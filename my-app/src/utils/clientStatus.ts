import type { Timestamp } from "firebase/firestore";
import type { DateTime } from "luxon";
import { TimeUtils } from "./timeUtils";

const ACTIVE_ICON_PATH =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z";
const INACTIVE_ICON_PATH =
  "M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z";

export interface ClientStatusPresentation {
  color: string;
  iconPath: string;
  isActive: boolean;
  missedStrikeCount: number;
  tooltip: string;
}

export const computeClientActiveStatus = (
  startDate: string | Date | DateTime | Timestamp | null | undefined,
  endDate: string | Date | DateTime | Timestamp | null | undefined
): boolean => {
  const today = TimeUtils.now().startOf("day");
  const startDateTime = startDate ? TimeUtils.fromAny(startDate).startOf("day") : null;
  if (!startDateTime?.isValid) {
    return false;
  }

  const endDateTime = endDate ? TimeUtils.fromAny(endDate).startOf("day") : null;
  const todayMillis = today.toMillis();

  if (endDateTime?.isValid) {
    return todayMillis >= startDateTime.toMillis() && todayMillis <= endDateTime.toMillis();
  }

  return todayMillis >= startDateTime.toMillis();
};

export const getClientStatusPresentation = (
  activeStatus?: boolean,
  missedStrikeCount?: number
): ClientStatusPresentation => {
  const normalizedCount =
    typeof missedStrikeCount === "number" && missedStrikeCount > 0
      ? Math.floor(missedStrikeCount)
      : 0;

  if (!activeStatus) {
    return {
      color: "#bdbdbd",
      iconPath: INACTIVE_ICON_PATH,
      isActive: false,
      missedStrikeCount: normalizedCount,
      tooltip: "Inactive profile",
    };
  }

  if (normalizedCount === 1) {
    return {
      color: "#fbc02d",
      iconPath: ACTIVE_ICON_PATH,
      isActive: true,
      missedStrikeCount: normalizedCount,
      tooltip: "1 missed delivery",
    };
  }

  if (normalizedCount >= 2) {
    return {
      color: "#d32f2f",
      iconPath: ACTIVE_ICON_PATH,
      isActive: true,
      missedStrikeCount: normalizedCount,
      tooltip: `${normalizedCount} missed deliveries`,
    };
  }

  return {
    color: "#4caf50",
    iconPath: ACTIVE_ICON_PATH,
    isActive: true,
    missedStrikeCount: 0,
    tooltip: "Active profile, no missed deliveries",
  };
};
