import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { DateTime } from "luxon";
import { deliveryDate } from "./deliveryDate";
import { computeClientActiveStatus, getClientStatusPresentation } from "./clientStatus";

describe("clientStatus utilities", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // App coverage:
  // - profile and calendar views rely on active-status gating by start/end date window
  // - boundary regressions can incorrectly hide active clients on exact start/end dates
  // Behavior contract: status is active on inclusive date boundaries and inactive after end date.
  it("treats start/end boundaries as inclusive in active status computation", () => {
    const fixedToday = DateTime.fromISO("2026-03-31T12:00:00", { zone: deliveryDate.zone });
    jest.spyOn(deliveryDate, "today").mockReturnValue(fixedToday);

    expect(computeClientActiveStatus("2026-03-31", "2026-03-31")).toBe(true);
    expect(computeClientActiveStatus("2026-03-01", "2026-03-31")).toBe(true);
    expect(computeClientActiveStatus("2026-03-01", "2026-03-30")).toBe(false);
  });

  // App coverage:
  // - three-strikes automation should force inactive presentation regardless of date range validity
  // - this override prevents re-activation by date edits alone when strike policy applies
  // Behavior contract: autoInactiveReason=three-strikes always returns inactive.
  it("forces inactive status for three-strikes auto-inactive reason", () => {
    const fixedToday = DateTime.fromISO("2026-03-31T12:00:00", { zone: deliveryDate.zone });
    jest.spyOn(deliveryDate, "today").mockReturnValue(fixedToday);

    expect(
      computeClientActiveStatus("2026-03-01", "2026-04-30", "three-strikes")
    ).toBe(false);
  });

  // App coverage:
  // - calendar day cards and profile chips consume this presentation object for icon/color/tooltip
  // - mapping regressions make status indicators inconsistent across views
  // Behavior contract: presentation matches inactive/active + missed-strike thresholds.
  it("maps active status and missed strikes to expected presentation states", () => {
    expect(getClientStatusPresentation(false, 3)).toEqual(
      expect.objectContaining({
        color: "#bdbdbd",
        isActive: false,
        missedStrikeCount: 3,
        tooltip: "Inactive profile",
      })
    );

    expect(getClientStatusPresentation(true, 0)).toEqual(
      expect.objectContaining({
        color: "#4caf50",
        isActive: true,
        missedStrikeCount: 0,
        tooltip: "Active profile, no missed deliveries",
      })
    );

    expect(getClientStatusPresentation(true, 1)).toEqual(
      expect.objectContaining({
        color: "#fbc02d",
        isActive: true,
        missedStrikeCount: 1,
        tooltip: "1 missed delivery",
      })
    );

    expect(getClientStatusPresentation(true, 2)).toEqual(
      expect.objectContaining({
        color: "#d32f2f",
        isActive: true,
        missedStrikeCount: 2,
        tooltip: "2 missed deliveries",
      })
    );
  });

  // App coverage:
  // - UI/client payloads may carry strike counts as strings when serialized through external sources
  // - string counts should still map to the same warning severity colors in day/profile indicators
  // Behavior contract: numeric-string strike counts are parsed and bucketed like numeric input.
  it("parses numeric string strike counts for status presentation", () => {
    expect(getClientStatusPresentation(true, "1")).toEqual(
      expect.objectContaining({
        color: "#fbc02d",
        missedStrikeCount: 1,
        tooltip: "1 missed delivery",
      })
    );

    expect(getClientStatusPresentation(true, "2")).toEqual(
      expect.objectContaining({
        color: "#d32f2f",
        missedStrikeCount: 2,
        tooltip: "2 missed deliveries",
      })
    );
  });
});
