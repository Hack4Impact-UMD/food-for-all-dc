import { DateTime } from "luxon";
import { Timestamp } from "firebase/firestore";
import { TimeUtils } from "./timeUtils";

type DeliveryDateInput = string | Date | DateTime | Timestamp | null | undefined;

const EASTERN_ZONE = "America/New_York";

const defaultMidday = () =>
  TimeUtils.now().setZone(EASTERN_ZONE).startOf("day").plus({ hours: 12 });

const toEasternMidday = (input: DeliveryDateInput, fallback: boolean): DateTime | null => {
  if (!input) {
    return fallback ? defaultMidday() : null;
  }

  const base = TimeUtils.fromAny(input);
  if (!base.isValid) {
    return fallback ? defaultMidday() : null;
  }

  const normalized = base
    .setZone(EASTERN_ZONE, { keepLocalTime: false })
    .startOf("day")
    .plus({ hours: 12 });

  if (!normalized.isValid) {
    return fallback ? defaultMidday() : null;
  }

  return normalized;
};

export const deliveryDate = {
  toDateTime(input: DeliveryDateInput): DateTime {
    return toEasternMidday(input, true) as DateTime;
  },
  toJSDate(input: DeliveryDateInput): Date {
    return (toEasternMidday(input, true) as DateTime).toJSDate();
  },
  toISODateString(input: DeliveryDateInput): string {
    const iso = (toEasternMidday(input, true) as DateTime).toISODate();
    return iso ?? TimeUtils.today().toISODate() ?? "";
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
    const dt = toEasternMidday(input, false);
    return dt?.toISODate() ?? null;
  },
};

export type { DeliveryDateInput };
