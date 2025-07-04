import { Timestamp } from "firebase/firestore";
import { DayPilot } from "@daypilot/daypilot-lite-react";

/**
 * Convert a Firestore Timestamp or JavaScript Date to a JavaScript Date
 */
export const toJSDate = (date: Date | Timestamp): Date => {
  if (!date) return new Date();
  if (date instanceof Timestamp) {
    return date.toDate();
  }
  return date;
};

/**
 * Convert a Date or Timestamp to an ISO date string (YYYY-MM-DD)
 */
export const toISODateString = (date: Date | Timestamp): string => {
  const jsDate = toJSDate(date);
  return jsDate.toISOString().split('T')[0];
};

/**
 * Convert a Date or Timestamp to a DayPilot date string
 */
export const toDayPilotDateString = (date: Date | Timestamp): string => {
  return toISODateString(date);
};
