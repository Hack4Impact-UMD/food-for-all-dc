import React from "react";
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
import { ClientProfileKey } from '../types';
import { DietaryRestrictions } from '../../../types';
import TagManager from "../Tags/TagManager";

interface FormFieldProps {
  fieldPath: ClientProfileKey;
  value: any;
  type?: string;
  isEditing: boolean;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | SelectChangeEvent
  ) => void;
  getNestedValue: (obj: any, path: string) => any;
  handleDietaryRestrictionChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addressInputRef?: React.RefObject<HTMLInputElement>;
  isDisabledField?: boolean;
  ward?: string;
  tags: string[];
  allTags: string[];
  isModalOpen: boolean;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleTag: (tag: string) => void;
}

const fieldStyles = {
  backgroundColor: "white",
  width: "100%",
  height: "1.813rem",
  padding: "0.1rem 0.5rem",
  borderRadius: "5px",
  border: ".1rem solid black",
  marginTop: "0px",
};

const CustomTextField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none",
    },
  },
  "& .MuiInputBase-input": {
    ...fieldStyles,
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
  
  "& .MuiOutlinedInput-root": {
    "& .MuiOutlinedInput-notchedOutline": {
      border: "none",
    },
  },
  "& fieldset": {
    border: "none",
  },
  "& .MuiSelect-select": {
    ...fieldStyles,
    height: '100%',
    padding: '0 0.5rem',
    display: 'flex',
    alignItems: 'center',
  },
  "& .MuiSelect-icon": {
    display: "none",
  },
  "& .MuiSelect-select.Mui-disabled": {
    backgroundColor: "#e0e0e0",
    color: "#757575",
    WebkitTextFillColor: "#757575",
    cursor: "not-allowed",
    borderRadius: fieldStyles.borderRadius,
    border: "1.5px solid #bdbdbd",
    fontWeight: 500,
    opacity: 1,
    padding: '0 0.5rem',
  },
});

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
              <Grid key={key}>
                <FormControlLabel
                  sx={{ textAlign: "left" }}
                  control={
                    <Checkbox
                      name={key}
                      checked={value as boolean}
                      onChange={handleDietaryRestrictionChange}
                      sx={{
                        "& .MuiSvgIcon-root": {
                          borderRadius: "1rem",
                        },
                      }}
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
        dobDate = new Date(); // Fallback to current date if invalid
      }

      // Format the date and calculate the age
      const formattedDate = dobDate.toUTCString().split(" ").slice(0, 4).join(" ");
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
      case "select":
        if (fieldPath === "gender") {
          return (
            <CustomSelect
              name={fieldPath}
              value={value as string}
              onChange={(e) => handleChange(e as SelectChangeEvent<string>)}
              displayEmpty
              inputProps={selectInputProps}
            >
              <MenuItem value="" disabled>
                Select
              </MenuItem>
              <MenuItem value="Male">Male</MenuItem>
              <MenuItem value="Female">Female</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </CustomSelect>
          );
        } else if (fieldPath === "headOfHousehold") {
          return (
            <CustomSelect
              name={fieldPath}
              value={value as string}
              onChange={(e) => handleChange(e as SelectChangeEvent<string>)}
              displayEmpty
              inputProps={selectInputProps}
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
              {/* Add referralEntity options if needed */}
            </CustomSelect>
          );
        }
        break;
      case "date":
        return (
          <CustomTextField
            type="date"
            name={fieldPath}
            value={value instanceof Date ? value.toISOString().split("T")[0] : value || ""}
            onChange={handleChange}
            fullWidth
            inputProps={dateInputProps}
          />
        );
      case "number":
        return (
          <CustomTextField
            type="number"
            name={fieldPath}
            value={value as number}
            onChange={handleChange}
            fullWidth
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
        );
      case "text":
        if (["email"].includes(fieldPath)) minLength = 5;
        if (["address2"].includes(fieldPath)) minLength = 5;
        return (
          <CustomTextField
            type="text"
            name={fieldPath}
            value={String(value || "")}
            onChange={handleChange}
            fullWidth
            disabled={isDisabledField}
            inputRef={fieldPath === "address" ? addressInputRef : null}
            inputProps={{ minLength }}
          />
        );
      case "textarea":
        if (fieldPath === "ward") {
          return <CustomTextField name={fieldPath} value={String(value || "")} disabled fullWidth />;
        } else {
          // Create block scope for lexical declaration
          {
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
    <Typography variant="body1" sx={{ fontWeight: 600 }}>
      {renderFieldValue(fieldPath, value)}
    </Typography>
  );
};

export default FormField;