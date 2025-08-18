/**
 * Utility function for password validation
 */

/**
 * Validates if a password is strong
 * @param password The password to validate
 * @returns Whether the password is valid (at least 8 characters with 1 uppercase, lowercase, number, and special character)
 */
export function isStrongPassword(password: string): boolean {
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
}