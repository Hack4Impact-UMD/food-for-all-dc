import { deliveryDate, type DeliveryDateInput } from "./deliveryDate";

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

export interface ClientActiveStatusOptions {
  referenceDate?: DeliveryDateInput;
  autoInactiveStrikeDate?: DeliveryDateInput;
  autoInactivePreviousEndDate?: DeliveryDateInput;
}

export const computeClientActiveStatus = (
  startDate: DeliveryDateInput,
  endDate: DeliveryDateInput,
  autoInactiveReason?: string | null,
  options: ClientActiveStatusOptions = {}
): boolean => {
  const hasReferenceDate = options.referenceDate !== null && options.referenceDate !== undefined;
  const statusDate = hasReferenceDate
    ? deliveryDate.tryToDateTime(options.referenceDate)?.startOf("day")
    : deliveryDate.today().startOf("day");
  if (!statusDate?.isValid) {
    return false;
  }

  let effectiveEndDate = endDate;
  if (autoInactiveReason === "three-strikes") {
    if (!hasReferenceDate) {
      return false;
    }

    const strikeDate = options.autoInactiveStrikeDate
      ? deliveryDate.tryToDateTime(options.autoInactiveStrikeDate)?.startOf("day")
      : null;
    if (!strikeDate?.isValid || statusDate.toMillis() >= strikeDate.toMillis()) {
      return false;
    }

    effectiveEndDate = options.autoInactivePreviousEndDate;
  }

  const startDateTime = startDate ? deliveryDate.tryToDateTime(startDate)?.startOf("day") : null;
  if (!startDateTime?.isValid) {
    return false;
  }

  const endDateTime = effectiveEndDate
    ? deliveryDate.tryToDateTime(effectiveEndDate)?.startOf("day")
    : null;
  const statusDateMillis = statusDate.toMillis();

  if (endDateTime?.isValid) {
    return (
      statusDateMillis >= startDateTime.toMillis() && statusDateMillis <= endDateTime.toMillis()
    );
  }

  return statusDateMillis >= startDateTime.toMillis();
};

export const getClientStatusPresentation = (
  activeStatus?: boolean,
  missedStrikeCount?: number | string | null
): ClientStatusPresentation => {
  const numericMissedCount =
    typeof missedStrikeCount === "number"
      ? missedStrikeCount
      : typeof missedStrikeCount === "string"
        ? Number.parseFloat(missedStrikeCount)
        : NaN;

  const normalizedCount = Number.isFinite(numericMissedCount) && numericMissedCount > 0
    ? Math.floor(numericMissedCount)
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
