/**
 * Centralized time utilities using Luxon for consistent date/time handling
 * Fixes off-by-one bugs and timezone inconsistencies throughout the app
 */
import { DateTime, Settings } from "luxon";
import { Timestamp } from "firebase/firestore";

// Configure default timezone to Eastern Time
Settings.defaultZone = "America/New_York";

export class TimeUtils {
  static now(): DateTime {
    return DateTime.now();
  }

  static fromObject(obj: {
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    minute?: number;
    second?: number;
  }): DateTime {
    return DateTime.fromObject(obj);
  }

  static fromISO(isoString: string): DateTime {
    return DateTime.fromISO(isoString);
  }

  static fromFormat(dateString: string, format: string): DateTime {
    return DateTime.fromFormat(dateString, format);
  }

  static fromJSDate(date: Date): DateTime {
    return DateTime.fromJSDate(date);
  }

  static fromFirebaseTimestamp(timestamp: Timestamp): DateTime {
    return DateTime.fromJSDate(timestamp.toDate());
  }

  /**
   * Universal converter for any date input type
   */
  static fromAny(input: string | Date | DateTime | Timestamp): DateTime {
    if (input instanceof DateTime) {
      return input;
    }
    if (input instanceof Date) {
      return TimeUtils.fromJSDate(input);
    }
    if (input instanceof Timestamp) {
      return TimeUtils.fromFirebaseTimestamp(input);
    }
    if (typeof input === "string") {
      // Try ISO first
      let dt = DateTime.fromISO(input);
      if (dt.isValid) return dt;
      // Try MM/DD/YYYY
      dt = DateTime.fromFormat(input, "MM/dd/yyyy");
      if (dt.isValid) return dt;
      // Try JS Date fallback
      dt = DateTime.fromJSDate(new Date(input));
      return dt;
    }
    // Fallback: invalid
    return DateTime.invalid("Invalid input for fromAny");
  }

  static toDateString(dateTime: DateTime): string {
    return dateTime.toISODate() || "";
  }

  static toISOString(dateTime: DateTime): string {
    return dateTime.toISO() || "";
  }

  static toJSDate(dateTime: DateTime): Date {
    return dateTime.toJSDate();
  }

  static toDisplayString(dateTime: DateTime): string {
    return dateTime.toLocaleString(DateTime.DATE_FULL);
  }

  static startOfDay(dateTime: DateTime): DateTime {
    return dateTime.startOf("day");
  }

  static endOfDay(dateTime: DateTime): DateTime {
    return dateTime.endOf("day");
  }

  static isValid(dateTime: DateTime): boolean {
    return dateTime.isValid;
  }

  /**
   * Get today at midnight
   */
  static today(): DateTime {
    return DateTime.now().startOf("day");
  }

  static isToday(dateTime: DateTime): boolean {
    return dateTime.hasSame(DateTime.now(), "day");
  }

  static isPast(dateTime: DateTime): boolean {
    return dateTime < TimeUtils.today();
  }

  static isFuture(dateTime: DateTime): boolean {
    return dateTime > TimeUtils.today();
  }

  static add(
    dateTime: DateTime,
    duration: {
      days?: number;
      weeks?: number;
      months?: number;
      years?: number;
      hours?: number;
      minutes?: number;
    }
  ): DateTime {
    return dateTime.plus(duration);
  }

  static subtract(
    dateTime: DateTime,
    duration: {
      days?: number;
      weeks?: number;
      months?: number;
      years?: number;
      hours?: number;
      minutes?: number;
    }
  ): DateTime {
    return dateTime.minus(duration);
  }

  static diff(
    start: DateTime,
    end: DateTime,
    unit: "days" | "weeks" | "months" | "years" | "hours" | "minutes" = "days"
  ): number {
    return end.diff(start, unit).as(unit);
  }

  static isSame(
    dt1: DateTime,
    dt2: DateTime,
    unit: "day" | "week" | "month" | "year" = "day"
  ): boolean {
    return dt1.hasSame(dt2, unit);
  }

  static isBefore(dt1: DateTime, dt2: DateTime): boolean {
    return dt1 < dt2;
  }

  static isAfter(dt1: DateTime, dt2: DateTime): boolean {
    return dt1 > dt2;
  }
}

/**
 * Date validation utilities with consistent error handling
 */
export class DateValidation {
  static validateNotPast(dateTime: DateTime): { isValid: boolean; errorMessage?: string } {
    if (!dateTime.isValid) {
      return { isValid: false, errorMessage: "Invalid date" };
    }

    if (TimeUtils.isPast(dateTime)) {
      return { isValid: false, errorMessage: "Date cannot be in the past" };
    }

    return { isValid: true };
  }

