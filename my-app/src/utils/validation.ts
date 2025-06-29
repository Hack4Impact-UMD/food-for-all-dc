/**
 * Validation utility functions
 */

/**
 * Validates an email address
 * @param email The email to validate
 * @returns Whether the email is valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates a phone number
 * @param phone The phone number to validate
 * @returns Whether the phone number is valid
 */
export const isValidPhone = (phone: string): boolean => {
  // Accept various formats of US phone numbers
  const phoneRegex = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
};

/**
 * Checks if a string is empty or only whitespace
 * @param value The string to check
 * @returns Whether the string is empty or only whitespace
 */
export const isEmpty = (value: string): boolean => {
  return value.trim() === '';
};

/**
 * Validates if a coordinate is valid
 * @param coord The coordinate to validate
 * @returns Whether the coordinate is valid
 */
export const isValidCoordinate = (
  coord: any
): coord is [number, number] | { lat: number; lng: number } => {
  if (!coord) return false;

  if (Array.isArray(coord)) {
    return (
      coord.length === 2 &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1]) &&
      Math.abs(coord[0]) <= 90 &&
      Math.abs(coord[1]) <= 180 &&
      !(coord[0] === 0 && coord[1] === 0)
    );
  }

  return (
    typeof coord === "object" &&
    !isNaN(coord.lat) &&
    !isNaN(coord.lng) &&
    Math.abs(coord.lat) <= 90 &&
    Math.abs(coord.lng) <= 180 &&
    !(coord.lat === 0 && coord.lng === 0)
  );
};

/**
 * Validates case worker fields
 * @param fields The case worker fields to validate
 * @returns Validation errors
 */
export const validateCaseWorkerFields = (fields: {
  name: string;
  organization: string;
  phone: string;
  email: string;
}): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!fields.name.trim()) {
    errors.name = "Name is required";
  }

  if (!fields.organization.trim()) {
    errors.organization = "Organization is required";
  }

  if (!fields.phone.trim()) {
    errors.phone = "Phone number is required";
  } else if (!isValidPhone(fields.phone)) {
    errors.phone = "Invalid phone number format";
  }

  if (!fields.email.trim()) {
    errors.email = "Email is required";
  } else if (!isValidEmail(fields.email)) {
    errors.email = "Invalid email format";
  }

  return errors;
};

/**
 * Validates driver fields
 * @param fields The driver fields to validate
 * @returns Validation errors
 */
export const validateDriverFields = (fields: {
  name: string;
  phone: string;
  email: string;
}): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!fields.name.trim()) {
    errors.name = "Name is required";
  }

  if (!fields.phone.trim()) {
    errors.phone = "Phone number is required";
  } else if (!isValidPhone(fields.phone)) {
    errors.phone = "Invalid phone number format";
  }

  if (!fields.email.trim()) {
    errors.email = "Email is required";
  } else if (!isValidEmail(fields.email)) {
    errors.email = "Invalid email format";
  }

  return errors;
};

/**
 * Validates a date string to ensure it follows the MM/DD/YYYY format
 * @param dateString The date string to validate
 * @param minYear The minimum allowed year (default: 1900)
 * @param maxYear The maximum allowed year (default: 2100)
 * @returns Whether the date string follows the MM/DD/YYYY format and is a valid date
 */
export const isValidDateFormat = (
  dateString: string, 
  minYear = 1900, 
  maxYear = 2100
): boolean => {
  // Check if empty
  if (!dateString) return false;
  
  // Check if the input matches MM/DD/YYYY pattern without any extra characters
  const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  // Validate that it's an actual valid date
  const [monthStr, dayStr, yearStr] = dateString.split('/');
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);

  // Check year is within valid range and exactly 4 digits
  if (year < minYear || year > maxYear || yearStr.length !== 4) {
    return false;
  }

  // Create a date object and check if the input matches a valid date
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

/**
 * Validates a date string to ensure it follows the YYYY-MM-DD format and is within a valid year range
 * This is useful for validating HTML input[type="date"] values
 * @param dateString The date string to validate
 * @param minYear The minimum allowed year (default: 1900)
 * @param maxYear The maximum allowed year (default: 2100)
 * @returns Whether the date string is valid and within the acceptable year range
 */
export const isValidHtmlDateFormat = (
  dateString: string, 
  minYear = 1900, 
  maxYear = 2100
): boolean => {
  // Check if empty
  if (!dateString) return false;
  
  // Check if the input matches YYYY-MM-DD pattern
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  // Create a date object and check if it's a valid date
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return false;
  }

  // Check year is within valid range
  const year = date.getFullYear();
  return year >= minYear && year <= maxYear;
};

/**
 * Validates a date input string while it's being typed, checking for placeholders or invalid patterns
 * @param dateString The partial or complete date string to validate
 * @returns An object containing whether the input is valid and any error message
 */
export const validatePartialDateInput = (dateString: string): { isValid: boolean; errorMessage?: string } => {
  if (!dateString) {
    return { isValid: false, errorMessage: "Date is required. Format must be MM/DD/YYYY" };
  }
    // Check for placeholder text like "dd", "mm", "yyyy" that might be left in the input
  if (/dd|mm|yy/i.test(dateString)) {
    return { isValid: false, errorMessage: "Please replace placeholder text with actual date values" };
  }

  // First check if the string contains slashes for MM/DD/YYYY format
  if (!dateString.includes('/')) {
    return { isValid: false, errorMessage: "Date must be in MM/DD/YYYY format" };
  }

  // For MM/DD/YYYY format
  const parts = dateString.split('/');
  
  // Check if we have the expected number of parts
  if (parts.length !== 3) {
    return { isValid: false, errorMessage: "Date must be in MM/DD/YYYY format" };
  }
  
  const [month, day, year] = parts;
  
  // Check month is valid
  if (!/^(0?[1-9]|1[0-2])$/.test(month)) {
    return { isValid: false, errorMessage: "Month must be between 01-12" };
  }
  
  // Check day is valid
  if (!/^(0?[1-9]|[12]\d|3[01])$/.test(day)) {
    return { isValid: false, errorMessage: "Day must be between 01-31" };
  }
  
  // Check year is valid (at least 4 digits and in range)
  if (!/^\d{4}$/.test(year)) {
    return { isValid: false, errorMessage: "Year must be 4 digits" };
  }
  
  const yearNumber = parseInt(year, 10);
  if (yearNumber < 1900 || yearNumber > 2100) {
    return { isValid: false, errorMessage: "Year must be between 1900-2100" };
  }

  // Perform basic date validation without creating circular dependencies
  // This checks if the date could possibly be valid
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);
  
  // Simple month/day validation
  if (monthNum === 2) {  // February
    const isLeapYear = (yearNumber % 4 === 0 && yearNumber % 100 !== 0) || (yearNumber % 400 === 0);
    if (dayNum > (isLeapYear ? 29 : 28)) {
      return { isValid: false, errorMessage: `February ${yearNumber} has ${isLeapYear ? 29 : 28} days` };
    }
  } else if ([4, 6, 9, 11].includes(monthNum) && dayNum > 30) {
    return { isValid: false, errorMessage: "This month has 30 days" };
  }
  
  return { isValid: true };
};