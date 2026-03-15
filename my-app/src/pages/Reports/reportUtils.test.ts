import { DateTime } from "luxon";
import { describe, expect, it } from "@jest/globals";
import {
  buildReferralAgenciesReportData,
  buildSummaryReportData,
  ReportClientRecord,
  ReportDeliveryRecord,
} from "./reportUtils";

const RANGE_START = DateTime.fromISO("2026-03-01").startOf("day");
const RANGE_END = DateTime.fromISO("2026-03-31").endOf("day");

const makeClient = (overrides: Partial<ReportClientRecord> = {}): ReportClientRecord => ({
  uid: overrides.uid ?? "client-1",
  firstName: overrides.firstName ?? "Sam",
  lastName: overrides.lastName ?? "Jones",
  phone: overrides.phone ?? "",
  address: overrides.address ?? "",
  zipCode: overrides.zipCode ?? "",
  adults: overrides.adults ?? 1,
  children: overrides.children ?? 0,
  seniors: overrides.seniors ?? 0,
  total: overrides.total ?? 1,
  startDate: overrides.startDate ?? "2025-01-01",
  endDate: overrides.endDate ?? "",
  referredDate: overrides.referredDate,
  referralEntity: overrides.referralEntity ?? null,
  deliveryDetails: overrides.deliveryDetails,
  physicalAilments: overrides.physicalAilments ?? null,
  physicalDisability: overrides.physicalDisability ?? null,
  mentalHealthConditions: overrides.mentalHealthConditions ?? null,
  tags: overrides.tags ?? [],
});

const makeEvent = (overrides: Partial<ReportDeliveryRecord> = {}): ReportDeliveryRecord => ({
  id: overrides.id ?? "event-1",
  clientId: overrides.clientId ?? "client-1",
  clientName: overrides.clientName ?? "Sam Jones",
  deliveryDate: overrides.deliveryDate ?? DateTime.fromISO("2026-03-05"),
  householdSnapshot:
    "householdSnapshot" in overrides
      ? overrides.householdSnapshot
      : {
          adults: 1,
          children: 0,
          seniors: 0,
          total: 1,
        },
});

