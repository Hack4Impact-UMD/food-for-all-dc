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

      args.cell.properties.html = `
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
      `;
    },
    onTimeRangeSelected: onTimeRangeSelected,
    events: [], // Remove events from month view
  };

  return <DayPilotMonth {...customCalendarConfig} />;
};

export default MonthView;