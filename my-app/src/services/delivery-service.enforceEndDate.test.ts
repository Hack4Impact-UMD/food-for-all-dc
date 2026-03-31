import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGetDocs = jest.fn();
const mockCollection = jest.fn(() => ({ mocked: "collection" }));
const mockWhere = jest.fn((...args: unknown[]) => ({ mocked: "where", args }));
const mockQuery = jest.fn((...args: unknown[]) => ({ mocked: "query", args }));
const mockWriteBatch = jest.fn();

jest.mock("../auth/firebaseConfig", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: () => ({}),
  getDoc: () => Promise.resolve(undefined),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: () => Promise.resolve(undefined),
  updateDoc: () => Promise.resolve(undefined),
  deleteDoc: () => Promise.resolve(undefined),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: () => ({}),
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

const makeDocSnapshot = (
  id: string,
  data: Record<string, unknown>
): {
  id: string;
  ref: Record<string, unknown>;
  data: () => Record<string, unknown>;
} => ({
  id,
  ref: { id },
  data: () => data,
});

describe("DeliveryService.enforceClientEndDate", () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockCollection.mockClear();
    mockWhere.mockClear();
    mockQuery.mockClear();
    mockWriteBatch.mockReset();

    mockWriteBatch.mockImplementation(() => ({
      delete: jest.fn(),
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // App coverage:
  // - profile end-date updates that prune future deliveries in `src/pages/Profile/Profile.tsx`
  // - downstream route invalidation/event notifications for deleted future deliveries
  // Behavior contract: deliveries after new end date are deleted, cluster reconciliation runs,
  // and a `schedule-batch-deleted` change event is emitted with deleted date keys.
  it("deletes future deliveries beyond end date and emits delete change event", async () => {
    const service = DeliveryService.getInstance() as any;

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [
        makeDocSnapshot("evt-delete", {
          clientId: "client-1",
          deliveryDate: "2099-01-20",
          recurrence: "None",
        }),
        makeDocSnapshot("evt-keep", {
          clientId: "client-1",
          deliveryDate: "2099-01-10",
          recurrence: "None",
        }),
      ],
    });

    const reconcileSpy = jest
      .spyOn(service, "reconcileClusterAssignmentsForDateKeys")
      .mockResolvedValue({
        impactedDateKeys: ["2099-01-20"],
        reviewRequiredDateKeys: [],
        failedDateKeys: [],
      });
    const invalidateRecurringCacheSpy = jest
      .spyOn(service, "invalidateRecurringCache")
      .mockImplementation(() => {});
    const emitSpy = jest.spyOn(service, "emitDeliveryChange").mockImplementation(() => {});

    await service.enforceClientEndDate("client-1", "2099-01-10");

    const batch = mockWriteBatch.mock.results[0].value as {
      delete: jest.Mock;
      update: jest.Mock;
      commit: jest.Mock;
    };

    expect(batch.delete).toHaveBeenCalledTimes(1);
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(invalidateRecurringCacheSpy).toHaveBeenCalledTimes(1);
    expect(reconcileSpy).toHaveBeenCalledWith(["2099-01-20"]);
    expect(emitSpy).toHaveBeenCalledWith(
      "schedule-batch-deleted",
      ["2099-01-20"],
      expect.objectContaining({ impactedDateKeys: ["2099-01-20"] })
    );
  });

  // App coverage:
  // - recurring schedule trimming when profile end date moves earlier
  // - update notifications consumed by calendar/profile listeners
  // Behavior contract: recurring events at/before end date get `repeatsEndDate` updated,
  // and a `schedule-batch-updated` event is emitted when no deletions occur.
  it("updates repeatsEndDate for recurring events and emits update change event", async () => {
    const service = DeliveryService.getInstance() as any;

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [
        makeDocSnapshot("evt-recurring", {
          clientId: "client-1",
          deliveryDate: "2099-01-05",
          recurrence: "Weekly",
          repeatsEndDate: "2099-03-01",
        }),
        makeDocSnapshot("evt-custom", {
          clientId: "client-1",
          deliveryDate: "2099-01-05",
          recurrence: "Custom",
        }),
      ],
    });

    const reconcileSpy = jest.spyOn(service, "reconcileClusterAssignmentsForDateKeys");
    const emitSpy = jest.spyOn(service, "emitDeliveryChange").mockImplementation(() => {});

    await service.enforceClientEndDate("client-1", "2099-01-10");

    const batch = mockWriteBatch.mock.results[0].value as {
      delete: jest.Mock;
      update: jest.Mock;
      commit: jest.Mock;
    };

    expect(batch.delete).not.toHaveBeenCalled();
    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt-recurring" }),
      { repeatsEndDate: "2099-01-10" }
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(reconcileSpy).not.toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith(
      "schedule-batch-updated",
      ["2099-01-05"],
      {
        impactedDateKeys: ["2099-01-05"],
        reviewRequiredDateKeys: [],
        failedDateKeys: [],
      }
    );
  });

  // App coverage:
  // - guard path for profile edits when end date stays the same or extends further out
  // - prevents unnecessary firestore reads/writes when no enforcement is needed
  // Behavior contract: if new end date is not earlier than previous end date, method exits early.
  it("returns early when new end date is not earlier than previous end date", async () => {
    const service = DeliveryService.getInstance() as any;

    await service.enforceClientEndDate("client-1", "2099-02-01", "2099-01-01");

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });
});
