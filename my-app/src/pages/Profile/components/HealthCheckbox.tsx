import React from "react";
import { FormControlLabel, Checkbox, TextField, Box } from "@mui/material";

interface HealthCheckboxProps {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name: string;
  label: string;
  showOtherText?: boolean;
  otherTextValue?: string;
  placeholder?: string;
  isEditing?: boolean;
}

const checkboxStyles = {
  "&:focus": { outline: "none" },
  "&.Mui-focusVisible": {
    outline: "none",
    "& .MuiSvgIcon-root": {
      color: "var(--color-primary)",
      filter:
        "drop-shadow(0 0 8px rgba(37, 126, 104, 0.4)) drop-shadow(0 0 16px rgba(37, 126, 104, 0.2))",
    },
  },
  "& input:focus + .MuiSvgIcon-root": {
    color: "var(--color-primary)",
    filter:
      "drop-shadow(0 0 8px rgba(37, 126, 104, 0.4)) drop-shadow(0 0 16px rgba(37, 126, 104, 0.2))",
  },
};

const textFieldStyles = {
  flexGrow: 1,
  marginTop: "5%",
  "& .MuiOutlinedInput-root": {
    "&.Mui-focused fieldset": {
      borderColor: "var(--color-primary)",
      border: "2px solid var(--color-primary)",
      boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
    },
  },
};

const HealthCheckbox: React.FC<HealthCheckboxProps> = ({
  checked,
  onChange,
  name,
  label,
  showOtherText = false,
  otherTextValue = "",
  placeholder = "Please specify",
  isEditing = true,
}) => {
  // Only change color in read-only mode, keep default style
  const checkboxProps = !isEditing
    ? {
        sx: {
          "&.MuiCheckbox-root .MuiSvgIcon-root": { color: "#B6E5D8 !important" },
          "&.Mui-checked .MuiSvgIcon-root": { color: "#B6E5D8 !important" },
          "& .MuiSvgIcon-root": { color: "#B6E5D8 !important" },
        },
        disabled: true,
      }
    : {
        sx: checkboxStyles,
        disabled: false,
      };
  if (name === "other" && showOtherText) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
        <FormControlLabel
          control={
            <Checkbox checked={checked} onChange={onChange} name={name} {...checkboxProps} />
          }
          label={<span style={{ color: "var(--color-black)" }}>{label}</span>}
        />
        {checked && isEditing && (
          <TextField
            name="otherText"
            value={otherTextValue}
            onChange={onChange}
            placeholder={placeholder}
            variant="outlined"
            size="small"
            sx={textFieldStyles}
          />
        )}
      </Box>
    );
  }

  return (
    <FormControlLabel
      control={<Checkbox checked={checked} onChange={onChange} name={name} {...checkboxProps} />}
      label={<span style={{ color: "var(--color-black)" }}>{label}</span>}
    />
  );
};

export default HealthCheckbox;
