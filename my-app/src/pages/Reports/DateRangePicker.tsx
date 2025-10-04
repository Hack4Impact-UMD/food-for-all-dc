import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { formatDate as formatAppDate } from "../../utils/dates";
import { Box, Typography } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { styled } from "@mui/material/styles";

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
}


const StyledDatePickerWrapper = styled(Box)({
  "& .react-datepicker-popper": {
    zIndex: 1000,
  },
  "& .react-datepicker": {
    fontFamily: "inherit",
    border: "none",
    boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.1)",
  },
});


export default function DateRangePicker({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}: DateRangePickerProps) {
  const formatDate = (date: Date | null) =>
    date ? formatAppDate(date) : "Select date";

  useEffect(() => {
    if (startDate != null) {
      localStorage.setItem("ffaReportDateRangeStart", startDate.toString());
    }

    if (endDate != null) {
      localStorage.setItem("ffaReportDateRangeEnd", endDate.toString());
    }
  }, [startDate, endDate]);

  return (
    <StyledDatePickerWrapper>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <DatePicker
          selected={startDate}
          onChange={(date) => setStartDate(date)}
          selectsStart
          startDate={startDate}
          maxDate={endDate ?? undefined}
          customInput={
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography>{formatDate(startDate)}</Typography>
              <CalendarTodayIcon sx={{ ml: 1, cursor: "pointer" }} />
            </Box>
          }
          wrapperClassName="date-picker"
        />

        <Typography> - </Typography>

        <DatePicker
          selected={endDate}
          onChange={(date) => setEndDate(date)}
          selectsEnd
          endDate={endDate}
          minDate={startDate ?? undefined}
          customInput={
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography>{formatDate(endDate)}</Typography>
              <CalendarTodayIcon sx={{ ml: 1, cursor: "pointer" }} />
            </Box>
          }
          wrapperClassName="date-picker"
        />
      </Box>
    </StyledDatePickerWrapper>
  );
}