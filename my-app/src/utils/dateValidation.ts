import { Time, TimeUtils } from './timeUtils';

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
  
  if (!startDate && !endDate) {
    return result;
  }

  if (startDate) {
    const startDateTime = TimeUtils.fromAny(startDate);
    const validation = Time.Validation.validateNotPast(startDateTime);
    
    if (!validation.isValid) {
      result.startDateError = validation.errorMessage;
      result.isValid = false;
    }
  }

  if (startDate && endDate) {
    const startDateTime = TimeUtils.fromAny(startDate);
    const endDateTime = TimeUtils.fromAny(endDate);
    
    const validation = Time.Validation.validateDateRange(startDateTime, endDateTime);
    
    if (!validation.isValid) {
      if (validation.startDateError) {
        result.startDateError = validation.startDateError;
      }
      if (validation.endDateError) {
        result.endDateError = validation.endDateError;
      }
      result.isValid = false;
    }
  }

  return result;
};

export const validateDeliveryDateRange = (
  deliveryDate: string | Date | null,
  repeatsEndDate: string | Date | null
): DateRangeValidationResult => {
  const result: DateRangeValidationResult = { isValid: true };

  if (deliveryDate && repeatsEndDate) {
    const deliveryDateTime = TimeUtils.fromAny(deliveryDate);
    const endDateTime = TimeUtils.fromAny(repeatsEndDate);

    const validation = Time.Validation.validateDeliveryDateRange(deliveryDateTime, endDateTime);
    
    if (!validation.isValid) {
      result.endDateError = validation.endDateError;
      result.isValid = false;
    }
  }

  return result;
};