import React, { useState, useCallback } from "react";
import Input from "./Input";
import { isValidDateFormat } from "../../../utils/validation";
import { formatDateToMMDDYYYY } from "../../../utils/dates";

interface DateInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  minYear?: number;
  maxYear?: number;
}

/**
 * DateInput component that enforces MM/DD/YYYY format
 * It validates input and only allows properly formatted dates
 */
const DateInput: React.FC<DateInputProps> = ({
  label,
  value,
  onChange,
  required = false,
  placeholder = "MM/DD/YYYY",
  className = "",
  fullWidth = true,
  disabled = false,
  id,
  name,
  minYear = 1900,
  maxYear = 2100,
}) => {
  const [error, setError] = useState<string>("");

  // Convert a Date to string in MM/DD/YYYY format
  const formatDate = useCallback((dateObj: Date): string => {
    return formatDateToMMDDYYYY(dateObj);
  }, []);

  // Handle input change and validate format
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;

    // Allow empty values if not required
    if (!inputValue) {
      setError(required ? "Date is required" : "");
      onChange("");
      return;
    }

    // Only allow digits and / characters
    if (/[^\d/]/.test(inputValue)) {
      setError("Only numbers and / are allowed");
      return;
    }

    // Enforce 4-digit year limit by checking parts
    const parts = inputValue.split("/");
    if (parts.length === 3 && parts[2] && parts[2].length > 4) {
      // Truncate year to 4 digits
      parts[2] = parts[2].slice(0, 4);
      inputValue = parts.join("/");
    }

    // Auto-add slashes as user types
    let formattedValue = inputValue;

    // Remove any existing slashes for clean processing
    const digitsOnly = inputValue.replace(/\D/g, "");

    if (digitsOnly.length >= 2) {
      formattedValue = digitsOnly.slice(0, 2);
      if (digitsOnly.length >= 4) {
        formattedValue += "/" + digitsOnly.slice(2, 4);
        if (digitsOnly.length >= 6) {
          formattedValue += "/" + digitsOnly.slice(4, 8); // Limit year to 4 digits
        }
      } else if (digitsOnly.length > 2) {
        formattedValue += "/" + digitsOnly.slice(2);
      }
    } else {
      formattedValue = digitsOnly;
    }

    // Update the input value
    onChange(formattedValue);

    // For partial input during typing, be lenient with errors
    if (formattedValue.length > 0 && formattedValue.length < 10) {
      setError("");
    } else if (formattedValue.length === 10) {
      // If we have a complete date, validate it
      if (isValidDateFormat(formattedValue, minYear, maxYear)) {
        setError("");
      } else {
        setError(`Invalid date. Format must be MM/DD/YYYY with year between ${minYear}-${maxYear}`);
      }
    }
  };

  // Validate on blur (when user tabs out of field)
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (!inputValue) {
      setError(required ? "Date is required" : "");
      return;
    }

    // If incomplete or invalid date format when leaving the field, show error
    if (inputValue.length > 0 && inputValue.length < 10) {
      setError("Incomplete date. Format must be MM/DD/YYYY");
      return;
    }

    if (inputValue.length === 10) {
      // Check basic format first
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!dateRegex.test(inputValue)) {
        setError("Invalid date. Format must be MM/DD/YYYY");
        return;
      }

      // Then check full validation including year range
      if (!isValidDateFormat(inputValue, minYear, maxYear)) {
        // Extract year to give more specific error if it's a year range issue
        const year = parseInt(inputValue.split("/")[2], 10);
        if (!isNaN(year) && (year < minYear || year > maxYear)) {
          setError(`Year must be between ${minYear} and ${maxYear}`);
        } else {
          setError(`Invalid date. Format must be MM/DD/YYYY with valid date`);
        }
      } else {
        setError("");
      }
    }
  };

  return (
    <Input
      label={label}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      error={!!error}
      helperText={error}
      className={className}
      fullWidth={fullWidth}
      disabled={disabled}
      id={id}
      name={name}
      inputProps={{
        maxLength: 10,
        pattern: "\\d{2}/\\d{2}/\\d{4}",
      }}
    />
  );
};

export default DateInput;
