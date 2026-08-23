import { DateTime } from "luxon";
import { describe, expect, it } from "@jest/globals";
import {
  buildSummaryReportData,
  ReportClientRecord,
  ReportDeliveryRecord,
} from "./reportUtils";

const createClient = (
  uid: string,
  overrides: Partial<ReportClientRecord> = {}
): ReportClientRecord => {
  return {
    uid,
    firstName: "Test",
    lastName: uid,
    startDate: "2026-06-01",
    endDate: "2026-12-31",
    adults: 2,
    children: 1,
    seniors: 0,
    total: 3,
    tags: [],
    ...overrides,
  };
};

const createDelivery = (id: string, clientId: string): ReportDeliveryRecord => ({
  id,
  clientId,
  clientName: clientId,
  deliveryDate: DateTime.fromISO("2026-08-01"),
  householdSnapshot: {
    adults: 2,
    children: 1,
    seniors: 0,
    total: 3,
  },
});

describe("buildSummaryReportData", () => {
  it("counts attributes for clients active at the selected report end date", () => {
    const activeWithoutDelivery = createClient("active-without-delivery", {
      endDate: "2026-08-12",
      tags: ["HFA", "HFA", "FAM", "Historical"],
      deliveryDetails: { dietaryRestrictions: { halal: true } },
      physicalAilments: { diabetes: true },
      physicalDisability: { other: true },
      mentalHealthConditions: { otherText: "Needs support" },
    });
    const servedActiveClient = createClient("served-active", { tags: ["HFA", "FAM"] });
    const expiredClient = createClient("expired", {
      endDate: "2026-08-11",
      tags: ["HFA"],
      deliveryDetails: { dietaryRestrictions: { vegan: true } },
      physicalAilments: { hypertension: true },
    });
    const futureClient = createClient("future", {
      startDate: "2026-08-13",
      tags: ["Future"],
    });
    const threeStrikesClient = {
      ...createClient("three-strikes", {
        endDate: "2026-08-01",
        tags: ["HFA"],
      }),
      autoInactiveReason: "three-strikes",
      autoInactivePreviousEndDate: "2026-12-31",
      autoInactiveStrikeDate: "2026-08-01",
    } as ReportClientRecord;
    const struckAfterReportEnd = {
      ...createClient("future-three-strikes", {
        endDate: "2026-08-20",
        tags: ["HFA", "PreStrike"],
      }),
      autoInactiveReason: "three-strikes",
      autoInactivePreviousEndDate: "2026-12-31",
      autoInactiveStrikeDate: "2026-08-20",
    } as ReportClientRecord;
    const endedBeforeFutureStrike = {
      ...createClient("ended-before-future-strike", {
        endDate: "2026-08-20",
        tags: ["EndedBeforeStrike"],
      }),
      autoInactiveReason: "three-strikes",
      autoInactivePreviousEndDate: "2026-08-10",
      autoInactiveStrikeDate: "2026-08-20",
    } as ReportClientRecord;
    const servedEvents = [
      createDelivery("delivery-1", servedActiveClient.uid),
      createDelivery("delivery-2", servedActiveClient.uid),
    ];

    const result = buildSummaryReportData({
      clients: [
        activeWithoutDelivery,
        { ...activeWithoutDelivery },
        servedActiveClient,
        expiredClient,
        futureClient,
        threeStrikesClient,
        struckAfterReportEnd,
        endedBeforeFutureStrike,
      ],
      servedEvents,
      firstDeliveriesByClientId: new Map(),
      start: DateTime.fromISO("2026-07-16").startOf("day"),
      end: DateTime.fromISO("2026-08-12").endOf("day"),
    });

    expect(result.data.Tags.HFA.value).toBe(3);
    expect(result.data.Tags.FAM.value).toBe(2);
    expect(result.data.Tags.Historical.value).toBe(1);
    expect(result.data.Tags.PreStrike.value).toBe(1);
    expect(result.data.Tags.Future).toBeUndefined();
    expect(result.data.Tags.EndedBeforeStrike).toBeUndefined();
    expect(
      result.data["FAM (Food as Medicine)"]["Clients Receiving Medically Tailored Food"].value
    ).toBe(1);
    expect(result.data["Dietary Restrictions"].Halal.value).toBe(1);
    expect(
      result.data["Dietary Restrictions"]["Clients with Dietary Restrictions"].value
    ).toBe(1);
    expect(
      result.data["Health Conditions"]["Client Health Conditions (Physical Ailments)"].value
    ).toBe(1);
    expect(result.data["Health Conditions"].Diabetes.value).toBe(1);
    expect(
      result.data["Health Conditions"]["Client Health Conditions (Physical Disability)"].value
    ).toBe(1);
    expect(
      result.data["Health Conditions"]["Client Health Conditions (Mental Health Conditions)"].value
    ).toBe(1);

    expect(result.data["Basic Output"]["Households Served (Duplicated)"].value).toBe(2);
    expect(result.data["Basic Output"]["Households Served (Unduplicated)"].value).toBe(1);
    expect(result.data["Basic Output"]["People Served (Duplicated)"].value).toBe(6);
    expect(result.data["Basic Output"]["People Served (Unduplicated)"].value).toBe(3);
    expect(result.data["Basic Output"]["Bags Delivered"].value).toBe(4);
  });
});
