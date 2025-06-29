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
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }
  return dateObj.toUTCString().split(' ').slice(0, 4).join(' ');
};

/**
 * Format a date to MM/DD/YYYY
 * @param date The date to format
 * @returns The formatted date string in MM/DD/YYYY format
 */
export const formatDateToMMDDYYYY = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

import { validatePartialDateInput, isValidDateFormat } from './validation';

/**
 * Validates and processes a date input, ensuring the year is within an acceptable range
 * @param dateStr Date string in YYYY-MM-DD format (HTML input[type="date"] format) or MM/DD/YYYY format
 * @param onValid Callback to run when date is valid
 * @param onError Optional callback for handling validation errors
 * @param minYear Minimum acceptable year (default: 1900)
 * @param maxYear Maximum acceptable year (default: 2100)
 * @returns An object with validation result and any error message
 */
export const validateDateInput = (
  dateStr: string,
  onValid: (dateStr: string) => void,
  onError?: ((errorMessage: string) => void) | null,
  minYear = 1900,
  maxYear = 2100
): { isValid: boolean; errorMessage?: string } => {
  
  if (!dateStr) {
    const errorMessage = "Date is required. Format must be MM/DD/YYYY";
    console.log("validateDateInput error - empty:", errorMessage);
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }
  
  // Check for placeholder text and common input errors
  if (/dd|mm|yy/i.test(dateStr)) {
    const errorMessage = "Please replace placeholder text with actual date values. Format must be MM/DD/YYYY";
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }
  
  // Enforce MM/DD/YYYY format
  if (!dateStr.includes('/')) {
    const errorMessage = "Date must be in MM/DD/YYYY format";
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }
    // Handle MM/DD/YYYY format only
  const parts = dateStr.split('/');
  
  // Basic format validation
  if (parts.length !== 3) {
    const errorMessage = "Date must be in MM/DD/YYYY format";
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }
  
  // Check format pattern matches MM/DD/YYYY
  const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(\d{4})$/;
  if (!dateRegex.test(dateStr)) {
    const errorMessage = "Date must be in MM/DD/YYYY format";
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }
  
  const [month, day, year] = parts.map(p => parseInt(p, 10));
  
  // Check year is valid
  if (isNaN(year) || year < minYear || year > maxYear) {
    const errorMessage = `Year must be between ${minYear} and ${maxYear}`;
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }
  
  // Check month and day
  if (isNaN(month) || month < 1 || month > 12) {
    const errorMessage = "Month must be between 1-12";
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }
  
  if (isNaN(day) || day < 1 || day > 31) {
    const errorMessage = "Day must be between 1-31";
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }
  
  // Check that it's a real date (e.g., not February 30)
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    const errorMessage = "Invalid date";
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }
  
  // Date is valid, call the provided callback
  onValid(dateStr);
  return { isValid: true };
};

/**
 * Attempts to normalize/format a date input to prevent common formatting mistakes
 * @param dateStr The input date string to normalize
 * @param format The target format ('MM/DD/YYYY' or 'YYYY-MM-DD')
 * @returns The normalized date string or the original if it couldn't be normalized
 */
export const normalizeDate = (dateStr: string): string => {
  // Always normalize to MM/DD/YYYY format - it's the only acceptable format
  // Return empty string as-is
  if (!dateStr) return '';
  
  // If it already contains placeholder text, don't try to normalize it
  if (/dd|mm|yy/i.test(dateStr)) {
    return dateStr;
  }
    // Handle MM/DD/YYYY format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    
    if (parts.length === 3) {
      // Try to fix common issues
      let [month, day, year] = parts;
      
      // Pad month and day with leading zeros
      if (month.length === 1) month = `0${month}`;
      if (day.length === 1) day = `0${day}`;
      
      // Fix year issues (2-digit years)
      if (year.length === 2) {
        const twoDigitYear = parseInt(year, 10);
        // Use current century for years less than 50, previous century for years >= 50
        year = twoDigitYear < 50 ? `20${year}` : `19${year}`;
      }
      
      // Add missing digits for years like "202" -> "2020"
      if (year.length === 3) {
        year = `${year}0`;
      }
      
      // Pad shorter years with zeros to make 4 digits
      if (year.length < 4) {
        year = year.padStart(4, '0');
      }
      
      // Always return MM/DD/YYYY format
      return `${month}/${day}/${year}`;
    }
  }
  // Handle YYYY-MM-DD format and convert it to MM/DD/YYYY
  else if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    
    if (parts.length === 3) {
      let [year, month, day] = parts;
      
      // Pad month and day with leading zeros
      if (month.length === 1) month = `0${month}`;
      if (day.length === 1) day = `0${day}`;
      
      // Fix year issues (2-digit years)
      if (year.length === 2) {
        const twoDigitYear = parseInt(year, 10);
        year = twoDigitYear < 50 ? `20${year}` : `19${year}`;
      }
      
      // Always convert to MM/DD/YYYY format
      return `${month}/${day}/${year}`;
    }
  }
  
  // If we can't normalize, return original
  return dateStr;
}