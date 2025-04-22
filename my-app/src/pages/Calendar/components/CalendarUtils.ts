import { DayPilot } from "@daypilot/daypilot-lite-react";
import { DeliveryService } from "../../../services";
import { NewDelivery } from "../../../types/calendar-types";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let firestoreLimits: number[] = [60, 60, 60, 60, 90, 90, 60];

// Get delivery service instance
const deliveryService = DeliveryService.getInstance();

// Initialize limits from the service
(async () => {
  try {
    const limits = await deliveryService.getWeeklyLimits();
    firestoreLimits = DAYS.map((day) => limits[day] || 60);
  } catch (error) {
    console.error("Error initializing limits:", error);
  }
})();

export const getDefaultLimit = (
  date: DayPilot.Date,
  limits: Record<string, number> | number[]
): number => {
  if (Array.isArray(limits)) {
    return limits[date.getDayOfWeek()];
  } else {
    const dayOfWeek = date.getDayOfWeek();
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      dayOfWeek
    ];
    return limits[dayName] || 20;
  }
};

export const setDefaultLimit = async (date: DayPilot.Date, newLimit: number): Promise<void> => {
  const dayIndex = date.getDayOfWeek();
  const dayField = DAYS[dayIndex];

  try {
    // Use delivery service to update the weekly limit
    const currentLimits = await deliveryService.getWeeklyLimits();
    const updatedLimits = { ...currentLimits, [dayField]: newLimit };
    await deliveryService.updateWeeklyLimits(updatedLimits);
  } catch (error) {
    console.error("Error updating limit:", error);
  }
};

export const getRecurrencePattern = (date: string): string => {
  const targetDate = new Date(date);

  // Adjust for local timezone offset
  const localDate = new Date(targetDate.getTime() + targetDate.getTimezoneOffset() * 60000);

  const dayOfWeek = localDate.getDay(); // Get the day of the week (0 = Sunday, 1 = Monday, etc.)
  const weekOfMonth = Math.ceil(localDate.getDate() / 7); // Calculate the week of the month
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${weekOfMonth}${getOrdinalSuffix(weekOfMonth)} ${daysOfWeek[dayOfWeek]}`;
};

export const calendarDateString = (date: DayPilot.Date, viewType: string): string => {
  const dateString = date.toString("MMMM") + " " + date.toString("yyyy");

  if (viewType === "Day") {
    return dateString + ", " + daysOfWeek[date.getDayOfWeek()];
  }
  return dateString;
};

export const getOrdinalSuffix = (num: number): string => {
  if (num === 1 || num === 21 || num === 31) return "st";
  if (num === 2 || num === 22) return "nd";
  if (num === 3 || num === 23) return "rd";
  return "th";
};

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = ("" + phone).replace(/\D/g, ""); // Remove non-numeric characters
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/); // Match the phone number pattern
  if (match) {
    return `(${match[1]})-${match[2]}-${match[3]}`; // Format as (xxx)-xxx-xxxx
  }
  return phone; // Return the original phone if it doesn't match the pattern
};

export const getNextMonthlyDate = (
  originalDate: Date,
  currentDate: Date,
  targetDay?: number
): Date => {
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

export const calculateRecurrenceDates = (newDelivery: NewDelivery): Date[] => {
  const recurrenceDates: Date[] = [];
  const originalDate = new Date(newDelivery.deliveryDate);
  let currentDate = new Date(originalDate);

  recurrenceDates.push(new Date(originalDate)); // Always include the original date

  if (newDelivery.recurrence === "Weekly") {
    const interval = 7; // Weekly interval
    addRecurrenceDates(interval);
  } else if (newDelivery.recurrence === "2x-Monthly") {
    const interval = 14; // 2x-Monthly interval
    addRecurrenceDates(interval);
  } else if (newDelivery.recurrence === "Monthly") {
    if (newDelivery.repeatsEndDate) {
      const endDate = new Date(newDelivery.repeatsEndDate);
      if (originalDate.getDate() <= 30) {
        // Fix for potential date issue
        originalDate.setDate(originalDate.getDate() + 1);
      }
      // If 31st it goes to next month so it will skip a month
      while (currentDate <= endDate) {
        currentDate = getNextMonthlyDate(originalDate, currentDate);
        if (currentDate <= endDate) {
          recurrenceDates.push(new Date(currentDate));
        }
      }
    }
  }

  return recurrenceDates;

  function addRecurrenceDates(interval: number) {
    if (newDelivery.repeatsEndDate) {
      const endDate = new Date(newDelivery.repeatsEndDate);
      let dateToAdd = new Date(currentDate);
      while (dateToAdd <= endDate) {
        dateToAdd = new Date(dateToAdd);
        dateToAdd.setDate(dateToAdd.getDate() + interval);
        if (dateToAdd <= endDate) {
          recurrenceDates.push(new Date(dateToAdd));
        }
      }
    }
  }
};
