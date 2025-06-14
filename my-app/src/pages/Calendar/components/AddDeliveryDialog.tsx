import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
} from "@mui/material";
import { Driver, NewDelivery } from "../../../types/calendar-types";
import { ClientProfile } from "../../../types/client-types";
import CalendarMultiSelect from "./CalendarMultiSelect";
import { DayPilot } from "@daypilot/daypilot-lite-react";

interface AddDeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  onAddDelivery: (newDelivery: NewDelivery) => void;
  clients: ClientProfile[];
  startDate: DayPilot.Date;
}

const AddDeliveryDialog: React.FC<AddDeliveryDialogProps> = ({
  open,
  onClose,
  onAddDelivery,
  clients,
  startDate
}) => {

  const [newDelivery, setNewDelivery] = useState<NewDelivery>(() => {
    
    return {
      clientId: "",
      clientName: "",
      deliveryDate: startDate.toString().split("T")[0],
      recurrence: "None",
      repeatsEndDate: "",
    };
  });

  const [customDates, setCustomDates] = useState<Date[]>([]);

  //update newDelivery with the correct date when the dialog is opened
  useEffect(() => {
    if (open) {
      setNewDelivery(prev => ({
        ...prev,
        deliveryDate: startDate.toString().split("T")[0],
      }));
    }
  }, [startDate, open]);

  const resetFormAndClose = () => {
    setNewDelivery({
      clientId: "",
      clientName: "",
      deliveryDate: startDate.toString().split("T")[0],
      recurrence: "None",
      repeatsEndDate: "",
    });
    setCustomDates([]);
    onClose();
  };

  const handleSubmit = () => {
    const deliveryToSubmit: Partial<NewDelivery> = { ...newDelivery };
    if (newDelivery.recurrence === "Custom") {
      deliveryToSubmit.customDates = customDates.map(date => date.toISOString().split("T")[0]);
      deliveryToSubmit.deliveryDate = customDates[0]?.toISOString().split("T")[0] || "";
      deliveryToSubmit.repeatsEndDate = undefined;
    }
    onAddDelivery(deliveryToSubmit as NewDelivery);
    setCustomDates([]);
    resetFormAndClose();
  };

  const isFormValid =
    newDelivery.clientId !== "" &&
    (newDelivery.recurrence !== "Custom" || customDates.length > 0);

  return (
    <Dialog open={open} onClose={resetFormAndClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Delivery</DialogTitle>
      <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <Autocomplete
          options={clients}
          getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
          value={newDelivery.clientId ? clients.find(c => c.uid === newDelivery.clientId) || null : null}
          onChange={(event, newValue) => {
            if (!newValue) {
              setNewDelivery({
                ...newDelivery,
                clientId: "",
                clientName: "",
              });
            } else {
              setNewDelivery({
                ...newDelivery,
                clientId: newValue.uid,
                clientName: `${newValue.firstName} ${newValue.lastName}`,
              });
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Client"
              margin="normal"
              fullWidth
              required
              sx={{
                '.MuiOutlinedInput-root': {
                  height: '56px',
                },
                '.MuiOutlinedInput-input': {
                  display: 'flex',
                  alignItems: 'center',
                },
              }}
            />
          )}
        />

        {newDelivery.recurrence !== "Custom" ? (
          <TextField
            label="Delivery Date"
            type="date"
            value={newDelivery.deliveryDate}
            onChange={(e) => setNewDelivery({ ...newDelivery, deliveryDate: e.target.value })}
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }}
            required
          />
        ) : null}

        <FormControl fullWidth variant="outlined" margin="normal">
          <InputLabel id="recurrence-label">Recurrence</InputLabel>
          <Select
            label="Recurrence"
            labelId="recurrence-label"
            value={newDelivery.recurrence}
            onChange={(e) => {
              const value = e.target.value as NewDelivery['recurrence'];
              setNewDelivery({
                ...newDelivery,
                recurrence: value,
                ...(value !== "Custom" ? { customDates: undefined } : {}),
              });
              if (value !== "Custom") setCustomDates([]);
            }}
          >
            <MenuItem value="None">None</MenuItem>
            <MenuItem value="Weekly">Weekly</MenuItem>
            <MenuItem value="2x-Monthly">2x-Monthly</MenuItem>
            <MenuItem value="Monthly">Monthly</MenuItem>
            <MenuItem value="Custom">Custom (Select Dates)</MenuItem>
          </Select>
        </FormControl>

        {newDelivery.recurrence === "Custom" ? (
          <CalendarMultiSelect selectedDates={customDates} setSelectedDates={setCustomDates} />
        ) : null}

        {newDelivery.recurrence !== "None" && newDelivery.recurrence !== "Custom" ? (
          <Box>
            <Typography variant="subtitle1">End Date</Typography>
            <TextField
              label="End Date"
              type="date"
              value={newDelivery.repeatsEndDate}
              onChange={(e) =>
                setNewDelivery({
                  ...newDelivery,
                  repeatsEndDate: e.target.value,
                })
              }
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={resetFormAndClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isFormValid}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddDeliveryDialog;