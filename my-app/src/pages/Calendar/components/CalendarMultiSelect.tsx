import React from "react";
import { Box, Chip, Stack, Typography, TextField } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';

interface CalendarMultiSelectProps {
  selectedDates: Date[];
  setSelectedDates: (dates: Date[]) => void;
}

const CalendarMultiSelect: React.FC<CalendarMultiSelectProps> = ({ selectedDates, setSelectedDates }) => {
  const [dateInput, setDateInput] = React.useState<string>("");

  const handleAddDate = (date: Date | null) => {
    if (
      date &&
      !selectedDates.some(d => d.toDateString() === date.toDateString())
    ) {
      setSelectedDates([...selectedDates, date]);
    }
    setDateInput("");
  };

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
      </Typography>
      <TextField
        label="Add Date"
        type="date"
        fullWidth
        size="small"
        value={dateInput}
        onChange={(e) => {
          const value = e.target.value;
          setDateInput(value);
          if (value) {
            const date = new Date(`${value}T00:00:00`);
            handleAddDate(date);
          }
        }}
        InputLabelProps={{ shrink: true }}
        sx={{ mb: 2 }}
      />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
        {selectedDates.map((date) => (
          <Chip
            key={date.toISOString()}
            label={date.toLocaleDateString()}
            onDelete={() => handleDeleteDate(date)}
            deleteIcon={<CloseIcon />}
            sx={{
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              fontWeight: 500,
              mb: 1
            }}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default CalendarMultiSelect;