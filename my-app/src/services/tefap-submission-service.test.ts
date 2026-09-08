import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { TefapSubmission } from "../types/tefap-types";

const mockAddDoc = jest.fn<any, any>();
const mockGetDocs = jest.fn<any, any>();
const mockWhere = jest.fn((...args: unknown[]) => ({ mocked: "where", args }));
const mockOrderBy = jest.fn((...args: unknown[]) => ({ mocked: "orderBy", args }));

jest.mock("../auth/firebaseConfig", () => ({ db: {} }));

jest.mock("../config/dataSources", () => ({
  __esModule: true,
  default: {
    firebase: { tefapSubmissionsCollection: "tefapSubmissions" },
    storage: { tefapFormsPath: "tefap-forms" },
  },
}));

jest.mock("firebase/firestore", () => ({
  collection: (..._args: unknown[]) => ({ mocked: "collection" }),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => ({ mocked: "query", args }),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  serverTimestamp: () => ({ mocked: "serverTimestamp" }),
  Timestamp: class MockTimestamp {
    static fromDate(date: Date) {
      return { mocked: "timestamp", date };
    }
  },
}));

import {
  defaultCertExpiry,
  keepLatestPerClient,
  tefapSubmissionService,
} from "./tefap-submission-service";

const actor = { uid: "u1", name: "Casey", email: "casey@example.org" };

const snapshotOf = (docs: Array<{ id: string; data: Record<string, unknown> }>) => ({
  docs: docs.map((entry) => ({ id: entry.id, data: () => entry.data })),
});

const submission = (over: Partial<TefapSubmission> = {}): TefapSubmission =>
  ({
    id: "s1",
    clientId: "c1",
    clientName: "Jane Doe",
    formId: "f1",
    formName: "FY26",
    formVersion: 1,
    values: [],
    submittedAt: new Date("2026-01-01"),
    submittedBy: actor,
    ...over,
  }) as TefapSubmission;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDocs.mockResolvedValue(snapshotOf([]));
});

describe("defaultCertExpiry", () => {
  it("adds the template's validity window to the submission date", () => {
    expect(defaultCertExpiry(12, new Date("2026-03-15T12:00:00Z"))).toBe("2027-03-15");
  });

  it("supports windows shorter than a year", () => {
    expect(defaultCertExpiry(6, new Date("2026-01-31T12:00:00Z"))).toBe("2026-07-31");
  });
});

describe("keepLatestPerClient", () => {
  it("keeps only the first entry per client, given newest-first input", () => {
    const rows = [
      submission({ id: "new", clientId: "c1" }),
      submission({ id: "old", clientId: "c1" }),
      submission({ id: "other", clientId: "c2" }),
    ];

    expect(keepLatestPerClient(rows).map((entry) => entry.id)).toEqual(["new", "other"]);
  });

  it("returns an empty list unchanged", () => {
    expect(keepLatestPerClient([])).toEqual([]);
  });
});

describe("createSubmission", () => {
  it("rejects a submission with no client", async () => {
    await expect(
      tefapSubmissionService.createSubmission(
        { clientId: "", clientName: "", form: { id: "f1", name: "FY26", version: 1 }, values: [] },
        actor
      )
    ).rejects.toThrow("A TEFAP form must be attached to a client.");
  });

  it("rejects a submission with no form", async () => {
    await expect(
      tefapSubmissionService.createSubmission(
        { clientId: "c1", clientName: "Jane", form: { id: "", name: "", version: 1 }, values: [] },
        actor
      )
    ).rejects.toThrow("Choose a TEFAP form before saving.");
  });

  it("denormalizes the form and client onto the record", async () => {
    mockAddDoc.mockResolvedValue({ id: "s99" });

    const created = await tefapSubmissionService.createSubmission(
      {
        clientId: "c1",
        clientName: "Jane Doe",
        form: { id: "f1", name: "FY26 Income Certification", version: 2 },
        values: [{ field: "name", value: "Jane Doe" }],
        certExpiresOn: "2027-01-01",
      },
      actor
    );

    const written = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(written.formName).toBe("FY26 Income Certification");
    expect(written.formVersion).toBe(2);
    expect(written.clientName).toBe("Jane Doe");
    expect(written.submittedBy).toEqual(actor);
    expect(created.id).toBe("s99");
  });

  it("omits supersedesId unless the submission corrects another", async () => {
    mockAddDoc.mockResolvedValue({ id: "s1" });

    await tefapSubmissionService.createSubmission(
      { clientId: "c1", clientName: "Jane", form: { id: "f1", name: "F", version: 1 }, values: [] },
      actor
    );

    expect(mockAddDoc.mock.calls[0][1]).not.toHaveProperty("supersedesId");
  });

  it("records supersedesId when correcting an earlier submission", async () => {
    mockAddDoc.mockResolvedValue({ id: "s2" });

    await tefapSubmissionService.createSubmission(
      {
        clientId: "c1",
        clientName: "Jane",
        form: { id: "f1", name: "F", version: 1 },
        values: [],
        supersedesId: "s1",
      },
      actor
    );

    expect(mockAddDoc.mock.calls[0][1]).toHaveProperty("supersedesId", "s1");
  });
});

