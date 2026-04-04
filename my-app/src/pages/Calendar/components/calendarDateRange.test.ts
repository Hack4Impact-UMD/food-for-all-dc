import { describe, expect, it } from "@jest/globals";
import { DayPilot } from "@daypilot/daypilot-lite-react";
import { DateTime } from "luxon";
import { deliveryDate } from "../../../utils/deliveryDate";
import { getCalendarViewRange } from "./calendarDateRange";

describe("getCalendarViewRange", () => {
  // App coverage:
  // - day calendar queries events in a one-day window around the selected date
  // - off-by-one errors here drop or duplicate deliveries in day view
  // Behavior contract: Day view starts at selected day and ends exclusively at next day.
  it("returns one-day inclusive/exclusive bounds for Day view", () => {
    const currentDate = new DayPilot.Date("2026-03-31");

    const range = getCalendarViewRange(currentDate, "Day");

    expect(range.start.toString("yyyy-MM-dd")).toBe("2026-03-31");
    expect(range.endExclusive.toString("yyyy-MM-dd")).toBe("2026-04-01");
    expect(deliveryDate.toISODateString(range.queryStart)).toBe("2026-03-31");
    expect(deliveryDate.toISODateString(range.queryEndExclusive)).toBe("2026-04-01");
  });

  // App coverage:
  // - month calendar prefetches an expanded grid window to avoid edge fetch misses while navigating
  // - incorrect expansion can omit events from visible leading/trailing weeks
  // Behavior contract: Month view range expands by two weeks around month-aligned Sunday/Saturday bounds.
  it("returns expanded month grid bounds with two-week padding", () => {
    const currentDate = new DayPilot.Date("2026-03-31");

    const range = getCalendarViewRange(currentDate, "Month");

    expect(range.start.toString("yyyy-MM-dd")).toBe("2026-02-15");
    expect(range.endExclusive.toString("yyyy-MM-dd")).toBe("2026-04-19");
    expect(deliveryDate.toISODateString(range.queryStart)).toBe("2026-02-15");
    expect(deliveryDate.toISODateString(range.queryEndExclusive)).toBe("2026-04-19");
  });

  // App coverage:
  // - month rendering assumes week rows are Sunday-start and Saturday-end before padding is applied
  // - weekday alignment regressions would shift event lanes in the month grid
  // Behavior contract: computed month start/end anchors align to Sunday and Saturday week boundaries.
  it("keeps month range anchored to Sunday/Saturday week alignment", () => {
    const currentDate = new DayPilot.Date("2026-04-10");

    const range = getCalendarViewRange(currentDate, "Month");

    const startDay = DateTime.fromISO(range.start.toString("yyyy-MM-dd"), {
      zone: deliveryDate.zone,
    }).weekday;
    const endExclusiveMinusOneDay = DateTime.fromISO(
      range.endExclusive.addDays(-1).toString("yyyy-MM-dd"),
      { zone: deliveryDate.zone }
    ).weekday;

    expect(startDay).toBe(7);
    expect(endExclusiveMinusOneDay).toBe(6);
  });
});
