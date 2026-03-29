import { Timestamp } from "firebase/firestore";
import { DateTime } from "luxon";
import { TimeUtils } from "./timeUtils";

type DeliveryDateInput = string | Date | DateTime | Timestamp | null | undefined;

const EASTERN_ZONE = "America/New_York";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DISPLAY_DATE_PATTERN = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(\d{4})$/;

const defaultMidday = () =>
  TimeUtils.now().setZone(EASTERN_ZONE).startOf("day").plus({ hours: 12 });

const isValidJsDate = (value: Date) => !Number.isNaN(value.getTime());

const normalizeDateTime = (dateTime: DateTime): DateTime =>
  dateTime.setZone(EASTERN_ZONE).startOf("day").plus({ hours: 12 });

const parseStringInput = (input: string): DateTime | null => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (ISO_DATE_PATTERN.test(trimmed)) {
    const parsed = DateTime.fromFormat(trimmed, "yyyy-MM-dd", { zone: EASTERN_ZONE });
    return parsed.isValid ? normalizeDateTime(parsed) : null;
  }

  if (DISPLAY_DATE_PATTERN.test(trimmed)) {
    const parsed = DateTime.fromFormat(trimmed, "MM/dd/yyyy", { zone: EASTERN_ZONE });
    return parsed.isValid ? normalizeDateTime(parsed) : null;
  }

  const isoDateTime = DateTime.fromISO(trimmed, { setZone: true });
  if (isoDateTime.isValid) {
    return normalizeDateTime(isoDateTime);
  }

  const legacyDate = new Date(trimmed);
  if (isValidJsDate(legacyDate)) {
    return normalizeDateTime(DateTime.fromJSDate(legacyDate, { zone: EASTERN_ZONE }));
  }

  return null;
};

const toEasternMidday = (input: DeliveryDateInput, fallback: boolean): DateTime | null => {
  if (!input) {
    return fallback ? defaultMidday() : null;
  }

  if (input instanceof DateTime) {
    return normalizeDateTime(input);
  }

  if (input instanceof Date) {
    if (!isValidJsDate(input)) {
      return fallback ? defaultMidday() : null;
    }

    return normalizeDateTime(DateTime.fromJSDate(input, { zone: EASTERN_ZONE }));
  }

  if (input instanceof Timestamp) {
    return normalizeDateTime(DateTime.fromJSDate(input.toDate(), { zone: EASTERN_ZONE }));
  }

  const parsed = parseStringInput(input);
  if (parsed) {
    return parsed;
  }

  return fallback ? defaultMidday() : null;
};

const toIsoDateString = (dateTime: DateTime | null): string | null => dateTime?.toISODate() ?? null;

export const deliveryDate = {
  zone: EASTERN_ZONE,
  today(): DateTime {
    return defaultMidday();
  },
  todayISODateString(): string {
    return toIsoDateString(defaultMidday()) ?? "";
  },
  toDateTime(input: DeliveryDateInput): DateTime {
    return toEasternMidday(input, true) as DateTime;
  },
  toJSDate(input: DeliveryDateInput): Date {
    return (toEasternMidday(input, true) as DateTime).toJSDate();
  },
  toISODateString(input: DeliveryDateInput): string {
    return toIsoDateString(toEasternMidday(input, true)) ?? deliveryDate.todayISODateString();
  },
  toDisplayString(input: DeliveryDateInput): string {
    return deliveryDate.toDateTime(input).toFormat("MM/dd/yyyy");
  },
  toInputValue(input: DeliveryDateInput): string {
    return deliveryDate.toISODateString(input);
  },
  parseDateParam(value: string | null): Date {
    const parsed = toEasternMidday(value ?? undefined, false);
    return (parsed ?? defaultMidday()).toJSDate();
  },
  tryToDateTime(input: DeliveryDateInput): DateTime | null {
    return toEasternMidday(input, false);
  },
  tryToJSDate(input: DeliveryDateInput): Date | null {
    const dt = toEasternMidday(input, false);
    return dt ? dt.toJSDate() : null;
  },
  tryToISODateString(input: DeliveryDateInput): string | null {
    return toIsoDateString(toEasternMidday(input, false));
  },
  compare(left: DeliveryDateInput, right: DeliveryDateInput): number {
    const leftIso = deliveryDate.tryToISODateString(left);
    const rightIso = deliveryDate.tryToISODateString(right);

    if (!leftIso && !rightIso) return 0;
    if (!leftIso) return -1;
    if (!rightIso) return 1;
    return leftIso.localeCompare(rightIso);
  },
  isSameDay(left: DeliveryDateInput, right: DeliveryDateInput): boolean {
    return deliveryDate.compare(left, right) === 0;
  },
  getDayBounds(input: DeliveryDateInput): { start: DateTime; endExclusive: DateTime } {
    const start = deliveryDate.toDateTime(input).startOf("day");
    return {
      start,
      endExclusive: start.plus({ days: 1 }),
    };
  },
};

export type { DeliveryDateInput };
