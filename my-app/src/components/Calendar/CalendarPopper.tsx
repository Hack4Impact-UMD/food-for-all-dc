import React, { useState, useMemo } from "react";
import { DayPilot, DayPilotMonth } from "@daypilot/daypilot-lite-react";
import {
  Popper,
  Paper,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fade,
} from "@mui/material";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../auth/firebaseConfig";
import { getDefaultLimit } from "./CalendarUtils";

interface DailyLimits {
  id: string;
  date: string;
  limit: number;
}

interface CalendarPopperProps {
  anchorEl: HTMLElement | null;
  viewType: string;
  calendarConfig: any;
  dailyLimits: DailyLimits[];
  setDailyLimits: (update: (prev: DailyLimits[]) => DailyLimits[]) => void;
  fetchDailyLimits: () => Promise<void>;
}

const LIMITS_OF_THE_WEEK = [60, 60, 60, 60, 60, 90, 90, 60]

const CalendarPopper = ({
  anchorEl,
  viewType,
  calendarConfig,
  dailyLimits,
  setDailyLimits,
  fetchDailyLimits,
}: CalendarPopperProps) => {
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [limitEditDate, setLimitEditDate] = useState<DayPilot.Date | null>(
    null
  );
  const [newLimit, setNewLimit] = useState<number>(60);
  const limitOptions = Array.from({ length: 9 }, (_, i) => 30 + i * 5);

  const handleDateClick = async (date: DayPilot.Date) => {
    const dateKey = date.toString("yyyy-MM-dd");
    const cellElement = document.querySelector(`[data-date="${dateKey}"]`);
    if (cellElement) {
      const rect = cellElement.getBoundingClientRect();
      setClickPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom,
      });
    } else {
      setClickPosition(null);
    }
    setLimitEditDate(date);
    const limitEntry = dailyLimits.find((dl) => dl.date === dateKey);

    if (limitEntry) {
      setNewLimit(limitEntry.limit);
    }else { 
      // Set the initial value based on weekday defaults:
      // Assumes DayPilot.Date.getDayOfWeek() returns 1=Monday,...,7=Sunday.
      const defaultLimit = getDefaultLimit(date)
    setNewLimit(defaultLimit);
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    setClickPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };



  const virtualAnchor = useMemo(() => {
    if (!clickPosition) return undefined;

    return {
      getBoundingClientRect: () =>
        new DOMRect(clickPosition.x, clickPosition.y, 1, 1),
    };
  }, [clickPosition]);

    // Bulk update function: updates all dates in the current calendar range
  // that have the same weekday as the currently edited date.
  // const handleApplyToAll = async () => {
  //   if (!limitEditDate || !calendarConfig.startDate || !calendarConfig.endDate)
  //     return;

  //   const selectedWeekday = limitEditDate.getDayOfWeek();
  //   // Convert startDate and endDate from calendarConfig to DayPilot.Date objects.
  //   const start = DayPilot.Date.fromString(calendarConfig.startDate);
  //   const end = DayPilot.Date.fromString(calendarConfig.endDate);
  //   let newDailyLimits = [...dailyLimits];

  //   // Iterate over the date range
  //   for (let d = start; d <= end; d = d.addDays(1)) {
  //     if (d.getDayOfWeek() === selectedWeekday) {
  //       const dateKey = d.toString("yyyy-MM-dd");
  //       const docRef = doc(db, "dailyLimits", dateKey);
  //       await setDoc(
  //         docRef,
  //         { limit: newLimit, date: dateKey },
  //         { merge: true }
  //       );
  //       const index = newDailyLimits.findIndex(item => item.date === dateKey);
  //       if (index !== -1) {
  //         newDailyLimits[index] = { ...newDailyLimits[index], limit: newLimit };
  //       } else {
  //         newDailyLimits.push({ id: dateKey, date: dateKey, limit: newLimit });
  //       }
  //     }
  //   }
  //   setDailyLimits(newDailyLimits);
  //   setLimitEditDate(null);
  //   setClickPosition(null);
  // };

  if (viewType === "Month") {
    const customCalendarConfig = {
      ...calendarConfig,

      onBeforeCellRender: (args: any) => {
        const cellDate = args.cell.start;
        const dateKey = cellDate.toString("yyyy-MM-dd");
        const limitEntry = dailyLimits.find((dl) => dl.date === dateKey);
        const defaultLimit = getDefaultLimit(cellDate)
        const limit = limitEntry ? limitEntry.limit : defaultLimit;

        const eventCount = calendarConfig.events.filter((event: any) => {
          const eventDateString = event.start.toString("yyyy-MM-dd");
          return eventDateString === dateKey;
        }).length;

        args.cell.properties.html = `
          <div data-date="${dateKey}" style='
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            cursor: pointer;
            padding: 4px;
          '>
            <div style='font-size: 14px; color:${eventCount > limit ? "#ff6e6b" : "#257E68"};'>
              ${eventCount}/${limit}
            </div>
            <div style='font-size: 10px; color: #666;'>DELIVERIES</div>
          </div>
        `;
      },
      onTimeRangeSelected: (args: any) => {
        handleDateClick(args.start);
      },
    };

    return (
      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement="bottom"
        transition
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={350}>
            <Box
              onClick={handleClick}
              sx={{ p: 2, width: 500, position: "relative" }}
            >
              <DayPilotMonth
                {...customCalendarConfig}
                cellHeight={60}
                events={[]}
              />

              <Popper
                open={!!limitEditDate && !!virtualAnchor}
                anchorEl={virtualAnchor}
                placement="bottom"
                modifiers={[
                  {
                    name: "offset",
                    options: { offset: [0, 10] },
                  },
                  {
                    name: "flip",
                    enabled: true,
                    options: { altBoundary: true },
                  },
                ]}
                sx={{ zIndex: 1 }}
              >
                <Paper elevation={3} sx={{ p: 2, width: 100 }}>
                  {limitEditDate && (
                    <>
                      <Typography variant="subtitle1" gutterBottom>
                        {limitEditDate.toString("MMM d")}
                      </Typography>
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Max</InputLabel>
                        <Select
                          value={newLimit}
                          label="Max"
                          onChange={async (e) => {
                            const selectedValue = Number(e.target.value);
                            setNewLimit(selectedValue);
                            const dateKey =
                              limitEditDate.toString("yyyy-MM-dd");
                            const docRef = doc(db, "dailyLimits", dateKey);
                            await setDoc(
                              docRef,
                              {
                                limit: selectedValue,
                                date: dateKey,
                              },
                              { merge: true }
                            );
                            setDailyLimits((prev) => {
                              const existingIndex = prev.findIndex(
                                (item) => item.date === dateKey
                              );
                              if (existingIndex !== -1) {
                                return prev.map((item, index) =>
                                  index === existingIndex
                                    ? { ...item, limit: selectedValue }
                                    : item
                                );
                              }
                              return [
                                ...prev,
                                {
                                  id: dateKey,
                                  date: dateKey,
                                  limit: selectedValue,
                                },
                              ];
                            });
                            setLimitEditDate(null);
                            setClickPosition(null);
                          }}
                          onClose={() => {
                            setLimitEditDate(null);
                            setClickPosition(null);
                          }}
                          open={true}
                          autoFocus
                        >
                          {limitOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </>
                  )}
                </Paper>
              </Popper>
            </Box>
          </Fade>
        )}
      </Popper>
    );
  }

  return <div></div>;
};

export default CalendarPopper;
