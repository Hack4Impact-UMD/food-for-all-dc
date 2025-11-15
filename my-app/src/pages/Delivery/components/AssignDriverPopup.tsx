import { Autocomplete, DialogActions, Paper, TextField, Box, Typography } from "@mui/material";
import { useEffect, useState, useCallback } from "react";
import Button from "../../../components/common/Button";
import DriverManagementModal from "../../../components/DriverManagementModal";
import { Driver } from "../../../types/calendar-types";
import DriverService from "../../../services/driver-service";

interface AssignDriverPopupProps {
  assignDriver: (driver: Driver | null) => void;
  setPopupMode: (mode: string) => void;
  onDriversUpdated?: () => void; // Optional callback when drivers are updated
}

export default function AssignDriverPopup({
  assignDriver,
  setPopupMode,
  onDriversUpdated,
}: AssignDriverPopupProps) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverSearchQuery, setDriverSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [isDriverModalOpen, setIsDriverModalOpen] = useState<boolean>(false);

  const resetAndClose = () => {
    setDriver(null);
    setDriverSearchQuery("");
    setError("");
    setPopupMode("");
  };

  const handleSave = () => {
    if (!driver) {
      setError("Please select a driver.");
      return;
    }
    setError("");
    assignDriver(driver);
    resetAndClose();
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
          options={[{ id: "__modal__", name: "Manage Drivers" }, ...drivers]}
          getOptionLabel={(option) => option.name}
          filterOptions={(options, state) => {
            const specialOption = { id: "__modal__", name: "Manage Drivers" };

            // Filter out the special option from the rest
            const filteredDrivers = drivers.filter((driver) =>
              driver.name.toLowerCase().includes(state.inputValue.toLowerCase())
            );

            return [specialOption, ...filteredDrivers];
          }}
          value={driver}
          onChange={(event, newValue) => {
            if (!newValue) {
              setDriver(null);
            } else if (newValue.id === "__modal__") {
              setIsDriverModalOpen(true);
            } else {
              setDriver(newValue as Driver);
            }
            if (error) setError("");
          }}
          inputValue={driverSearchQuery}
          onInputChange={(event, newInputValue) => {
            setDriverSearchQuery(newInputValue);
          }}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderOption={(props, option) =>
            option.id === "__modal__" ? (
              <li {...props} key="manage-drivers-option">
                <span
                  style={{
                    color: "var(--color-primary)",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDriverModalOpen(true);
                  }}
                >
                  Edit Driver List
                </span>
              </li>
            ) : (
              <li {...props} key={option.id}>
                <span>
                  <p
                    style={{
                      color: "var(--color-black)",
                      fontWeight: "bold",
                      display: "inline-block",
                      marginRight: "10px",
                    }}
                  >
                    {option.name}
                  </p>
                  <p style={{ color: "grey", display: "inline-block" }}>
                    {"phone" in option && option.phone ? `(${option.phone})` : ""}
                  </p>
                </span>
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
              error={!!error}
              helperText={
                error ||
                (loading
                  ? "Loading drivers..."
                  : drivers.length === 0
                    ? "No drivers available"
                    : "")
              }
              sx={{
                ".MuiOutlinedInput-root": {
                  height: "var(--spacing-xl40)",
                },
                ".MuiOutlinedInput-input": {
                  display: "flex",
                  alignItems: "center",
                },
              }}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <Typography variant="caption">Loading...</Typography> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          loading={loading}
          noOptionsText="No matching drivers found"
          disabled={loading}
          PaperComponent={({ children }) => <Paper elevation={3}>{children}</Paper>}
          forcePopupIcon={false}
          sx={{
            minWidth: "250px",
            "& .MuiAutocomplete-clearIndicator": {
              display: "none",
            },
          }}
        />

        <DriverManagementModal
          open={isDriverModalOpen}
          onClose={() => setIsDriverModalOpen(false)}
          drivers={drivers}
          onDriversChange={handleDriversChange}
        />
      </Box>

      <DialogActions sx={{ pt: 2, pb: 1, pr: 1 }}>
        <Button variant="secondary" onClick={resetAndClose} size="medium">
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!driver || loading} size="medium">
          Save
        </Button>
      </DialogActions>
    </>
  );
}
