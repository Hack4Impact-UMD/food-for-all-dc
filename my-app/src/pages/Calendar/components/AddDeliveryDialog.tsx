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
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
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
  // New optional props for pre-selected client
  preSelectedClient?: {
    clientId: string;
    clientName: string;
    clientProfile: ClientProfile;
  };
}

const AddDeliveryDialog: React.FC<AddDeliveryDialogProps> = ({
  open,
  onClose,
  onAddDelivery,
  clients,
  startDate,
  preSelectedClient
}) => {

  const [newDelivery, setNewDelivery] = useState<NewDelivery>(() => {
    // If we have a pre-selected client, initialize with their data
    if (preSelectedClient) {
      return {
        clientId: preSelectedClient.clientId,
        clientName: preSelectedClient.clientName,
        deliveryDate: startDate.toString("yyyy-MM-dd"),
        recurrence: (preSelectedClient.clientProfile.recurrence as "None" | "Weekly" | "2x-Monthly" | "Monthly" | "Custom") || "None",
        repeatsEndDate: preSelectedClient.clientProfile.endDate || 
          new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0],
      };
    }
    
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
    if (preSelectedClient) {
      // Reset to pre-selected client data
      setNewDelivery({
        clientId: preSelectedClient.clientId,
        clientName: preSelectedClient.clientName,
        deliveryDate: startDate.toString("yyyy-MM-dd"),
        recurrence: (preSelectedClient.clientProfile.recurrence as "None" | "Weekly" | "2x-Monthly" | "Monthly" | "Custom") || "None",
        repeatsEndDate: preSelectedClient.clientProfile.endDate || 
          new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0],
      });
    } else {
      // Reset to empty form
      setNewDelivery({
        clientId: "",
        clientName: "",
        deliveryDate: startDate.toString("yyyy-MM-dd"),
        recurrence: "None",
        repeatsEndDate: "",
      });
    }
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
        console.log(validation.endDateError)
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
  
  // Update validation logic - if we have a pre-selected client, clientId is always valid
  const isFormValid = 
    (preSelectedClient ? true : newDelivery.clientId !== "") &&
    (newDelivery.recurrence !== "Custom" || customDates.length > 0);

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
  };

  // Custom filter function to ensure we never see duplicates
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
      <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Unified layout for all fields */}
        <Box display="flex" flexDirection="column" gap={2}>
          {/* Conditionally render client selection only if no pre-selected client */}
          {!preSelectedClient && (
            <Autocomplete
              fullWidth
              disableClearable
              options={uniqueClients}
              getOptionLabel={getDisplayLabel}
              getOptionKey={(option) => option.uid}
              filterOptions={filterOptions}
              value={newDelivery.clientId ? uniqueClients.find(c => c.uid === newDelivery.clientId) : undefined}
              sx={{
                width: 'calc(100% + 48px)',
                '.MuiInputBase-root': { 
                  width: '100%',
                  minWidth: '100%',
                },
                '.MuiOutlinedInput-root': {
                  width: '100%',
                  minWidth: '100%',
                  height: '56px',
                  minHeight: '56px',
                  boxSizing: 'border-box',
                },
                '.MuiOutlinedInput-input': {
                  width: '100%',
                  height: '56px',
                  minHeight: '56px',
                  display: 'flex',
                  alignItems: 'center',
                  boxSizing: 'border-box',
                },
                '.MuiAutocomplete-root': {
                  width: '100%',
                  minWidth: '100%',
                },
              }}
              componentsProps={{
                popupIndicator: {
                  style: {
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }
                }
              }}
              disablePortal={false}
              renderOption={(props, option) => {
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
                    </Typography>
                    <Typography 
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
                    if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                      return dateStr;
                    }
                    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      const [year, month, day] = dateStr.split('-');
                      return `${month}/${day}/${year}`;
                    }
                    return dateStr;
                  };
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
              popupIcon={
                <ArrowDropDownIcon sx={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: 'action.active',
                  fontSize: 24,
                }} />
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Client"
                  margin="normal"
                  fullWidth
                  variant="outlined"
                  size="medium"
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    width: '100%',
                    '.MuiInputBase-root': { width: '100%' },
                    '.MuiOutlinedInput-root': {
                      width: '100%',
                      height: '56px',
                      minHeight: '56px',
                      boxSizing: 'border-box',
                    },
                    '.MuiOutlinedInput-input': {
                      height: '56px',
                      minHeight: '56px',
                      display: 'flex',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                    },
                  }}
                />
              )}
            />
          )}

          {/* Show selected client info if pre-selected */}
          {preSelectedClient && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Adding delivery for:
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {preSelectedClient.clientName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {preSelectedClient.clientProfile.address || 'No address'}
              </Typography>
            </Box>
          )}

          {newDelivery.recurrence !== "Custom" ? (
            <>
              <TextField
                label="Delivery Date"
                type="date"
                value={newDelivery.deliveryDate || ""}
                onChange={(e) => setNewDelivery({ 
                  ...newDelivery, 
                  deliveryDate: e.target.value,
                  _deliveryDateError: undefined 
                })}
                margin="normal"
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                error={Boolean(newDelivery._deliveryDateError)}
                helperText={newDelivery._deliveryDateError}
                inputProps={{ 'data-testid': 'date-input' }}
                sx={{
                  '.MuiOutlinedInput-root': {
                    '& input[type="date"]::-webkit-calendar-picker-indicator': {
                      position: 'absolute',
                      right: '14px',
                      cursor: 'pointer',
                    },
                  },
                  '.MuiOutlinedInput-input': {
                    display: 'flex',
                    alignItems: 'center',
                    paddingRight: '40px',
                  },
                }}
              />
              <Typography sx={{color:"red"}}>{startDateError}</Typography>
            </>
          ) : null}

          <FormControl fullWidth variant="outlined" margin="normal" sx={{ width: '100%' }}>
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
              inputProps={{ 'data-testid': 'recurrence-select-input' }}
            >
              <MenuItem value="None">None</MenuItem>
              <MenuItem value="Weekly">Weekly</MenuItem>
              <MenuItem value="2x-Monthly">2x-Monthly</MenuItem>
              <MenuItem value="Monthly">Monthly</MenuItem>
              <MenuItem value="Custom">Custom (Select Dates)</MenuItem>
            </Select>
          </FormControl>
        </Box>
        {newDelivery.recurrence === "Custom" ? (
          <CalendarMultiSelect selectedDates={customDates} setSelectedDates={setCustomDates} />
        ) : null}

        {newDelivery.recurrence !== "None" && newDelivery.recurrence !== "Custom" ? (     
          <>
            <Box>
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
            <Typography sx={{color:"red"}}>{endDateError}</Typography>
          </>    
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