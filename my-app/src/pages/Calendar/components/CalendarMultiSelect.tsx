import React, { useState } from "react";
import { Box, Chip, Stack, Typography, Button } from "@mui/material";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

interface CalendarMultiSelectProps {
  selectedDates: Date[];
  setSelectedDates: (dates: Date[]) => void;
}

const CalendarMultiSelect: React.FC<CalendarMultiSelectProps> = ({ selectedDates, setSelectedDates }) => {
  const [dateInput, setDateInput] = useState<string>("");
  
  // function to add a date to the selectedDates array
  const handleAddDate = (date: Date | null) => {
    if (
      date &&
      !selectedDates.some(d => d.toDateString() === date.toDateString())
    ) {
      const correctedDate = new Date(date);
      correctedDate.setHours(24); //offsetting by one day 
      setSelectedDates([...selectedDates, correctedDate]);
    }
    setDateInput("");
  };

  // function to delete a date from the selectedDates array
  const handleDeleteDate = (dateToDelete: Date) => {
    setSelectedDates(selectedDates.filter(d => d.toDateString() !== dateToDelete.toDateString()));
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Select Custom Dates
      </Typography>
      
      <Box sx={{ display: 'flex', mb: 2, gap: 1 }}>
        <input
          type="date"
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          style={{
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            flexGrow: 1
          }}
        />
        <Button
          variant="contained"
          size="small"
          startIcon={<CalendarMonthIcon />}
          onClick={() => {
            if (dateInput) {
              handleAddDate(new Date(dateInput));
            }
          }}
          disabled={!dateInput}
        >
          Add Date
        </Button>
      </Box>
      
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
        {selectedDates.map((date) => (
          <Chip
            key={date.toISOString()}
            label={date.toLocaleDateString()}
            onDelete={() => handleDeleteDate(date)}
            onClick = {function() {return;}} // fix onClick error
            sx={{ mb: 1 }}
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