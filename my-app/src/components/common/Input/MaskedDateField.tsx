import React, { useState, useRef, useEffect } from 'react';
import { TextField, TextFieldProps, Box } from '@mui/material';
import { validatePartialDateInput } from '../../../utils/validation';
import { normalizeDate } from '../../../utils/dates';

interface MaskedDateFieldProps extends Omit<TextFieldProps, 'onChange' | 'onError'> {
  value: string;
  onChange: (date: string) => void;
  onError?: (error: string | null) => void;
  fieldTouched?: boolean;
  setFieldTouched?: (touched: boolean) => void;
}

/**
 * A date input field with MM/DD/YYYY mask that validates input as the user types
 * Supports tabbing between MM, DD, and YYYY parts
 */
const MaskedDateField: React.FC<MaskedDateFieldProps> = ({
  value,
  onChange,
  onError,
  onBlur,
  fieldTouched = false,
  setFieldTouched = () => {
    // No-op default function
  },
  ...props
}) => {  const [dateValue, setDateValue] = useState({
    month: '',
    day: '',
    year: ''
  });
  const [error, setError] = useState<string | null>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
    // Parse date value into parts
  useEffect(() => {
    if (value) {
      // Check if it appears to be a Date object (but safely without instanceof)
      if (typeof value === 'object' && 'getMonth' in value && 'getDate' in value && 'getFullYear' in value) {
        const dateObj = value as unknown as Date;
        setDateValue({
          month: (dateObj.getMonth() + 1).toString().padStart(2, '0'),
          day: dateObj.getDate().toString().padStart(2, '0'),
          year: dateObj.getFullYear().toString()
        });
      } 
      // Check if it's in YYYY-MM-DD format (HTML date input)
      else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = value.split('-');
        setDateValue({ month, day, year });
      } 
      // Check if it's in MM/DD/YYYY format
      else if (typeof value === 'string' && value.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [month, day, year] = value.split('/');
        setDateValue({ month, day, year });
      } else if (typeof value === 'string') {
        // Try to extract what we can
        const parts = value.split(/[-/]/);
        if (parts.length === 3) {
          // Guess the format - if first part is 4 digits, assume YYYY-MM-DD
          if (parts[0].length === 4) {
            setDateValue({
              year: parts[0],
              month: parts[1].padStart(2, '0'),
              day: parts[2].padStart(2, '0')
            });
          } else {
            // Assume MM/DD/YYYY
            setDateValue({
              month: parts[0].padStart(2, '0'),
              day: parts[1].padStart(2, '0'),
              year: parts[2]
            });
          }
        }
      }
    } else {
      setDateValue({ month: '', day: '', year: '' });
    }
  }, [value]);

  // Notify of changes when date is complete
  const notifyChange = (month: string, day: string, year: string) => {
    if (month && day && year && year.length === 4) {
      // Create MM/DD/YYYY format
      const dateStr = `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
      
      // Validate full date
      const validation = validatePartialDateInput(dateStr);
      if (validation.isValid) {
        setError(null);
        if (onError) onError(null);
        onChange(dateStr);
      } else {
        setError(validation.errorMessage || "Invalid date");
        if (onError) onError(validation.errorMessage || "Invalid date");
      }
    }
  };
  
  // Handle month input
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Mark as touched
    if (!fieldTouched) setFieldTouched(true);
    
    let month = e.target.value.replace(/\D/g, '');
    
    if (month.length > 2) month = month.slice(0, 2);
    
    // Validate month range
    if (month.length === 1 && parseInt(month) > 1) {
      month = '0' + month;
      setDateValue(prev => ({ ...prev, month }));
      // Auto-advance to day input
      dayRef.current?.focus();
    } else if (month.length === 2) {
      if (parseInt(month) > 12) month = '12';
      if (parseInt(month) < 1) month = '01';
      setDateValue(prev => ({ ...prev, month }));
      // Auto-advance to day input
      dayRef.current?.focus();
    } else {
      setDateValue(prev => ({ ...prev, month }));
    }

    // If we have a complete date, notify
    if (month && dateValue.day && dateValue.year && dateValue.year.length === 4) {
      notifyChange(month, dateValue.day, dateValue.year);
    }
  };

  // Handle day input
  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Mark as touched
    if (!fieldTouched) setFieldTouched(true);
    
    let day = e.target.value.replace(/\D/g, '');
    
    if (day.length > 2) day = day.slice(0, 2);
    
    // Validate day range
    if (day.length === 1 && parseInt(day) > 3) {
      day = '0' + day;
      setDateValue(prev => ({ ...prev, day }));
      // Auto-advance to year input
      yearRef.current?.focus();
    } else if (day.length === 2) {
      if (parseInt(day) > 31) day = '31';
      if (parseInt(day) < 1) day = '01';
      setDateValue(prev => ({ ...prev, day }));
      // Auto-advance to year input
      yearRef.current?.focus();
    } else {
      setDateValue(prev => ({ ...prev, day }));
    }

    // If we have a complete date, notify
    if (dateValue.month && day && dateValue.year && dateValue.year.length === 4) {
      notifyChange(dateValue.month, day, dateValue.year);
    }
  };

  // Handle year input
  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    
    // Limit to 4 digits maximum
    const limitedValue = value.slice(0, 4);
    
    setDateValue(prev => ({ ...prev, year: limitedValue }));
    notifyChange(dateValue.month, dateValue.day, limitedValue);
    
    // Auto-focus to month when year is complete
    if (limitedValue.length === 4) {
      monthRef.current?.focus();
    }
  };
    // Handle blur event
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Mark as touched
    if (!fieldTouched) setFieldTouched(true);
    
    // Skip if the relatedTarget is one of our own inputs
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && (relatedTarget === monthRef.current || 
                          relatedTarget === dayRef.current || 
                          relatedTarget === yearRef.current)) {
      return;
    }
    
    // On blur, format and validate the date
    if (dateValue.month || dateValue.day || dateValue.year) {
      const month = dateValue.month.padStart(2, '0');
      const day = dateValue.day.padStart(2, '0');
      
      // Update the values if needed
      if (month !== dateValue.month || day !== dateValue.day) {
        setDateValue(prev => ({
          ...prev,
          month,
          day
        }));
      }
      
      // If we have a complete date, validate and notify
      if (month && day && dateValue.year && dateValue.year.length === 4) {
        notifyChange(month, day, dateValue.year);
      } else {
        // Incomplete date
        setError("Date must be in MM/DD/YYYY format");
        if (onError) onError("Date must be in MM/DD/YYYY format");
      }
    }
    
    // Call original onBlur if provided
    if (onBlur) {
      onBlur(e);
    }
  };
  
  // Handle key navigation between fields
  const handleKeyDown = (e: React.KeyboardEvent, field: 'month' | 'day' | 'year') => {
    // Handle tab navigation
    if (e.key === 'Tab' && !e.shiftKey) {
      if (field === 'month') {
        e.preventDefault();
        dayRef.current?.focus();
      } else if (field === 'day') {
        e.preventDefault();
        yearRef.current?.focus();
      }
    }
    
    // Handle backward tab navigation
    if (e.key === 'Tab' && e.shiftKey) {
      if (field === 'year') {
        e.preventDefault();
        dayRef.current?.focus();
      } else if (field === 'day') {
        e.preventDefault();
        monthRef.current?.focus();
      }
    }
    
    // Handle right arrow navigation
    if (e.key === 'ArrowRight') {
      const target = e.target as HTMLInputElement;
      const position = target.selectionStart || 0;
      
      if (field === 'month' && position === target.value.length) {
        e.preventDefault();
        dayRef.current?.focus();
      } else if (field === 'day' && position === target.value.length) {
        e.preventDefault();
        yearRef.current?.focus();
      }
    }
    
    // Handle left arrow navigation
    if (e.key === 'ArrowLeft') {
      const target = e.target as HTMLInputElement;
      const position = target.selectionStart || 0;
      
      if (field === 'day' && position === 0) {
        e.preventDefault();
        monthRef.current?.focus();
        // Position cursor at the end
        setTimeout(() => {
          if (monthRef.current) {
            const len = monthRef.current.value.length;
            monthRef.current.setSelectionRange(len, len);
          }
        }, 0);
      } else if (field === 'year' && position === 0) {
        e.preventDefault();
        dayRef.current?.focus();
        // Position cursor at the end
        setTimeout(() => {
          if (dayRef.current) {
            const len = dayRef.current.value.length;
            dayRef.current.setSelectionRange(len, len);
          }
        }, 0);
      }
    }
  };
  
  return (
    <Box sx={{ 
      position: 'relative',
      display: 'flex', 
      flexDirection: 'column',
      width: '100%',
      minHeight: '38px',
      marginBottom: '24px' // Space for error message
    }}>      <Box 
        className={(!!error || !!props.error) ? 'error' : ''}
        sx={{ 
          display: 'flex', 
          alignItems: 'center',
          position: 'relative',
          width: '100%',
          height: '38px',
          backgroundColor: 'var(--color-white)',
          border: (!!error || !!props.error) ? '1px solid var(--color-error)' : '.1rem solid black',
          borderRadius: '5px',
          padding: '0 8px',
          '&:focus-within': {
            border: '2px solid var(--color-primary)',
            boxShadow: '0 0 0 3px rgba(37, 126, 104, 0.2)',
          }
        }}
      >
        {/* Month input */}
        <input
          ref={monthRef}
          type="text"
          value={dateValue.month}
          onChange={handleMonthChange}
          placeholder="MM"
          maxLength={2}
          onBlur={handleBlur}
          onKeyDown={(e) => handleKeyDown(e, 'month')}
          style={{
            width: '24px',
            border: 'none',
            background: 'var(--color-transparent)',
            textAlign: 'center',
            outline: 'none',
            fontSize: '16px',
          }}
          aria-label="Month"
        />
        <span style={{ userSelect: 'none' }}>/</span>
        
        {/* Day input */}
        <input
          ref={dayRef}
          type="text"
          value={dateValue.day}
          onChange={handleDayChange}
          placeholder="DD"
          maxLength={2}
          onBlur={handleBlur}
          onKeyDown={(e) => handleKeyDown(e, 'day')}
          style={{
            width: '24px',
            border: 'none',
            background: 'var(--color-transparent)',
            textAlign: 'center',
            outline: 'none',
            fontSize: '16px',
          }}
          aria-label="Day"
        />
        <span style={{ userSelect: 'none' }}>/</span>
        
        {/* Year input */}
        <input
          ref={yearRef}
          type="text"
          value={dateValue.year}
          onChange={handleYearChange}
          placeholder="YYYY"
          maxLength={4}
          onBlur={handleBlur}
          onKeyDown={(e) => handleKeyDown(e, 'year')}
          style={{
            width: '48px',
            border: 'none',
            background: 'var(--color-transparent)',
            textAlign: 'center',
            outline: 'none',
            fontSize: '16px',
          }}
          aria-label="Year"
        />
        
        {/* Calendar icon */}
        <Box 
          onClick={() => {
            // Simulate a click on a native date input to open the date picker
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'date';
            hiddenInput.style.position = 'absolute';
            hiddenInput.style.left = '-9999px';
            
            // Set min/max constraints (1900-2100)
            hiddenInput.min = '1900-01-01';
            hiddenInput.max = '2100-12-31';
            
            // If we have a current value, set it
            if (dateValue.month && dateValue.day && dateValue.year && dateValue.year.length === 4) {
              hiddenInput.value = `${dateValue.year}-${dateValue.month}-${dateValue.day}`;
            }
            
            // Handle change when user selects a date
            hiddenInput.onchange = () => {
              if (hiddenInput.value) {
                const [year, month, day] = hiddenInput.value.split('-');
                setDateValue({ month, day, year });
                notifyChange(month, day, year);
                setFieldTouched(true);
              }
              document.body.removeChild(hiddenInput);
            };
            
            document.body.appendChild(hiddenInput);
            hiddenInput.click();
          }}
          sx={{
            marginLeft: 'auto',
            cursor: 'pointer',
            color: 'var(--color-text-medium-alt)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ':hover': { color: 'var(--color-primary)' }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,4H17V3a1,1,0,0,0-2,0V4H9V3A1,1,0,0,0,7,3V4H5A3,3,0,0,0,2,7V19a3,3,0,0,0,3,3H19a3,3,0,0,0,3-3V7A3,3,0,0,0,19,4Zm1,15a1,1,0,0,1-1,1H5a1,1,0,0,1-1-1V10H20ZM20,8H4V7A1,1,0,0,1,5,6H7V7A1,1,0,0,0,9,7V6h6V7a1,1,0,0,0,2,0V6h2a1,1,0,0,1,1,1Z"/>
          </svg>
        </Box>
      </Box>
        {/* Error message */}
      {(!!error || !!props.error || !!props.helperText) && (
        <Box 
          className="form-error-container"
          sx={{
            visibility: fieldTouched && (!!error || !!props.error) ? 'visible' : 'hidden',
            position: 'absolute',
            bottom: '-20px',
            left: 0,
            minHeight: '20px',
            fontSize: '0.75rem',
            color: (!!error || !!props.error) ? 'var(--color-error)' : 'rgba(0, 0, 0, 0.6)',
            lineHeight: '1.66',
            letterSpacing: '0.03333em',
            textAlign: 'left',
          }}
        >
          <span className="form-error">{error || props.helperText || " "}</span>
        </Box>
      )}
    </Box>
  );
};

export default MaskedDateField;
