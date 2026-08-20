import { DateTime } from "luxon";
import { describe, expect, it } from "@jest/globals";
import {
  buildSummaryReportData,
  ReportClientRecord,
  ReportDeliveryRecord,
} from "./reportUtils";

const createHfaClient = (uid: string): ReportClientRecord => ({
  uid,
  firstName: "Test",
  lastName: uid,
  adults: 1,
  children: 0,
  seniors: 0,
  total: 1,
  tags: ["HFA"],
});

const createDelivery = (
  id: string,
  clientId: string,
  deliveryStatus?: "Scheduled" | "Missed"
): ReportDeliveryRecord =>
  ({
    id,
    clientId,
    clientName: clientId,
    deliveryDate: DateTime.fromISO("2026-08-01"),
    ...(deliveryStatus === undefined ? {} : { deliveryStatus }),
    householdSnapshot: {
      adults: 1,
      children: 0,
      seniors: 0,
      total: 1,
    },
  });

describe("buildSummaryReportData HFA delivery metric", () => {
  it("counts each HFA client with a non-missed delivery in the report period once", () => {
    const repeatedHfaClient = createHfaClient("repeated-hfa");
    const otherHfaClient = createHfaClient("other-hfa");
    const legacyHfaClient = createHfaClient("legacy-hfa");
    const missedOnlyHfaClient = createHfaClient("missed-only-hfa");
    const outsidePeriodHfaClient = createHfaClient("outside-period-hfa");
    const nonHfaClient = { ...createHfaClient("non-hfa"), tags: [] };
    const legacyDelivery = createDelivery("delivery-6", legacyHfaClient.uid);

    expect(legacyDelivery).not.toHaveProperty("deliveryStatus");

    const result = buildSummaryReportData({
      clients: [
        repeatedHfaClient,
        otherHfaClient,
        legacyHfaClient,
        missedOnlyHfaClient,
        outsidePeriodHfaClient,
        nonHfaClient,
      ],
      // The report loader supplies only events inside the selected range, so the
      // outside-period HFA client has no event in this date-scoped input.
      servedEvents: [
        createDelivery("delivery-1", repeatedHfaClient.uid, "Missed"),
        createDelivery("delivery-2", repeatedHfaClient.uid, "Scheduled"),
        createDelivery("delivery-3", otherHfaClient.uid, "Scheduled"),
        legacyDelivery,
        createDelivery("delivery-4", missedOnlyHfaClient.uid, "Missed"),
        createDelivery("delivery-5", nonHfaClient.uid, "Scheduled"),
      ],
      firstDeliveriesByClientId: new Map(),
      start: DateTime.fromISO("2026-07-16").startOf("day"),
      end: DateTime.fromISO("2026-08-12").endOf("day"),
    });

    expect(result.data["HFA (Healthy Food Access)"]).toEqual({
      "Clients Receiving Food (Unduplicated)": { value: 3, isFullRow: true },
    });
  });
});