  /**
   * Validate date range ensuring start <= end
   */
  static validateDateRange(
    startDate: DateTime | null,
    endDate: DateTime | null
  ): { isValid: boolean; startDateError?: string; endDateError?: string } {
    const result: { isValid: boolean; startDateError?: string; endDateError?: string } = {
      isValid: true,
    };

    if (!startDate || !endDate) {
      return result;
    }

    if (!startDate.isValid) {
      result.startDateError = "Invalid start date";
      result.isValid = false;
    }

    if (!endDate.isValid) {
      result.endDateError = "Invalid end date";
      result.isValid = false;
    }

    if (startDate.isValid && endDate.isValid && TimeUtils.isAfter(startDate, endDate)) {
      result.endDateError = "End date must be on or after start date";
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate delivery date range (allows past delivery dates)
   */
  static validateDeliveryDateRange(
    deliveryDate: DateTime | null,
    endDate: DateTime | null
  ): { isValid: boolean; endDateError?: string } {
    if (!deliveryDate || !endDate) {
      return { isValid: true };
    }

    if (!deliveryDate.isValid || !endDate.isValid) {
      return { isValid: false, endDateError: "Invalid date" };
    }

    if (TimeUtils.isAfter(deliveryDate, endDate)) {
      return { isValid: false, endDateError: "Delivery date cannot be after End Date" };
    }

    return { isValid: true };
  }
}

/**
 * Recurrence pattern utilities for delivery scheduling
 */
export class RecurrenceUtils {
  /**
   * Generate human-readable pattern like "3rd Wednesday"
   */
  static getRecurrencePattern(dateTime: DateTime): string {
    const weekOfMonth = Math.ceil(dateTime.day / 7);
    const dayOfWeek = dateTime.weekdayLong;
    const ordinalSuffix = RecurrenceUtils.getOrdinalSuffix(weekOfMonth);

    return `${weekOfMonth}${ordinalSuffix} ${dayOfWeek}`;
  }

  static getOrdinalSuffix(num: number): string {
    if (num === 1 || num === 21 || num === 31) return "st";
    if (num === 2 || num === 22) return "nd";
    if (num === 3 || num === 23) return "rd";
    return "th";
  }

  /**
   * Calculate next monthly occurrence handling edge cases like 5th week
   */
  static getNextMonthlyDate(
    originalDate: DateTime,
    currentDate: DateTime,
    targetDay?: number
  ): DateTime {
    // Instead of monthly, schedule every 4 weeks (28 days) from originalDate
    const nextDate = originalDate.plus({ days: 28 });
    return nextDate;
  }

  /**
   * Generate all recurrence dates within the specified range
   */
  static calculateRecurrenceDates(
    deliveryDate: DateTime,
    recurrence: "Weekly" | "2x-Monthly" | "Monthly" | "None" | "Custom",
    endDate?: DateTime
  ): DateTime[] {
    const dates: DateTime[] = [deliveryDate];

    if (recurrence === "None" || recurrence === "Custom" || !endDate) {
      return dates;
    }

    let currentDate = deliveryDate;
    const interval =
      recurrence === "Weekly"
        ? { weeks: 1 }
        : recurrence === "2x-Monthly"
          ? { weeks: 2 }
          : recurrence === "Monthly"
            ? { days: 28 }
            : { months: 1 };

    while (currentDate < endDate) {
      currentDate = currentDate.plus(interval);
      if (currentDate <= endDate) {
        dates.push(currentDate);
      }
    }

    return dates;
  }
}

/**
 * Calendar integration utilities for DayPilot and other calendar components
 */
export class CalendarUtils {
  static toDayPilotString(dateTime: DateTime): string {
    return dateTime.toFormat("yyyy-MM-dd");
  }

  static fromDayPilotString(dateString: string): DateTime {
    return DateTime.fromFormat(dateString, "yyyy-MM-dd");
  }

  static getWeekBounds(dateTime: DateTime): { start: DateTime; end: DateTime } {
    const start = dateTime.startOf("week");
    const end = dateTime.endOf("week");
    return { start, end };
  }

  static getMonthBounds(dateTime: DateTime): { start: DateTime; end: DateTime } {
    const start = dateTime.startOf("month");
    const end = dateTime.endOf("month");
    return { start, end };
  }
}

/**
 * Firebase Timestamp integration utilities
 */
export class FirebaseTimeUtils {
  static toTimestamp(dateTime: DateTime): Timestamp {
    return Timestamp.fromDate(dateTime.toJSDate());
  }

  static fromTimestamp(timestamp: Timestamp): DateTime {
    return TimeUtils.fromFirebaseTimestamp(timestamp);
  }

  /**
   * Safely prepare any date input for Firestore storage
   */
  static prepareForStorage(input: string | Date | DateTime | null): Timestamp | null {
    if (!input) return null;

    const dateTime = TimeUtils.fromAny(input);
    return dateTime.isValid ? FirebaseTimeUtils.toTimestamp(dateTime) : null;
  }

  /**
   * Calculate age in years from date of birth
   */
  static calculateAge(dob: Date | DateTime): number {
    const dobDateTime = dob instanceof DateTime ? dob : TimeUtils.fromJSDate(dob);
    const now = TimeUtils.now();
    const years = now.diff(dobDateTime, "years");
    return Math.floor(years.years);
  }
}

// Unified namespace for all time utilities
export const Time = {
  ...TimeUtils,
  Validation: DateValidation,
  Recurrence: RecurrenceUtils,
  Calendar: CalendarUtils,
  Firebase: FirebaseTimeUtils,
};

export { TimeUtils as default };
