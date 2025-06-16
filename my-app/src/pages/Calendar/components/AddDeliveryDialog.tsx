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
import { NewDelivery } from "../../../types/calendar-types";
import { ClientProfile } from "../../../types/client-types";
import CalendarMultiSelect from "./CalendarMultiSelect";

interface AddDeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  onAddDelivery: (newDelivery: NewDelivery) => void;
  clients: ClientProfile[];
}

const AddDeliveryDialog: React.FC<AddDeliveryDialogProps> = ({
  open,
  onClose,
  onAddDelivery,
  clients,
}) => {
  const [newDelivery, setNewDelivery] = useState<NewDelivery>(() => {
    const today = new Date().toISOString().split("T")[0];
    return {
      clientId: "",
      clientName: "",
      deliveryDate: today,
      recurrence: "None",
      repeatsEndDate: "",
    };
  });

  const [customDates, setCustomDates] = useState<Date[]>([]);

  const resetFormAndClose = () => {
    const today = new Date().toISOString().split("T")[0];
    setNewDelivery({
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
    const deliveryToSubmit: Partial<NewDelivery> = { ...newDelivery };
    if (newDelivery.recurrence === "Custom") {
      deliveryToSubmit.customDates = customDates.map(date => date.toISOString().split("T")[0]);
      deliveryToSubmit.deliveryDate = customDates[0]?.toISOString().split("T")[0] || "";
      deliveryToSubmit.repeatsEndDate = undefined;
    }    onAddDelivery(deliveryToSubmit as NewDelivery);
    setCustomDates([]);
    resetFormAndClose();
  };

  const isFormValid =
    newDelivery.clientId !== "" &&
    (newDelivery.recurrence !== "Custom" || customDates.length > 0);  // Filter out duplicate clients based on UID - memoized for performance
  const uniqueClients = React.useMemo(() => {
    const filtered = clients.filter((client, index, self) => 
      index === self.findIndex(c => c.uid === client.uid)
    );
    
    // Console log all clients with their details
    console.log('All clients:', clients.map(client => ({
      firstName: client.firstName,
      lastName: client.lastName,
      uid: client.uid,
      email: client.email
    })));
    
    return filtered;
  }, [clients]);

  // Simple display label showing only the name
  const getDisplayLabel = (option: ClientProfile) => {
    return `${option.firstName} ${option.lastName}`;
  };  // Custom filter function to ensure we never see duplicates
  const filterOptions = React.useCallback((options: ClientProfile[], { inputValue }: { inputValue: string }) => {
    // Start with our unique clients, not the passed options
    const uniqueOptions = uniqueClients.filter((client, index, self) => 
      index === self.findIndex(c => c.uid === client.uid)
    );
    
    // Apply text filtering
    const textFiltered = uniqueOptions.filter((option) =>
      getDisplayLabel(option).toLowerCase().includes(inputValue.toLowerCase())
    );
    
    return textFiltered;
  }, [uniqueClients]);
  return (
    <Dialog open={open} onClose={resetFormAndClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Delivery</DialogTitle>
      <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto' }}>        <Autocomplete
          options={uniqueClients}
          getOptionLabel={getDisplayLabel}
          getOptionKey={(option) => option.uid}
          filterOptions={filterOptions}
          value={newDelivery.clientId ? uniqueClients.find(c => c.uid === newDelivery.clientId) || null : null}          renderOption={(props, option) => {
            const { key, ...otherProps } = props;
            return (
              <Box 
                component="li" 
                key={key} 
                {...otherProps} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '8px 16px',
                  width: '100%'
                }}
              >
                <Typography variant="body1" sx={{ flexShrink: 0 }}>
                  {getDisplayLabel(option)}
                </Typography>                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    fontStyle: 'italic',
                    marginLeft: 'auto',
                    paddingLeft: '16px',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {option.address || 'No address'}
                </Typography>
              </Box>
            );
          }}
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
                recurrence: (newValue.recurrence as "None" | "Weekly" | "2x-Monthly" | "Monthly" | "Custom") || "Weekly",
                repeatsEndDate: newValue.endDate ||
                  // Calculate a default end date (e.g. one month from today) if not provided
                  new Date(new Date().setMonth(new Date().getMonth() + 1))
                    .toISOString().split("T")[0],
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