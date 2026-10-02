import { deliveryDate } from "./deliveryDate";
import { toDateOrNull } from "./dates";

/**
 * Client profile fields that represent a calendar day rather than an instant.
 * Every write to these must go through `normalizeClientDatesForWrite` so the
 * stored type stays consistent regardless of which code path saved the profile.
 */
export const CLIENT_DATE_FIELDS = [
  "dob",
  "startDate",
  "endDate",
  "tefapCertDate",
  "famStartDate",
  "referredDate",
  "autoInactivePreviousEndDate",
  "autoInactiveStrikeDate",
] as const;

export type ClientDateField = (typeof CLIENT_DATE_FIELDS)[number];

const CLIENT_DATE_FIELD_SET: ReadonlySet<string> = new Set(CLIENT_DATE_FIELDS);

const SENTINEL_TEXT = ["nan", "none", "null", "n/a"];

/**
 * Accepted string shapes, matching ACCEPTED_FORMATS in ETL/client_dates.py.
 * Deliberately narrower than `deliveryDate`, whose fallback to `new Date(...)`
 * will happily read "sometime in 1945" as 1945-01-01. Inventing a date from free
 * text is worse than reporting it, and it would disagree with the backfill.
 */
const ACCEPTED_DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}(?:[ T].*)?$/,
  /^\d{1,2}\/\d{1,2}\/\d{4}$/,
  /^\d{1,2}\/\d{1,2}\/\d{2}$/,
];

const isBlankOrSentinel = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return !trimmed || SENTINEL_TEXT.includes(trimmed.toLowerCase());
};

/**
 * Coerce any stored or user-entered client date into something `deliveryDate`
 * can parse. Handles Firestore Timestamps and the plain `{ seconds, nanoseconds }`
 * maps left behind when a Timestamp is structurally copied.
 */
const toParsableDate = (value: unknown): string | Date | null => {
  if (isBlankOrSentinel(value)) return null;
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return ACCEPTED_DATE_PATTERNS.some((pattern) => pattern.test(trimmed)) ? trimmed : null;
  }

  if (typeof value === "object") return toDateOrNull(value);

  return null;
};

/**
 * Convert a client date to the canonical stored form: noon Eastern, so the
 * calendar day survives being rendered in any US timezone. Firestore stores a
 * Date as a Timestamp, matching how `normalizeEventForWrite` persists deliveries.
 * Returns null for empty or unparseable input rather than guessing a date.
 */
export const toClientDateValue = (value: unknown): Date | null => {
  const parsable = toParsableDate(value);
  return parsable === null ? null : deliveryDate.tryToJSDate(parsable);
};

/**
 * True when a value holds something we could not interpret as a date but which
 * is not simply empty - e.g. a legacy `"1945"` or free text from the spreadsheet.
 * These are left untouched so a save cannot destroy data awaiting manual triage.
 */
const isUnparseableValue = (value: unknown): boolean =>
  !isBlankOrSentinel(value) && toClientDateValue(value) === null;

/**
 * Read a client date as a `yyyy-MM-dd` string, accepting either the legacy
 * string forms or a Timestamp. Unparseable-but-present values are returned
 * verbatim so a later save can round-trip them instead of erasing them.
 */
export const toClientDateString = (value: unknown): string => {
  const parsable = toParsableDate(value);
  const iso = parsable === null ? null : deliveryDate.tryToISODateString(parsable);
  if (iso) return iso;

  // Hand back anything we could not read so a later save can round-trip it.
  return isBlankOrSentinel(value) || typeof value !== "string" ? "" : value;
};

/** The payload shape after normalization: date fields change type, everything else is untouched. */
type WithNormalizedDates<T, TDate> = {
  [K in keyof T]: K extends ClientDateField ? TDate : T[K];
};

/**
 * The single write funnel for client profiles: normalizes every calendar-date
 * field present on the payload, leaving all other fields untouched.
 * Mirrors `normalizeEventForWrite` in delivery-service.
 */
export const normalizeClientDatesForWrite = <T extends Record<string, any>>(
  profile: T
): WithNormalizedDates<T, Date | null> => {
  const normalized: Record<string, any> = { ...profile };

  Object.keys(normalized).forEach((key) => {
    if (!CLIENT_DATE_FIELD_SET.has(key)) return;
    // Leave junk we could not parse alone; nulling it would destroy the original.
    if (isUnparseableValue(normalized[key])) return;
    normalized[key] = toClientDateValue(normalized[key]);
  });

  return normalized as WithNormalizedDates<T, Date | null>;
};

/** Reads every client date field on a document back into `yyyy-MM-dd` strings. */
export const normalizeClientDatesForRead = <T extends Record<string, any>>(
  profile: T
): WithNormalizedDates<T, string> => {
  const normalized: Record<string, any> = { ...profile };

  CLIENT_DATE_FIELDS.forEach((field) => {
    if (field in normalized) {
      normalized[field] = toClientDateString(normalized[field]);
    }
  });

  return normalized as WithNormalizedDates<T, string>;
};
