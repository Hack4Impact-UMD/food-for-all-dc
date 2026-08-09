import { describe, expect, it, jest } from "@jest/globals";
import { formatLastEditedTimestamp, validateDateInput } from "../../utils/dates";

describe("validateDateInput", () => {
  // App coverage:
  // - profile and scheduling forms submit MM/DD/YYYY values directly from text/date inputs
  // - valid dates should propagate unchanged to downstream state updates
  // Behavior contract: a valid MM/DD/YYYY value passes validation and triggers onValid.
  it("accepts valid MM/DD/YYYY input", () => {
    const onValid = jest.fn();
    const onError = jest.fn();

    const result = validateDateInput("03/15/2026", onValid, onError);

    expect(result).toEqual({ isValid: true });
    expect(onValid).toHaveBeenCalledWith("03/15/2026");
    expect(onError).not.toHaveBeenCalled();
  });

  // App coverage:
  // - html date inputs emit YYYY-MM-DD strings that must be normalized for shared form logic
  // - normalization regressions would break date persistence in profile/calendar flows
  // Behavior contract: valid YYYY-MM-DD is accepted and converted to MM/DD/YYYY.
  it("accepts valid YYYY-MM-DD input and normalizes to MM/DD/YYYY", () => {
    const onValid = jest.fn();
    const onError = jest.fn();

    const result = validateDateInput("2026-03-15", onValid, onError);

    expect(result).toEqual({ isValid: true });
    expect(onValid).toHaveBeenCalledWith("03/15/2026");
    expect(onError).not.toHaveBeenCalled();
  });

  // App coverage:
  // - manual entry can produce structurally valid but impossible calendar dates
  // - impossible dates must be blocked before scheduling/profile writes
  // Behavior contract: invalid real-world dates fail with an Invalid date error.
  it("rejects impossible dates such as February 30", () => {
    const onValid = jest.fn();
    const onError = jest.fn();

    const result = validateDateInput("02/30/2026", onValid, onError);

    expect(result).toEqual({ isValid: false, errorMessage: "Invalid date" });
    expect(onValid).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Invalid date");
  });

  // App coverage:
  // - age/status logic depends on sensible date bounds configured by callers
  // - out-of-range years should fail predictably with the configured range message
  // Behavior contract: validation enforces minYear/maxYear boundaries.
  it("enforces configurable year boundaries", () => {
    const onValid = jest.fn();
    const onError = jest.fn();

    const result = validateDateInput("03/15/1999", onValid, onError, 2000, 2030);

    expect(result).toEqual({ isValid: false, errorMessage: "Year must be between 2000 and 2030" });
    expect(onValid).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Year must be between 2000 and 2030");
  });
});

describe("formatLastEditedTimestamp", () => {
  // App coverage:
  // - profile "Last edited" labels read timestamps that Firestore returns as Timestamp instances
  // Behavior contract: a Firestore-style Timestamp is converted through toDate() and formatted.
  it("formats a Firestore Timestamp via toDate()", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const timestamp = { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0, toDate: () => date };

    expect(formatLastEditedTimestamp(timestamp)).toBe(date.toLocaleString());
  });

  // App coverage:
  // - entering and cancelling profile edit mode deep-copies the profile, which can strip a
  //   Timestamp's prototype and leave a bare { seconds, nanoseconds } map
  // Behavior contract: a prototype-less timestamp map still formats instead of showing "Invalid date".
  it("formats a prototype-less { seconds, nanoseconds } map", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const stripped = { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 };

    expect(formatLastEditedTimestamp(stripped)).toBe(date.toLocaleString());
  });

  // App coverage:
  // - profiles saved in the current session hold plain JS Dates before any Firestore round-trip
  // Behavior contract: a JS Date formats directly.
  it("formats a plain JS Date", () => {
    const date = new Date("2026-03-15T12:00:00Z");

    expect(formatLastEditedTimestamp(date)).toBe(date.toLocaleString());
  });

  // App coverage:
  // - clients that never had notes carry a null/absent timestamp
  // Behavior contract: uninterpretable values yield an empty string so no label is rendered.
  it("returns an empty string for missing or unusable values", () => {
    expect(formatLastEditedTimestamp(null)).toBe("");
    expect(formatLastEditedTimestamp(undefined)).toBe("");
    expect(formatLastEditedTimestamp({})).toBe("");
    expect(formatLastEditedTimestamp("not a date")).toBe("");
  });
});
