/**
 * Date utility functions using Luxon for consistent time handling
 */
import { Time, TimeUtils } from './timeUtils';

export const getRecurrencePattern = (date: string): string => {
  const dateTime = TimeUtils.fromISO(date);
  return Time.Recurrence.getRecurrencePattern(dateTime);
};

export const getNextMonthlyDate = (originalDate: Date, currentDate: Date, targetDay?: number): Date => {
  const originalDateTime = TimeUtils.fromJSDate(originalDate);
  const currentDateTime = TimeUtils.fromJSDate(currentDate);
  const nextDate = Time.Recurrence.getNextMonthlyDate(originalDateTime, currentDateTime, targetDay);
  return nextDate.toJSDate();
};

export const formatDateToYYYYMMDD = (date: Date): string => {
  const dateTime = TimeUtils.fromJSDate(date);
  return dateTime.toISODate() || '';
};

export const formatDate = (date: Date | string): string => {
  try {
    const dateTime = TimeUtils.fromAny(date);
    if (!dateTime.isValid) {
      return 'Invalid date';
    }
    return dateTime.toLocaleString();
  } catch {
    return 'Invalid date';
  }
};