import React from "react";
import { Typography } from "@mui/material";
import { format } from "date-fns";
import { DeliveryEvent } from "../../../types/calendar-types";
import styles from "./DeliveryCard.module.css";

// Helper to parse YYYY-MM-DD as local date
function parseLocalDateString(dateStr: string): Date {
  if (!dateStr) return new Date("");
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Helper function to get delivery recurrence label and CSS class
const getDeliveryTypeInfo = (recurrence: string) => {
  switch (recurrence) {
    case "Weekly":
      return { label: "WEEKLY DELIVERY", className: styles.weekly };
    case "2x-Monthly":
      return { label: "2x-MONTHLY DELIVERY", className: styles.twoXMonthly };
    case "Monthly":
      return { label: "MONTHLY DELIVERY", className: styles.monthly };
    case "Custom":
      return { label: "CUSTOM DELIVERY", className: styles.custom };
    default:
      return { label: "ONE-OFF DELIVERY", className: styles.oneOff };
  }
};

interface DeliveryRecurrenceDisplayProps {
  event: DeliveryEvent;
}

const DeliveryRecurrenceDisplay: React.FC<DeliveryRecurrenceDisplayProps> = ({ event }) => {
  const { label, className } = getDeliveryTypeInfo(event.recurrence);

  let dateRangeElement = null;
  // Only show date range if not a one-off delivery
  if (event.recurrence !== "None" && event.seriesStartDate && event.repeatsEndDate) {
    try {
      const startDateStr = String(event.seriesStartDate);
      const endDateStr = String(event.repeatsEndDate);

      const startDateObj = parseLocalDateString(startDateStr);
      const endDateObj = parseLocalDateString(endDateStr);

      if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
        const startDate = format(startDateObj, "M/d/yy");
        const endDate = format(endDateObj, "M/d/yy");
        const dateRange = `(${startDate}-${endDate})`;

        dateRangeElement = <Typography>{dateRange}</Typography>;
      }
    } catch (error) {
      console.error("Error formatting date range:", error);
    }
  }

  return (
    <>
      <Typography className={`${styles.deliveryTypeIndicator} ${className}`}>{label}</Typography>
      {dateRangeElement}
    </>
  );
};

export default DeliveryRecurrenceDisplay;
