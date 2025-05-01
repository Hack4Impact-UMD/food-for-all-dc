import React, { useState } from "react";
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
import DriverManagementModal from "../../../components/DriverManagementModal";

interface AddDeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  onAddDelivery: (newDelivery: NewDelivery) => void;
  clients: ClientProfile[];
  drivers: Driver[];
  setDrivers: React.Dispatch<React.SetStateAction<Driver[]>>;
}

const AddDeliveryDialog: React.FC<AddDeliveryDialogProps> = ({
  open,
  onClose,
  onAddDelivery,
  clients,
  drivers,
  setDrivers,
}) => {
  const [newDelivery, setNewDelivery] = useState<NewDelivery>(() => {
    const today = new Date().toISOString().split("T")[0];
    return {
      assignedDriverId: "",
      assignedDriverName: "",
      clientId: "",
      clientName: "",
      deliveryDate: today,
      recurrence: "None",
      repeatsEndDate: "",
    };
  });

  const [customDates, setCustomDates] = useState<Date[]>([]);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);

  const resetFormAndClose = () => {
    // Reset the form
    const today = new Date().toISOString().split("T")[0];
    setNewDelivery({
      assignedDriverId: "",
      assignedDriverName: "",
      clientId: "",
      clientName: "",
      deliveryDate: today,
      recurrence: "None",
      repeatsEndDate: "",
    });
    setCustomDates([]);
    onClose();
  };

  const handleSubmit = () => {
    const deliveryToSubmit: NewDelivery = { ...newDelivery };
    if (newDelivery.recurrence === "Custom") {
      deliveryToSubmit.customDates = customDates.map(date => date.toISOString().split("T")[0]);
      // Set deliveryDate to the first custom date for compatibility
      deliveryToSubmit.deliveryDate = customDates[0]?.toISOString().split("T")[0] || "";
      deliveryToSubmit.repeatsEndDate = undefined;
    }
    onAddDelivery(deliveryToSubmit);
    setCustomDates([]);
    resetFormAndClose();
  };

  // --- Validation ---
  const isFormValid =
    newDelivery.clientId !== "" &&
    newDelivery.assignedDriverId !== "" &&
    (newDelivery.recurrence !== "Custom" || customDates.length > 0);
  // --- End Validation ---

  return (
    <Dialog open={open} onClose={resetFormAndClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Delivery</DialogTitle>
      <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Driver Selection */}
        <Autocomplete
          options={[{ id: '__modal__', name: 'Manage Drivers' }, ...drivers]}
          getOptionLabel={(option) => option.name}
          filterOptions={(options, state) => {
            const specialOption = { id: '__modal__', name: 'Manage Drivers' };

            // Filter out the special option from the rest
            const filteredDrivers = drivers.filter((driver) =>
              driver.name.toLowerCase().includes(state.inputValue.toLowerCase())
            );

            // Limit total displayed items to 10, including the special option
            const limitedDrivers = filteredDrivers.slice(0, 9); // 9 + 1 = 10 total

            return [specialOption, ...limitedDrivers];
          }}
          value={
            newDelivery.assignedDriverId
              ? drivers.find((driver) => driver.id === newDelivery.assignedDriverId) || null
              : null
          }
          onChange={(event, newValue) => {
            if (!newValue) {
              setNewDelivery({
                ...newDelivery,
                assignedDriverId: '',
                assignedDriverName: '',
              });
            } else if (newValue.id === '__modal__') {
              setIsDriverModalOpen(true);
            } else {
              setNewDelivery({
                ...newDelivery,
                assignedDriverId: newValue.id,
                assignedDriverName: newValue.name,
              });
            }
          }}
          renderOption={(props, option) =>
            option.id === '__modal__' ? (
              <li {...props} key="manage-drivers-option">
                <span
                  style={{
                    color: '#257E68',
                    fontWeight: 'bold',
                    cursor: 'pointer', // Make it look like clickable text
                  }}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevents closing the dropdown when clicked
                    setIsDriverModalOpen(true); // Open the modal
                  }}
                >
                  Edit Driver List
                </span>
          </li>
            ) : (
              <li {...props} key={option.id}>
                <span>
                  <p style={{color: 'black', fontWeight: 'bold', display: 'inline-block', marginRight: '10px'}}>{option.name}</p>
                  <p style={{color: 'grey', display: 'inline-block'}}>{'phone' in option && option.phone ? `(${option.phone})` : ''}</p>
                </span>
              </li>
            )
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Driver"
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
        <DriverManagementModal
          open={isDriverModalOpen}
          onClose={() => setIsDriverModalOpen(false)}
          drivers={drivers}
          onDriversChange={(updatedDrivers) => {
            setDrivers(updatedDrivers); // or however you update your state
          }}
        />

        {/* Delivery Date */}
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

        {/* Recurrence Dropdown */}
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
                // Reset customDates if not custom
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

        {/* Custom Dates Picker */}
        {newDelivery.recurrence === "Custom" ? (
          <CalendarMultiSelect selectedDates={customDates} setSelectedDates={setCustomDates} />
        ) : null}

        {/* Ends Section */}
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