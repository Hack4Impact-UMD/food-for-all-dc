/**
 * Date utility functions
 */
import { getOrdinalSuffix } from './format';

/**
 * Gets a human-readable recurrence pattern from a date
 * @param date The date to get the recurrence pattern for
 * @returns The recurrence pattern (e.g. "3rd Wednesday")
 */
export const getRecurrencePattern = (date: string): string => {
  const targetDate = new Date(date);

  // Adjust for local timezone offset
  const localDate = new Date(targetDate.getTime() + targetDate.getTimezoneOffset() * 60000);

  const dayOfWeek = localDate.getDay(); // Get the day of the week (0 = Sunday, 1 = Monday, etc.)
  const weekOfMonth = Math.ceil(localDate.getDate() / 7); // Calculate the week of the month
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return `${weekOfMonth}${getOrdinalSuffix(weekOfMonth)} ${daysOfWeek[dayOfWeek]}`;
};

/**
 * Gets the next monthly date based on a pattern
 * @param originalDate The original date to base the pattern on
 * @param currentDate The current date to calculate from
 * @param targetDay Optional specific day of week to target
 * @returns The next monthly date
 */
export const getNextMonthlyDate = (originalDate: Date, currentDate: Date, targetDay?: number): Date => {
  const nextMonth = new Date(currentDate);
  nextMonth.setDate(1); // Start at the first day of the month
  nextMonth.setMonth(nextMonth.getMonth() + 1); // Move to the next month

  const daysInMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  const originalWeek = Math.ceil(originalDate.getDate() / 7); // Week of the original delivery
  const targetWeek = originalWeek > 4 ? -1 : originalWeek; // If it's the 5th week, use -1 for the last occurrence
  const targetWeekday = targetDay ?? originalDate.getDay(); // Day of the week (0 = Sunday, 1 = Monday, etc.)

  const targetDate = new Date(nextMonth);

  if (targetWeek === -1) {
    // Handle the last occurrence of the target weekday
    targetDate.setDate(daysInMonth); // Start at the last day of the month
    while (targetDate.getDay() !== targetWeekday) {
      targetDate.setDate(targetDate.getDate() - 1); // Move backward to find the last occurrence
    }
  } else {
    // Handle specific week occurrences (1st, 2nd, 3rd, 4th)
    targetDate.setDate((targetWeek - 1) * 7 + 1); // Start at the first day of the target week
    while (targetDate.getDay() !== targetWeekday) {
      targetDate.setDate(targetDate.getDate() + 1); // Move forward to find the correct weekday
    }
  }

  targetDate.setDate(targetDate.getDate() - 1);

  return targetDate;
};

/**
 * Format a date to YYYY-MM-DD
 * @param date The date to format
 * @returns The formatted date string
 */
export const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Formats a date to a readable string
 * @param date The date to format
 * @returns Formatted date string
 */
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }
  return dateObj.toUTCString().split(' ').slice(0, 4).join(' ');
}; 