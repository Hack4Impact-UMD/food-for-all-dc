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
  Switch,
  FormGroup,
  FormControlLabel,
} from "@mui/material";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../auth/firebaseConfig";
import { getDefaultLimit, setDefaultLimit } from "./CalendarUtils";
import { useLimits } from "./useLimits";

interface DailyLimits {
  id: string;
  date: string;
  limit: number;
}

interface CalendarMultiSelectProps {
  anchorEl: HTMLElement | null;
  viewType: string;
  calendarConfig: any;
  dailyLimits: any;
  setDailyLimits: (limits: any) => void;
  fetchDailyLimits: () => void;
  selectedDates: string[];
  setSelectedDates: (dates: string[]) => void;
  onClose: () => void;
}

const CalendarMultiSelect: React.FC<CalendarMultiSelectProps> = ({
  anchorEl,
  viewType,
  calendarConfig,
  dailyLimits,
  setDailyLimits,
  fetchDailyLimits,
  selectedDates,
  setSelectedDates,
  onClose,
}: CalendarMultiSelectProps) => {
  const limits = useLimits()
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [limitEditDate, setLimitEditDate] = useState<DayPilot.Date | null>(
    null
  );
  const [newLimit, setNewLimit] = useState<number>(60);
  const [bulkEdit, setBulkEdit] = useState<boolean>(false);

  const limitOptions = Array.from({ length: 13 }, (_, i) => 30 + i * 5);


  const handleDateToggle = (date: DayPilot.Date) => {
    const dateKey = date.toString("yyyy-MM-dd");

    const isSelected = selectedDates.includes(dateKey);
    const updatedDates = isSelected
      ? selectedDates.filter((d) => d !== dateKey)
      : [...selectedDates, dateKey];

    setSelectedDates(updatedDates);
    setClickPosition(null);

    if (!bulkEdit && !isSelected) {
      setLimitEditDate(date);
    } else {
      setLimitEditDate(null);
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

  if (viewType === "Month") {
    const customCalendarConfig = {
      ...calendarConfig,

      onBeforeCellRender: (args: any) => {
        const cellDate = args.cell.start;
        const dateKey = cellDate.toString("yyyy-MM-dd");
        const limitEntry = dailyLimits.find((dl: DailyLimits) => dl.date === dateKey);
        const defaultLimit = getDefaultLimit(cellDate, limits)
        const limit = limitEntry ? limitEntry.limit : defaultLimit;

        const eventCount = calendarConfig.events.filter((event: any) => {
          const eventDateString = event.start.toString("yyyy-MM-dd");
          return eventDateString === dateKey;
        }).length;

        const isSelected = selectedDates.includes(dateKey);

        args.cell.backColor = isSelected ? "#e3f2fd" : "";

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
        handleDateToggle(args.start);
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
              sx={{ p: 2, width: 500, position: "relative", background: "white" }}
            >
              <FormGroup>
                <FormControlLabel control={<Switch/>} label="Bulk Edit" onChange={() => {
                  
                  setBulkEdit(!bulkEdit)
                  console.log(bulkEdit)}}/>
              </FormGroup>
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
                            
                            
                            if (!bulkEdit){
                              
                              const docRef = doc(db, "dailyLimits", dateKey);
                              console.log('A')
                              await setDoc(
                                docRef,
                                {
                                  limit: selectedValue,
                                  date: dateKey,
                                },
                                { merge: true }
                              );
                              setDailyLimits((prev: DailyLimits[]) => {
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
                              selectedDates.forEach(async (dateKey) => {
                                const dateObj = new DayPilot.Date(dateKey);
                                setDefaultLimit(dateObj, selectedValue); // update default in memory
                            
                                const docRef = doc(db, "dailyLimits", dateKey);
                                await setDoc(
                                  docRef,
                                  { limit: selectedValue, date: dateKey },
                                  { merge: true }
                                );
                            
                                setDailyLimits((prev: DailyLimits[]) => {
                                  const exists = prev.some((item) => item.date === dateKey);
                                  if (exists) {
                                    return prev.map((item) =>
                                      item.date === dateKey ? { ...item, limit: selectedValue } : item
                                    );
                                  } else {
                                    return [
                                      ...prev,
                                      { id: dateKey, date: dateKey, limit: selectedValue },
                                    ];
                                  }
                                });
                              });
                            
                              // Reset after bulk update
                              setSelectedDates([]);
                            }


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

export default CalendarMultiSelect;