import React, { useState } from "react";
import { TextField } from "@mui/material";
import { validateDateInput } from "../../../utils/dates";

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  required?: boolean;
  error?: string;
  setError?: (error: string | null) => void;
}

const DateField: React.FC<DateFieldProps> = ({
  label,
  value,
  onChange,
  required = false,
  error: propError,
  setError: setExternalError,
}) => {
  const [internalError, setInternalError] = useState<string | null>(null);

  // Determine which error to use (prop or internal)
  const error = propError || internalError;

  // Function to set error in both places
  const setError = (errorMessage: string | null) => {
    setInternalError(errorMessage);
    if (setExternalError) {
      setExternalError(errorMessage);
    }
  };

  // Convert MM/DD/YYYY to YYYY-MM-DD for HTML date input
  const convertToHtmlDateFormat = (mmddyyyy: string): string => {
    if (!mmddyyyy) return "";

    // Handle full MM/DD/YYYY format
    if (mmddyyyy.length === 10 && mmddyyyy.includes("/")) {
      const [month, day, year] = mmddyyyy.split("/");
      if (month && day && year && year.length === 4) {
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }

    // For any other format or partial input, return empty string
    // This prevents the HTML date input from showing invalid values
    return "";
  };

  // Convert YYYY-MM-DD to MM/DD/YYYY
  const convertFromHtmlDateFormat = (yyyymmdd: string): string => {
    if (!yyyymmdd || yyyymmdd.length !== 10) return "";

    const [year, month, day] = yyyymmdd.split("-");
    if (!year || !month || !day) return "";

    return `${month}/${day}/${year}`;
  };

  // Handle date input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const htmlDateValue = e.target.value; // This is in YYYY-MM-DD format from HTML input

    // Clear error when user starts typing
    if (error) setError(null);

    if (!htmlDateValue) {
      onChange("");
      return;
    }

    // HTML date inputs only emit complete dates or empty strings
    // Convert to MM/DD/YYYY format and update parent
    const mmddyyyyValue = convertFromHtmlDateFormat(htmlDateValue);
    if (mmddyyyyValue) {
      onChange(mmddyyyyValue);
    }
  };

  return (
    <TextField
      label={label}
      type="date"
      value={convertToHtmlDateFormat(value) || ""}
      className={error ? "error" : ""}
      onChange={handleInputChange}
      onBlur={(e) => {
        const htmlDateValue = e.target.value;

        // Handle required field validation
        if (!htmlDateValue && required) {
          setError("Date is required");
          return;
        }

        // Clear error for empty optional fields
        if (!htmlDateValue && !required) {
          setError(null);
          return;
        }

        // Validate complete dates
        if (htmlDateValue) {
          const mmddyyyyValue = convertFromHtmlDateFormat(htmlDateValue);

          if (mmddyyyyValue) {
            // Validate the date
            validateDateInput(
              mmddyyyyValue,
              () => setError(null),
              (errorMsg) => setError(errorMsg)
            );
          } else {
            setError("Please enter a valid date");
          }
        }
      }}
      error={Boolean(error)}
      helperText={error || " "}
      FormHelperTextProps={{
        className: "form-error",
        style: {
          visibility: error ? "visible" : "visible",
          minHeight: "20px",
        },
      }}
      fullWidth
      margin="normal"
      InputLabelProps={{ shrink: true }}
      inputProps={{
        min: "1900-01-01",
        max: "2100-12-31",
        required: required,
      }}
    />
  );
};

export default DateField;
