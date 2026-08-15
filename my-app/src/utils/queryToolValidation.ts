// Validation for the Client Query Tool filter builder.
// Runs entirely client-side, before any Firestore query is constructed.

import { CollectionKey, getFieldDef, OPERATORS_BY_TYPE, QueryFilter } from "../types/query-tool-types";

export interface FilterValidationResult {
  valid: boolean;
  /** Per-filter error messages, keyed by filter id. */
  fieldErrors: Record<string, string>;
  /** Errors that apply to the query as a whole (e.g. illegal operator combinations). */
  formErrors: string[];
}

const SINGLE_USE_OPERATORS = new Set(["in", "not-in", "array-contains-any"]);
const NEGATION_OPERATORS = new Set(["!=", "not-in"]);
const LIST_VALUE_LIMITS: Record<string, number> = {
  in: 30,
  "array-contains-any": 30,
  "not-in": 10,
};

const isValueEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

export const validateFilters = (
  collectionKey: CollectionKey,
  filters: QueryFilter[]
): FilterValidationResult => {
  const fieldErrors: Record<string, string> = {};
  const formErrors: string[] = [];

  if (filters.length === 0) {
    formErrors.push("Add one or more filters, then select Run Query.");
    return { valid: false, fieldErrors, formErrors };
  }

  let arrayContainsCount = 0;
  let singleUseOperatorCount = 0;
  let negationOperatorCount = 0;

  for (const filter of filters) {
    const fieldDef = getFieldDef(collectionKey, filter.field);

    if (!filter.field || !fieldDef) {
      fieldErrors[filter.id] = "Choose a field for this filter.";
      continue;
    }

    if (!filter.operator) {
      fieldErrors[filter.id] = `Choose an operator for ${fieldDef.label}.`;
      continue;
    }

    const validOperators = OPERATORS_BY_TYPE[fieldDef.type];
    if (!validOperators.includes(filter.operator)) {
      fieldErrors[filter.id] =
        `"${filter.operator}" is not a valid operator for ${fieldDef.label}.`;
      continue;
    }

    if (isValueEmpty(filter.value)) {
      fieldErrors[filter.id] = `Choose a value for ${fieldDef.label} before running the query.`;
      continue;
    }

    if (filter.operator === "array-contains" && Array.isArray(filter.value)) {
      fieldErrors[filter.id] = `Choose one value for ${fieldDef.label} when using "contains".`;
      continue;
    }

    const listValueLimit = LIST_VALUE_LIMITS[filter.operator];
    const listValueCount = Array.isArray(filter.value)
      ? filter.value.length
      : String(filter.value)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean).length;
    if (listValueLimit && listValueCount > listValueLimit) {
      fieldErrors[filter.id] =
        `${fieldDef.label} accepts at most ${listValueLimit} values with this operator.`;
      continue;
    }

    if (filter.operator === "array-contains") arrayContainsCount += 1;
    if (SINGLE_USE_OPERATORS.has(filter.operator)) singleUseOperatorCount += 1;
    if (NEGATION_OPERATORS.has(filter.operator)) negationOperatorCount += 1;
  }

  if (arrayContainsCount > 1) {
    formErrors.push("Only one \"contains\" filter is allowed per query.");
  }

  if (singleUseOperatorCount > 1) {
    formErrors.push(
      "Only one \"is any of\", \"is none of\", or \"contains any of\" filter is allowed per query."
    );
  }

  if (negationOperatorCount > 1) {
    formErrors.push("Only one \"not equals\" or \"is none of\" filter is allowed per query.");
  }

  const valid = formErrors.length === 0 && Object.keys(fieldErrors).length === 0;
  return { valid, fieldErrors, formErrors };
};
