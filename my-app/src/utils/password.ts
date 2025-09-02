/**
 * Utility functions for password validation
 */

export function isStrongPassword(password: string): boolean {
  if (!password || password.length < 8) return false;

  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  return strongPasswordRegex.test(password);
}

export function getPasswordStrengthErrors(password: string): string[] {
  const errors: string[] = [];

  if (!password) {
    errors.push("Password is required");
    return errors;
  }

  if (password.length < 8) errors.push("At least 8 characters");
  if (!/[a-z]/.test(password)) errors.push("One lowercase letter");
  if (!/[A-Z]/.test(password)) errors.push("One uppercase letter");
  if (!/\d/.test(password)) errors.push("One number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("One special character");

  return errors;
}
