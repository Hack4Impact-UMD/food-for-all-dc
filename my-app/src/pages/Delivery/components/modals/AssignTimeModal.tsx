import React from 'react';
import { TextField } from "@mui/material";

interface AssignTimeModalProps {
  time: string;
  handleTimeChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const AssignTimeModal: React.FC<AssignTimeModalProps> = ({
  time,
  handleTimeChange
}) => {
  return (
    <TextField
      label="Select Time"
      type="time"
      value={time}
      onChange={handleTimeChange}
      InputLabelProps={{
        shrink: true,
      }}
      fullWidth
      variant="outlined"
    />
  );
};

export default AssignTimeModal;