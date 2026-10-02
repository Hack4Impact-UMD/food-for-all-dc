// The allowlist of client-profile values an admin may bind a TEFAP form field
// to, plus the logic that turns a client into a form's opening answers.
//
// An explicit registry rather than free-text property paths: it keeps nested
// profile internals and unrelated PII out of reach of form mapping, and gives
// the mapping UI a fixed menu to offer.

import type { ClientProfile } from "../types/client-types";
import type { TefapFieldValue, TefapFormField } from "../types/tefap-types";
import { formatAddressWithQuadrantAndUnit } from "./addressFormat";
import { deliveryDate } from "./deliveryDate";
import { emptyValueFor } from "./tefapFields";

export interface TefapClientFieldSource {
  key: string;
  /** Shown in the mapping UI's prefill menu. */
  label: string;
  /** Grouping for the menu. */
  group: "Identity" | "Address" | "Contact" | "Household" | "Date";
  resolve: (client: ClientProfile) => string;
}

const text = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const count = (value: unknown): string => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
};

/**
 * Household size. Prefers the stored total and falls back to summing the
 * component counts, because legacy records do not all carry a total.
 */
const householdSize = (client: ClientProfile): string => {
  const total = Number(client.total);
  if (Number.isFinite(total) && total > 0) return String(total);

  const summed =
    (Number(client.adults) || 0) + (Number(client.children) || 0) + (Number(client.seniors) || 0);

  return summed > 0 ? String(summed) : "";
};

export const TEFAP_CLIENT_FIELD_SOURCES: TefapClientFieldSource[] = [
  {
    key: "fullName",
    label: "Full name",
    group: "Identity",
    resolve: (client) => `${text(client.firstName)} ${text(client.lastName)}`.trim(),
  },
  {
    key: "firstName",
    label: "First name",
    group: "Identity",
    resolve: (client) => text(client.firstName),
  },
  {
    key: "lastName",
    label: "Last name",
    group: "Identity",
    resolve: (client) => text(client.lastName),
  },
  {
    key: "dob",
    label: "Date of birth",
    group: "Identity",
    resolve: (client) => (client.dob ? deliveryDate.toDisplayString(client.dob) : ""),
  },
  {
    key: "fullAddress",
    label: "Full address",
    group: "Address",
    resolve: (client) =>
      formatAddressWithQuadrantAndUnit(client.address, client.quadrant, client.address2),
  },
  {
    key: "streetAddress",
    label: "Street address only",
    group: "Address",
    resolve: (client) => text(client.address),
  },
  {
    key: "address2",
    label: "Apartment / unit",
    group: "Address",
    resolve: (client) => text(client.address2),
  },
  { key: "city", label: "City", group: "Address", resolve: (client) => text(client.city) },
  { key: "state", label: "State", group: "Address", resolve: (client) => text(client.state) },
  {
    key: "zipCode",
    label: "ZIP code",
    group: "Address",
    resolve: (client) => text(client.zipCode),
  },
  { key: "ward", label: "Ward", group: "Address", resolve: (client) => text(client.ward) },
  {
    key: "quadrant",
    label: "Quadrant",
    group: "Address",
    resolve: (client) => text(client.quadrant),
  },
  { key: "phone", label: "Phone", group: "Contact", resolve: (client) => text(client.phone) },
  {
    key: "alternativePhone",
    label: "Alternate phone",
    group: "Contact",
    resolve: (client) => text(client.alternativePhone),
  },
  { key: "email", label: "Email", group: "Contact", resolve: (client) => text(client.email) },
  {
    key: "householdSize",
    label: "Number in household",
    group: "Household",
    resolve: householdSize,
  },
  { key: "adults", label: "Adults", group: "Household", resolve: (client) => count(client.adults) },
  {
    key: "children",
    label: "Children",
    group: "Household",
    resolve: (client) => count(client.children),
  },
  {
    key: "seniors",
    label: "Seniors",
    group: "Household",
    resolve: (client) => count(client.seniors),
  },
  {
    key: "today",
    label: "Today's date",
    group: "Date",
    resolve: () => deliveryDate.toDisplayString(deliveryDate.todayISODateString()),
  },
];

const SOURCE_BY_KEY = new Map(
  TEFAP_CLIENT_FIELD_SOURCES.map((source) => [source.key, source] as const)
);

export const getClientFieldSource = (key: string): TefapClientFieldSource | undefined =>
  SOURCE_BY_KEY.get(key);

/** Resolves one field's prefill. Unknown client keys resolve to blank. */
export const resolvePrefill = (
  field: TefapFormField,
  client: ClientProfile | null
): string | boolean => {
  const { prefill } = field;

  if (prefill.source === "static") {
    return prefill.staticValue ?? emptyValueFor(field);
  }

  if (prefill.source === "client" && client && prefill.clientKey) {
    const source = SOURCE_BY_KEY.get(prefill.clientKey);
    if (!source) return emptyValueFor(field);

    const resolved = source.resolve(client);
    // A checkbox bound to a client value is checked when that value is present.
    return field.type === "checkbox" ? resolved.length > 0 : resolved;
  }

  return emptyValueFor(field);
};

/** Builds the opening answer set for a client about to fill a form. */
export const buildInitialValues = (
  fields: TefapFormField[],
  client: ClientProfile | null
): TefapFieldValue[] =>
  fields.map((field) => ({ field: field.key, value: resolvePrefill(field, client) }));
