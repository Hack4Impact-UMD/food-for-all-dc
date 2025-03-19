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

interface CalendarPopperProps {
  anchorEl: HTMLElement | null;
  viewType: string;
  calendarConfig: any;
  dailyLimits: Record<string, number>;
  setDailyLimits: (
    update: (prev: Record<string, number>) => Record<string, number>
  ) => void;
}

const CalendarPopper = ({
  anchorEl,
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
    const dateKey = date.toString("yyyy-MM-dd");
    // Find the cell element using the data-date attribute
    const cellElement = document.querySelector(`[data-date="${dateKey}"]`);
    if (cellElement) {
      const rect = cellElement.getBoundingClientRect();
      // Set the anchor position to the center bottom of the cell
      setClickPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom,
      });
    } else {
      setClickPosition(null);
    }
    setLimitEditDate(date);
    setNewLimit(dailyLimits[dateKey] || 60);
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
                          onChange={(e) => {
                            const selectedValue = Number(e.target.value);
                            setNewLimit(selectedValue);
                            setDailyLimits((prev: Record<string, number>) => ({
                              ...prev,
                              [limitEditDate!.toString("yyyy-MM-dd")]:
                                selectedValue,
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

  return <div>View in month Mode</div>;
};

export default CalendarPopper;
