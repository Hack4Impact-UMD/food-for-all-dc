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