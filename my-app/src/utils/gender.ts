import type { ClientProfile } from "../types/client-types";

export type Gender = ClientProfile["gender"];

/** Canonical gender values, in the order the profile dropdown shows them. */
export const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Unknown",
  "Other",
] as const satisfies readonly Gender[];

/**
 * Coerce a stored gender value to one of the canonical options.
 * Records written before the option list was fixed can hold anything, so
 * unrecognized values become "Unknown" rather than reaching the UI as a value
 * the dropdown cannot represent (which would show one value and save another).
 */
export const normalizeGender = (value: unknown): Gender => {
  if (typeof value !== "string") {
    return "Unknown";
  }
  const normalized = value.trim().toLowerCase();
  return GENDER_OPTIONS.find((option) => option.toLowerCase() === normalized) ?? "Unknown";
};
