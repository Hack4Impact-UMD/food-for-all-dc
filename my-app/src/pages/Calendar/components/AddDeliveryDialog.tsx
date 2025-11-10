import React, { useEffect, useState, useCallback } from "react";
import {
  GlobalStyles,
} from "@mui/material";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import DateField from "./DateField";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Autocomplete from "@mui/material/Autocomplete";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CalendarMultiSelect from "./CalendarMultiSelect";
import type { NewDelivery } from "../../../types/calendar-types";
import type { ClientProfile } from "../../../types/client-types";
import { DayPilot } from "@daypilot/daypilot-lite-react";
import { validateDeliveryDateRange } from "../../../utils/dateValidation";
import { getLastDeliveryDateForClient } from "../../../utils/lastDeliveryDate";
import { deliveryEventEmitter } from "../../../utils/deliveryEventEmitter";
import { clientService } from "../../../services/client-service";
import { deliveryDate } from "../../../utils/deliveryDate";

interface AddDeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  onAddDelivery: (newDelivery: NewDelivery) => void;
  clients: ClientProfile[];
  clientsLoaded?: boolean;
  startDate: DayPilot.Date;
  preSelectedClient?: {
    clientId: string;
    clientName: string;
    clientProfile: ClientProfile;
  };
}

type ClientSearchResult = Pick<ClientProfile, 'uid' | 'firstName' | 'lastName' | 'address'>;

const AddDeliveryDialog: React.FC<AddDeliveryDialogProps> = (props) => {
  const { open, onClose, onAddDelivery, clients, clientsLoaded, preSelectedClient } = props;
  const [formError, setFormError] = useState<string>("");
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Always update newDelivery client info from preSelectedClient when modal opens
  useEffect(() => {
    if (open && preSelectedClient) {
      let name = preSelectedClient.clientName;
      if (!name || name.trim() === "") {
        const { firstName, lastName } = preSelectedClient.clientProfile;
        name = (firstName && lastName) ? `${firstName} ${lastName}` : "";
      }
      setNewDelivery((prev) => ({
        ...prev,
        clientId: preSelectedClient.clientId,
        clientName: name,
      }));
    }
  }, [open, preSelectedClient]);

  // Helper to set time to 12:00:00 PM
// ...existing code...

  // Helper to convert date to MM/DD/YYYY format for DateField
  const convertToMMDDYYYY = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return dateStr; // Already in MM/DD/YYYY format
    }
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateStr.split('-');
      return `${month}/${day}/${year}`;
    }
    return dateStr;
  };

  const [newDelivery, setNewDelivery] = useState<NewDelivery>(() => {
    if (preSelectedClient) {
      let name = preSelectedClient.clientName;
      if (!name || name.trim() === "") {
        const { firstName, lastName } = preSelectedClient.clientProfile;
        name = (firstName && lastName) ? `${firstName} ${lastName}` : "";
      }
      return {
        clientId: preSelectedClient.clientId,
        clientName: name,
        deliveryDate: "",
        recurrence: (preSelectedClient.clientProfile.recurrence as "None" | "Weekly" | "2x-Monthly" | "Monthly" | "Custom") || "None",
        repeatsEndDate: convertToMMDDYYYY(preSelectedClient.clientProfile.endDate || ""),
      };
    }
    return {
      clientId: "",
      clientName: "",
      deliveryDate: "",
      recurrence: "None",
      repeatsEndDate: "",
    };
  });

  const [customDates, setCustomDates] = useState<Date[]>([]);
  const [startDateError, setStartDateError] = useState<string>("");
  const [endDateError, setEndDateError] = useState<string>("");
