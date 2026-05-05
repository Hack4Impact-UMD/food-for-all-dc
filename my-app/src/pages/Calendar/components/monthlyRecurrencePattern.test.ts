import { describe, it, expect } from "@jest/globals";
import { generateMonthlyRecurrencePatternDates } from "./CalendarUtils";

const iso = (d: Date) => {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

describe("generateMonthlyRecurrencePatternDates", () => {
  it("generates Third Friday dates from spec example", () => {
    const results = generateMonthlyRecurrencePatternDates({
      startDate: new Date(2026, 4, 1),  // 2026-05-01
      endDate:   new Date(2026, 9, 16), // 2026-10-16
      weekPosition: "third",
      dayOfWeek: "friday",
    }).map(iso);

    expect(results).toEqual([
      "2026-05-15",
      "2026-06-19",
      "2026-07-17",
      "2026-08-21",
      "2026-09-18",
      "2026-10-16",
    ]);
  });

  it("includes end date when it exactly matches the pattern", () => {
    // Third Friday of October 2026 is 10/16/2026 — endDate matches exactly
    const results = generateMonthlyRecurrencePatternDates({
      startDate: new Date(2026, 9, 1),
      endDate:   new Date(2026, 9, 16),
      weekPosition: "third",
      dayOfWeek: "friday",
    }).map(iso);

    expect(results).toContain("2026-10-16");
  });

  it("excludes dates before startDate", () => {
    // First Monday of May 2026 is 05/04/2026; start is 05/05 so it should be skipped
    const results = generateMonthlyRecurrencePatternDates({
      startDate: new Date(2026, 4, 5),
      endDate:   new Date(2026, 5, 30),
      weekPosition: "first",
      dayOfWeek: "monday",
    }).map(iso);

    expect(results).not.toContain("2026-05-04");
    expect(results).toContain("2026-06-01");
  });

  it("finds the last Friday of each month", () => {
    const results = generateMonthlyRecurrencePatternDates({
      startDate: new Date(2026, 0, 1),
      endDate:   new Date(2026, 2, 31),
      weekPosition: "last",
      dayOfWeek: "friday",
    }).map(iso);

    // Last Friday Jan 2026 = 30th, Feb = 27th, Mar = 27th
    expect(results).toEqual(["2026-01-30", "2026-02-27", "2026-03-27"]);
  });

  it("returns empty array when no dates fall in range", () => {
    const results = generateMonthlyRecurrencePatternDates({
      startDate: new Date(2026, 4, 16), // after 3rd Friday of May (15th)
      endDate:   new Date(2026, 4, 20), // before any next occurrence
      weekPosition: "third",
      dayOfWeek: "friday",
    });

    expect(results).toHaveLength(0);
  });
});