describe("buildSummaryReportData", () => {
  it("uses delivery events for duplicated vs unduplicated counts and first-in-period people totals", () => {
    const client = makeClient({
      adults: 2,
      children: 1,
      total: 3,
    });
    const servedEvents = [
      makeEvent({
        id: "event-1",
        deliveryDate: DateTime.fromISO("2026-03-03"),
        householdSnapshot: { adults: 2, children: 1, seniors: 0, total: 3 },
      }),
      makeEvent({
        id: "event-2",
        deliveryDate: DateTime.fromISO("2026-03-20"),
        householdSnapshot: { adults: 3, children: 2, seniors: 0, total: 5 },
      }),
    ];
    const firstDeliveriesByClientId = new Map<string, ReportDeliveryRecord>([
      [client.uid, servedEvents[0]],
    ]);

    const result = buildSummaryReportData({
      clients: [client],
      servedEvents,
      firstDeliveriesByClientId,
      start: RANGE_START,
      end: RANGE_END,
    });

    expect(result.data["Basic Output"]["Households Served (Duplicated)"].value).toBe(2);
    expect(result.data["Basic Output"]["Households Served (Unduplicated)"].value).toBe(1);
    expect(result.data["Basic Output"]["People Served (Duplicated)"].value).toBe(8);
    expect(result.data["Basic Output"]["People Served (Unduplicated)"].value).toBe(3);
    expect(result.data["Basic Output"]["Bags Delivered"].value).toBe(4);
    expect(result.data.Demographics["Total Adults"].value).toBe(2);
    expect(result.data.Demographics["Total Children"].value).toBe(1);
  });

  it("counts new metrics from first-ever delivery and includes start/end boundaries", () => {
    const startBoundaryClient = makeClient({
      uid: "client-start",
      firstName: "Alice",
      adults: 1,
      children: 2,
      total: 3,
      referralEntity: { organization: "Agency A" },
    });
    const endBoundaryClient = makeClient({
      uid: "client-end",
      firstName: "Bree",
      adults: 0,
      children: 0,
      seniors: 1,
      total: 1,
      referralEntity: { organization: "Agency B" },
    });
    const existingClient = makeClient({
      uid: "client-existing",
      firstName: "Chris",
      adults: 2,
      children: 0,
      total: 2,
      referralEntity: { organization: "Agency C" },
    });

    const servedEvents = [
      makeEvent({
        id: "event-start",
        clientId: startBoundaryClient.uid,
        deliveryDate: RANGE_START,
        householdSnapshot: { adults: 1, children: 2, seniors: 0, total: 3 },
      }),
      makeEvent({
        id: "event-end",
        clientId: endBoundaryClient.uid,
        deliveryDate: RANGE_END,
        householdSnapshot: { adults: 0, children: 0, seniors: 1, total: 1 },
      }),
      makeEvent({
        id: "event-existing",
        clientId: existingClient.uid,
        deliveryDate: DateTime.fromISO("2026-03-10"),
        householdSnapshot: { adults: 2, children: 0, seniors: 0, total: 2 },
      }),
    ];

    const firstDeliveriesByClientId = new Map<string, ReportDeliveryRecord>([
      [startBoundaryClient.uid, servedEvents[0]],
      [endBoundaryClient.uid, servedEvents[1]],
      [
        existingClient.uid,
        makeEvent({
          id: "event-existing-first",
          clientId: existingClient.uid,
          deliveryDate: DateTime.fromISO("2026-02-20"),
          householdSnapshot: { adults: 2, children: 0, seniors: 0, total: 2 },
        }),
      ],
    ]);

    const result = buildSummaryReportData({
      clients: [startBoundaryClient, endBoundaryClient, existingClient],
      servedEvents,
      firstDeliveriesByClientId,
      start: RANGE_START,
      end: RANGE_END,
    });

    expect(result.data["Basic Output"]["New Households"].value).toBe(2);
    expect(result.data["Basic Output"]["New People"].value).toBe(4);
    expect(result.data.Demographics["New Adults"].value).toBe(1);
    expect(result.data.Demographics["New Children"].value).toBe(2);
    expect(result.data.Demographics["New Seniors"].value).toBe(1);
    expect(result.data.Demographics["New Single Parents"].value).toBe(1);
    expect(result.data.Referrals["New Client Referrals"].value).toBe(2);
    expect(result.data.Referrals["New Referral Agency Names"].value).toBe(2);
  });

  it("counts referred clients separately from agency totals when organization data is missing", () => {
    const referredWithoutAgency = makeClient({
      uid: "client-referred-no-agency",
      firstName: "Dani",
      referralEntity: {
        id: "worker-1",
        name: "Worker One",
      },
      referredDate: "2026-03-04",
    });
    const servedEvent = makeEvent({
      clientId: referredWithoutAgency.uid,
      deliveryDate: DateTime.fromISO("2026-03-04"),
    });
    const firstDeliveriesByClientId = new Map<string, ReportDeliveryRecord>([
      [referredWithoutAgency.uid, servedEvent],
    ]);

    const result = buildSummaryReportData({
      clients: [referredWithoutAgency],
      servedEvents: [servedEvent],
      firstDeliveriesByClientId,
      start: RANGE_START,
      end: RANGE_END,
    });

    expect(result.data.Referrals["New Client Referrals"].value).toBe(1);
    expect(result.data.Referrals["New Referral Agency Names"].value).toBe(0);
  });

  it("falls back to current household counts when a legacy event has no snapshot", () => {
    const legacyClient = makeClient({
      adults: 2,
      children: 1,
      total: 3,
    });
    const legacyEvent = makeEvent({
      householdSnapshot: null,
    });
    const firstDeliveriesByClientId = new Map<string, ReportDeliveryRecord>([
      [legacyClient.uid, legacyEvent],
    ]);

    const result = buildSummaryReportData({
      clients: [legacyClient],
      servedEvents: [legacyEvent],
      firstDeliveriesByClientId,
      start: RANGE_START,
      end: RANGE_END,
    });

    expect(result.usedLegacySnapshotFallback).toBe(true);
    expect(result.data["Basic Output"]["People Served (Duplicated)"].value).toBe(3);
    expect(result.data["Basic Output"]["People Served (Unduplicated)"].value).toBe(3);
    expect(result.data.Demographics["Total Adults"].value).toBe(2);
    expect(result.data.Demographics["Total Children"].value).toBe(1);
  });

  it("counts health, dietary, FAM, and tags for served clients only", () => {
    const servedClient = makeClient({
      uid: "served-client",
      adults: 1,
      children: 0,
      total: 1,
      tags: ["FAM", "Priority"],
      deliveryDetails: {
        dietaryRestrictions: {
          lowSugar: true,
          microwaveOnly: true,
          foodAllergens: ["peanuts"],
          other: true,
          otherText: "No pork",
        },
      },
      physicalAilments: {
        diabetes: true,
        heartDisease: true,
        kidneyDisease: false,
        hypertension: false,
        cancer: false,
        other: false,
        otherText: "",
      },
      physicalDisability: {
        other: true,
        otherText: "Mobility issue",
      },
      mentalHealthConditions: {
        other: true,
        otherText: "Anxiety",
      },
    });
    const unservedClient = makeClient({
      uid: "unserved-client",
      tags: ["Invisible Tag"],
      deliveryDetails: {
        dietaryRestrictions: {
          vegan: true,
        },
      },
    });
    const servedEvent = makeEvent({
      clientId: servedClient.uid,
      householdSnapshot: { adults: 1, children: 0, seniors: 0, total: 1 },
    });
    const firstDeliveriesByClientId = new Map<string, ReportDeliveryRecord>([
      [servedClient.uid, servedEvent],
    ]);

    const result = buildSummaryReportData({
      clients: [servedClient, unservedClient],
      servedEvents: [servedEvent],
      firstDeliveriesByClientId,
      start: RANGE_START,
      end: RANGE_END,
    });

    expect(
      result.data["Health Conditions"]["Client Health Conditions (Physical Ailments)"].value
    ).toBe(1);
    expect(
      result.data["Health Conditions"]["Client Health Conditions (Physical Disability)"].value
    ).toBe(1);
    expect(
      result.data["Health Conditions"]["Client Health Conditions (Mental Health Conditions)"].value
    ).toBe(1);
    expect(result.data["Health Conditions"].Diabetes.value).toBe(1);
    expect(result.data["Health Conditions"]["Heart Disease"].value).toBe(1);
    expect(result.data["Dietary Restrictions"]["Clients with Dietary Restrictions"].value).toBe(1);
    expect(result.data["Dietary Restrictions"]["Microwave Only"].value).toBe(1);
    expect(result.data["Dietary Restrictions"]["Low Sugar"].value).toBe(1);
    expect(result.data["Dietary Restrictions"].Other.value).toBe(1);
    expect(result.data["Dietary Restrictions"]["No Restrictions"].value).toBe(0);
    expect(
      result.data["FAM (Food as Medicine)"]["Clients Receiving Medically Tailored Food"].value
    ).toBe(1);
    expect(result.data.Tags.Priority.value).toBe(1);
    expect(result.data.Tags["Invisible Tag"]).toBeUndefined();
  });
});

