import { GlobalStyles } from '@mui/material';
import { useEffect } from "react";
import React, { useState } from "react";
import { Box, Chip, Stack, Typography, TextField } from "@mui/material";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
// Removed react-datepicker import, only using MUI DatePicker
import { validateDateInput } from "../../../utils/dates";

interface CalendarMultiSelectProps {
  selectedDates: Date[];
  setSelectedDates: (dates: Date[]) => void;
  endDate: Date;
}

const CalendarMultiSelect: React.FC<CalendarMultiSelectProps> = ({ selectedDates, setSelectedDates, endDate }) => {
  const [dateInput, setDateInput] = useState<Date | null>(null);

  // Reset date input when dialog opens (when selectedDates is reset)
  useEffect(() => {
  setDateInput(null);
  }, [selectedDates.length === 0]);
  const [dateError, setDateError] = useState<string | null>(null);

  const handleAddDate = (date: Date | null) => {
    if (
      date &&
      !selectedDates.some(d => d.toDateString() === date.toDateString())
    ) {
      setSelectedDates([...selectedDates, date]);
    }
  setDateInput(null);
  };

   // Function to handle adding a new date
   const handleDateChange = (date: Date | null) => {
    if (!date) return;
    
    // Check if date already exists in the array
    if (!selectedDates.some(d => d.toDateString() === date.toDateString())) {
      // Add the new date and sort all dates chronologically
      const updatedDates = [...selectedDates, date];
      const sortedDates = updatedDates.sort((a, b) => a.getTime() - b.getTime());
      setSelectedDates(sortedDates);
    } else {
      setSelectedDates(selectedDates.filter(d => d.toDateString() !== date.toDateString()));
    }
  };

  // Function to delete a date from the selectedDates array
  const handleDeleteDate = (dateToDelete: Date) => {
    if (dateToDelete < new Date()) {
      console.warn("Cannot delete chips for past dates.");
      return;
    }
    setSelectedDates(selectedDates.filter(d => d.toDateString() !== dateToDelete.toDateString()));
  };

  return (
    <>
      <GlobalStyles styles={{
        '.MuiPaper-root.MuiPickerPopper-paper, .MuiPaper-root[class*="MuiPickerPopper-paper"]': {
          transform: 'scale(0.5)',
          transformOrigin: 'top right',
        }
      }} />
      <Box sx={{ display: 'grid', gridTemplateRows: '56px 1fr', width: '100%', mt: 2 }}>
        {/* DatePicker input always anchored at top, fixed height */}
        <Box sx={{ height: 56, display: 'flex', alignItems: 'center', width: '100%' }}>
          <DatePicker
            label="Add Date"
            value={dateInput}
            onChange={(newValue: Date | null) => {
              setDateInput(newValue);
              setDateError(null);
              if (!newValue) return;
              if (newValue > endDate) {
                setDateError('Date cannot be later than the current end date.');
                return;
              }
              if (!selectedDates.some(d => d.toDateString() === newValue.toDateString())) {
                setSelectedDates([...selectedDates, newValue]);
              }
            }}
            slotProps={{
              textField: { fullWidth: true, size: 'small', sx: { mb: 2, width: '100%' } },
              popper: {
                placement: 'top-end',
                modifiers: [
                  { name: 'offset', options: { offset: [0, -380] } }
                ],
                sx: {
                  zIndex: 1500,
                  boxSizing: 'border-box',
                },
                className: 'add-delivery-datepicker-popper',
              }
            }}
          />
        </Box>
        {dateError && (
          <Typography variant="body2" color="error" sx={{ mt: 0.5, mb: 0.5 }}>
            {dateError}
          </Typography>
        )}
        {/* Chip container grows below, never moves input */}
        <Box sx={{ minHeight: 32, maxHeight: 64, overflowY: 'auto', width: '100%' }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', minWidth: 0, flexShrink: 1, mt: 0 }}>
            {selectedDates.map((date) => (
              <Chip
                key={date.toISOString()}
                label={date.toLocaleDateString()}
                onDelete={() => setSelectedDates(selectedDates.filter(d => d.toDateString() !== date.toDateString()))}
                sx={{ mb: 1, padding: '1rem .5rem' }}
              />
            ))}
            {selectedDates.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No dates selected
              </Typography>
            )}
          </Stack>
        </Box>
      </Box>
    </>
  );
};

export default CalendarMultiSelect;