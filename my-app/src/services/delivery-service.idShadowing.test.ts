import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

type MockDocData = Record<string, unknown>;
type MockDocSnapshot = {
  id: string;
  data: () => MockDocData;
};
type MockGetDocsResult = {
  docs: MockDocSnapshot[];
};

const mockGetDocs = jest.fn<Promise<MockGetDocsResult>, []>();
const mockCollection = jest.fn(() => ({ mocked: "collection" }));
const mockWhere = jest.fn((...args: unknown[]) => ({ mocked: "where", args }));
const mockOrderBy = jest.fn((...args: unknown[]) => ({ mocked: "orderBy", args }));
const mockQuery = jest.fn((...args: unknown[]) => ({ mocked: "query", args }));

jest.mock("../auth/firebaseConfig", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: () => mockCollection(),
  doc: (..._args: unknown[]) => ({ id: "mock-doc-ref" }),
  getDoc: () => Promise.resolve(undefined),
  getDocs: () => mockGetDocs(),
  setDoc: () => Promise.resolve(undefined),
  updateDoc: () => Promise.resolve(undefined),
  deleteDoc: () => Promise.resolve(undefined),
  writeBatch: () => ({
    delete: () => undefined,
    update: () => undefined,
    set: () => undefined,
    commit: () => Promise.resolve(undefined),
  }),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: () => ({}),
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

import DeliveryService from "./delivery-service";

const createDocSnapshot = (id: string, data: MockDocData): MockDocSnapshot => ({
  id,
  data: () => data,
});

describe("DeliveryService.getEventsByDateRange id source", () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockCollection.mockClear();
    mockWhere.mockClear();
    mockOrderBy.mockClear();
    mockQuery.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // App coverage:
  // - Day Calendar list rendering in `src/pages/Calendar/components/DayView.tsx` uses `key={event.id}`
  // - If fetched events reuse payload ids instead of Firestore document ids, duplicate keys can hide cards
  // Behavior contract: fetched event ids should come from Firestore document ids, not a stored payload `id` field.
  it("prefers Firestore document ids over payload id fields", async () => {
    const service = DeliveryService.getInstance();

    // Two distinct docs that accidentally share a stale payload `id`.
    // This reproduces the scenario where one card can disappear while counts stay correct.
    mockGetDocs.mockResolvedValue({
      docs: [
        createDocSnapshot("doc-a", {
          id: "legacy-shared-id",
          clientId: "client-a",
          deliveryDate: {
            toDate: () => new Date("2026-04-24T12:00:00.000Z"),
          },
        }),
        createDocSnapshot("doc-b", {
          id: "legacy-shared-id",
          clientId: "client-b",
          deliveryDate: {
            toDate: () => new Date("2026-04-24T13:00:00.000Z"),
          },
        }),
      ],
    });

    const events = await service.getEventsByDateRange(
      new Date("2026-04-24T00:00:00.000Z"),
      new Date("2026-04-25T00:00:00.000Z")
    );

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.id)).toEqual(["doc-a", "doc-b"]);
  });
});
