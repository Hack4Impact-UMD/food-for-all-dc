import { DayPilot } from "@daypilot/daypilot-lite-react";
import { DeliveryService } from "../../../services";
import { NewDelivery } from "../../../types/calendar-types";
import { Time, TimeUtils } from "../../../utils/timeUtils";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

let firestoreLimits: number[] = [60, 60, 60, 60, 90, 90, 60];

const deliveryService = DeliveryService.getInstance();

(async () => {
  try {
    const limits = await deliveryService.getWeeklyLimits();
    firestoreLimits = DAYS.map((day) => limits[day] || 60);
  } catch (error) {
    console.error("Error initializing limits:", error);
  }
})();

export const getDefaultLimit = (
  date: DayPilot.Date,
  limits: Record<string, number> | number[]
): number => {
  if (Array.isArray(limits)) {
    return limits[date.getDayOfWeek()];
  } else {
    const dayOfWeek = date.getDayOfWeek();
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      dayOfWeek
    ];
    return limits[dayName] || 20;
  }
};

export const setDefaultLimit = async (date: DayPilot.Date, newLimit: number): Promise<void> => {
  const dayIndex = date.getDayOfWeek();
  const dayField = DAYS[dayIndex];

  try {
    const currentLimits = await deliveryService.getWeeklyLimits();
    const updatedLimits = { ...currentLimits, [dayField]: newLimit };
    await deliveryService.updateWeeklyLimits(updatedLimits);
  } catch (error) {
    console.error("Error updating limit:", error);
  }
};

export const getRecurrencePattern = (date: string): string => {
  const dateTime = TimeUtils.fromISO(date);
  return Time.Recurrence.getRecurrencePattern(dateTime);
};

export const getOrdinalSuffix = (num: number): string => {
  return Time.Recurrence.getOrdinalSuffix(num);
};

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = ("" + phone).replace(/\D/g, "");
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]})-${match[2]}-${match[3]}`;
  }
  return phone;
};

export const getNextMonthlyDate = (
  originalDate: Date,
  currentDate: Date,
  targetDay?: number
): Date => {
  const originalDateTime = TimeUtils.fromJSDate(originalDate);
  const currentDateTime = TimeUtils.fromJSDate(currentDate);
  const nextDate = Time.Recurrence.getNextMonthlyDate(originalDateTime, currentDateTime, targetDay);
  return nextDate.toJSDate();
};

export const calculateRecurrenceDates = (newDelivery: NewDelivery): Date[] => {
  const deliveryDateTime = TimeUtils.fromAny(newDelivery.deliveryDate);
  const endDateTime = newDelivery.repeatsEndDate
    ? TimeUtils.fromAny(newDelivery.repeatsEndDate)
    : undefined;

  const recurrenceDates = Time.Recurrence.calculateRecurrenceDates(
    deliveryDateTime,
    newDelivery.recurrence,
    endDateTime
  );

  return recurrenceDates.map((dt) => dt.toJSDate());
};
