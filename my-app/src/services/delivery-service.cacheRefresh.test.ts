import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import DeliveryService from "./delivery-service";

const mockBatchSet = jest.fn<void, unknown[]>();
const mockBatchCommit = jest.fn<Promise<void>, []>();
const mockCollection = jest.fn<unknown, unknown[]>();
const mockDoc = jest.fn<unknown, unknown[]>();
const mockWriteBatch = jest.fn<unknown, unknown[]>();

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: async () => ({ exists: () => false, data: () => undefined }),
  getDocs: async () => ({ docs: [] }),
  setDoc: async () => undefined,
  updateDoc: async () => undefined,
  deleteDoc: async () => undefined,
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  query: (...args: unknown[]) => args,
  where: (...args: unknown[]) => args,
  orderBy: (...args: unknown[]) => args,
  limit: (...args: unknown[]) => args,
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

jest.mock("../auth/firebaseConfig", () => ({
  db: {},
}));

describe("DeliveryService post-commit cache refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockReturnValue({ path: "events" });
    mockDoc.mockReturnValue({ id: "event-1" });
    mockBatchCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      set: mockBatchSet,
      commit: mockBatchCommit,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps a committed create successful when only the secondary cache refresh fails", async () => {
    const service = DeliveryService.getInstance() as any;
    const reconcile = jest
      .spyOn(service, "reconcileClusterAssignmentsForDateKeys")
      .mockResolvedValue({
        impactedDateKeys: ["2026-01-15"],
        reviewRequiredDateKeys: [],
        failedDateKeys: [],
      });
    const emit = jest.spyOn(service, "emitDeliveryChange").mockImplementation(() => undefined);
    const refresh = jest
      .spyOn(service, "refreshLastDeliveryDatesForClients")
      .mockRejectedValue(new Error("secondary cache unavailable"));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      service.createEvent({ clientId: "client-1", deliveryDate: "2026-01-15" })
    ).resolves.toBe("event-1");

    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledWith(["2026-01-15"]);
    expect(emit).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledWith(["client-1"]);
    expect(consoleError).toHaveBeenCalledWith(
      "Delivery saved, but the client last-delivery cache refresh failed:",
      expect.any(Error)
    );
  });
});
