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
  setError: setExternalError
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
  };  // Use the imported normalizeDate function
  
  // Check for placeholder text in input as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Check for placeholder text
    if (/dd|mm|yy/i.test(inputValue)) {
      setError("Please replace placeholders with actual values");
      return;
    }
    
    // Try to normalize the date format before validation
    const normalizedValue = normalizeDate(inputValue);
    if (normalizedValue !== inputValue) {
      inputValue = normalizedValue;
      // Update the input value for better user experience
      e.target.value = normalizedValue;
    }
    
    // Clear prior errors when user starts typing again
    if (error) setError(null);
    
    validateDateInput(
      inputValue,
      (dateStr) => onChange(dateStr),
      // Light validation during typing, only show certain errors immediately
      (errorMsg) => {
        // Only show critical errors during typing like invalid format
        if (errorMsg.includes("placeholder") || 
            errorMsg.includes("Year must be") || 
            errorMsg.includes("complete date")) {
          setError(errorMsg);
        }
      }
    );
  };
  return (    <TextField
      label={label}
      type="date"      value={value || ""}
      className={error ? 'error' : ''}
      onChange={handleInputChange}
      onBlur={(e) => {
        // Always validate on blur, even if empty (to show required error)
        validateDateInput(
            e.target.value,
            (validatedDate) => {
              // We don't update the value on blur, only show validation errors
              // This prevents unexpected input field changes when user tabs out
            },
            (errorMsg) => {
              console.log("DateField validation error on blur:", errorMsg);
              setError(errorMsg);
            }
        );      }}      
      error={Boolean(error)}      
      helperText={error || " "}
      FormHelperTextProps={{ 
        className: 'form-error',
        style: { 
          visibility: error ? 'visible' : 'visible',
          minHeight: '20px'
        } 
      }}
      fullWidth
      margin="normal"      InputLabelProps={{ shrink: true }}
      inputProps={{
        min: "1900-01-01", 
        max: "2100-12-31",
        required: required
      }}
    />
  );
};

export default DateField;
