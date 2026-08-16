import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import type { QueryFilter } from "../types/query-tool-types";

type MockDocSnapshot = { id: string; data: () => Record<string, unknown> };

const mockGetDocs = jest.fn<any, any>();
const mockCollection = jest.fn((..._args: unknown[]) => ({ mocked: "collection" }));
const mockWhere = jest.fn((...args: unknown[]) => ({ mocked: "where", args }));
const mockQuery = jest.fn((...args: unknown[]) => ({ mocked: "query", args }));

jest.mock("../auth/firebaseConfig", () => ({ db: {} }));

jest.mock("../config/dataSources", () => ({
  __esModule: true,
  default: {
    firebase: {
      clientsCollection: "client-profile2",
      calendarCollection: "events",
      clustersCollection: "clusters",
    },
  },
}));

const mockGetDoc = jest.fn(async (..._args: unknown[]) => ({
  exists: () => false as boolean,
  data: () => ({} as Record<string, unknown>),
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  doc: (..._args: unknown[]) => ({ mocked: "doc" }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  Timestamp: {
    fromDate: (date: Date) => ({ mocked: "timestamp", date }),
  },
}));

jest.mock("../utils/lastDeliveryDate", () => ({
  batchGetClientDeliverySummaries: async () => new Map(),
}));

const mockMapClientDocToSpreadsheetBaseRow = (id: string, raw: any) => ({
  id,
  uid: id,
  firstName: raw.firstName ?? "",
  lastName: raw.lastName ?? "",
  ward: raw.ward ?? "",
  zipCode: raw.zipCode ?? "",
  tags: raw.tags ?? [],
  deliveryFreq: raw.deliveryFreq ?? "",
  activeStatus: Boolean(raw.activeStatus),
});
jest.mock("./client-service", () => ({
  mapClientDocToSpreadsheetBaseRow: (id: string, raw: any) =>
    mockMapClientDocToSpreadsheetBaseRow(id, raw),
}));

import {
  buildFirestoreConstraints,
  getComputedFilters,
  getFirestoreFilters,
  runClientQuery,
} from "./client-query-service";

const makeFilter = (field: string, operator: string, value: unknown): QueryFilter => ({
  id: field,
  field,
  operator: operator as QueryFilter["operator"],
  value,
});

const createSnapshot = (docs: MockDocSnapshot[]) => ({ docs });

describe("client-query-service", () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockCollection.mockClear();
    mockWhere.mockClear();
    mockQuery.mockClear();
    mockGetDoc.mockReset();
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  });

  it("builds an activeStatus == true constraint client-side (computed field, not sent to Firestore)", () => {
    const filters = [makeFilter("activeStatus", "==", true)];
    expect(getFirestoreFilters("clients", filters)).toHaveLength(0);
    expect(getComputedFilters("clients", filters)).toHaveLength(1);
    expect(buildFirestoreConstraints("clients", filters)).toHaveLength(0);
  });

  it("applies a ward == value filter client-side to normalize stored formats", () => {
    const filters = [makeFilter("ward", "==", "Ward 3")];
    buildFirestoreConstraints("clients", filters);
    expect(getFirestoreFilters("clients", filters)).toHaveLength(0);
    expect(getComputedFilters("clients", filters)).toHaveLength(1);
  });

  it("builds a tags array-contains constraint", () => {
    const filters = [makeFilter("tags", "array-contains", "Halal")];
    buildFirestoreConstraints("clients", filters);
    expect(mockWhere).toHaveBeenCalledWith("tags", "array-contains", "Halal");
  });

  it("builds a total >= constraint", () => {
    const filters = [makeFilter("total", ">=", 3)];
    buildFirestoreConstraints("clients", filters);
    expect(mockWhere).toHaveBeenCalledWith("total", ">=", 3);
  });

  it("converts a numeric option value to a number before querying Firestore", () => {
    const filters = [makeFilter("total", "==", "4")];
    buildFirestoreConstraints("clients", filters);
    expect(mockWhere).toHaveBeenCalledWith("total", "==", 4);
  });

  it("converts a date-only updatedAt filter into a start-of-day Firestore Timestamp", () => {
    const filters = [makeFilter("updatedAt", ">=", "2024-01-01")];
    buildFirestoreConstraints("clients", filters);
    expect(mockWhere).toHaveBeenCalledWith(
      "updatedAt",
      ">=",
      expect.objectContaining({
        mocked: "timestamp",
        date: new Date(2024, 0, 1, 0, 0, 0, 0),
      })
    );
  });

  it("expands an == timestamp filter into a whole-day range instead of an exact instant", () => {
    const filters = [makeFilter("updatedAt", "==", "2024-01-01")];
    buildFirestoreConstraints("clients", filters);
    expect(mockWhere).toHaveBeenCalledWith(
      "updatedAt",
      ">=",
      expect.objectContaining({ date: new Date(2024, 0, 1, 0, 0, 0, 0) })
    );
    expect(mockWhere).toHaveBeenCalledWith(
      "updatedAt",
      "<",
      expect.objectContaining({ date: new Date(2024, 0, 2, 0, 0, 0, 0) })
    );
    expect(mockWhere).toHaveBeenCalledTimes(2);
  });

  it("combines multiple compatible filters into separate where clauses", () => {
    const filters = [makeFilter("ward", "==", "Ward 3"), makeFilter("tefapCert", "==", true)];
    buildFirestoreConstraints("clients", filters);
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });

  it("does not cap the number of results returned", async () => {
    mockGetDocs.mockResolvedValue(createSnapshot([]));
    await runClientQuery("clients", [makeFilter("ward", "==", "Ward 3")]);
    expect(mockQuery).toHaveBeenCalled();
    const queryArgs = mockQuery.mock.calls[0];
    expect(queryArgs.some((arg: any) => arg?.mocked === "limit")).toBe(false);
  });

  it("applies the computed activeStatus filter to already-fetched rows", async () => {
    mockGetDocs.mockResolvedValue(
      createSnapshot([
        { id: "a", data: () => ({ firstName: "Active", activeStatus: true }) },
        { id: "b", data: () => ({ firstName: "Inactive", activeStatus: false }) },
      ])
    );
    const result = await runClientQuery("clients", [makeFilter("activeStatus", "==", true)]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].firstName).toBe("Active");
  });

  it("preserves every allowlisted client field needed by results and exports", async () => {
    const updatedAt = { seconds: 1786752000, nanoseconds: 0 };
    mockGetDocs.mockResolvedValue(
      createSnapshot([
        {
          id: "client-1",
          data: () => ({
            firstName: "Ada",
            city: "Washington",
            state: "DC",
            quadrant: "NW",
            recurrence: "Monthly",
            total: 4,
            seniors: 1,
            updatedAt,
          }),
        },
      ])
    );

    const result = await runClientQuery("clients", [
      makeFilter("city", "==", "Washington"),
    ]);

    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        city: "Washington",
        state: "DC",
        quadrant: "NW",
        recurrence: "Monthly",
        total: 4,
        seniors: 1,
        updatedAt,
      })
    );
  });

  it("treats deliveries without a status as Scheduled", async () => {
    const filters = [makeFilter("deliveryStatus", "==", "Scheduled")];
    mockGetDocs.mockResolvedValue(
      createSnapshot([
        { id: "normal", data: () => ({ clientName: "Normal delivery" }) },
        {
          id: "restored",
          data: () => ({ clientName: "Restored delivery", deliveryStatus: "Scheduled" }),
        },
        {
          id: "missed",
          data: () => ({ clientName: "Missed delivery", deliveryStatus: "Missed" }),
        },
      ])
    );

    expect(getFirestoreFilters("deliveries", filters)).toHaveLength(0);
    const result = await runClientQuery("deliveries", filters);

    expect(result.rows.map((row) => row.id)).toEqual(["normal", "restored"]);
  });

  it("joins deliveries to the related client and adds joined columns", async () => {
    mockGetDocs.mockResolvedValue(
      createSnapshot([{ id: "evt-1", data: () => ({ clientId: "client-1", clientName: "Jane Doe" }) }])
    );
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ ward: "Ward 3", zipCode: "20001", tags: ["Halal"] }),
    });

    const result = await runClientQuery("deliveries", [
      makeFilter("clientName", "==", "Jane Doe"),
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]["join.ward"]).toBe("Ward 3");
    expect(result.rows[0]["join.zipCode"]).toBe("20001");
    expect(result.rows[0]["join.tags"]).toEqual(["Halal"]);
  });

  it("only enriches a route from the matching delivery date", async () => {
    mockGetDocs
      .mockResolvedValueOnce(
        createSnapshot([
          {
            id: "evt-1",
            data: () => ({
              clientId: "client-1",
              clientName: "Jane Doe",
              deliveryDate: new Date("2026-08-15T12:00:00Z"),
            }),
          },
        ])
      )
      .mockResolvedValueOnce(
        createSnapshot([
          {
            id: "same-day",
            data: () => ({
              date: { toDate: () => new Date("2026-08-15T12:00:00Z") },
              clusters: [{ id: "1", deliveries: ["another-client"] }],
            }),
          },
          {
            id: "previous-day",
            data: () => ({
              date: { toDate: () => new Date("2026-08-14T12:00:00Z") },
              clusters: [{ id: "9", deliveries: ["client-1"], driver: "Wrong Driver", time: "3" }],
            }),
          },
        ])
      );

    const result = await runClientQuery("deliveries", [
      makeFilter("deliveryDate", "==", "2026-08-15"),
    ]);

    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        cluster: undefined,
        assignedDriverName: undefined,
        time: undefined,
      })
    );
  });

  it("applies a driver filter after route assignments are enriched", async () => {
    const filters = [makeFilter("assignedDriverName", "==", "DoorDash")];
    expect(getFirestoreFilters("deliveries", filters)).toHaveLength(0);
    expect(getComputedFilters("deliveries", filters)).toHaveLength(1);

    mockGetDocs
      .mockResolvedValueOnce(
        createSnapshot([
          {
            id: "evt-1",
            data: () => ({
              clientId: "client-1",
              clientName: "Jane Doe",
              deliveryDate: new Date("2026-08-15T12:00:00Z"),
            }),
          },
        ])
      )
      .mockResolvedValueOnce(
        createSnapshot([
          {
            id: "same-day",
            data: () => ({
              date: { toDate: () => new Date("2026-08-15T12:00:00Z") },
              clusters: [{ id: "2", deliveries: ["client-1"], driver: "DoorDash" }],
            }),
          },
        ])
      );

    const result = await runClientQuery("deliveries", filters);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].assignedDriverName).toBe("DoorDash");
  });

  it("throws a friendly error when Firestore reports a missing index", async () => {
    mockGetDocs.mockRejectedValue(
      Object.assign(new Error("The query requires an index. https://console..."), {
        code: "failed-precondition",
      })
    );
    await expect(
      runClientQuery("clients", [makeFilter("ward", "==", "Ward 3")])
    ).rejects.toThrow(/additional database index/);
  });
});