describe("listSubmissions", () => {
  it("queries by formId when one is given", async () => {
    await tefapSubmissionService.listSubmissions({ formId: "f1" });

    expect(mockWhere).toHaveBeenCalledWith("formId", "==", "f1");
  });

  // Firestore would need a separate composite index for every combination of
  // equalities, so only one goes to the server and the rest is filtered here.
  it("sends only one equality to Firestore and filters the other in memory", async () => {
    mockGetDocs.mockResolvedValue(
      snapshotOf([
        { id: "a", data: { clientId: "c1", formId: "f1" } },
        { id: "b", data: { clientId: "c2", formId: "f1" } },
      ])
    );

    const result = await tefapSubmissionService.listSubmissions({
      formId: "f1",
      clientId: "c1",
    });

    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(result.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("bounds an inclusive end date by the start of the next day", async () => {
    await tefapSubmissionService.listSubmissions({ to: "2026-09-30" });

    const bound = mockWhere.mock.calls.find((call) => call[1] === "<");
    expect(bound).toBeDefined();
    const { date } = bound?.[2] as { date: Date };
    expect(date.getTime()).toBeGreaterThan(new Date("2026-09-30T00:00:00Z").getTime());
  });

  // tryToJSDate normalises to Eastern midday, so bounding on it directly drops
  // every submission made in the morning of the start date - silently, and with
  // no count discrepancy to notice.
  it("bounds an inclusive start date by the start of that day", async () => {
    await tefapSubmissionService.listSubmissions({ from: "2026-09-30" });

    const bound = mockWhere.mock.calls.find((call) => call[1] === ">=");
    expect(bound).toBeDefined();
    const { date } = bound?.[2] as { date: Date };

    // 2026-09-30T00:00 Eastern is 04:00 UTC; midday would be 16:00 UTC.
    expect(date.getTime()).toBeLessThan(new Date("2026-09-30T05:00:00Z").getTime());
    expect(date.getTime()).toBeGreaterThanOrEqual(new Date("2026-09-30T00:00:00Z").getTime());
  });

  it("always orders newest first", async () => {
    await tefapSubmissionService.listSubmissions({});

    expect(mockOrderBy).toHaveBeenCalledWith("submittedAt", "desc");
  });

  it("collapses to the latest per client when asked", async () => {
    mockGetDocs.mockResolvedValue(
      snapshotOf([
        { id: "new", data: { clientId: "c1" } },
        { id: "old", data: { clientId: "c1" } },
      ])
    );

    const result = await tefapSubmissionService.listSubmissions({ latestPerClient: true });

    expect(result.map((entry) => entry.id)).toEqual(["new"]);
  });

  it("defaults missing fields so a partial record still maps", async () => {
    mockGetDocs.mockResolvedValue(snapshotOf([{ id: "s1", data: {} }]));

    const [only] = await tefapSubmissionService.listSubmissions({});

    expect(only.values).toEqual([]);
    expect(only.formVersion).toBe(1);
    expect(only.certExpiresOn).toBeUndefined();
  });

  it("wraps a Firestore failure in a friendly message", async () => {
    mockGetDocs.mockRejectedValue(new Error("index missing"));

    await expect(tefapSubmissionService.listSubmissions({})).rejects.toThrow(
      "Failed to load TEFAP submissions."
    );
  });
});
