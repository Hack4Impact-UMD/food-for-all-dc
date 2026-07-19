import { DateTime } from "luxon";
import { describe, expect, it } from "@jest/globals";
import { enrichRouteClientStatuses } from "../../../../pages/Delivery/utils/routeClientStatus";

describe("enrichRouteClientStatuses", () => {
  it("derives active status and applies event-based missed delivery counts", () => {
    const clients = [
      {
        id: "active-client",
        startDate: DateTime.now().minus({ years: 1 }).toISODate(),
        endDate: DateTime.now().plus({ years: 1 }).toISODate(),
      },
      {
        id: "inactive-client",
        startDate: "2020-01-01",
        autoInactiveReason: "three-strikes",
      },
    ];
    const summaries = new Map([
      ["active-client", { lastDeliveryDate: "2026-01-10", missedStrikeCount: 2 }],
    ]);

    const result = enrichRouteClientStatuses(clients, summaries);

    expect(result[0].activeStatus).toBe(true);
    expect(result[0].missedStrikeCount).toBe(2);
    expect(result[1].activeStatus).toBe(false);
    expect(result[1].missedStrikeCount).toBe(0);
  });
});
