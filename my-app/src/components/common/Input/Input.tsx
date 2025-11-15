import React from "react";
import { TextField, TextFieldProps } from "@mui/material";
import styles from "./Input.module.css";

/**
 * Custom Input component with consistent styling and validation support
 *
 * @example
 * // Basic input
 * <Input label="Email" placeholder="Enter your email" />
 *
 * // Input with validation
 * <Input
 *   label="Password"
 *   type="password"
 *   error={hasError}
 *   helperText="Password must be at least 8 characters"
 * />
 */
interface InputProps extends Omit<TextFieldProps, "variant"> {
  /** Input field label */
  label?: string;
  /** Whether the input has an error state */
  error?: boolean;
  /** Helper text to display below the input (replaces errorMessage for consistency) */
  helperText?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error = false,
  helperText = "",
  fullWidth = true,
  className = "",
  ...props
}) => {
  return (
    <TextField
      variant="standard"
      fullWidth={fullWidth}
      error={error}
      helperText={helperText}
      label={label}
      className={`${styles.inputField} ${className}`}
      {...props}
    />
  );
};

export default Input;
