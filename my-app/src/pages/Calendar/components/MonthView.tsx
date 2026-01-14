
import React from "react";
import { DayPilotMonth } from "@daypilot/daypilot-lite-react";
import { CalendarConfig, DateLimit } from "../../../types/calendar-types";
import { getDefaultLimit } from "./CalendarUtils";

interface MonthViewProps {
  calendarConfig: CalendarConfig;
  dailyLimits: DateLimit[];
  limits: Record<string, number>;
  onTimeRangeSelected: (args: any) => void;
}

const MonthView: React.FC<MonthViewProps> = ({
  calendarConfig,
  dailyLimits,
  limits,
  onTimeRangeSelected,
}) => {
  // Precompute today's date key in yyyy-MM-dd to match DayPilot.Date formatting
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const customCalendarConfig = {
    ...calendarConfig,
    onBeforeCellRender: (args: any) => {
      const dateKey = args.cell.start.toString("yyyy-MM-dd");
      const dailyLimit = dailyLimits.find((dl) => dl.date === dateKey);
      const defaultLimit = getDefaultLimit(args.cell.start, limits);
      const limit = dailyLimit ? dailyLimit.limit : defaultLimit;

      const eventCount = calendarConfig.events.filter((event) => {
        const eventDateString = event.start.toString("yyyy-MM-dd");
        return eventDateString === dateKey;
      }).length;

      const isToday = dateKey === todayKey;
      if (isToday) {
        const dayNumber = args.cell.start.toString("d");
        args.cell.properties.headerHtml = `
          <div
            style='
              width: 28px;
              height: 28px;
              border-radius: 50%;
              background: transparent;
              border: 2px solid var(--color-error-text);
              display: flex;
              align-items: center;
              justify-content: center;
              box-sizing: border-box;
              margin-left: auto;
              margin-right: 0;
              color: var(--color-error-text);
            '
          >
            ${dayNumber}
          </div>
        `;
      }

      args.cell.properties.html = `
        <div style='position: relative; height: 100%; width: 100%;'>
          <div style='position: absolute; 
                      top: 50%; 
                      left: 50%; 
                      transform: translate(-50%, -50%);
                      text-align: center; 
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      justify-content: center;
                      color: ${eventCount > limit && "#ff6e6b"};'>
              ${eventCount}/${limit}
              <div>DELIVERIES</div>
          </div>
        </div>
      `;
    },
    onTimeRangeSelected: onTimeRangeSelected,
    events: [], // Remove events from month view
  };

  return <DayPilotMonth {...customCalendarConfig} />;
};

export default MonthView;