describe("buildReferralAgenciesReportData", () => {
  it("groups by organization and includes only clients whose first delivery is in range", () => {
    const agencyClientOne = makeClient({
      uid: "client-a",
      firstName: "April",
      referralEntity: { organization: "Agency One", name: "Worker One" },
      referredDate: "2026-02-20",
    });
    const agencyClientTwo = makeClient({
      uid: "client-b",
      firstName: "Ben",
      referralEntity: { organization: "Agency One", name: "Worker Two" },
      referredDate: "2026-03-02",
    });
    const oldClient = makeClient({
      uid: "client-old",
      firstName: "Cara",
      referralEntity: { organization: "Agency Two", name: "Worker Three" },
      referredDate: "2026-01-01",
    });

    const firstDeliveriesByClientId = new Map<string, ReportDeliveryRecord>([
      [
        agencyClientOne.uid,
        makeEvent({
          clientId: agencyClientOne.uid,
          deliveryDate: DateTime.fromISO("2026-03-05"),
        }),
      ],
      [
        agencyClientTwo.uid,
        makeEvent({
          clientId: agencyClientTwo.uid,
          deliveryDate: DateTime.fromISO("2026-03-10"),
        }),
      ],
      [
        oldClient.uid,
        makeEvent({
          clientId: oldClient.uid,
          deliveryDate: DateTime.fromISO("2026-02-10"),
        }),
      ],
    ]);

    const report = buildReferralAgenciesReportData({
      clients: [agencyClientOne, agencyClientTwo, oldClient],
      firstDeliveriesByClientId,
      start: RANGE_START,
      end: RANGE_END,
    });

    expect(Object.keys(report)).toEqual(["Agency One"]);
    expect(report["Agency One"]).toHaveLength(2);
    expect(report["Agency One"].map((client) => client.id)).toEqual(["client-a", "client-b"]);
  });
});
