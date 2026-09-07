// Value helpers for TEFAP form fields: building the initial answer set,
// enforcing required fields, and keeping mutually exclusive checkboxes honest.
//
// Kept separate from tefapPdf so it carries no PDF dependency, and separate
// from tefapPrefill so it knows nothing about client profiles.

import type { TefapFieldValue, TefapFormField } from "../types/tefap-types";

export interface TefapValidationIssue {
  fieldKey: string;
  label: string;
  code: "required";
  message: string;
}

/** Empty value appropriate to a field's type. */
export const emptyValueFor = (field: TefapFormField): string | boolean =>
  field.type === "checkbox" ? false : "";

/** Turns an answer list into a lookup, last entry winning on duplicates. */
export const toValueMap = (values: TefapFieldValue[]): Map<string, string | boolean> => {
  const map = new Map<string, string | boolean>();
  for (const entry of values) {
    map.set(entry.field, entry.value);
  }
  return map;
};

/** Turns a lookup back into the array form stored in Firestore. */
export const toValueList = (values: Map<string, string | boolean>): TefapFieldValue[] =>
  Array.from(values.entries()).map(([field, value]) => ({ field, value }));

/**
 * Checkboxes standing in for a Yes/No pair are independent fields in the PDF,
 * so nothing stops both being ticked. Applying a field's `exclusiveWith` list
 * clears its partners whenever it is checked.
 */
export const applyExclusivity = (
  fields: TefapFormField[],
  values: Map<string, string | boolean>,
  changedKey: string
): Map<string, string | boolean> => {
  const changed = fields.find((field) => field.key === changedKey);
  if (!changed || changed.type !== "checkbox") return values;
  if (values.get(changedKey) !== true) return values;

  const next = new Map(values);
  for (const partnerKey of changed.exclusiveWith ?? []) {
    if (partnerKey === changedKey) continue;
    if (next.has(partnerKey)) {
      next.set(partnerKey, false);
    }
  }
  return next;
};

/** True when a value counts as supplied for required-field purposes. */
export const hasValue = (field: TefapFormField, value: string | boolean | undefined): boolean => {
  if (value === undefined || value === null) return false;
  if (field.type === "checkbox") return value === true;
  return String(value).trim().length > 0;
};

/**
 * Reports required fields left blank. Hidden fields are exempt: the filler is
 * never shown them, so they cannot be held responsible for filling them.
 */
export const validateRequired = (
  fields: TefapFormField[],
  values: TefapFieldValue[]
): TefapValidationIssue[] => {
  const map = toValueMap(values);

  return fields
    .filter((field) => field.required && !field.hidden)
    .filter((field) => !hasValue(field, map.get(field.key)))
    .map((field) => ({
      fieldKey: field.key,
      label: field.label,
      code: "required" as const,
      message: `${field.label} is required.`,
    }));
};

/** Fields a filler actually sees, in display order. */
export const visibleFields = (fields: TefapFormField[]): TefapFormField[] =>
  fields.filter((field) => !field.hidden).sort((left, right) => left.order - right.order);
