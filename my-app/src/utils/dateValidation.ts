export interface DateValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export interface DateRangeValidationResult {
  isValid: boolean;
  startDateError?: string;
  endDateError?: string;
}

export const validateDateRange = (
  startDate: string | Date | null, 
  endDate: string | Date | null
): DateRangeValidationResult => {
  const result: DateRangeValidationResult = { isValid: true };
  
  // If either date is empty, allow it (other validation handles required fields)
  if (!startDate && !endDate) {
    return result;
  }

  // Get today's date and normalize to start of day for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Validate start date if provided
  if (startDate) {
    const start = typeof startDate === 'string' ? new Date(startDate) : new Date(startDate);
    // Normalize start date to start of day for comparison
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + 1); // Allow start date to be today or in the future
    
    if (!isNaN(start.getTime())) {
      // Check if start date is before today (current day is allowed)
      if (start < today) {
        console.log("Start date is in the past:", start);
        console.log("Today's date:", today);
        result.startDateError = "Start date cannot be in the past";
        result.isValid = false;
      }
    }
  }

  // Validate end date if provided and both dates exist
  if (startDate && endDate) {
    const start = typeof startDate === 'string' ? new Date(startDate) : new Date(startDate);
    const end = typeof endDate === 'string' ? new Date(endDate) : new Date(endDate);
    
    // Normalize both dates to start of day for comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Check if dates are valid
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      // Compare dates (end must be >= start)
      if (end < start) {
        result.endDateError = "End date must be on or after start date";
        result.isValid = false;
      }
    }
  }

  return result;
};

export const validateDeliveryDateRange = (
  deliveryDate: string | Date | null,
  repeatsEndDate: string | Date | null
): DateRangeValidationResult => {
  const result: DateRangeValidationResult = { isValid: true };

  // For delivery dates, we don't validate against current date since deliveries can be scheduled for past dates
  // Only validate that end date is not before delivery date
  if (deliveryDate && repeatsEndDate) {
    const start = typeof deliveryDate === 'string' ? new Date(deliveryDate) : new Date(deliveryDate);
    const end = typeof repeatsEndDate === 'string' ? new Date(repeatsEndDate) : new Date(repeatsEndDate);

    // Normalize both dates to start of day for comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      if (end < start) {
        result.endDateError = "End date must be on or after delivery date";
        result.isValid = false;
      }
    }
  }

  return result;
};
