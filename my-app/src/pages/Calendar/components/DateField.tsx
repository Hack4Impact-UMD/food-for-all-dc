import React, { useState } from "react";
import { TextField } from "@mui/material";
import { validateDateInput, normalizeDate } from "../../../utils/dates";
import { MaskedDateField } from "../../../components/common/Input";

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
    if (!mmddyyyy || mmddyyyy.length !== 10) return "";

    const [month, day, year] = mmddyyyy.split("/");
    if (!month || !day || !year || year.length !== 4) return "";

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };

  // Convert YYYY-MM-DD to MM/DD/YYYY
  const convertFromHtmlDateFormat = (yyyymmdd: string): string => {
    if (!yyyymmdd || yyyymmdd.length !== 10) return "";

    const [year, month, day] = yyyymmdd.split("-");
    if (!year || !month || !day) return "";

    return `${month}/${day}/${year}`;
  };

  // Check for placeholder text in input as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const htmlDateValue = e.target.value; // This is in YYYY-MM-DD format

    // Clear error when user starts typing
    if (error) setError(null);

    if (!htmlDateValue) {
      onChange("");
      return;
    }

    // Convert HTML date format to MM/DD/YYYY format
    const mmddyyyyValue = convertFromHtmlDateFormat(htmlDateValue);

    // Validate the converted date
    validateDateInput(
      mmddyyyyValue,
      (validatedDate) => onChange(validatedDate),
      (errorMsg) => {
        // Only show critical errors during typing
        if (errorMsg.includes("Year must be") || errorMsg.includes("Invalid date")) {
          setError(errorMsg);
        }
      }
    );
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

        if (!htmlDateValue && required) {
          setError("Date is required");
          return;
        }

        if (!htmlDateValue && !required) {
          setError(null);
          return;
        }

        // Convert and validate on blur
        const mmddyyyyValue = convertFromHtmlDateFormat(htmlDateValue);

        validateDateInput(
          mmddyyyyValue,
          (validatedDate) => {
            // Date is valid, no need to change the value as it's already set
            setError(null);
          },
          (errorMsg) => {
            setError(errorMsg);
          }
        );
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
