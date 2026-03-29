import { DialogActions, TextField, Box } from "@mui/material";
import { useState } from "react";
import Button from "../../../components/common/Button";

interface AssignTimePopupProps {
  assignTime: (time: string) => Promise<boolean>;
  setPopupMode: (mode: string) => void;
}

export default function AssignTimePopup({ assignTime, setPopupMode }: AssignTimePopupProps) {
  const [time, setTime] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSave = async () => {
    if (!time) {
      setError("Please select a time.");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const didSave = await assignTime(time);
      if (didSave) {
        resetAndClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const resetAndClose = () => {
    setTime("");
    setError("");
    setPopupMode("");
  };

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 1 }}>
        <TextField
          label="Select Time"
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            if (error) setError("");
          }}
          InputLabelProps={{
            shrink: true,
          }}
          fullWidth
          variant="outlined"
          size="small"
          error={!!error}
          helperText={error}
        />
      </Box>
      <DialogActions sx={{ pt: 2, pb: 1, pr: 1 }}>
        <Button variant="secondary" onClick={resetAndClose} size="medium" disabled={isSaving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!time || isSaving} size="medium">
          Save
        </Button>
      </DialogActions>
    </>
  );
}
