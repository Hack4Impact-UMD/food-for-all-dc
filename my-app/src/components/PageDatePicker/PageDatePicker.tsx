import { styled } from "@mui/material/styles";
import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./pagedatepicker.css";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

interface StyledButtonProps {
  marginLeft?: string;
}

const StyledCalendarButton = styled("button")<StyledButtonProps>(({ marginLeft = "var(--spacing-xl)" }) => ({
  all: "unset",
  cursor: "pointer",
  fontSize: "12px",
  width: "var(--spacing-xl40)",
  height: "var(--spacing-xl40)",
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
  <StyledCalendarButton
    ref={ref}
    onClick={onClick}
    marginLeft={marginLeft}
    aria-label="Pick a date"
  >
    <CalendarTodayIcon fontSize="medium" />
  </StyledCalendarButton>
));
CalendarButton.displayName = "CalendarButton";

interface PageDatePickerProps {
  setSelectedDate: (date: Date) => void;
  selectedDate?: Date;
  marginLeft?: string;
}

const PageDatePicker = ({ setSelectedDate, selectedDate, marginLeft }: PageDatePickerProps) => {
  const handleDateChange = (newDate: Date | null) => {
    if (!newDate) return;
    setSelectedDate(newDate);
  };

  // Get today's date (ignore time)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Use dayClassName to highlight selected and today
  return (
    <DatePicker
      onChange={(date) => handleDateChange(date)}
      selected={selectedDate}
      customInput={<CalendarButton marginLeft={marginLeft} />}
      popperPlacement="bottom-start"
      dayClassName={date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const isToday = d.getTime() === today.getTime();
        const isSelected = selectedDate && d.getTime() === new Date(selectedDate).setHours(0, 0, 0, 0);
        if (isSelected && isToday) {
          // Selected and today: use selected style only
          return "react-datepicker__day--selected";
        }
        if (isSelected) {
          // Selected: green outline
          return "react-datepicker__day--selected";
        }
        if (isToday) {
          // Today: solid green fill
          return "react-datepicker__day--custom-today";
        }
        return "";
      }}
    />
  );
};

export default PageDatePicker;
