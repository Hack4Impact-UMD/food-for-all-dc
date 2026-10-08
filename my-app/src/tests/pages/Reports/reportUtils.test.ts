import { describe, expect, it } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import { DateTime } from "luxon";
import {
  buildReferralAgenciesReportData,
  buildSummaryReportData,
  ReportClientRecord,
  ReportDeliveryRecord,
  SupportedDateInput,
} from "../../../pages/Reports/reportUtils";

const reportDate = (value: string) =>
  DateTime.fromISO(value, { zone: "America/New_York" });
const start = reportDate("2026-07-16").startOf("day");
const end = reportDate("2026-08-12").endOf("day");

const makeClient = (uid: string, startDate: SupportedDateInput): ReportClientRecord => ({
  uid,
  firstName: "Test",
  lastName: uid,
  startDate,
  adults: 5,
  children: 0,
  seniors: 0,
  total: 5,
  referralEntity: { organization: "Community Agency" },
});

const makeDelivery = (clientId: string, date = "2026-07-20"): ReportDeliveryRecord => ({
  id: `${clientId}-${date}`,
  clientId,
  clientName: "Test Client",
  deliveryDate: reportDate(date),
  householdSnapshot: { adults: 1, children: 2, seniors: 1, total: 4 },
});

describe("start-date-based new client reporting", () => {
  it("does not count migrated clients as new when their first app delivery is in the period", () => {
    const clients = [makeClient("existing", "03/01/2023")];
    const { data } = buildSummaryReportData({
      clients,
      servedEvents: [makeDelivery("existing")],
      start,
      end,
    });

    expect(data["Basic Output"]["Households Served (Unduplicated)"].value).toBe(1);
    expect(data["Basic Output"]["People Served (Unduplicated)"].value).toBe(4);
    expect(data["Basic Output"]["New Households"].value).toBe(0);
    expect(data["Basic Output"]["New People"].value).toBe(0);
    expect(data.Referrals["New Client Referrals"].value).toBe(0);
    expect(data.Referrals["New Referral Sources"].value).toBe(0);
    expect(buildReferralAgenciesReportData({ clients, start, end })).toEqual({});
  });

  it("counts new clients once and uses the first in-period household snapshot", () => {
    const clients = [makeClient("new", "07/16/2026"), makeClient("existing", "2023-03-01")];
    const laterDelivery = {
      ...makeDelivery("new", "2026-08-01"),
      householdSnapshot: { adults: 2, children: 3, seniors: 1, total: 6 },
    };
    const { data, usedLegacySnapshotFallback } = buildSummaryReportData({
      clients,
      servedEvents: [makeDelivery("new"), makeDelivery("existing"), laterDelivery],
      start,
      end,
    });

    expect(data["Basic Output"]["Households Served (Duplicated)"].value).toBe(3);
    expect(data["Basic Output"]["People Served (Duplicated)"].value).toBe(14);
    expect(data["Basic Output"]["Households Served (Unduplicated)"].value).toBe(2);
    expect(data["Basic Output"]["New Households"].value).toBe(1);
    expect(data["Basic Output"]["New People"].value).toBe(4);
    expect(data.Demographics["New Adults"].value).toBe(1);
    expect(data.Demographics["New Children"].value).toBe(2);
    expect(data.Demographics["New Seniors"].value).toBe(1);
    expect(data.Demographics["New Single Parents"].value).toBe(1);
    expect(data.Referrals["New Client Referrals"].value).toBe(1);
    expect(data.Referrals["New Referral Sources"].value).toBe(1);
    expect(usedLegacySnapshotFallback).toBe(false);
    expect(buildReferralAgenciesReportData({ clients, start, end })).toEqual({
      "Community Agency": [{
        id: "new",
        firstName: "Test",
        lastName: "new",
        referredDate: "",
        startDate: "2026-07-16",
      }],
    });
  });

  it.each([
    ["07/16/2026", 1],
    ["08/12/2026", 1],
    ["2026-07-16", 1],
    ["2026-08-12", 1],
    [reportDate("2026-08-12T23:59:59"), 1],
    [reportDate("2026-08-12T23:59:59").toJSDate(), 1],
    [Timestamp.fromDate(reportDate("2026-08-12T23:59:59").toJSDate()), 1],
    ["07/15/2026", 0],
    ["08/13/2026", 0],
    [undefined, 0],
    [null, 0],
    ["", 0],
    ["not-a-date", 0],
    ["02/30/2026", 0],
  ] as Array<[SupportedDateInput, number]>)("handles start date %p consistently in both reports", (startDate, expectedCount) => {
    const clients = [makeClient("client", startDate)];
    const { data } = buildSummaryReportData({
      clients,
      servedEvents: [makeDelivery("client")],
      start,
      end,
    });
    const referrals = buildReferralAgenciesReportData({ clients, start, end });

    expect(data["Basic Output"]["New Households"].value).toBe(expectedCount);
    expect(data.Referrals["New Client Referrals"].value).toBe(expectedCount);
    expect(referrals["Community Agency"]?.length ?? 0).toBe(expectedCount);
  });

  it("does not include unserved clients in summary new counts", () => {
    const { data } = buildSummaryReportData({
      clients: [makeClient("unserved", "07/16/2026")],
      servedEvents: [],
      start,
      end,
    });

    expect(data["Basic Output"]["New Households"].value).toBe(0);
    expect(data.Referrals["New Client Referrals"].value).toBe(0);
  });

  it("preserves the client snapshot fallback for legacy deliveries", () => {
    const { data, usedLegacySnapshotFallback } = buildSummaryReportData({
      clients: [makeClient("new", "07/16/2026")],
      servedEvents: [{ ...makeDelivery("new"), householdSnapshot: null }],
      start,
      end,
    });

    expect(data["Basic Output"]["New People"].value).toBe(5);
    expect(usedLegacySnapshotFallback).toBe(true);
  });
});