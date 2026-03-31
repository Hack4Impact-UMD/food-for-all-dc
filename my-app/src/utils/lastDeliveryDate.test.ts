import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGetDocs = jest.fn();
const mockCollection = jest.fn(() => ({ mocked: "collection" }));
const mockWhere = jest.fn((...args: unknown[]) => ({ mocked: "where", args }));
const mockOrderBy = jest.fn((...args: unknown[]) => ({ mocked: "orderBy", args }));
const mockQuery = jest.fn((...args: unknown[]) => ({ mocked: "query", args }));

jest.mock("../auth/firebaseConfig", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  Timestamp: class MockTimestamp {
    private readonly value: Date;

    constructor(date: Date) {
      this.value = date;
    }

    toDate(): Date {
      return this.value;
    }

    static fromDate(date: Date): MockTimestamp {
      return new MockTimestamp(date);
    }
  },
}));

import { batchGetClientDeliverySummaries } from "./lastDeliveryDate";

type EventRow = {
  clientId: string;
  deliveryDate?: string;
  deliveryStatus?: string;
};

const makeSnapshot = (rows: EventRow[]) => ({
  forEach: (callback: (doc: { id: string; data: () => EventRow }) => void) => {
    rows.forEach((row, index) => {
      callback({
        id: `doc-${index}`,
        data: () => row,
      });
    });
  },
});

describe("batchGetClientDeliverySummaries", () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockCollection.mockClear();
    mockWhere.mockClear();
    mockOrderBy.mockClear();
    mockQuery.mockClear();
  });

  // App coverage:
  // - profile and delivery grids call this summary fetch for many clients at once
  // - firestore "in" queries must be chunked to stay within platform limits
  // Behavior contract: >10 unique clients should query in deterministic 10-item chunks.
  it("chunks large client lists into firestore-safe in queries", async () => {
    const uniqueClientIds = Array.from({ length: 12 }, (_, index) => `client-${index + 1}`);

    mockGetDocs
      .mockResolvedValueOnce(makeSnapshot([]))
      .mockResolvedValueOnce(makeSnapshot([]));

    await batchGetClientDeliverySummaries([...uniqueClientIds, "client-1", ""]);

    const inClauses = mockWhere.mock.calls
      .filter(([field, operator]) => field === "clientId" && operator === "in")
      .map(([, , values]) => values);

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(inClauses).toHaveLength(2);
    expect(inClauses[0]).toEqual(uniqueClientIds.slice(0, 10));
    expect(inClauses[1]).toEqual(uniqueClientIds.slice(10));
  });

  // App coverage:
  // - delivery history displays rely on the summary map's lastDeliveryDate
  // - mixed event ordering from firestore should still pick the true newest date
  // Behavior contract: each client summary keeps the maximum deliveryDate seen.
  it("selects the latest delivery date per client", async () => {
    mockGetDocs.mockResolvedValueOnce(
      makeSnapshot([
        { clientId: "client-1", deliveryDate: "2026-01-03", deliveryStatus: "Delivered" },
        { clientId: "client-1", deliveryDate: "2026-01-10", deliveryStatus: "Delivered" },
        { clientId: "client-2", deliveryDate: "2026-02-01", deliveryStatus: "Missed" },
        { clientId: "client-2", deliveryDate: "2026-01-15", deliveryStatus: "Delivered" },
      ])
    );

    const summaryMap = await batchGetClientDeliverySummaries(["client-1", "client-2"]);

    expect(summaryMap.get("client-1")).toEqual({
      lastDeliveryDate: "2026-01-10",
      missedStrikeCount: 0,
    });
    expect(summaryMap.get("client-2")).toEqual({
      lastDeliveryDate: "2026-02-01",
      missedStrikeCount: 1,
    });
  });

  // App coverage:
  // - profile status logic consumes missed strike totals from this summary response
  // - missed events can be interleaved with delivered events for the same client
  // Behavior contract: every "Missed" event increments the per-client strike counter.
  it("aggregates missed strike counts per client", async () => {
    mockGetDocs.mockResolvedValueOnce(
      makeSnapshot([
        { clientId: "client-1", deliveryDate: "2026-03-01", deliveryStatus: "Missed" },
        { clientId: "client-1", deliveryDate: "2026-03-05", deliveryStatus: "Delivered" },
        { clientId: "client-1", deliveryDate: "2026-03-08", deliveryStatus: "Missed" },
        { clientId: "client-2", deliveryDate: "2026-03-09", deliveryStatus: "Missed" },
      ])
    );

    const summaryMap = await batchGetClientDeliverySummaries(["client-1", "client-2"]);

    expect(summaryMap.get("client-1")?.missedStrikeCount).toBe(2);
    expect(summaryMap.get("client-2")?.missedStrikeCount).toBe(1);
  });
});
