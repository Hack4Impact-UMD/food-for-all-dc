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
import type { SelectChangeEvent } from "@mui/material/Select";
import React, { useEffect, useMemo, useState } from "react";
import { getDefaultLimit, setDefaultLimit } from "./CalendarUtils";
import { useLimits } from "./useLimits";
import { DeliveryService } from "../../../services";
import { CalendarConfig, DateLimit } from "../../../types/calendar-types";
import {
  buildDailyLimitsMap,
  getCapacityStatus,
  getCapacityUi,
  resolveLimitForDate,
} from "./capacityStatus";

interface MonthCellClickArgs {
  cell: {
    start: DayPilot.Date;
  };
  e?: {
    target?: EventTarget | null;
  };
}

interface MonthTimeRangeSelectedArgsLike {
  start: DayPilot.Date;
  e?: {
    target?: EventTarget | null;
  };
}

interface MonthBeforeCellRenderArgsLike {
  cell: {
    start: DayPilot.Date;
    properties: {
      html: string;
    };
  };
}

interface CalendarPopperProps {
  anchorEl: HTMLElement | null;
  viewType: string;
  calendarConfig: CalendarConfig;
  dailyLimits: DateLimit[];
  setDailyLimits: (update: (prev: DateLimit[]) => DateLimit[]) => void;
}

const CalendarPopper = ({
  anchorEl,
  viewType,
  calendarConfig,
  dailyLimits,
  setDailyLimits,
}: CalendarPopperProps) => {
  const limits = useLimits();
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [clickedElement, setClickedElement] = useState<HTMLElement | null>(null);
  const [limitEditDate, setLimitEditDate] = useState<DayPilot.Date | null>(null);
  const [newLimit, setNewLimit] = useState<number>(60);
  const [bulkEdit, setBulkEdit] = useState<boolean>(false);

  const limitOptions = Array.from({ length: 13 }, (_, i) => 30 + i * 5);

  const handleDateClick = async (
    date: DayPilot.Date,
    event?: MonthTimeRangeSelectedArgsLike | MonthCellClickArgs
  ) => {
    const dateKey = date.toString("yyyy-MM-dd");

    let cellElement = null;
    const target = event?.e?.target instanceof HTMLElement ? event.e.target : null;
    if (target) {
      cellElement =
        target.closest(".calendar_default_cell") ||
        target.closest(".calendar_default_cell_business") ||
        target.closest('[class*="calendar_default_cell"]') ||
        target;
    }

    if (!cellElement) {
      cellElement =
        document.querySelector(`[data-date="${dateKey}"]`) ||
        document.querySelector(`[data-day="${dateKey}"]`) ||
        document.querySelector(`[title*="${dateKey}"]`);
    }

    if (cellElement) {
      setClickedElement(cellElement as HTMLElement);
      setClickPosition(null);
    } else {
      setClickedElement(null);
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

  useEffect(() => {
    if (anchorEl === null) {
      setBulkEdit(false);
      setLimitEditDate(null);
      setClickPosition(null);
    }
  }, [anchorEl]);

  const handleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('[role="tooltip"]') || target.closest(".MuiPaper-root")) {
      const clickedPopper = target.closest('[role="tooltip"]');
      if (clickedPopper && clickedPopper.querySelector("select, input, .MuiTypography-root")) {
        return;
      }
    }

    const cellElement =
      target.closest(".calendar_default_cell") ||
      target.closest(".calendar_default_cell_business") ||
      target.closest('[class*="calendar_default_cell"]') ||
      target.closest("[data-date]") ||
      target.closest('[class*="daypilot"]') ||
      target;

    if (cellElement && cellElement !== target) {
      setClickedElement(cellElement as HTMLElement);
      setClickPosition(null);
    } else {
      setClickedElement(null);
      setClickPosition({
        x: event.clientX,
        y: event.clientY,
      });
    }
  };

  const virtualAnchor = useMemo(() => {
    if (clickedElement) {
      const rect = clickedElement.getBoundingClientRect();
      return {
        getBoundingClientRect: () => new DOMRect(rect.left, rect.bottom, rect.width, 1),
      };
    }
    if (!clickPosition) return undefined;

    return {
      getBoundingClientRect: () => new DOMRect(clickPosition.x, clickPosition.y, 1, 1),
    };
  }, [clickedElement, clickPosition]);

  const dailyLimitsMap = useMemo(() => buildDailyLimitsMap(dailyLimits), [dailyLimits]);

  const handleLimitChange = async (e: SelectChangeEvent<number>) => {
    const selectedValue = Number(e.target.value);
    setNewLimit(selectedValue);
    const dateKey = limitEditDate!.toString("yyyy-MM-dd");

    if (!bulkEdit) {
      const deliveryService = DeliveryService.getInstance();
      await deliveryService.setDailyLimit(dateKey, selectedValue);

      setDailyLimits((prev) => {
        const existingIndex = prev.findIndex((item) => item.date === dateKey);
        if (existingIndex !== -1) {
          return prev.map((item, index) =>
            index === existingIndex ? { ...item, limit: selectedValue } : item
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
      onBeforeCellRender: (args: MonthBeforeCellRenderArgsLike) => {
        const cellDate = args.cell.start;
        const dateKey = cellDate.toString("yyyy-MM-dd");
        const limit = resolveLimitForDate(dateKey, limits, dailyLimitsMap);

        const eventCount = calendarConfig.events.filter((event) => {
          const eventDateString = event.start.toString("yyyy-MM-dd");
          return eventDateString === dateKey;
        }).length;
        const status = getCapacityStatus(eventCount, limit);
        const capacityUi = getCapacityUi(status);

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
            <div style='font-size: 14px; color:${capacityUi.color}; ${
              capacityUi.emphasis ? "font-weight: 700;" : ""
            }'>
              ${eventCount}/${limit}
            </div>
            <div style='font-size: 10px; color: var(--color-text-medium-alt);'>DELIVERIES</div>
            ${
              capacityUi.statusLabel
                ? `<div style='font-size: 10px; color: var(--color-text-medium-alt); letter-spacing: 0.3px;'>${capacityUi.statusLabel}</div>`
                : ""
            }
          </div>
        `;
      },
      onTimeRangeSelected: (args: MonthTimeRangeSelectedArgsLike) => {
        handleDateClick(args.start, args);
      },
      onCellClick: (args: MonthCellClickArgs) => {
        handleDateClick(args.cell.start, args);
      },
    };

    return (
      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement="bottom"
        transition
        sx={{ zIndex: 1200 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={350}>
            <Paper elevation={3} sx={{ p: 2, width: 500 }}>
              <Box sx={{ position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
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
                  sx={{ zIndex: 1300 }}
                >
                  <Paper
                    elevation={3}
                    sx={{ p: 2, width: 100 }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {limitEditDate && (
                      <>
                        <Typography
                          variant="subtitle1"
                          gutterBottom
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
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
