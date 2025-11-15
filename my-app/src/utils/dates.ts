/**
 * Date utility functions using Luxon for consistent time handling
 */
import { Time, TimeUtils } from "./timeUtils";

export const getRecurrencePattern = (date: string): string => {
  const dateTime = TimeUtils.fromISO(date);
  return Time.Recurrence.getRecurrencePattern(dateTime);
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

export const formatDateToYYYYMMDD = (date: Date): string => {
  const dateTime = TimeUtils.fromJSDate(date);
  return dateTime.toISODate() || "";
};

export const formatDate = (date: Date | string): string => {
  try {
    const dateTime = TimeUtils.fromAny(date);
    if (!dateTime.isValid) {
      return "Invalid date";
    }
    return dateTime.toLocaleString();
  } catch {
    return "Invalid date";
  }
};

/**
 * Format a date to MM/DD/YYYY
 * @param date The date to format
 * @returns The formatted date string in MM/DD/YYYY format
 */
export const formatDateToMMDDYYYY = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

import { validatePartialDateInput, isValidDateFormat } from "./validation";

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
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }

  // Check for placeholder text and common input errors
  if (/dd|mm|yy/i.test(dateStr)) {
    const errorMessage =
      "Please replace placeholder text with actual date values. Format must be MM/DD/YYYY";
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }

  // Handle both MM/DD/YYYY and YYYY-MM-DD formats
  let normalizedDateStr = dateStr;

  // If it's YYYY-MM-DD format, convert to MM/DD/YYYY
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split("-");
    normalizedDateStr = `${month}/${day}/${year}`;
  }

  // Enforce MM/DD/YYYY format after normalization
  if (!normalizedDateStr.includes("/")) {
    const errorMessage = "Date must be in MM/DD/YYYY format";
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }

  // Handle MM/DD/YYYY format only
  const parts = normalizedDateStr.split("/");

  // Basic format validation
  if (parts.length !== 3) {
    const errorMessage = "Date must be in MM/DD/YYYY format";
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }

  // Check format pattern matches MM/DD/YYYY
  const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(\d{4})$/;
  if (!dateRegex.test(normalizedDateStr)) {
    const errorMessage = "Date must be in MM/DD/YYYY format";
    if (onError) onError(errorMessage);
    return { isValid: false, errorMessage };
  }

  const [month, day, year] = parts.map((p) => parseInt(p, 10));

  // Check year is valid and exactly 4 digits
  if (isNaN(year) || year < minYear || year > maxYear || parts[2].length !== 4) {
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

  // Date is valid, call the provided callback with MM/DD/YYYY format
  onValid(normalizedDateStr);
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
  if (!dateStr) return "";

  // If it already contains placeholder text, don't try to normalize it
  if (/dd|mm|yy/i.test(dateStr)) {
    return dateStr;
  }
  // Handle MM/DD/YYYY format
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");

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
        year = year.padStart(4, "0");
      }

      // Always return MM/DD/YYYY format
      return `${month}/${day}/${year}`;
    }
  }
  // Handle YYYY-MM-DD format and convert it to MM/DD/YYYY
  else if (dateStr.includes("-")) {
    const parts = dateStr.split("-");

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
};
