import React, { useState } from "react";
import { Box, Chip, Stack, Typography, TextField } from "@mui/material";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { validateDateInput } from "../../../utils/dates";

interface CalendarMultiSelectProps {
  selectedDates: Date[];
  setSelectedDates: (dates: Date[]) => void;
}

const CalendarMultiSelect: React.FC<CalendarMultiSelectProps> = ({ selectedDates, setSelectedDates }) => {
  const [dateInput, setDateInput] = useState<string>("");
  const [dateError, setDateError] = useState<string | null>(null);

  const handleAddDate = (date: Date | null) => {
    if (
      date &&
      !selectedDates.some(d => d.toDateString() === date.toDateString())
    ) {
      setSelectedDates([...selectedDates, date]);
    }
    setDateInput("");
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
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Select Custom Dates
      </Typography>      <TextField
        label="Add Date"
        type="date"
        fullWidth
        size="small"
        value={dateInput}
        onChange={(e) => {
          // Clear error when user starts typing
          if (dateError) setDateError(null);
          
          validateDateInput(
            e.target.value,
            (dateStr) => {
              setDateInput(dateStr);
              handleAddDate(new Date(dateStr));
            },
            (errorMsg) => setDateError(errorMsg)
          );
        }}
        onBlur={(e) => {
          if (e.target.value) {
            validateDateInput(
              e.target.value,
              (dateStr) => {
                setDateInput(dateStr);
                handleAddDate(new Date(dateStr));
              },
              (errorMsg) => setDateError(errorMsg)
            );
          }
        }}
        error={!!dateError}
        helperText={dateError || " "}
        InputLabelProps={{ shrink: true }}
        inputProps={{
          min: "1900-01-01",
          max: "2100-12-31"
        }}
        sx={{ mb: 2 }}
      />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
        {selectedDates.map((date) => (
          <Chip
            key={date.toISOString()}
            label={date.toLocaleDateString()}
            onDelete={() => handleDeleteDate(date)}
            sx={{ mb: 1, padding: '1rem .5rem' }}
            onClick = {function() {return;}} //empty onclick to prevent error
          />
        ))}
        {selectedDates.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No dates selected
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default CalendarMultiSelect;