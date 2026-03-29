import { DayPilot } from "@daypilot/daypilot-lite-react";
import { DateTime } from "luxon";
import { ViewType } from "../../../types/calendar-types";
import { deliveryDate } from "../../../utils/deliveryDate";

const getSundayWeekStart = (dateTime: DateTime): DateTime => {
  const weekdayOffset = dateTime.weekday % 7;
  return dateTime.startOf("day").minus({ days: weekdayOffset });
};

const getSaturdayWeekEnd = (dateTime: DateTime): DateTime =>
  getSundayWeekStart(dateTime).plus({ days: 6 }).endOf("day");

const toDayPilotDate = (dateTime: DateTime): DayPilot.Date =>
  new DayPilot.Date(dateTime.toISODate() ?? deliveryDate.todayISODateString());

export const getTodayDayPilotDate = (): DayPilot.Date =>
  new DayPilot.Date(deliveryDate.todayISODateString());

export const getCalendarViewRange = (
  currentDate: DayPilot.Date,
  viewType: ViewType
): { start: DayPilot.Date; endExclusive: DayPilot.Date } => {
  const currentDateKey = currentDate.toString("yyyy-MM-dd");
  const currentDateTime = deliveryDate.toDateTime(currentDateKey);

  if (viewType === "Month") {
    const monthStart = currentDateTime.startOf("month");
    const monthEnd = currentDateTime.endOf("month");
    const gridStart = getSundayWeekStart(monthStart).minus({ weeks: 2 });
    const gridEndExclusive = getSaturdayWeekEnd(monthEnd).plus({ weeks: 2 }).plus({ days: 1 }).startOf("day");

    return {
      start: toDayPilotDate(gridStart),
      endExclusive: toDayPilotDate(gridEndExclusive),
    };
  }

  const start = currentDateTime.startOf("day");
  return {
    start: toDayPilotDate(start),
    endExclusive: toDayPilotDate(start.plus({ days: 1 })),
  };
};
