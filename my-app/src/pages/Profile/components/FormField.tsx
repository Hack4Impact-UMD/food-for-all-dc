import React, { useState } from "react";
import {
  TextField,
  styled,
  SelectChangeEvent,
  Box,
  Button,
  MenuItem,
  Typography,
  Checkbox,
  FormControlLabel,
  Grid,
  Select,
} from "@mui/material";
import { validateDateInput } from "../../../utils/dates";
import { isValidHtmlDateFormat } from "../../../utils/validation";
import { ClientProfileKey } from '../types';
import { DietaryRestrictions } from '../../../types';
import TagManager from "../Tags/TagManager";
import '../../../styles/checkbox-override.css';

interface FormFieldProps {
  fieldPath: ClientProfileKey;
  value: any;
  type?: string;
  isEditing: boolean; handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | SelectChangeEvent
  ) => void;
  getNestedValue: (obj: any, path: string) => any;
  handleDietaryRestrictionChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addressInputRef?: React.RefObject<HTMLInputElement | null>;
  isDisabledField?: boolean;
  ward?: string;
  tags: string[];
  allTags: string[];
  isModalOpen: boolean;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleTag: (tag: string) => void;
  error?: string; // Add error prop
}

const fieldStyles = {
  backgroundColor: "white",
  width: "100%",
  height: "56px",
  padding: "0.1rem 0.5rem",
  borderRadius: "5px",
  border: "1px solid var(--color-border-light)",
  marginTop: "0px",
};

const CustomTextField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      border: "none",
    },
    "&:focus-within": {
      "& .MuiInputBase-input": {
        border: "2px solid var(--color-primary)",
        outline: "none",
        boxShadow: "0 0 0 3px rgba(37, 126, 104, 0.2)",
      },
    },
    "&.Mui-error .MuiInputBase-input": {
      border: "1px solid var(--color-error)",
      boxShadow: "0 0 0 1px rgba(255, 0, 0, 0.1)",
    }
  },
  "& .MuiFormHelperText-root": {
    minHeight: '20px',
    height: '20px',
    margin: '3px 0',
    lineHeight: '20px',
    "&.Mui-error": {
      color: "var(--color-error)",
    }
  }, "& .MuiInputBase-input": {
    backgroundColor: "white",
    width: "100%",
    height: "56px",
    padding: "0.1rem 0.5rem",
    borderRadius: "5px",
    border: ".1rem solid black",
    marginTop: "0px",
    "&:focus": {
      border: "2px solid #257E68",
      outline: "none",
      boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
    },
  },
  "& .MuiInputBase-inputMultiline": {
    backgroundColor: "white",
    width: "100%",
    minHeight: "56px",
    height: "auto",
    padding: "0.5rem",
    borderRadius: "5px",
    border: ".1rem solid black",
    marginTop: "0px",
    marginBottom: "-20px",
    whiteSpace: "normal",
    wordWrap: "break-word",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    resize: "vertical",
    "&:focus": {
      border: "2px solid #257E68",
      outline: "none",
      boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
    },
  },
  "& .MuiInputBase-input.Mui-disabled": {
    backgroundColor: "#e0e0e0",
    color: "#757575",
    WebkitTextFillColor: "#757575",
    cursor: "not-allowed",
    borderRadius: fieldStyles.borderRadius,
    border: "1.5px solid #bdbdbd",
    fontWeight: 500,
    opacity: 1,
  },
});

