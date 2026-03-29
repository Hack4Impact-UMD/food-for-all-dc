import { Timestamp } from "firebase/firestore";
import { deliveryDate } from "./deliveryDate";

/**
 * Convert a Firestore Timestamp or JavaScript Date to a JavaScript Date
 */
export const toJSDate = (date: string | Date | Timestamp): Date => {
  return deliveryDate.toJSDate(date);
};

/**
 * Convert a Date or Timestamp to an ISO date string (YYYY-MM-DD)
 */
export const toISODateString = (date: string | Date | Timestamp): string => {
  return deliveryDate.toISODateString(date);
};

/**
 * Convert a Date or Timestamp to a DayPilot date string
 */
export const toDayPilotDateString = (date: string | Date | Timestamp): string => {
  return deliveryDate.toISODateString(date);
};
