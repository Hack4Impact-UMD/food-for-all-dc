import { DayPilot } from "@daypilot/daypilot-lite-react";
import { styled } from "@mui/material/styles";
import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./pagedatepicker.css";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

const StyledCalendarButton = styled("button")({
  all: "unset", // reset browser defaults
  cursor: "pointer",
  fontSize: "12px",
  width: "64px",
  height: "45px",
  marginLeft: "2rem",
  backgroundColor: "#257e68", // your primary green
  color: "#ffffff", // white icon/text
  borderRadius: "5px", // match .box border-radius
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background-color 200ms, transform 100ms",

  "&:hover": {
    backgroundColor: "#1f6e5c", // a slightly darker hover state
  },
  "&:active": {
    transform: "scale(0.95)", // subtle press feedback
  },
});

// Custom button to trigger DatePicker
const CalendarButton = forwardRef<HTMLButtonElement, any>(({ onClick }, ref) => (
  <StyledCalendarButton ref={ref} onClick={onClick} aria-label="Pick a date">
    <CalendarTodayIcon fontSize="medium" />
  </StyledCalendarButton>
));
CalendarButton.displayName = "CalendarButton";

interface PageDatePickerProps {
  setSelectedDate: (date: Date) => void;
}

const PageDatePicker = ({ setSelectedDate }: PageDatePickerProps) => {
  const handleDateChange = (newDate: Date | null) => {
    if (!newDate) return;

    setSelectedDate(newDate);
  };

  return (
    <DatePicker
      onChange={(date) => handleDateChange(date)}
      customInput={<CalendarButton />}
      popperPlacement="bottom-start"
    />
  );
};

export default PageDatePicker;