// ...existing code...

  // Clear formError when any relevant field changes
  useEffect(() => {
    setFormError("");
  }, [newDelivery, customDates, startDateError, endDateError]);
  // Track if all required fields are filled and valid
  // Only require visible fields for the current recurrence type
  const isFormValid = (() => {
    const isValidDateFormat = (dateStr: string) => {
      if (!dateStr) return false;
      // Accept MM/DD/YYYY or YYYY-MM-DD
      return /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr) || /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    };
    // If any visible error is present, form is invalid
    if (typeof formError === 'string' && formError.trim() !== '') return false;
    if (!newDelivery.clientName) return false;
    const hasStartDateError = typeof startDateError === 'string' && startDateError.trim() !== '';
    const hasEndDateError = typeof endDateError === 'string' && endDateError.trim() !== '';
    const hasDeliveryDateError = typeof newDelivery._deliveryDateError === 'string' && newDelivery._deliveryDateError.trim() !== '';
    const hasRepeatsEndDateError = typeof newDelivery._repeatsEndDateError === 'string' && newDelivery._repeatsEndDateError.trim() !== '';
    if (newDelivery.recurrence === "None") {
      if (hasStartDateError || hasDeliveryDateError) return false;
      return isValidDateFormat(newDelivery.deliveryDate);
    }
    if (["Weekly", "2x-Monthly", "Monthly"].includes(newDelivery.recurrence)) {
      if (!newDelivery.deliveryDate || !newDelivery.repeatsEndDate) return false;
      if (hasStartDateError || hasEndDateError || hasDeliveryDateError || hasRepeatsEndDateError) return false;
      return isValidDateFormat(newDelivery.deliveryDate) && isValidDateFormat(newDelivery.repeatsEndDate);
    }
    if (newDelivery.recurrence === "Custom") {
      if (customDates.length === 0 || !newDelivery.repeatsEndDate) return false;
      if (hasEndDateError || hasRepeatsEndDateError) return false;
      return customDates.length > 0 && isValidDateFormat(newDelivery.repeatsEndDate);
    }
    return false;
  })();

  const handleClientSearch = useCallback(async (searchTerm: string) => {
    setSearchLoading(true);
    try {
      if (clientsLoaded && clients.length > 0) {
        const searchLower = searchTerm.toLowerCase().trim();
        const filtered = searchLower
          ? clients
              .filter(client => {
                const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
                return fullName.includes(searchLower);
              })
              .slice(0, 50)
              .map(client => ({
                uid: client.uid,
                firstName: client.firstName,
                lastName: client.lastName,
                address: client.address
              }))
          : clients.slice(0, 50).map(client => ({
              uid: client.uid,
              firstName: client.firstName,
              lastName: client.lastName,
              address: client.address
            }));
        setSearchResults(filtered);
      } else {
        const results = await clientService.searchClientsByName(searchTerm);
        setSearchResults(results);
      }
    } catch (error) {
      console.error("Error searching clients:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [clientsLoaded, clients]);

  useEffect(() => {
    if (open && !preSelectedClient) {
      handleClientSearch("");
    }
  }, [open, preSelectedClient, handleClientSearch]);

  // Fetch current last delivery date when client is selected or modal opens

  useEffect(() => {
    const fetchCurrentLastDeliveryDate = async () => {
      if (newDelivery.clientId && open) {
        try {
          const latestEndDate = await getLastDeliveryDateForClient(newDelivery.clientId);
          if (latestEndDate) {
            const formattedDate = convertToMMDDYYYY(latestEndDate);
            setNewDelivery((prev: NewDelivery) => ({
              ...prev,
              repeatsEndDate: prev.repeatsEndDate || formattedDate
            }));
          }
        } catch (error) {
          console.error("Error fetching current last delivery date:", error);
        }
      }
    };
    fetchCurrentLastDeliveryDate();
  }, [newDelivery.clientId, open]);

  useEffect(() => {
    if (newDelivery.recurrence !== "None" && newDelivery.recurrence !== "Custom" && 
        newDelivery.deliveryDate && newDelivery.repeatsEndDate) {
      const validation = validateDeliveryDateRange(newDelivery.deliveryDate, newDelivery.repeatsEndDate);
      setStartDateError(validation.startDateError || "");
      // Validate end date format
      const endDateFormatValid = /^\d{2}\/\d{2}\/\d{4}$/.test(newDelivery.repeatsEndDate) || /^\d{4}-\d{2}-\d{2}$/.test(newDelivery.repeatsEndDate);
      if (!endDateFormatValid) {
        setEndDateError("End date must be MM/DD/YYYY or YYYY-MM-DD");
      } else {
        setEndDateError(validation.endDateError || "");
      }
    } else {
      setStartDateError("");
      setEndDateError("");
    }
  }, [newDelivery.deliveryDate, newDelivery.repeatsEndDate, newDelivery.recurrence]);

  //update newDelivery with the correct date when the dialog is first opened

  const resetFormAndClose = () => {
    if (preSelectedClient) {
      setNewDelivery({
        clientId: preSelectedClient.clientId,
        clientName: preSelectedClient.clientName,
        deliveryDate: "",
        recurrence: (preSelectedClient.clientProfile.recurrence as "None" | "Weekly" | "2x-Monthly" | "Monthly" | "Custom") || "None",
        repeatsEndDate: convertToMMDDYYYY(preSelectedClient.clientProfile.endDate || ""),
      });
    } else {
      setNewDelivery({
        clientId: "",
        clientName: "",
        deliveryDate: "",
        recurrence: "None",
        repeatsEndDate: "",
      });
    }
    setCustomDates([]);
    setStartDateError("");
    setEndDateError("");
    setFormError("");
    onClose();
  };
  const handleSubmit = async () => {
    setFormError("");
    if (!newDelivery.clientName || newDelivery.clientName.trim() === "") {
      setFormError("Please select a client");
      return;
    }
    if (newDelivery.recurrence !== "None" && newDelivery.recurrence !== "Custom" && 
        newDelivery.deliveryDate && newDelivery.repeatsEndDate) {
      const validation = validateDeliveryDateRange(newDelivery.deliveryDate, newDelivery.repeatsEndDate);
      if (!validation.isValid) {
        setStartDateError(validation.startDateError || "");
        setEndDateError(validation.endDateError || "");
        return;
      }
    }

    try {
      const { default: DeliveryService } = await import("../../../services/delivery-service");
      const service = DeliveryService.getInstance();
      const existingEvents = await service.getEventsByClientId(newDelivery.clientId);
      const existingDates = new Set(
        existingEvents.map(event => deliveryDate.toISODateString(event.deliveryDate))
      );

      const normalizedDeliveryDate = deliveryDate.tryToISODateString(newDelivery.deliveryDate) || "";
      const normalizedCustomDates =
        newDelivery.recurrence === "Custom"
          ? customDates
              .map(date => deliveryDate.tryToISODateString(date))
              .filter((d): d is string => !!d)
          : [];

      const datesToCheck =
        newDelivery.recurrence === "Custom" ? normalizedCustomDates : normalizedDeliveryDate ? [normalizedDeliveryDate] : [];

      const conflictingDate = datesToCheck.find(date => existingDates.has(date));
      if (conflictingDate) {
        setFormError(`This client already has a delivery on ${convertToMMDDYYYY(conflictingDate)}.`);
        return;
      }

      if (!datesToCheck.length) {
        setFormError("Please select at least one delivery date.");
        return;
      }

      setFormError("");
      const deliveryToSubmit: Partial<NewDelivery> = { ...newDelivery };
      if (newDelivery.recurrence === "Custom") {
        deliveryToSubmit.customDates = normalizedCustomDates;
        deliveryToSubmit.deliveryDate = normalizedCustomDates[0] || normalizedDeliveryDate;
        deliveryToSubmit.repeatsEndDate = undefined;
      } else {
        deliveryToSubmit.deliveryDate = normalizedDeliveryDate;
      }

      deliveryEventEmitter.emit();
      onAddDelivery(deliveryToSubmit as NewDelivery);
      setCustomDates([]);
      resetFormAndClose();
    } catch (error) {
      console.error("Error validating delivery dates:", error);
      setFormError("Unable to validate deliveries. Please try again.");
    }
  };
  
  const getDisplayLabel = (option: ClientSearchResult) => {
    return `${option.firstName} ${option.lastName}`;
  };

  return (
  <Dialog open={open} onClose={resetFormAndClose} maxWidth="sm" fullWidth className="add-delivery-modal-root" sx={{ top: '-35px' }}>
      <DialogTitle>Add Delivery</DialogTitle>
      {/* Shrink only DatePicker popups from this modal */}
      <GlobalStyles styles={{
        'body.add-delivery-modal-open [class*="MuiPaper-root"][class*="MuiPickerPopper-paper"]': {
          transform: 'scale(0.8) !important',
          transformOrigin: 'right top !important',
        }
      }} />
      <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' }}>
        {formError && (
          <Typography sx={{ color: 'red', mb: 2 }}>{formError}</Typography>
        )}
        {/* Unified layout for all fields */}
        <Box display="flex" flexDirection="column" gap={2}>
          {/* Conditionally render client selection only if no pre-selected client */}
          {!preSelectedClient && (
            <Autocomplete
              fullWidth
              disableClearable
              options={searchResults}
              loading={searchLoading}
              getOptionLabel={getDisplayLabel}
              getOptionKey={(option: ClientSearchResult) => option.uid}
              filterOptions={(options: ClientSearchResult[]) => options}
              onInputChange={(event: React.ChangeEvent<unknown>, value: string) => {
                if (event && (event as unknown as { type: string }).type === 'change') {
                  handleClientSearch(value);
                }
              }}
              value={newDelivery.clientId ? searchResults.find((c: ClientSearchResult) => c.uid === newDelivery.clientId) : undefined}
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
                '.MuiAutocomplete-popupIndicator': {
                  right: "30px !important", // moves the arrow left
                  top: '50%',
                  transform: 'translateY(-50%)',
                  position: 'absolute',
                }
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
              renderOption={(props: object, option: ClientSearchResult) => {
                const { key, ...otherProps } = props as { key: string };
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
              onChange={async (event: React.SyntheticEvent, newValue: ClientSearchResult | null) => {
                if (!newValue) {
                  setNewDelivery({
                    ...newDelivery,
                    clientId: "",
                    clientName: "",
                  });
                } else {
                  const fullClient = await clientService.getClientById(newValue.uid);
                  if (!fullClient) return;

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
                    clientId: fullClient.uid,
                    clientName: `${fullClient.firstName} ${fullClient.lastName}`,
                    recurrence: (fullClient.recurrence as "None" | "Weekly" | "2x-Monthly" | "Monthly" | "Custom") || "Weekly",
                    repeatsEndDate: fullClient.endDate ? convertToMMDDYYYY(fullClient.endDate) : defaultEndDate,
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
                onChange={(e) => {
                  const val = e.target.value;
                  // Only allow valid yyyy-MM-dd date strings
                  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(val);
                  setNewDelivery({
                    ...newDelivery,
                    deliveryDate: isValidDate ? val : "",
                    _deliveryDateError: isValidDate ? undefined : "Invalid date format. Please select a valid date.",
                  });
                }}
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
              <MenuItem value="Monthly">Monthly (Every 4 Weeks)</MenuItem>
              <MenuItem value="Custom">Custom (Select Dates)</MenuItem>
            </Select>
          </FormControl>
        </Box>
        {newDelivery.recurrence === "Custom" ? (
          <>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Select Custom Dates
            </Typography>
            <CalendarMultiSelect 
              selectedDates={customDates} 
              setSelectedDates={setCustomDates} 
              endDate={
                newDelivery.repeatsEndDate
                  ? deliveryDate.toJSDate(newDelivery.repeatsEndDate)
                  : deliveryDate.toJSDate(new Date())
              } 
            />
          </>
        ) : (
          <Box sx={{ mb: 2 }} />
        )}
        {(newDelivery.recurrence !== "None" && newDelivery.recurrence !== "Custom") || 
         (preSelectedClient && preSelectedClient.clientProfile.endDate) ? (
          <>
            {/* Only show End Date if recurrence is not None or is Custom with preSelectedClient endDate */}
            {(newDelivery.recurrence !== "None") ? (
              <>
                <DateField
                  label="End Date"
                  value={newDelivery.repeatsEndDate || ""}
                  onChange={(dateStr: string) => {
                    setNewDelivery({
                      ...newDelivery,
                      repeatsEndDate: dateStr,
                    });
                  }}
                  required={String(newDelivery.recurrence) !== "None"}
                  error={newDelivery._repeatsEndDateError}
                  setError={(err: string | null) => {
                    setNewDelivery((prev: NewDelivery) => ({
                      ...prev,
                      _repeatsEndDateError: err || undefined,
                    }));
                  }}
                />
                <Typography sx={{color:"red"}}>{endDateError}</Typography>
              </>
            ) : null}
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
}

export default AddDeliveryDialog;





