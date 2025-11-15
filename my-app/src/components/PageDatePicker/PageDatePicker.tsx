import { styled } from "@mui/material/styles";
import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./pagedatepicker.css";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

interface StyledButtonProps {
  marginLeft?: string;
}

const StyledCalendarButton = styled("button")<StyledButtonProps>(({ marginLeft = "2rem" }) => ({
  all: "unset",
  cursor: "pointer",
  fontSize: "12px",
  width: "2.5rem",
  height: "2.5rem",
  marginLeft,
  backgroundColor: "var(--color-primary)",
  color: "var(--color-background-main)",
  borderRadius: "var(--border-radius-md)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background-color 200ms, transform 100ms",
  "&:hover": {
    backgroundColor: "var(--color-primary-dark)",
  },
  "&:active": {
    transform: "scale(0.95)",
  },
}));

// Custom button to trigger DatePicker
const CalendarButton = forwardRef<HTMLButtonElement, any>(({ onClick, marginLeft }, ref) => (
  <StyledCalendarButton ref={ref} onClick={onClick} marginLeft={marginLeft} aria-label="Pick a date">
    <CalendarTodayIcon fontSize="medium" />
  </StyledCalendarButton>
));
CalendarButton.displayName = "CalendarButton";

interface PageDatePickerProps {
  setSelectedDate: (date: Date) => void;
  marginLeft?: string;
}

const PageDatePicker = ({ setSelectedDate, marginLeft }: PageDatePickerProps) => {
  const handleDateChange = (newDate: Date | null) => {
    if (!newDate) return;

    setSelectedDate(newDate);
  };

  return (
    <DatePicker
      onChange={(date) => handleDateChange(date)}
      customInput={<CalendarButton marginLeft={marginLeft} />}
      popperPlacement="bottom-start"
    />
  );
};

export default PageDatePicker;
