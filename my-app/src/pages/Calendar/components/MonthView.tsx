import React from "react";
import { DayPilot, DayPilotMonth } from "@daypilot/daypilot-lite-react";
import { CalendarConfig, DateLimit } from "../../../types/calendar-types";
import {
  buildDailyLimitsMap,
  getCapacityStatus,
  getCapacityUi,
  resolveLimitForDate,
} from "./capacityStatus";

interface MonthViewProps {
  calendarConfig: CalendarConfig;
  dailyLimits: DateLimit[];
  limits: Record<string, number>;
  onTimeRangeSelected: (args: MonthTimeRangeSelectedArgsLike) => void;
}

interface MonthBeforeCellRenderArgsLike {
  cell: {
    start: DayPilot.Date;
    properties: {
      headerHtml: string;
      html: string;
    };
  };
}

interface MonthTimeRangeSelectedArgsLike {
  start: DayPilot.Date;
}

const MonthView: React.FC<MonthViewProps> = ({
  calendarConfig,
  dailyLimits,
  limits,
  onTimeRangeSelected,
}) => {
  const dailyLimitsMap = buildDailyLimitsMap(dailyLimits);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const customCalendarConfig = {
    ...calendarConfig,
    onBeforeCellRender: (args: MonthBeforeCellRenderArgsLike) => {
      const dateKey = args.cell.start.toString("yyyy-MM-dd");
      const limit = resolveLimitForDate(dateKey, limits, dailyLimitsMap);

      const eventCount = calendarConfig.events.filter((event) => {
        const eventDateString = event.start.toString("yyyy-MM-dd");
        return eventDateString === dateKey;
      }).length;
      const status = getCapacityStatus(eventCount, limit);
      const capacityUi = getCapacityUi(status);

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
                      color: ${capacityUi.color};
                      ${capacityUi.emphasis ? "font-weight: 700;" : ""}'>
              ${eventCount}/${limit}
              <div>DELIVERIES</div>
              ${
                capacityUi.statusLabel
                  ? `<div style='font-size: 10px; letter-spacing: 0.3px;'>${capacityUi.statusLabel}</div>`
                  : ""
              }
          </div>
        </div>
      `;
    },
    onTimeRangeSelected: onTimeRangeSelected,
    events: [],
  };

  return <DayPilotMonth {...customCalendarConfig} />;
};

export default MonthView;
