import { DeliveryEvent } from "../types/calendar-types";
import { deliveryDate } from "./deliveryDate";

export interface DeliverySeriesSummary {
  key: string;
  clientId: string;
  recurrence: DeliveryEvent["recurrence"];
  recurrenceId?: string;
  eventIds: string[];
  earliestDate: string;
  latestDate: string;
  effectiveEndDate: string;
  supportsFutureOperations: boolean;
  unresolvedLegacy: boolean;
}

export interface RecurringSeriesAuditReport {
  missingRecurrenceId: Array<{
    eventId: string;
    clientId: string;
    recurrence: DeliveryEvent["recurrence"];
    deliveryDate: string;
  }>;
  overlappingRecurringSeries: Array<{
    clientId: string;
    recurrence: DeliveryEvent["recurrence"];
    recurrenceIds: string[];
    ranges: Array<{
      recurrenceId: string;
      earliestDate: string;
      latestDate: string;
    }>;
  }>;
}

type DeliveryEventLike = Pick<
  DeliveryEvent,
  "id" | "clientId" | "deliveryDate" | "recurrence" | "recurrenceId"
> & {
  repeatsEndDate?: DeliveryEvent["repeatsEndDate"];
};

const compareIsoDates = (left: string, right: string) => left.localeCompare(right);

const toIsoDateOrNull = (value: DeliveryEventLike["deliveryDate"] | string | undefined): string | null =>
  value ? deliveryDate.tryToISODateString(value) : null;

const buildLegacySeriesKey = (eventId: string) => `legacy:${eventId}`;

export const getDeliverySeriesKey = (event: Pick<DeliveryEventLike, "id" | "recurrence" | "recurrenceId">): string | null => {
  if (event.recurrence === "None") {
    return event.id;
  }

  return event.recurrenceId || null;
};

export const canMutateFutureSeries = (
  event: Pick<DeliveryEventLike, "recurrence" | "recurrenceId">
): boolean => event.recurrence !== "None" && Boolean(event.recurrenceId);

export const buildSeriesSummary = (events: DeliveryEventLike[]): DeliverySeriesSummary | null => {
  if (events.length === 0) {
    return null;
  }

  const normalizedEvents = events
    .map((event) => {
      const dateKey = toIsoDateOrNull(event.deliveryDate);
      return dateKey ? { ...event, dateKey } : null;
    })
    .filter((event): event is DeliveryEventLike & { dateKey: string } => event !== null)
    .sort((left, right) => compareIsoDates(left.dateKey, right.dateKey));

  if (normalizedEvents.length === 0) {
    return null;
  }

  const firstEvent = normalizedEvents[0];
  const latestDate = normalizedEvents[normalizedEvents.length - 1].dateKey;
  const recurrenceId = firstEvent.recurrenceId?.trim() || undefined;
  const unresolvedLegacy = firstEvent.recurrence !== "None" && !recurrenceId;
  const key =
    firstEvent.recurrence === "None"
      ? firstEvent.id
      : recurrenceId || buildLegacySeriesKey(firstEvent.id);

  return {
    key,
    clientId: firstEvent.clientId,
    recurrence: firstEvent.recurrence,
    recurrenceId,
    eventIds: normalizedEvents.map((event) => event.id),
    earliestDate: firstEvent.dateKey,
    latestDate,
    effectiveEndDate: latestDate,
    supportsFutureOperations: firstEvent.recurrence !== "None" && Boolean(recurrenceId),
    unresolvedLegacy,
  };
};

export const summarizeDeliverySeries = (
  events: DeliveryEventLike[]
): DeliverySeriesSummary[] => {
  const seriesMap = new Map<string, DeliveryEventLike[]>();

  events.forEach((event) => {
    const baseKey =
      event.recurrence === "None"
        ? event.id
        : event.recurrenceId?.trim() || buildLegacySeriesKey(event.id);

    if (!seriesMap.has(baseKey)) {
      seriesMap.set(baseKey, []);
    }

    const seriesEvents = seriesMap.get(baseKey);
    if (seriesEvents) {
      seriesEvents.push(event);
    }
  });

  return Array.from(seriesMap.values())
    .map((seriesEvents) => buildSeriesSummary(seriesEvents))
    .filter((summary): summary is DeliverySeriesSummary => summary !== null)
    .sort((left, right) => compareIsoDates(right.latestDate, left.latestDate));
};

export const getLatestScheduledDate = (
  events: Array<Pick<DeliveryEventLike, "deliveryDate">>
): string | null => {
  let latestDate: string | null = null;

  events.forEach((event) => {
    const dateKey = toIsoDateOrNull(event.deliveryDate);
    if (dateKey && (!latestDate || compareIsoDates(dateKey, latestDate) > 0)) {
      latestDate = dateKey;
    }
  });

  return latestDate;
};

export const buildRecurringSeriesAuditReport = (
  events: DeliveryEventLike[]
): RecurringSeriesAuditReport => {
  const summaries = summarizeDeliverySeries(events);
  const missingRecurrenceId = events
    .filter((event) => event.recurrence !== "None" && !event.recurrenceId)
    .map((event) => ({
      eventId: event.id,
      clientId: event.clientId,
      recurrence: event.recurrence,
      deliveryDate: toIsoDateOrNull(event.deliveryDate) || "",
    }))
    .sort((left, right) => compareIsoDates(left.deliveryDate, right.deliveryDate));

  const overlappingRecurringSeries: RecurringSeriesAuditReport["overlappingRecurringSeries"] = [];
  const groupedSummaries = new Map<string, DeliverySeriesSummary[]>();

  summaries
    .filter((summary) => summary.recurrence !== "None" && summary.recurrenceId)
    .forEach((summary) => {
      const key = `${summary.clientId}:${summary.recurrence}`;
      if (!groupedSummaries.has(key)) {
        groupedSummaries.set(key, []);
      }

      const series = groupedSummaries.get(key);
      if (series) {
        series.push(summary);
      }
    });

  groupedSummaries.forEach((seriesSummaries) => {
    if (seriesSummaries.length < 2) {
      return;
    }

    const sortedSummaries = [...seriesSummaries].sort((left, right) =>
      compareIsoDates(left.earliestDate, right.earliestDate)
    );
    const overlapping = sortedSummaries.filter((summary, index) => {
      const previous = sortedSummaries[index - 1];
      return (
        Boolean(previous) &&
        compareIsoDates(summary.earliestDate, previous.latestDate) <= 0
      );
    });

    if (overlapping.length === 0) {
      return;
    }

    overlappingRecurringSeries.push({
      clientId: sortedSummaries[0].clientId,
      recurrence: sortedSummaries[0].recurrence,
      recurrenceIds: sortedSummaries
        .map((summary) => summary.recurrenceId)
        .filter((recurrenceId): recurrenceId is string => Boolean(recurrenceId)),
      ranges: sortedSummaries
        .map((summary) => ({
          recurrenceId: summary.recurrenceId!,
          earliestDate: summary.earliestDate,
          latestDate: summary.latestDate,
        }))
        .sort((left, right) => compareIsoDates(left.earliestDate, right.earliestDate)),
    });
  });

  return {
    missingRecurrenceId,
    overlappingRecurringSeries,
  };
};
