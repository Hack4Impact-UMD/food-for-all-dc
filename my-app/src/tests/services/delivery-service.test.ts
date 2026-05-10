import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import DeliveryService from "../../services/delivery-service";
import { NewDelivery } from "../../types/calendar-types";

jest.mock("../../auth/firebaseConfig", () => ({
  db: {},
}));

const createNewDelivery = (overrides: Partial<NewDelivery> = {}): NewDelivery => ({
  clientId: "client-1",
  clientName: "Client One",
  deliveryDate: "2026-03-30",
  recurrence: "Custom",
  customDates: ["2026-03-30"],
  ...overrides,
});

const createDeliveryEvent = (overrides: Record<string, unknown> = {}) => ({
  id: "evt-1",
  clientId: "client-1",
  clientName: "Client One",
  assignedDriverId: "",
  assignedDriverName: "",
  deliveryDate: "2026-03-30",
  time: "",
  cluster: 0,
  recurrence: "Weekly",
  recurrenceId: "series-1",
  ...overrides,
});

describe("DeliveryService.scheduleClientDeliveries", () => {
  beforeEach(() => {
    const globalAny = global as any;
    if (!globalAny.crypto) {
      Object.defineProperty(globalAny, "crypto", {
        value: {},
        configurable: true,
      });
    }

    if (typeof globalAny.crypto.randomUUID !== "function") {
      globalAny.crypto.randomUUID = jest.fn(() => "test-recurrence-id");
    } else {
      jest.spyOn(globalAny.crypto, "randomUUID").mockReturnValue("test-recurrence-id");
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Guards add-flow idempotency: if every requested date already exists,
  // scheduling should be a no-op and must not trigger any write path.
  it("does nothing when all requested dates already exist", async () => {
    const service = DeliveryService.getInstance() as any;

    jest.spyOn(service, "calculateDeliveryDateKeys").mockReturnValue(["2026-03-30"]);
    jest.spyOn(service, "getEventsByClientId").mockResolvedValue([
      { id: "evt-1", deliveryDate: "2026-03-30" },
    ]);
    const createEventsInternalSpy = jest
      .spyOn(service, "createEventsInternal")
      .mockResolvedValue([]);
    const writeBatchDeleteAndCreateSpy = jest
      .spyOn(service, "writeBatchDeleteAndCreate")
      .mockResolvedValue(undefined);

    await service.scheduleClientDeliveries(createNewDelivery());

    expect(createEventsInternalSpy).not.toHaveBeenCalled();
    expect(writeBatchDeleteAndCreateSpy).not.toHaveBeenCalled();
  });

  // Verifies additive behavior for mixed requests: existing dates are preserved,
  // and only truly new dates are materialized.
  it("adds only missing dates when requested dates include existing ones", async () => {
    const service = DeliveryService.getInstance() as any;

    jest
      .spyOn(service, "calculateDeliveryDateKeys")
      .mockReturnValue(["2026-03-30", "2026-04-06"]);
    jest.spyOn(service, "getEventsByClientId").mockResolvedValue([
      { id: "evt-1", deliveryDate: "2026-03-30" },
    ]);
    const createEventsInternalSpy = jest
      .spyOn(service, "createEventsInternal")
      .mockResolvedValue([]);
    const writeBatchDeleteAndCreateSpy = jest
      .spyOn(service, "writeBatchDeleteAndCreate")
      .mockResolvedValue(undefined);

    await service.scheduleClientDeliveries(
      createNewDelivery({
        customDates: ["2026-03-30", "2026-04-06"],
      })
    );

    expect(createEventsInternalSpy).toHaveBeenCalledTimes(1);
    const [eventsToCreate, reason] = createEventsInternalSpy.mock.calls[0] as [
      Array<{ deliveryDate: string }>,
      string,
    ];
    expect(eventsToCreate).toHaveLength(1);
    expect(eventsToCreate[0].deliveryDate).toBe("2026-04-06");
    expect(reason).toBe("schedule-created");
    expect(writeBatchDeleteAndCreateSpy).not.toHaveBeenCalled();
  });

  // Regression guard against destructive rewrites: weekly scheduling should create
  // batched new events only and never enter delete-and-recreate replacement logic.
  it("never uses destructive replacement path when creating multiple new dates", async () => {
    const service = DeliveryService.getInstance() as any;

    jest
      .spyOn(service, "calculateDeliveryDateKeys")
      .mockReturnValue(["2026-03-30", "2026-04-06", "2026-04-13"]);
    jest.spyOn(service, "getEventsByClientId").mockResolvedValue([]);
    const createEventsInternalSpy = jest
      .spyOn(service, "createEventsInternal")
      .mockResolvedValue([]);
    const writeBatchDeleteAndCreateSpy = jest
      .spyOn(service, "writeBatchDeleteAndCreate")
      .mockResolvedValue(undefined);

    await service.scheduleClientDeliveries(
      createNewDelivery({
        recurrence: "Weekly",
      })
    );

    expect(createEventsInternalSpy).toHaveBeenCalledTimes(1);
    const [eventsToCreate, reason] = createEventsInternalSpy.mock.calls[0] as [
      Array<{ deliveryDate: string }>,
      string,
    ];
    expect(eventsToCreate).toHaveLength(3);
    expect(reason).toBe("schedule-created-batch");
    expect(writeBatchDeleteAndCreateSpy).not.toHaveBeenCalled();
  });
});

describe("DeliveryService.calculateDeliveryDateKeys", () => {
  // App coverage:
  // - date-key generation used by `scheduleClientDeliveries` in `src/services/delivery-service.ts`
  // - protects add-flow from duplicate/unsorted custom date submissions
  // Behavior contract: custom recurrence returns unique, valid, sorted ISO date keys.
  it("normalizes custom dates into unique sorted ISO keys", () => {
    const service = DeliveryService.getInstance() as any;

    const result = service.calculateDeliveryDateKeys({
      deliveryDate: "2026-03-30",
      recurrence: "Custom",
      customDates: ["2026-04-06", "2026-03-30", "2026-04-06", "invalid-date"],
    });

    expect(result).toEqual(["2026-03-30", "2026-04-06"]);
  });

  // App coverage:
  // - one-off scheduling path in `scheduleClientDeliveries`
  // - ensures non-recurring delivery creation writes exactly one date key
  // Behavior contract: recurrence "None" returns one normalized start date.
  it("returns a single normalized date key for one-off deliveries", () => {
    const service = DeliveryService.getInstance() as any;

    const result = service.calculateDeliveryDateKeys({
      deliveryDate: "2026-03-30T10:30:00.000Z",
      recurrence: "None",
    });

    expect(result).toEqual(["2026-03-30"]);
  });

  // App coverage:
  // - weekly recurrence expansion used by scheduling and recurrence edit flows
  // - guards recurrence cutoff logic so no dates are created past repeatsEndDate
  // Behavior contract: weekly expansion includes start date and stops at end date (inclusive).
  it("expands weekly recurrence through repeatsEndDate inclusive", () => {
    const service = DeliveryService.getInstance() as any;

    const result = service.calculateDeliveryDateKeys({
      deliveryDate: "2026-03-30",
      recurrence: "Weekly",
      repeatsEndDate: "2026-04-13",
    });

    expect(result).toEqual(["2026-03-30", "2026-04-06", "2026-04-13"]);
  });

  // App coverage:
  // - defensive validation path inside scheduling before recurrence expansion
  // - prevents invalid source dates from producing malformed writes
  // Behavior contract: invalid non-custom start date yields no date keys.
  it("returns an empty array when the non-custom start date is invalid", () => {
    const service = DeliveryService.getInstance() as any;

    const result = service.calculateDeliveryDateKeys({
      deliveryDate: "not-a-real-date",
      recurrence: "Weekly",
      repeatsEndDate: "2026-04-13",
    });

    expect(result).toEqual([]);
  });
});

describe("DeliveryService.reconcileClusterState", () => {
  // App coverage:
  // - cluster invalidation/reconciliation writes in `invalidateClustersForDates` (`src/services/delivery-service.ts`)
  // - protects route map/spreadsheet assignment integrity after delivery changes
  // Behavior contract: cluster deliveries are trimmed, filtered to active clients, and deduplicated
  // both within a cluster and across clusters, with empty clusters removed.
  it("reconciles cluster deliveries by trimming, filtering, and deduplicating client assignments", () => {
    const service = DeliveryService.getInstance() as any;

    const result = service.reconcileClusterState(
      {
        clusters: [
          {
            id: "A",
            deliveries: [" client-1 ", "client-1", "client-2", "ghost", 123],
          },
          {
            id: "B",
            deliveries: ["client-2", "client-3"],
          },
          {
            id: "C",
            deliveries: ["ghost"],
          },
          null,
        ],
        clientOverrides: [],
      },
      ["client-1", "client-2", "client-3"]
    );

    expect(result.clusters).toEqual([
      {
        id: "A",
        deliveries: ["client-1", "client-2"],
      },
      {
        id: "B",
        deliveries: ["client-3"],
      },
    ]);
    expect(result.reviewRequired).toBe(false);
    expect(result.changed).toBe(true);
  });

  // App coverage:
  // - override sanitization in cluster docs used by route assignment display/edit flows
  // - ensures only active client overrides with meaningful driver/time values persist
  // Behavior contract: trims strings, drops blank values, and filters overrides for inactive clients.
  it("normalizes and filters client overrides to valid active client entries", () => {
    const service = DeliveryService.getInstance() as any;

    const result = service.reconcileClusterState(
      {
        clusters: [],
        clientOverrides: [
          { clientId: " client-1 ", driver: "  Alice  ", time: "   " },
          { clientId: "client-1", driver: "", time: " 09:00 " },
          { clientId: "client-2", driver: "Bob", time: "10:00" },
          { clientId: "client-1", driver: " ", time: "  " },
          { foo: "bar" },
        ],
      },
      ["client-1"]
    );

    expect(result.clientOverrides).toEqual([
      { clientId: "client-1", driver: "Alice" },
      { clientId: "client-1", time: "09:00" },
    ]);
    expect(result.changed).toBe(true);
  });

  // App coverage:
  // - review-required signaling consumed by delivery change emitter downstream (`emitDeliveryChange`)
  // - surfaces dates needing manual route reassignment after cluster invalidation
  // Behavior contract: reviewRequired only triggers when prior assignments existed and active clients
  // remain unassigned after reconciliation.
  it("sets reviewRequired only when assignments existed and active clients are left unassigned", () => {
    const service = DeliveryService.getInstance() as any;

    const withAssignments = service.reconcileClusterState(
      {
        clusters: [{ id: "A", deliveries: ["client-1"] }],
        clientOverrides: [],
      },
      ["client-1", "client-2"]
    );

    const withoutAssignments = service.reconcileClusterState(
      {
        clusters: [],
        clientOverrides: [],
      },
      ["client-1", "client-2"]
    );

    expect(withAssignments.reviewRequired).toBe(true);
    expect(withoutAssignments.reviewRequired).toBe(false);
    expect(withoutAssignments.changed).toBe(false);
  });
});

describe("DeliveryService.resolveSeriesForEvent", () => {
  // App coverage:
  // - scoped mutation entry points (`deleteEventByScope`, `updateEventByScope`) in `src/services/delivery-service.ts`
  // - protects one-event edits/deletes from accidentally expanding into future-series operations
  // Behavior contract: `single` scope resolves to exactly the anchor event.
  it("returns only the anchor event for single scope", async () => {
    const service = DeliveryService.getInstance() as any;
    const anchorEvent = createDeliveryEvent({ id: "evt-anchor", deliveryDate: "2026-03-30" });

    jest.spyOn(service, "getEventOrThrow").mockResolvedValue(anchorEvent);

    const result = await service.resolveSeriesForEvent("evt-anchor", "single");

    expect(result.anchorEvent.id).toBe("evt-anchor");
    expect(result.scopedEvents.map((event: any) => event.id)).toEqual(["evt-anchor"]);
    expect(result.seriesEvents.map((event: any) => event.id)).toEqual(["evt-anchor"]);
    expect(result.summary.recurrenceId).toBe("series-1");
  });

  // App coverage:
  // - "this and following" mutation behavior in recurrence edit/delete paths
  // - ensures only anchor-and-future events are touched for recurring series operations
  // Behavior contract: `following` scope includes anchor event and events on later dates only.
  it("returns anchor-and-future events for following scope", async () => {
    const service = DeliveryService.getInstance() as any;
    const anchorEvent = createDeliveryEvent({ id: "evt-2", deliveryDate: "2026-04-06" });

    jest.spyOn(service, "getEventOrThrow").mockResolvedValue(anchorEvent);
    jest.spyOn(service, "getEventsForRecurrenceId").mockResolvedValue([
      createDeliveryEvent({ id: "evt-1", deliveryDate: "2026-03-30" }),
      createDeliveryEvent({ id: "evt-2", deliveryDate: "2026-04-06" }),
      createDeliveryEvent({ id: "evt-3", deliveryDate: "2026-04-13" }),
    ]);

    const result = await service.resolveSeriesForEvent("evt-2", "following");

    expect(result.seriesEvents.map((event: any) => event.id)).toEqual(["evt-1", "evt-2", "evt-3"]);
    expect(result.scopedEvents.map((event: any) => event.id)).toEqual(["evt-2", "evt-3"]);
    expect(result.scopedEvents.some((event: any) => event.id === "evt-2")).toBe(true);
  });

  // App coverage:
  // - recurring mutation safety checks that prevent writes against inconsistent series data
  // - surfaces repair-required state to callers when anchor cannot be found in derived scoped set
  // Behavior contract: inconsistent series resolution throws `ambiguous-series-repair-required`.
  it("throws repair-required error when anchor event is missing from scoped following events", async () => {
    const service = DeliveryService.getInstance() as any;
    const anchorEvent = createDeliveryEvent({ id: "evt-anchor", deliveryDate: "2026-04-06" });

    jest.spyOn(service, "getEventOrThrow").mockResolvedValue(anchorEvent);
    jest.spyOn(service, "getEventsForRecurrenceId").mockResolvedValue([
      createDeliveryEvent({ id: "evt-other", deliveryDate: "2026-04-13" }),
    ]);

    await expect(service.resolveSeriesForEvent("evt-anchor", "following")).rejects.toMatchObject({
      code: "ambiguous-series-repair-required",
    });
  });
});
