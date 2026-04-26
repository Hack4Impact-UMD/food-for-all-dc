import {
  Autocomplete,
  DialogActions,
  TextField,
  Box,
} from "@mui/material";
import { useEffect, useState, useCallback } from "react";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Button from "../../../components/common/Button";
import DriverManagementModal from "../../../components/DriverManagementModal";
import { Driver } from "../../../types/calendar-types";
import DriverService from "../../../services/driver-service";
import { TIME_SLOTS } from "../utils/timeSlots";

interface AssignDriverPopupProps {
  assignDriverAndTime: (driver: Driver | null, time: string) => Promise<boolean>;
  setPopupMode: (mode: string) => void;
  onDriversUpdated?: () => void; // Optional callback when drivers are updated
}

export default function AssignDriverPopup({
  assignDriverAndTime,
  setPopupMode,
  onDriversUpdated,
}: AssignDriverPopupProps) {
  const MANAGE_DRIVERS_OPTION = { id: "__modal__", name: "Edit Driver List", phone: "" };
  const [driver, setDriver] = useState<Driver | null>(null);
  const [time, setTime] = useState<string>("");
  const [driverSearchQuery, setDriverSearchQuery] = useState<string>("");
  const [timeSearchQuery, setTimeSearchQuery] = useState<string>("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isDriverModalOpen, setIsDriverModalOpen] = useState<boolean>(false);
  const isDriverError = error === "Please select a driver.";
  const isTimeError = error === "Please select a time.";
  const autocompleteSx = {
    width: "100%",
    minWidth: 0,
    "& .MuiFormControl-root": {
      width: "100%",
    },
    "& .MuiInputBase-root": {
      width: "100%",
    },
    "& .MuiOutlinedInput-root": {
      width: "100%",
      paddingRight: "8px !important",
    },
  };

  const resetAndClose = () => {
    setDriver(null);
    setTime("");
    setDriverSearchQuery("");
    setTimeSearchQuery("");
    setError("");
    setPopupMode("");
  };

  const handleSave = async () => {
    if (!driver) {
      setError("Please select a driver.");
      return;
    }

    if (!time) {
      setError("Please select a time.");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const didSave = await assignDriverAndTime(driver, time);
      if (didSave) {
        resetAndClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Create a memoized fetch function that can be called from multiple places
  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const driverService = DriverService.getInstance();
      const driversData = await driverService.getAllDrivers();
      setDrivers(driversData);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      setError("Failed to load drivers. Please try again.");
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on component mount
  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Handle drivers change from DriverManagementModal
  const handleDriversChange = useCallback(
    (updatedDrivers: Driver[]) => {
      setDrivers(updatedDrivers);
      // Call the callback to notify parent component
      if (onDriversUpdated) {
        onDriversUpdated();
      }
    },
    [onDriversUpdated]
  );

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 1 }}>
        <Autocomplete
          options={[MANAGE_DRIVERS_OPTION, ...drivers]}
          value={driver}
          inputValue={driverSearchQuery}
          onInputChange={(_, newInputValue) => {
            setDriverSearchQuery(newInputValue);
          }}
          onChange={(_, newValue) => {
            if (!newValue) {
              setDriver(null);
            } else if (newValue.id === MANAGE_DRIVERS_OPTION.id) {
              setIsDriverModalOpen(true);
              return;
            } else {
              setDriver(newValue as Driver);
            }
            if (error) setError("");
          }}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          filterOptions={(options, state) => {
            const filteredDrivers = drivers.filter((candidateDriver) =>
              candidateDriver.name.toLowerCase().includes(state.inputValue.toLowerCase())
            );
            return [MANAGE_DRIVERS_OPTION, ...filteredDrivers];
          }}
          renderOption={(props, option) =>
            option.id === MANAGE_DRIVERS_OPTION.id ? (
              <li {...props} key="manage-drivers-option">
                <span style={{ color: "var(--color-primary)", fontWeight: 700 }}>
                  {MANAGE_DRIVERS_OPTION.name}
                </span>
              </li>
            ) : (
              <li {...props} key={option.id}>
                {option.name}
                {option.phone ? ` (${option.phone})` : ""}
              </li>
            )
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Driver"
              variant="outlined"
              fullWidth
              size="small"
              error={isDriverError}
              helperText={
                (isDriverError ? error : "") ||
                (loading
                  ? "Loading drivers..."
                  : drivers.length === 0
                    ? "No drivers available"
                    : "")
              }
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <ArrowDropDownIcon
                    sx={{ color: "var(--color-text-medium-alt)", pointerEvents: "none" }}
                  />
                ),
              }}
            />
          )}
          disabled={loading}
          noOptionsText="No matching drivers found"
          forcePopupIcon={false}
          sx={autocompleteSx}
        />

        <Autocomplete
          options={TIME_SLOTS}
          value={TIME_SLOTS.find((slot) => slot.value === time) ?? null}
          inputValue={timeSearchQuery}
          onInputChange={(_, newInputValue) => {
            setTimeSearchQuery(newInputValue);
          }}
          onChange={(_, newValue) => {
            setTime(newValue?.value ?? "");
            if (newValue) {
              setTimeSearchQuery(newValue.label);
            }
            if (error) setError("");
          }}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.value === value.value}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Time"
              variant="outlined"
              fullWidth
              size="small"
              error={isTimeError && !time}
              helperText={
                isTimeError && !time
                  ? error
                  : "Choose the route start time for selected deliveries."
              }
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <ArrowDropDownIcon
                    sx={{ color: "var(--color-text-medium-alt)", pointerEvents: "none" }}
                  />
                ),
              }}
            />
          )}
          noOptionsText="No matching times found"
          forcePopupIcon={false}
          sx={autocompleteSx}
        />

        <DriverManagementModal
          open={isDriverModalOpen}
          onClose={() => setIsDriverModalOpen(false)}
          drivers={drivers}
          onDriversChange={handleDriversChange}
        />
      </Box>

      <DialogActions sx={{ pt: 2, pb: 1, pr: 1 }}>
        <Button variant="secondary" onClick={resetAndClose} size="medium" disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!driver || !time || loading || isSaving}
          size="medium"
        >
          Save
        </Button>
      </DialogActions>
    </>
  );
}
