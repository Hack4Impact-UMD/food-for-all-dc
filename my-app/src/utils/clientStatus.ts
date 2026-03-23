import { DateTime } from "luxon";
import type { Timestamp } from "firebase/firestore";
import type { ClientServiceStatus } from "../types/client-types";
import TimeUtils from "./timeUtils";

type SupportedDateInput = string | Date | DateTime | Timestamp | null | undefined;

export const CLIENT_STATUS_RECENT_DELIVERY_DAYS = 90;

export interface ClientStatusInput {
  startDate: SupportedDateInput;
  endDate: SupportedDateInput;
  lastPastDeliveryDate?: SupportedDateInput;
  today?: DateTime;
}

export interface ClientStatusResult {
  status: ClientServiceStatus;
  canSchedule: boolean;
}

const normalizeDate = (value: SupportedDateInput): DateTime | null => {
  if (!value) {
    return null;
  }

  const normalized = TimeUtils.fromAny(value).startOf("day");
  return normalized.isValid ? normalized : null;
};

export const getClientServiceState = ({
  startDate,
  endDate,
  lastPastDeliveryDate,
  today = TimeUtils.now().startOf("day"),
}: ClientStatusInput): ClientStatusResult => {
  const normalizedStartDate = normalizeDate(startDate);
  const normalizedEndDate = normalizeDate(endDate);

  if (!normalizedStartDate || !normalizedEndDate) {
    return { status: "inactive", canSchedule: false };
  }

  if (normalizedStartDate > today || normalizedEndDate < today) {
    return { status: "inactive", canSchedule: false };
  }

  const recentWindowStart = today.minus({ days: CLIENT_STATUS_RECENT_DELIVERY_DAYS });
  const normalizedLastPastDeliveryDate = normalizeDate(lastPastDeliveryDate);

  if (
    normalizedLastPastDeliveryDate &&
    normalizedLastPastDeliveryDate <= today &&
    normalizedLastPastDeliveryDate >= recentWindowStart
  ) {
    return { status: "active", canSchedule: true };
  }

  return { status: "lapsed", canSchedule: true };
};
