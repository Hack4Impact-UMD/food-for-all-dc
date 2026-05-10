import { describe, expect, it } from "@jest/globals";
import {
  buildProjectedCapacityWarnings,
  getCapacityStatus,
  resolveLimitForDate,
} from "../../../../pages/Calendar/components/capacityStatus";

describe("capacityStatus helpers", () => {
  // App coverage:
  // - calendar capacity display and warnings in month/day scheduling surfaces
  // - limit selection logic used when comparing projected deliveries against allowed capacity
  // Behavior contract: date-specific daily limits override weekly limits for the same date.
  it("uses date-specific daily limit over weekly defaults", () => {
    const limit = resolveLimitForDate(
      "2026-03-30",
      { monday: 60, Monday: 55, sunday: 40 },
      { "2026-03-30": 75 }
    );

    expect(limit).toBe(75);
  });

  // App coverage:
  // - weekly capacity fallback used when no daily override exists
  // - supports both array-based and object-based weekly limit configurations
  // Behavior contract: resolveLimitForDate reads the correct weekday index from array limits.
  it("falls back to array-based weekly limit when no daily override exists", () => {
    const weeklyLimits = [40, 61, 62, 63, 64, 65, 66]; // Sunday..Saturday
    const limit = resolveLimitForDate("2026-03-30", weeklyLimits, {}); // Monday

    expect(limit).toBe(61);
  });

  // App coverage:
  // - warning chips and capacity color states in Calendar views
  // - threshold logic that determines normal/near/at/over capacity labels
  // Behavior contract: getCapacityStatus returns deterministic bucketed status for count/limit combinations.
  it("classifies counts into normal, near, at, and over statuses", () => {
    expect(getCapacityStatus(7, 10)).toBe("normal");
    expect(getCapacityStatus(8, 10)).toBe("near");
    expect(getCapacityStatus(10, 10)).toBe("at");
    expect(getCapacityStatus(11, 10)).toBe("over");
  });

  // App coverage:
  // - projected warning generation before saving schedule mutations
  // - keeps warning list concise by excluding dates that remain within normal capacity
  // Behavior contract: only near/at/over entries are returned, sorted by date key.
  it("builds sorted projected warnings and omits normal-capacity dates", () => {
    const warnings = buildProjectedCapacityWarnings({
      dateAdjustments: {
        "2026-03-31": 1,
        "2026-03-30": 2,
      },
      existingCounts: {
        "2026-03-30": 8,
        "2026-03-31": 2,
      },
      weeklyLimits: { monday: 10, tuesday: 5 },
      dailyLimitsMap: {},
    });

    expect(warnings).toEqual([
      {
        dateKey: "2026-03-30",
        projectedCount: 10,
        limit: 10,
        status: "at",
      },
    ]);
  });

  // App coverage:
  // - projected count handling when date adjustments reduce counts (e.g., deleting deliveries)
  // - prevents negative warning counts from surfacing in UI when clamping is enabled
  // Behavior contract: clampProjectedCountToZero bounds projected count at zero before status evaluation.
  it("clamps projected counts to zero when clampProjectedCountToZero is enabled", () => {
    const warnings = buildProjectedCapacityWarnings({
      dateAdjustments: {
        "2026-03-30": -10,
      },
      existingCounts: {
        "2026-03-30": 3,
      },
      weeklyLimits: { monday: 0 },
      dailyLimitsMap: {},
      clampProjectedCountToZero: true,
    });

    expect(warnings).toEqual([]);
  });
});
