import { Timestamp } from "firebase/firestore";
import { DayPilot } from "@daypilot/daypilot-lite-react";

/**
 * Convert a Firestore Timestamp or JavaScript Date to a JavaScript Date
 */
export const toJSDate = (date: string | Date | Timestamp): Date => {
  if (!date) return new Date();
  if (date instanceof Timestamp) {
    return date.toDate();
  }
  if (typeof date === 'string') {
    // Parse 'YYYY-MM-DD' as local date
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0); // Local noon
  }
  return date;
};

/**
 * Convert a Date or Timestamp to an ISO date string (YYYY-MM-DD)
 */
export const toISODateString = (date: string | Date | Timestamp): string => {
  if (typeof date === 'string') {
    // Assume 'YYYY-MM-DD' format
    return date;
  }
  const jsDate = toJSDate(date);
  return jsDate.toISOString().split('T')[0];
};

/**
 * Convert a Date or Timestamp to a DayPilot date string
 */
export const toDayPilotDateString = (date: string | Date | Timestamp): string => {
  return toISODateString(date);
};
