import { DayPilot, DayPilotMonth } from "@daypilot/daypilot-lite-react";
import {
  Box,
  Fade,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Popper,
  Select,
  Switch,
  Typography,
} from "@mui/material";
import React, { useMemo, useState } from "react";
import { getDefaultLimit, setDefaultLimit } from "./CalendarUtils";
import { useLimits } from "./useLimits";
import { DeliveryService } from "../../../services";
import { DateLimit } from "../../../types/calendar-types";

interface CalendarPopperProps {
  anchorEl: HTMLElement | null;
  viewType: string;
  calendarConfig: any;
  dailyLimits: DateLimit[];
  setDailyLimits: (update: (prev: DateLimit[]) => DateLimit[]) => void;
  fetchDailyLimits: () => Promise<void>;
}

const CalendarPopper = ({
  anchorEl,
  viewType,
  calendarConfig,
  dailyLimits,
  setDailyLimits,
  fetchDailyLimits,
}: CalendarPopperProps) => {
  const limits = useLimits();
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [limitEditDate, setLimitEditDate] = useState<DayPilot.Date | null>(null);
  const [newLimit, setNewLimit] = useState<number>(60);
  const [bulkEdit, setBulkEdit] = useState<boolean>(false);

  const limitOptions = Array.from({ length: 13 }, (_, i) => 30 + i * 5);

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
    } else {
      const defaultLimit = getDefaultLimit(date, limits);
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
      getBoundingClientRect: () => new DOMRect(clickPosition.x, clickPosition.y, 1, 1),
    };
  }, [clickPosition]);

  const handleLimitChange = async (e: any) => {
    const selectedValue = Number(e.target.value);
    setNewLimit(selectedValue);
    const dateKey = limitEditDate!.toString("yyyy-MM-dd");
    
    if (!bulkEdit) {
      const deliveryService = DeliveryService.getInstance();
      await deliveryService.setDailyLimit(dateKey, selectedValue);
      
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
    } else {
      setDefaultLimit(limitEditDate!, selectedValue);
    }
    
    setLimitEditDate(null);
    setClickPosition(null);
  };

  if (viewType === "Month") {
    const customCalendarConfig = {
      ...calendarConfig,

      onBeforeCellRender: (args: any) => {
        const cellDate = args.cell.start;
        const dateKey = cellDate.toString("yyyy-MM-dd");
        const limitEntry = dailyLimits.find((dl) => dl.date === dateKey);
        const defaultLimit = getDefaultLimit(cellDate, limits);
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
      <Popper open={Boolean(anchorEl)} anchorEl={anchorEl} placement="bottom" transition>
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={350}>
            <Paper elevation={3} sx={{ p: 2, width: 500 }}>
              <Box
                onClick={handleClick}
                sx={{ position: "relative" }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <FormGroup>
                  <FormControlLabel
                    control={<Switch />}
                    label="Bulk Edit"
                    onChange={() => setBulkEdit(!bulkEdit)}
                  />
                </FormGroup>
                <DayPilotMonth {...customCalendarConfig} cellHeight={60} events={[]} />

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
                  <Paper
                    elevation={3}
                    sx={{ p: 2, width: 100 }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
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
                            onChange={handleLimitChange}
                            onClose={() => {
                              setLimitEditDate(null);
                              setClickPosition(null);
                            }}
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
            </Paper>
          </Fade>
        )}
      </Popper>
    );
  }

  return <div></div>;
};

export default CalendarPopper;