export const CustomSelect = styled(Select)({
  height: fieldStyles.height,
  boxSizing: 'border-box',
  width: '100%',
  position: 'relative',

  // Remove the default Material UI outline completely
  '&.MuiOutlinedInput-root': {
    '& fieldset.MuiOutlinedInput-notchedOutline': {
      display: 'none',
    },
  },

  // Apply our own border and background
  border: `1px solid var(--color-border-light)`,
  borderRadius: '5px',
  backgroundColor: 'white',

  // Focus state
  '&:focus-within': {
    border: `1px solid var(--color-primary)`,
    boxShadow: '0 0 0 3px rgba(37, 126, 104, 0.2)',
    outline: 'none',
  },

  // Style the select content area
  '& .MuiSelect-select': {
    height: '100%',
    padding: '0 48px 0 14px', // Increased right padding to prevent text overlap with arrow
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    border: 'none',
    outline: 'none',
  },

  // Position the real MUI arrow inside the field
  '& .MuiSelect-icon': {
    position: 'absolute !important',
    right: '12px !important',
    top: '50% !important',
    transform: 'translateY(-50%) !important',
    color: '#666 !important',
    fontSize: '1.2rem !important',
    pointerEvents: 'none !important',
    zIndex: 2,
  },

  // Disabled state
  '&.Mui-disabled': {
    backgroundColor: "#e0e0e0",
    color: "#757575",
    cursor: "not-allowed",

    '& .MuiSelect-select': {
      color: "#757575",
    },

    '& .MuiSelect-icon': {
      color: "#999",
    }
  },
});

const CustomCheckbox = styled(Checkbox)({
  "&.MuiCheckbox-root": {
    "&:focus": {
      outline: "none",
    },
    "&.Mui-focusVisible": {
      "& .MuiSvgIcon-root": {
        color: "#257E68",
      },
    },
    "& .MuiTouchRipple-root": {
      color: "rgba(37, 126, 104, 1)",
      backgroundColor: "rgba(37, 126, 104, 1)",
    },
    "& .MuiTouchRipple-child": {
      backgroundColor: "rgba(37, 126, 104, 1)",
    },
    "&:hover .MuiTouchRipple-root": {
      color: "rgba(37, 126, 104, 1)",
    },
    "&.Mui-focusVisible .MuiTouchRipple-root": {
      color: "rgba(37, 126, 104, 1)",
    },
  },
});

const DateFieldComponent = ({
  fieldPath,
  value,
  handleChange,
  dateInputProps,
  error
}: {
  fieldPath: string;
  value: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | SelectChangeEvent) => void;
  dateInputProps: Record<string, any>;
  error?: string;
}) => {
  const [dateError, setDateError] = useState<string | null>(null);
  const [fieldTouched, setFieldTouched] = useState<boolean>(false);

  // Determine what error to show:
  // 1. External error (from Profile validation) takes priority
  // 2. Internal dateError only shows if field was touched
  const displayError = error || (fieldTouched && dateError);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Mark field as touched on blur
    setFieldTouched(true);

    const value = e.target.value;

    // If the field is empty, it's valid (DOB is optional)
    if (!value) {
      setDateError(null);
      return;
    }

    // Use the isValidHtmlDateFormat function for HTML date input validation
    if (!isValidHtmlDateFormat(value, 1900, 2100)) {
      // Provide more specific error messages
      if (!value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        setDateError("Please select a valid date");
      } else {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          setDateError("Please select a valid date");
        } else {
          const year = date.getFullYear();
          if (year < 1900 || year > 2100) {
            setDateError("Year must be between 1900-2100");
          } else {
            setDateError("Please select a valid date");
          }
        }
      }
    } else {
      setDateError(null);
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        marginBottom: '24px', // Space for any error message
      }}
    >
      <CustomTextField
        type="date"
        name={fieldPath}
        value={value || ""}
        className={(fieldTouched && !!dateError) ? 'error' : ''}
        onChange={(e) => {
          // Mark field as touched on change
          if (!fieldTouched) setFieldTouched(true);

          // Clear error when user starts typing
          if (dateError) setDateError(null);

          // Pass to the handler
          handleChange(e);
        }}
        onBlur={handleBlur}
        onFocus={() => setFieldTouched(true)}
        error={!!displayError}
        helperText={displayError || " "}
        InputLabelProps={{ shrink: true }}
        FormHelperTextProps={{
          sx: {
            visibility: displayError ? 'visible' : 'hidden',
            position: 'absolute',
            bottom: '-2.65rem',
            left: 0,
            margin: '1rem 0 0 0',
            color: '#d32f2f !important', // unsure why we need to specifically enforce this color here
          }
        }}
        InputProps={{
          sx: {
            '& input::-webkit-calendar-picker-indicator': {
              cursor: 'pointer'
            }
          }
        }}
        fullWidth
        margin="none"
        sx={{
          '& .MuiInputBase-root': { height: '38px' },
          mb: 0
        }}
        inputProps={{
          min: "1900-01-01",
          max: "2100-12-31",
          ...dateInputProps
        }}
      />
    </Box>
  );
};

