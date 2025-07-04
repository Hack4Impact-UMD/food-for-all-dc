/**
 * Formatting utility functions
 */

import { DietaryRestrictions } from '../types';

/**
 * Formats a phone number to (xxx)-xxx-xxxx format
 * @param phone The phone number to format
 * @returns The formatted phone number
 */
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = ("" + phone).replace(/\D/g, ""); // Remove non-numeric characters
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/); // Match the phone number pattern
  if (match) {
    return `(${match[1]})-${match[2]}-${match[3]}`; // Format as (xxx)-xxx-xxxx
  }
  return phone; // Return the original phone if it doesn't match the pattern
};


/**
 * Capitalizes the first letter of a string
 * @param value The string to capitalize
 * @returns The capitalized string
 */
export const capitalizeFirstLetter = (value: string): string => {
  if (!value || typeof value !== 'string' || value.length === 0) return '';
  return value[0].toUpperCase() + value.slice(1);
};

/**
 * Formats dietary restrictions from object to readable string
 * @param restrictions The dietary restrictions object
 * @returns Formatted string of restrictions
 */
export const formatDietaryRestrictions = (restrictions: DietaryRestrictions): string => {
  if (!restrictions) return 'None';
  const booleanRestrictions = Object.entries(restrictions)
    .filter(([key, val]) => val === true && typeof val === "boolean")
    .map(([key]) => key.replace(/([A-Z])/g, " $1").trim());
  const foodAllergens = restrictions.foodAllergens || [];
  const other = restrictions.other || [];
  const allRestrictions = [...booleanRestrictions, ...(Array.isArray(foodAllergens) ? foodAllergens : []), ...(Array.isArray(other) ? other : [])];
  return allRestrictions.length > 0 ? allRestrictions.join(", ") : "None";
};

 