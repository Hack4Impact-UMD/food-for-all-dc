import { DayPilot } from "@daypilot/daypilot-lite-react";
import { DeliveryService } from "../../../services";
import { NewDelivery } from "../../../types/calendar-types";
import { Time, TimeUtils } from "../../../utils/timeUtils";
import { deliveryDate } from "../../../utils/deliveryDate";
import {
  DEFAULT_CALENDAR_DELIVERY_LIMIT,
  DEFAULT_WEEKLY_CALENDAR_DELIVERY_LIMITS,
} from "../../../config/calendarLimits";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

let firestoreLimits: number[] = DAYS.map((day) => DEFAULT_WEEKLY_CALENDAR_DELIVERY_LIMITS[day]);

const deliveryService = DeliveryService.getInstance();

// Call this after auth is ready
export const initLimits = async () => {
  try {
    const limits = await deliveryService.getWeeklyLimits();
    firestoreLimits = DAYS.map((day) =>
      typeof limits[day] === "number" ? limits[day] : DEFAULT_CALENDAR_DELIVERY_LIMIT
    );
  } catch (error) {
    console.error("Error initializing limits:", error);
  }
};

export const getDefaultLimit = (
  date: DayPilot.Date,
  limits: Record<string, number> | number[]
): number => {
  if (Array.isArray(limits)) {
    const weeklyLimit = limits[date.getDayOfWeek()];
    return typeof weeklyLimit === "number" ? weeklyLimit : DEFAULT_CALENDAR_DELIVERY_LIMIT;
  } else {
    const dayOfWeek = date.getDayOfWeek();
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      dayOfWeek
    ];
    return typeof limits[dayName] === "number" ? limits[dayName] : DEFAULT_CALENDAR_DELIVERY_LIMIT;
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

export const calculateRecurrenceDates = (newDelivery: NewDelivery): string[] => {
  // Monthly-Pattern has its own generator; this function does not handle it.
  if (newDelivery.recurrence === "Monthly-Pattern") return [];

  const deliveryDateTime = deliveryDate.toDateTime(newDelivery.deliveryDate);
  const endDateTime = newDelivery.repeatsEndDate
    ? deliveryDate.toDateTime(newDelivery.repeatsEndDate)
    : undefined;

  // Get recurrence dates as DateTime[]
  const recurrenceDates = Time.Recurrence.calculateRecurrenceDates(
    deliveryDateTime,
    newDelivery.recurrence,
    endDateTime
  );

  // Return as local date strings (YYYY-MM-DD)
  return recurrenceDates.map((dt) => TimeUtils.toDateString(dt));
};

// ── Monthly Recurrence Pattern ────────────────────────────────────────────────

export type WeekPosition = "first" | "second" | "third" | "fourth" | "last";
export type PatternDayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const DAY_OF_WEEK_INDEX: Record<PatternDayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Returns the Date for a given weekday occurrence inside a calendar month.
 * @param year       Full year, e.g. 2026
 * @param month      0-based month index (0 = January)
 * @param position   "first" | "second" | "third" | "fourth" | "last"
 * @param dayIndex   0 = Sunday … 6 = Saturday
 */
function getPatternDateInMonth(
  year: number,
  month: number,
  position: WeekPosition,
  dayIndex: number
): Date | null {
  if (position === "last") {
    // Start from the last day of the month and walk backwards
    const lastDay = new Date(year, month + 1, 0); // day 0 of next month = last day
    let d = lastDay.getDate();
    while (new Date(year, month, d).getDay() !== dayIndex) {
      d--;
    }
    return new Date(year, month, d);
  }

  // Count up occurrences from the 1st
  const ordinal = { first: 1, second: 2, third: 3, fourth: 4 }[position];
  let count = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month, d).getDay() === dayIndex) {
      count++;
      if (count === ordinal) {
        return new Date(year, month, d);
      }
    }
  }
  return null; // shouldn't happen for first–fourth
}

/**
 * Generates all dates matching the monthly weekday-position pattern that fall
 * on or after `startDate` and on or before `endDate` (both inclusive).
 */
export function generateMonthlyRecurrencePatternDates({
  startDate,
  endDate,
  weekPosition,
  dayOfWeek,
}: {
  startDate: Date;
  endDate: Date;
  weekPosition: WeekPosition;
  dayOfWeek: PatternDayOfWeek;
}): Date[] {
  const dayIndex = DAY_OF_WEEK_INDEX[dayOfWeek];
  const results: Date[] = [];

  // Normalise to midnight local time so comparisons are date-only
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  let year = start.getFullYear();
  let month = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const candidate = getPatternDateInMonth(year, month, weekPosition, dayIndex);
    if (candidate && candidate >= start && candidate <= end) {
      results.push(candidate);
    }
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return results;
}
