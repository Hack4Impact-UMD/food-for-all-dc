import { DateLimit } from "../../../types/calendar-types";
import { deliveryDate } from "../../../utils/deliveryDate";

export type CapacityStatus = "normal" | "near" | "at" | "over";
export type CapacityWarningStatus = Exclude<CapacityStatus, "normal">;

export const NEAR_LIMIT_RATIO = 0.8;

const DAY_NAMES_LOWER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DAY_NAMES_TITLE = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface CapacityUi {
  color: string;
  emphasis: boolean;
  statusLabel?: string;
}

export interface CapacityWarningEntry {
  dateKey: string;
  projectedCount: number;
  limit: number;
  status: CapacityWarningStatus;
}

interface BuildProjectedCapacityWarningsParams {
  dateAdjustments: Record<string, number>;
  existingCounts: Record<string, number>;
  weeklyLimits: Record<string, number> | number[];
  dailyLimitsMap: Record<string, number>;
  clampProjectedCountToZero?: boolean;
}

export const buildDailyLimitsMap = (dailyLimits: DateLimit[]): Record<string, number> => {
  return dailyLimits.reduce(
    (acc, item) => {
      if (item?.date && typeof item.limit === "number") {
        acc[item.date] = item.limit;
      }
      return acc;
    },
    {} as Record<string, number>
  );
};

export const resolveLimitForDate = (
  dateKey: string,
  weeklyLimits: Record<string, number> | number[],
  dailyLimitsMap: Record<string, number>
): number => {
  const dailyLimit = dailyLimitsMap[dateKey];
  if (typeof dailyLimit === "number") {
    return dailyLimit;
  }

  const dayIndex = deliveryDate.toJSDate(dateKey).getDay();
  if (Array.isArray(weeklyLimits)) {
    const weeklyLimit = weeklyLimits[dayIndex];
    return typeof weeklyLimit === "number" ? weeklyLimit : 60;
  }

  const lowerKey = DAY_NAMES_LOWER[dayIndex];
  const titleKey = DAY_NAMES_TITLE[dayIndex];
  const weeklyLimit = weeklyLimits[lowerKey] ?? weeklyLimits[titleKey];
  return typeof weeklyLimit === "number" ? weeklyLimit : 60;
};

export const getCapacityStatus = (
  count: number,
  limit: number,
  nearRatio = NEAR_LIMIT_RATIO
): CapacityStatus => {
  if (limit <= 0) {
    return count > 0 ? "over" : "normal";
  }

  if (count > limit) {
    return "over";
  }

  if (count === limit) {
    return "at";
  }

  if (count / limit >= nearRatio) {
    return "near";
  }

  return "normal";
};

export const getCapacityUi = (status: CapacityStatus): CapacityUi => {
  switch (status) {
    case "near":
      return {
        color: "var(--color-warning-text)",
        emphasis: false,
      };
    case "at":
      return {
        color: "var(--color-warning-text)",
        emphasis: true,
        statusLabel: "FULL",
      };
    case "over":
      return {
        color: "var(--color-error-text)",
        emphasis: true,
      };
    case "normal":
    default:
      return {
        color: "var(--color-primary)",
        emphasis: false,
      };
  }
};

export const getCapacityWarningText = (status: Exclude<CapacityStatus, "normal">): string => {
  switch (status) {
    case "near":
      return "Approaching daily limit.";
    case "at":
      return "At daily limit.";
    case "over":
      return "Exceeds daily limit.";
  }
};

export const buildProjectedCapacityWarnings = ({
  dateAdjustments,
  existingCounts,
  weeklyLimits,
  dailyLimitsMap,
  clampProjectedCountToZero = false,
}: BuildProjectedCapacityWarningsParams): CapacityWarningEntry[] => {
  return Object.keys(dateAdjustments)
    .map((dateKey) => {
      const rawProjectedCount = (existingCounts[dateKey] || 0) + dateAdjustments[dateKey];
      const projectedCount = clampProjectedCountToZero
        ? Math.max(0, rawProjectedCount)
        : rawProjectedCount;
      const limit = resolveLimitForDate(dateKey, weeklyLimits, dailyLimitsMap);
      const status = getCapacityStatus(projectedCount, limit);
      if (status === "normal") return null;

      return {
        dateKey,
        projectedCount,
        limit,
        status,
      };
    })
    .filter((entry): entry is CapacityWarningEntry => entry !== null)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
};
