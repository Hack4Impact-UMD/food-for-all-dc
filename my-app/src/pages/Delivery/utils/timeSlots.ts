/**
 * Shared time slot configuration for delivery scheduling
 * Generates time slots from 8:00 AM to 5:00 PM in 30-minute intervals
 * (excludes 5:30 PM)
 */

export interface TimeSlot {
  value: string; // 24-hour format: "HH:MM"
  label: string; // 12-hour format: "H:MM AM/PM"
}

/**
 * Generate time slots for delivery scheduling
 * @returns Array of time slots with both 24-hour value and 12-hour label
 */
export const generateTimeSlots = (): TimeSlot[] => {
  const intervals: TimeSlot[] = [];
  const startHour = 8;
  const endHour = 17;

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
      if (hour === endHour && min > 0) continue; // Don't add 5:30 PM
      
      const value = `${hour.toString().padStart(2, "0")}:${min === 0 ? "00" : "30"}`;
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? "AM" : "PM";
      const label = `${displayHour}:${min === 0 ? "00" : "30"} ${ampm}`;
      
      intervals.push({ value, label });
    }
  }

  return intervals;
};

/**
 * Get time slot labels only (for simple dropdowns)
 * @returns Array of time slot labels in 12-hour format
 */
export const getTimeSlotLabels = (): string[] => {
  return generateTimeSlots().map((slot) => slot.label);
};

/**
 * Pre-generated time slots for repeated use
 */
export const TIME_SLOTS = generateTimeSlots();

/**
 * Pre-generated time slot labels for simple dropdowns
 */
export const TIME_SLOT_LABELS = getTimeSlotLabels();
