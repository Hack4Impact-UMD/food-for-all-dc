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
import { validateDateInput } from "../../../utils/dates";
import { NewDelivery } from "../../../types/calendar-types";
import { ClientProfile } from "../../../types/client-types";
import CalendarMultiSelect from "./CalendarMultiSelect";
import DateField from "./DateField";
import { DayPilot } from "@daypilot/daypilot-lite-react";
import { validateDeliveryDateRange } from "../../../utils/dateValidation";

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
      deliveryDate: startDate.toString("yyyy-MM-dd"),
      recurrence: "None",
      repeatsEndDate: "",
    };
  });

  const [customDates, setCustomDates] = useState<Date[]>([]);
  const [startDateError, setStartDateError] = useState<string>("");
  const [endDateError, setEndDateError] = useState<string>("");

  // Validate date range whenever delivery date or end date changes
  useEffect(() => {
    if (newDelivery.recurrence !== "None" && newDelivery.recurrence !== "Custom" && 
        newDelivery.deliveryDate && newDelivery.repeatsEndDate) {
      const validation = validateDeliveryDateRange(newDelivery.deliveryDate, newDelivery.repeatsEndDate);
      setStartDateError(validation.startDateError || "");
      setEndDateError(validation.endDateError || "");
    } else {
      setStartDateError("");
      setEndDateError("");
    }
  }, [newDelivery.deliveryDate, newDelivery.repeatsEndDate, newDelivery.recurrence]);

  //update newDelivery with the correct date when the dialog is first opened
  useEffect(() => {
    if (open) {
      setNewDelivery(prev => ({
        ...prev,
        deliveryDate: startDate.toString("yyyy-MM-dd"),
      }));
    }
  }, [open]); // Removed startDate dependency to prevent overwriting user input

  const resetFormAndClose = () => {
    setNewDelivery({
      clientId: "",
      clientName: "",
      deliveryDate: startDate.toString("yyyy-MM-dd"),
      recurrence: "None",
      repeatsEndDate: "",
    });
    setCustomDates([]);
    setStartDateError("");
    setEndDateError("");
    onClose();
  };
  const handleSubmit = () => {
    // Validate dates before submission
    if (newDelivery.recurrence !== "None" && newDelivery.recurrence !== "Custom" && 
        newDelivery.deliveryDate && newDelivery.repeatsEndDate) {
      const validation = validateDeliveryDateRange(newDelivery.deliveryDate, newDelivery.repeatsEndDate);
      if (!validation.isValid) {
        setStartDateError(validation.startDateError || "");
        setEndDateError(validation.endDateError || "");
        return;
      }
    }

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
    (newDelivery.recurrence !== "Custom" || customDates.length > 0) &&
    !startDateError && !endDateError;

  // Filter out duplicate clients based on UID - memoized for performance
  const uniqueClients = React.useMemo(() => {
    const filtered = clients.filter((client, index, self) => 
      index === self.findIndex(c => c.uid === client.uid)
    );
    
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
              // Helper function to convert YYYY-MM-DD to MM/DD/YYYY
              const convertToMMDDYYYY = (dateStr: string): string => {
                if (!dateStr) return '';
                
                // If it's already in MM/DD/YYYY format, return as is
                if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                  return dateStr;
                }
                
                // If it's in YYYY-MM-DD format, convert it
                if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  const [year, month, day] = dateStr.split('-');
                  return `${month}/${day}/${year}`;
                }
                
                return dateStr;
              };

              // Calculate default end date (one month from today) in MM/DD/YYYY format
              const defaultEndDate = (() => {
                const oneMonthFromNow = new Date();
                oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
                const month = (oneMonthFromNow.getMonth() + 1).toString().padStart(2, '0');
                const day = oneMonthFromNow.getDate().toString().padStart(2, '0');
                const year = oneMonthFromNow.getFullYear().toString();
                return `${month}/${day}/${year}`;
              })();

              setNewDelivery({
                ...newDelivery,
                clientId: newValue.uid,
                clientName: `${newValue.firstName} ${newValue.lastName}`,
                recurrence: (newValue.recurrence as "None" | "Weekly" | "2x-Monthly" | "Monthly" | "Custom") || "Weekly",
                repeatsEndDate: newValue.endDate ? convertToMMDDYYYY(newValue.endDate) : defaultEndDate,
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
        />        {newDelivery.recurrence !== "Custom" ? (
          <DateField
            label="Delivery Date"
            value={newDelivery.deliveryDate || ""}
            onChange={(dateStr) => setNewDelivery({ 
              ...newDelivery, 
              deliveryDate: dateStr,
              _deliveryDateError: undefined 
            })}
            required={true}
            error={newDelivery._deliveryDateError}
            setError={(errorMsg) => setNewDelivery(prev => ({
              ...prev,
              _deliveryDateError: errorMsg || undefined
            }))}
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

        {newDelivery.recurrence !== "None" && newDelivery.recurrence !== "Custom" ? (          <Box>
            <Typography variant="subtitle1">End Date</Typography>
            <DateField
              label="End Date"
              value={newDelivery.repeatsEndDate || ""}
              onChange={(dateStr) => setNewDelivery({
                ...newDelivery,
                repeatsEndDate: dateStr,
                _repeatsEndDateError: undefined,
              })}
              required={true}
              error={newDelivery._repeatsEndDateError}
              setError={(errorMsg) => setNewDelivery(prev => ({
                ...prev,
                _repeatsEndDateError: errorMsg || undefined
              }))}
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