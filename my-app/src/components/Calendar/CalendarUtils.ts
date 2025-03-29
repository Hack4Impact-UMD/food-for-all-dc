import { DayPilot } from "@daypilot/daypilot-lite-react";

export const LIMITS_OF_THE_WEEK = [60, 60, 60, 60, 90, 90, 60]; // Sun - Sat

export const getDefaultLimit = (date: DayPilot.Date): number => {
  return LIMITS_OF_THE_WEEK[date.getDayOfWeek()];
};