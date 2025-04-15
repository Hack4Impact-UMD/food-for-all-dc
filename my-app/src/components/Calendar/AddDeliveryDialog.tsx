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
import { Client, Driver, NewDelivery } from "./types";

interface AddDeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  onAddDelivery: (newDelivery: NewDelivery) => void;
  clients: Client[];
  drivers: Driver[];
}

const AddDeliveryDialog: React.FC<AddDeliveryDialogProps> = ({
  open,
  onClose,
  onAddDelivery,
  clients,
  drivers,
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
    onClose();
  };

  const handleSubmit = () => {
    onAddDelivery(newDelivery);
    resetFormAndClose();
  };

  return (
    <Dialog open={open} onClose={resetFormAndClose}>
      <DialogTitle>Add Delivery</DialogTitle>
      <DialogContent>
        {/* Client Selection */}
        <Autocomplete
          options={clients}
          getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
          value={
            newDelivery.clientId
              ? clients.find((client) => client.uid === newDelivery.clientId) || null
              : null
          }
          onChange={(event, newValue) => {
            if (newValue) {
              // Autofill logic based on the selected client
              const clientProfile = clients.find((client) => client.uid === newValue.uid);
              if (clientProfile) {
                setNewDelivery({
                  ...newDelivery,
                  clientId: clientProfile.uid,
                  clientName: `${clientProfile.firstName} ${clientProfile.lastName}`,
                  deliveryDate:
                    clientProfile.startDate || new Date().toISOString().split("T")[0],
                  recurrence: ["None", "Weekly", "2x-Monthly", "Monthly"].includes(
                    clientProfile.recurrence
                  )
                    ? (clientProfile.recurrence as "None" | "Weekly" | "2x-Monthly" | "Monthly")
                    : "None",
                  repeatsEndDate: clientProfile.endDate || "",
                });
              }
            } else {
              // Reset fields if no client is selected
              setNewDelivery({
                ...newDelivery,
                clientId: "",
                clientName: "",
                deliveryDate: new Date().toISOString().split("T")[0],
                recurrence: "None",
                repeatsEndDate: "",
              });
            }
          }}
          renderOption={(props, option) => (
            <li {...props} key={option.uid}>
              {`${option.firstName} ${option.lastName}`}
            </li>
          )}
          renderInput={(params) => (
            <TextField {...params} label="Client Name" margin="normal" fullWidth />
          )}
        />

        {/* Driver Selection */}
        <Autocomplete
          options={drivers}
          getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
          value={
            newDelivery.assignedDriverId
              ? drivers.find((driver) => driver.id === newDelivery.assignedDriverId) || null
              : null
          }
          onChange={(event, newValue) => {
            if (newValue) {
              setNewDelivery({
                ...newDelivery,
                assignedDriverId: newValue.id,
                assignedDriverName: `${newValue.firstName} ${newValue.lastName}`,
              });
            } else {
              setNewDelivery({
                ...newDelivery,
                assignedDriverId: "",
                assignedDriverName: "",
              });
            }
          }}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              {`${option.firstName} ${option.lastName}`}
            </li>
          )}
          renderInput={(params) => (
            <TextField {...params} label="Driver" margin="normal" fullWidth />
          )}
        />

        {/* Delivery Date */}
        <TextField
          label="Delivery Date"
          type="date"
          value={newDelivery.deliveryDate}
          onChange={(e) => setNewDelivery({ ...newDelivery, deliveryDate: e.target.value })}
          fullWidth
          margin="normal"
          InputLabelProps={{ shrink: true }}
        />

        {/* Recurrence Dropdown */}
        <FormControl fullWidth variant="outlined" margin="normal">
          <InputLabel id="recurrence-label">Recurrence</InputLabel>
          <Select
            label="Recurrence"
            labelId="recurrence-label"
            value={newDelivery.recurrence}
            onChange={(e) =>
              setNewDelivery({
                ...newDelivery,
                recurrence: e.target.value as "None" | "Weekly" | "2x-Monthly" | "Monthly",
              })
            }
          >
            <MenuItem value="None">None</MenuItem>
            <MenuItem value="Weekly">Weekly</MenuItem>
            <MenuItem value="2x-Monthly">2x-Monthly</MenuItem>
            <MenuItem value="Monthly">Monthly</MenuItem>
          </Select>
        </FormControl>

        {/* Ends Section */}
        {newDelivery.recurrence !== "None" && (
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
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={resetFormAndClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddDeliveryDialog;