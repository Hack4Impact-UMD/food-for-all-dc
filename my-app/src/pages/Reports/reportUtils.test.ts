import { DateTime } from "luxon";
import { describe, expect, it } from "@jest/globals";
import { deliveryDate } from "../../utils/deliveryDate";
import {
  buildSummaryReportData,
  ReportClientRecord,
  ReportDeliveryRecord,
} from "./reportUtils";

const createClient = (
  uid: string,
  overrides: Partial<ReportClientRecord> = {}
): ReportClientRecord => {
  const today = deliveryDate.today();

  return {
    uid,
    firstName: "Test",
    lastName: uid,
    startDate: today.minus({ days: 30 }),
    endDate: today.plus({ days: 30 }),
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
  it("counts attributes once for every eligible active client, including clients without an in-range delivery", () => {
    const activeWithoutDelivery = createClient("active-without-delivery", {
      tags: ["HFA", "HFA", "FAM"],
      deliveryDetails: { dietaryRestrictions: { halal: true } },
      physicalAilments: { diabetes: true },
      physicalDisability: { other: true },
      mentalHealthConditions: { otherText: "Needs support" },
    });
    const servedActiveClient = createClient("served-active", { tags: ["HFA", "FAM"] });
    const expiredClient = createClient("expired", {
      endDate: deliveryDate.today().minus({ days: 1 }),
      tags: ["HFA"],
      deliveryDetails: { dietaryRestrictions: { vegan: true } },
      physicalAilments: { hypertension: true },
    });
    const futureClient = createClient("future", {
      startDate: deliveryDate.today().plus({ days: 1 }),
      tags: ["HFA"],
    });
    const threeStrikesClient = {
      ...createClient("three-strikes", { tags: ["HFA"] }),
      autoInactiveReason: "three-strikes",
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
      ],
      servedEvents,
      firstDeliveriesByClientId: new Map(),
      start: DateTime.fromISO("2026-07-16").startOf("day"),
      end: DateTime.fromISO("2026-08-12").endOf("day"),
    });

    expect(result.data.Tags.HFA.value).toBe(2);
    expect(result.data.Tags.FAM.value).toBe(2);
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
