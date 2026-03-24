import { describe, expect, it } from "@jest/globals";
import {
  buildRecurringSeriesAuditReport,
  buildSeriesSummary,
  canMutateFutureSeries,
  getDeliverySeriesKey,
  getLatestScheduledDate,
  summarizeDeliverySeries,
} from "./recurringSeries";

const createEvent = ({
  id,
  clientId = "client-1",
  deliveryDate,
  recurrence = "Weekly",
  recurrenceId,
}: {
  id: string;
  clientId?: string;
  deliveryDate: string;
  recurrence?: "None" | "Weekly" | "2x-Monthly" | "Monthly" | "Custom";
  recurrenceId?: string;
}) => ({
  id,
  clientId,
  deliveryDate,
  recurrence,
  recurrenceId,
});

describe("recurringSeries", () => {
  it("keeps separate recurring series split by recurrenceId", () => {
    const summaries = summarizeDeliverySeries([
      createEvent({
        id: "event-1",
        clientId: "client-1",
        deliveryDate: "2026-02-01",
        recurrenceId: "series-a",
      }),
      createEvent({
        id: "event-2",
        clientId: "client-1",
        deliveryDate: "2026-02-08",
        recurrenceId: "series-a",
      }),
      createEvent({
        id: "event-3",
        clientId: "client-1",
        deliveryDate: "2026-03-01",
        recurrenceId: "series-b",
      }),
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries.map((summary) => summary.recurrenceId)).toEqual(["series-b", "series-a"]);
    expect(summaries[0].latestDate).toBe("2026-03-01");
    expect(summaries[1].eventIds).toEqual(["event-1", "event-2"]);
  });

  it("uses recurrenceId as the series key and blocks legacy future mutations", () => {
    const legacyRecurringEvent = createEvent({
      id: "event-1",
      deliveryDate: "2026-02-01",
      recurrence: "Weekly",
    });
    const oneOffEvent = createEvent({
      id: "event-2",
      deliveryDate: "2026-02-02",
      recurrence: "None",
    });

    expect(getDeliverySeriesKey(legacyRecurringEvent)).toBeNull();
    expect(getDeliverySeriesKey(oneOffEvent)).toBe("event-2");
    expect(canMutateFutureSeries(legacyRecurringEvent)).toBe(false);

    const summary = buildSeriesSummary([legacyRecurringEvent]);
    expect(summary).not.toBeNull();
    expect(summary?.unresolvedLegacy).toBe(true);
    expect(summary?.supportsFutureOperations).toBe(false);
  });

  it("returns the latest scheduled date for custom and one-off deliveries", () => {
    const latestDate = getLatestScheduledDate([
      createEvent({
        id: "event-1",
        deliveryDate: "2026-02-01",
        recurrence: "Weekly",
        recurrenceId: "series-a",
      }),
      createEvent({
        id: "event-2",
        deliveryDate: "2026-04-15",
        recurrence: "Custom",
        recurrenceId: "series-custom",
      }),
      createEvent({
        id: "event-3",
        deliveryDate: "2026-03-01",
        recurrence: "None",
      }),
    ]);

    expect(latestDate).toBe("2026-04-15");
  });

  it("flags missing recurrenceIds and overlapping recurring series", () => {
    const auditReport = buildRecurringSeriesAuditReport([
      createEvent({
        id: "legacy-1",
        clientId: "client-1",
        deliveryDate: "2026-01-01",
        recurrence: "Weekly",
      }),
      createEvent({
        id: "event-1",
        clientId: "client-1",
        deliveryDate: "2026-01-01",
        recurrenceId: "series-a",
      }),
      createEvent({
        id: "event-2",
        clientId: "client-1",
        deliveryDate: "2026-01-15",
        recurrenceId: "series-a",
      }),
      createEvent({
        id: "event-3",
        clientId: "client-1",
        deliveryDate: "2026-01-10",
        recurrenceId: "series-b",
      }),
      createEvent({
        id: "event-4",
        clientId: "client-1",
        deliveryDate: "2026-01-20",
        recurrenceId: "series-b",
      }),
    ]);

    expect(auditReport.missingRecurrenceId).toEqual([
      {
        eventId: "legacy-1",
        clientId: "client-1",
        recurrence: "Weekly",
        deliveryDate: "2026-01-01",
      },
    ]);
    expect(auditReport.overlappingRecurringSeries).toHaveLength(1);
    expect(auditReport.overlappingRecurringSeries[0].clientId).toBe("client-1");
    expect(auditReport.overlappingRecurringSeries[0].recurrenceIds).toEqual([
      "series-a",
      "series-b",
    ]);
  });
});
