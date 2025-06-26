import React, { useState } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface CalendarMultiSelectProps {
  selectedDates: Date[];
  setSelectedDates: (dates: Date[]) => void;
}

const CalendarMultiSelect: React.FC<CalendarMultiSelectProps> = ({ selectedDates, setSelectedDates }) => {
  // Function to handle adding a new date
  const handleDateChange = (date: Date | null) => {
    if (!date) return;
    
    // Check if date already exists in the array
    if (!selectedDates.some(d => d.toDateString() === date.toDateString())) {
      // Add the new date and sort all dates chronologically
      const updatedDates = [...selectedDates, date];
      const sortedDates = updatedDates.sort((a, b) => a.getTime() - b.getTime());
      setSelectedDates(sortedDates);
    }
  };

  // Function to delete a date from the selectedDates array
  const handleDeleteDate = (dateToDelete: Date) => {
    setSelectedDates(selectedDates.filter(d => d.toDateString() !== dateToDelete.toDateString()));
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Select Custom Dates
      </Typography>
      
      <Box sx={{ 
        '& .react-datepicker': { 
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontFamily: 'inherit'
        },
        '& .react-datepicker__header': {
          backgroundColor: '#f5f5f5'
        },
        '& .react-datepicker__day--selected': {
          backgroundColor: '#1976d2',
          color: 'white'
        },
        '& .react-datepicker__day--highlighted': {
          backgroundColor: '#e6f7ff',
          borderRadius: '50%'
        }
      }}>
        <DatePicker
          inline
          selected = {null}
          onChange = {handleDateChange}
          highlightDates = {selectedDates}
          calendarClassName = "persistent-calendar"
          dayClassName={(date) => {
            // Highlight days that are already selected
            return selectedDates.some(d => d.toDateString() === date.toDateString()) 
              ? "highlighted-day" 
              : "";
          }}
        />
      </Box>
      
      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
        Selected Dates:
      </Typography>
      
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
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