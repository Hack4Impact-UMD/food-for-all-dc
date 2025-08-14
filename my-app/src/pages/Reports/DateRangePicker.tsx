import React, { useEffect, useState } from "react";
import { TextField, IconButton, Box, Typography } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { formatDate as formatAppDate } from "../../utils/dates";

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
}

export default function DateRangePicker({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}: DateRangePickerProps) {
  const [openStart, setOpenStart] = useState(false);
  const [openEnd, setOpenEnd] = useState(false);

  useEffect(()=>{
    if (startDate != null) {
      localStorage.setItem("ffaReportDateRangeStart", startDate.toString());
    }

    if (endDate != null) {
      localStorage.setItem("ffaReportDateRangeEnd", endDate.toString());
    }
  },[startDate, endDate])

  const formatDate = (date: Date | null) =>
    date ? formatAppDate(date) : "Select date";

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography>{formatDate(startDate)}</Typography>
        <IconButton
          size="small"
          onClick={() => setOpenStart(true)}
          aria-label="Select start date"
        >
          <CalendarTodayIcon />
        </IconButton>
        <DatePicker
          open={openStart}
          onClose={() => setOpenStart(false)}
          value={startDate}
          onChange={(newValue) => setStartDate(newValue)}
          maxDate={endDate ?? undefined}
          slotProps={{
            textField: { sx: { display: "none" } }
          }}
        />

        <Typography> - </Typography>

        <Typography>{formatDate(endDate)}</Typography>
        <IconButton
          size="small"
          onClick={() => setOpenEnd(true)}
          aria-label="Select end date"
        >
          <CalendarTodayIcon />
        </IconButton>
        <DatePicker
          open={openEnd}
          onClose={() => setOpenEnd(false)}
          value={endDate}
          onChange={(newValue) => setEndDate(newValue)}
          minDate={startDate ?? undefined}
          slotProps={{
            textField: { sx: { display: "none" } }
          }}
        />
      </Box>
    </LocalizationProvider>
  );
}
