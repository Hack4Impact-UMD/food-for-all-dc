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
  Button,
} from "@mui/material";

interface CalendarPopperProps {
  viewType: string;
  calendarConfig: any;
  dailyLimits: Record<string, number>;
  setDailyLimits: (
    update: (prev: Record<string, number>) => Record<string, number>
  ) => void;
}

const CalendarPopper = ({
  viewType,
  calendarConfig,
  dailyLimits,
  setDailyLimits,
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

  const handleDateClick = (date: DayPilot.Date) => {
    setLimitEditDate(date);
    setNewLimit(dailyLimits[date.toString("yyyy-MM-dd")] || 60);
  };

  const handleClick = (event: React.MouseEvent) => {
    console.log(event.clientX, event.clientY);
    setClickPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const virtualAnchor = useMemo(() => {
    if (!clickPosition) return undefined;

    return {
      getBoundingClientRect: () =>
        new DOMRect(
          clickPosition.x,
          clickPosition.y,
          1, // width
          1 // height
        ),
    };
  }, [clickPosition]);

  if (viewType === "Month") {
    const customCalendarConfig = {
      ...calendarConfig,

      onBeforeCellRender: (args: any) => {
        const cellDate = args.cell.start;
        const dateKey = cellDate.toString("yyyy-MM-dd");
        const limit = dailyLimits[dateKey] || 60;

        const eventCount = calendarConfig.events.filter((event: any) => {
          const eventDateString = event.start.toString("yyyy-MM-dd");
          return eventDateString === dateKey;
        }).length;

        args.cell.properties.html = `
          <div style='
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
      <Box sx={{ p: 2, width: 500, position: "relative" }}>
        <Box onClick={handleClick}>
          <DayPilotMonth
            {...customCalendarConfig}
            cellHeight={60}
            events={[]}
          />
        </Box>

        <Popper
          open={!!limitEditDate && !!virtualAnchor}
          anchorEl={virtualAnchor}
          placement="bottom-start"
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
          <Paper elevation={3} sx={{ p: 2, width: 250 }}>
            {limitEditDate && (
              <>
                <Typography variant="subtitle1" gutterBottom>
                  Delivery Limit for {limitEditDate.toString("MMM d")}
                </Typography>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Max Deliveries</InputLabel>
                  <Select
                    value={newLimit}
                    label="Max Deliveries"
                    onChange={(e) => {
                      const selectedValue = Number(e.target.value);
                      setNewLimit(selectedValue);
                      setDailyLimits((prev: Record<string, number>) => ({
                        ...prev,
                        [limitEditDate!.toString("yyyy-MM-dd")]: selectedValue,
                      }));
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
                        {option} deliveries
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
          </Paper>
        </Popper>
      </Box>
    );
  }

  return <div>View in month Mode</div>;
};

export default CalendarPopper;