const FormField: React.FC<FormFieldProps> = ({
  fieldPath,
  value,
  type = "text",
  isEditing,
  handleChange,
  getNestedValue,
  handleDietaryRestrictionChange,
  addressInputRef,
  isDisabledField = false,
  ward,
  tags,
  allTags,
  isModalOpen,
  setIsModalOpen,
  handleTag,
  error,
}) => {
  const capitalizeFirstLetter = (value: string) => {
    return value[0].toUpperCase() + value.slice(1);
  };

  const renderDietaryRestrictions = () => {
    const restrictions = value as DietaryRestrictions;

    if (isEditing) {
      return (
        <Grid container spacing={1}>
          {Object.entries(restrictions)
            .filter(([key, value]) => typeof value === "boolean")
            .map(([key, value]) => (
              <Grid key={key}>                <FormControlLabel
                sx={{ textAlign: "left" }}
                control={
                  <CustomCheckbox
                    name={key}
                    checked={value as boolean}
                    onChange={handleDietaryRestrictionChange}
                  />
                }
                label={capitalizeFirstLetter(key.replace(/([A-Z])/g, " $1").trim())}
              />
              </Grid>
            ))}
        </Grid>
      );
    }

    const selectedRestrictions = Object.entries(restrictions)
      .filter(([key, value]) => value === true && typeof value === "boolean")
      .map(([key]) => key.replace(/([A-Z])/g, " $1").trim());

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, minHeight: 40 }}>
        {selectedRestrictions.length > 0 ? (
          selectedRestrictions.map((restriction) => (
            <Box
              key={restriction}
              sx={{
                display: 'inline-block',
                px: 1.5,
                py: 0.5,
                bgcolor: '#e0f2f1',
                color: '#257E68',
                borderRadius: '16px',
                fontWeight: 600,
                fontSize: '0.95rem',
                mr: 1,
                mb: 1,
                letterSpacing: 0.2,
              }}
            >
              {restriction}
            </Box>
          ))
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 64,
              minHeight: 32,
              px: 1.5,
              py: 0.5,
              bgcolor: '#f5f5f5',
              color: '#888',
              borderRadius: '16px',
              fontWeight: 500,
              fontSize: '0.95rem',
              letterSpacing: 0.2,
              textAlign: 'center',
            }}
          >
            None
          </Box>
        )}
      </Box>
    );
  };

  const renderFieldValue = (fieldPath: string, value: any) => {
    if (fieldPath === "dob") {
      let dobDate;

      // Check if the value is a Date object, Timestamp, or string
      if (value instanceof Date) {
        dobDate = value;
      } else if (typeof value === "object" && value?.toDate) {
        // If it's a Firestore Timestamp, convert it to a Date object
        dobDate = value.toDate();
      } else if (typeof value === "string") {
        // If it's a string, try to create a Date object from it
        dobDate = new Date(value);
      } else {
        // Handle other cases
        dobDate = new Date();
      }

      // Ensure dobDate is valid
      if (isNaN(dobDate.getTime())) {
        return "";
      }

      // Format the date in a more readable format
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };
      const formattedDate = dobDate.toLocaleDateString('en-US', options);
      const age = Math.floor((new Date().getTime() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      return `${formattedDate} (Age ${age})`;
    }
    if (fieldPath === "gender") {
      return value as string;
    }
    if (fieldPath === "tags") {
      value = tags.length > 0 ? tags : "None"; // Tags depend on this
    }
    if (fieldPath === "deliveryDetails.dietaryRestrictions") {
      return (
        Object.entries(value as DietaryRestrictions)
          .filter(([key, val]) => val === true && typeof val === "boolean")
          .map(([key]) => key.replace(/([A-Z])/g, " $1").trim())
          .join(", ") || "None"
      );
    }
    return String(value || "N/A");
  };

  if (fieldPath === "deliveryDetails.dietaryRestrictions") {
    return renderDietaryRestrictions();
  }

  if (isEditing) {
    // Declare minLength variables before switch to avoid no-case-declarations lint error
    let minLength = 2;
    const minLengthTextarea = 2;
    const selectInputProps = { minLength: 2 };
    const dateInputProps = { minLength: 10 };
    switch (type) {
      case "select": if (fieldPath === "gender") {
        return (
          <Box sx={{ position: 'relative', width: '100%' }}>
            <CustomSelect
              name={fieldPath}
              value={value as string || ''}
              onChange={(e) => handleChange(e as SelectChangeEvent<string>)}
              displayEmpty
              inputProps={selectInputProps}
              sx={{ width: '100%' }}
              MenuProps={{
                sx: { marginTop: '2px' } // Separate the dropdown from the field slightly
              }}
            >
              <MenuItem value="" disabled>
                Select
              </MenuItem>
              <MenuItem value="Male">Male</MenuItem>
              <MenuItem value="Female">Female</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </CustomSelect>
          </Box>
        );
      } else if (fieldPath === "headOfHousehold") {
        return (
          <CustomSelect
            name={fieldPath}
            value={value as string}
            onChange={(e) => handleChange(e as SelectChangeEvent<string>)}
            displayEmpty
            inputProps={selectInputProps}
            sx={{ width: '100%' }}
          >
            <MenuItem value="" disabled>
              Select
            </MenuItem>
            <MenuItem value="Adult">Adult</MenuItem>
            <MenuItem value="Senior">Senior</MenuItem>
          </CustomSelect>
        );
      } else if (fieldPath === "ethnicity" || fieldPath === "referralEntity" || fieldPath === "recurrence") {
        return (
          <CustomSelect
            name={fieldPath}
            value={value as string}
            onChange={(e) => handleChange(e as SelectChangeEvent<string>)}
            inputProps={selectInputProps}
          >
            {fieldPath === "recurrence" && [
              <MenuItem key="None" value="None">None</MenuItem>,
              <MenuItem key="Weekly" value="Weekly">Weekly</MenuItem>,
              <MenuItem key="2x-Monthly" value="2x-Monthly">2x-Monthly</MenuItem>,
              <MenuItem key="Monthly" value="Monthly">Monthly</MenuItem>,
            ]}
            {fieldPath === "ethnicity" && [
              <MenuItem key="" value="" disabled>Select</MenuItem>,
              <MenuItem key="Hispanic or Latino" value="Hispanic or Latino">Hispanic or Latino</MenuItem>,
              <MenuItem key="Not Hispanic or Latino" value="Not Hispanic or Latino">Not Hispanic or Latino</MenuItem>,
              <MenuItem key="Unknown" value="Unknown">Unknown</MenuItem>,
            ]}
            {fieldPath === "referralEntity" && [
              <MenuItem key="" value="" disabled>Select</MenuItem>,
              <MenuItem key="Healthcare Provider" value="Healthcare Provider">Healthcare Provider</MenuItem>,
              <MenuItem key="Social Services" value="Social Services">Social Services</MenuItem>,
              <MenuItem key="Community Organization" value="Community Organization">Community Organization</MenuItem>,
              <MenuItem key="School/Educational Institution" value="School/Educational Institution">School/Educational Institution</MenuItem>,
              <MenuItem key="Religious Organization" value="Religious Organization">Religious Organization</MenuItem>,
              <MenuItem key="Government Agency" value="Government Agency">Government Agency</MenuItem>,
              <MenuItem key="Family/Friend" value="Family/Friend">Family/Friend</MenuItem>,
              <MenuItem key="Self-Referred" value="Self-Referred">Self-Referred</MenuItem>,
              <MenuItem key="Other" value="Other">Other</MenuItem>,
            ]}
          </CustomSelect>
        );
      } break;
      case "date":
        // Use a separate component to avoid React Hook warning
        return (
          <DateFieldComponent
            fieldPath={fieldPath}
            value={value}
            handleChange={handleChange}
            dateInputProps={dateInputProps}
            error={error}
          />
        );
        break;
      case "number":
        return (
          <CustomTextField
            type="number"
            name={fieldPath}
            value={value as number}
            onChange={handleChange}
            fullWidth
            slotProps={{
              input: {
                inputProps: {
                  ...(["adults", "children", "seniors"].includes(fieldPath) && { min: 0 }),
                },
              },
            }}
          />
        );
      case "email":
        minLength = 5;
        return (
          <CustomTextField
            type="email"
            name={fieldPath}
            value={value as string}
            onChange={handleChange}
            fullWidth
            inputProps={{ minLength }}
          />
        ); case "text":
        if (["email"].includes(fieldPath)) minLength = 5;
        if (["address2"].includes(fieldPath)) minLength = 5; return (
          <Box sx={{
            width: "100%",
            position: "relative"
          }}>
            <CustomTextField
              type="text"
              name={fieldPath}
              value={String(value || "")}
              onChange={handleChange}
              fullWidth
              disabled={isDisabledField}
              inputRef={fieldPath === "address" ? addressInputRef : null}
              inputProps={{ minLength }}
              error={!!error}
              sx={{
                width: "100%",
                "& .MuiOutlinedInput-root": {
                  height: fieldStyles.height, // Control inner element height
                },
                "& .MuiInputBase-input": {
                  height: fieldStyles.height, // Control input element height
                }
              }}
            />            {error && fieldPath !== "phone" && fieldPath !== "alternativePhone" && (
              <Typography variant="caption" color="error" sx={{
                display: 'block',
                position: "absolute",
                top: "calc(100% + 2px)",
                left: 0,
                mt: 0
              }}>
                {error}
              </Typography>
            )}
          </Box>
        );
      case "textarea":
        if (fieldPath === "ward") {
          return <CustomTextField name={fieldPath} value={String(value || "")} disabled fullWidth />;
        } else {
          const isTallTextarea = ["lifeChallenges", "lifestyleGoals", "notes", "deliveryDetails.deliveryInstructions"].includes(fieldPath);
          return (
            <CustomTextField
              name={fieldPath}
              value={String(value || "")}
              onChange={handleChange}
              multiline
              fullWidth
              minRows={isTallTextarea ? 3 : 1}
              inputProps={{ minLength: minLengthTextarea }}
            />
          );
        }
      case "tags":
        return (
          <>
            <Box sx={{ textAlign: "left" }}>
              {tags.length > 0 ? <p>{tags.join(", ")}</p> : <p>No tags selected</p>}
            </Box>
            <Button
              variant="contained"
              onClick={() => {
                setIsModalOpen(true);
              }}
              sx={{
                marginRight: 4,
                width: 166,
                color: "#fff",
                backgroundColor: "#257E68",
              }}
            >
              Edit Tags
            </Button>
          </>
        );
      default:
        return (
          <CustomTextField
            type="text"
            name={fieldPath}
            value={fieldPath === "ward" ? ward : String(value || "")}
            onChange={handleChange}
            fullWidth
            inputRef={fieldPath === "address" ? addressInputRef : null}
          />
        );
    }
  }

  return (
    <Typography
      variant="body1"
      sx={{
        fontWeight: 600,
        textAlign: "left",
        whiteSpace: "pre-wrap !important",
        wordWrap: "break-word !important",
        overflowWrap: "anywhere !important",
        wordBreak: "break-all !important",
        maxWidth: "100% !important",
        width: "100% !important",
        display: "block !important",
        overflow: "hidden !important",
        // Additional CSS to ensure wrapping works
        hyphens: "auto",
        lineBreak: "anywhere"
      }}
    >
      {renderFieldValue(fieldPath, value)}
    </Typography>
  );
};

export default FormField;