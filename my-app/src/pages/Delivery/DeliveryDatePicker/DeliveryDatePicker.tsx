import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./DeliveryDatePicker.css";

// Custom button to trigger DatePicker
const CalendarButton = forwardRef<HTMLButtonElement, any>(({ onClick }, ref) => (
  <button
    onClick={onClick}
    ref={ref}
    style={{
      all: "unset",
      cursor: "pointer",
      fontSize: "1.2rem",
      lineHeight: 1,
      marginLeft: "2rem",
    }}
  >
    📅
  </button>
));

// Add display name to the component
CalendarButton.displayName = "CalendarButton";

interface DeliveryDatePickerProps {
  setSelectedDate: (date: Date) => void;
}

const DeliveryDatePicker = ({ setSelectedDate }: DeliveryDatePickerProps) => {
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

export default DeliveryDatePicker;
