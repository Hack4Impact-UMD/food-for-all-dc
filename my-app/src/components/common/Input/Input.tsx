import React from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import styles from './Input.module.css';

interface InputProps extends Omit<TextFieldProps, 'variant'> {
  label?: string;
  error?: boolean;
  errorMessage?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error = false,
  errorMessage = '',
  fullWidth = true,
  className = '',
  ...props
}) => {
  return (
    <div className={`${styles.inputContainer} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      <TextField
        variant="standard"
        fullWidth={fullWidth}
        error={error}
        className={styles.inputField}
        {...props}
      />
      {error && errorMessage && <p className={styles.error}>{errorMessage}</p>}
    </div>
  );
};

export default Input;