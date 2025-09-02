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
}

const checkboxStyles = {
  "&:focus": { outline: "none" },
  "&.Mui-focusVisible": {
    outline: "none",
    "& .MuiSvgIcon-root": {
      color: "#257E68",
      filter:
        "drop-shadow(0 0 8px rgba(37, 126, 104, 0.4)) drop-shadow(0 0 16px rgba(37, 126, 104, 0.2))",
    },
  },
  "& input:focus + .MuiSvgIcon-root": {
    color: "#257E68",
    filter:
      "drop-shadow(0 0 8px rgba(37, 126, 104, 0.4)) drop-shadow(0 0 16px rgba(37, 126, 104, 0.2))",
  },
};

const textFieldStyles = {
  flexGrow: 1,
  marginTop: "5%",
  "& .MuiOutlinedInput-root": {
    "&.Mui-focused fieldset": {
      borderColor: "#257E68",
      border: "2px solid #257E68",
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
}) => {
  if (name === "other" && showOtherText) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
        <FormControlLabel
          control={
            <Checkbox checked={checked} onChange={onChange} name={name} sx={checkboxStyles} />
          }
          label={label}
        />
        {checked && (
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
      control={<Checkbox checked={checked} onChange={onChange} name={name} sx={checkboxStyles} />}
      label={label}
    />
  );
};

export default HealthCheckbox;
