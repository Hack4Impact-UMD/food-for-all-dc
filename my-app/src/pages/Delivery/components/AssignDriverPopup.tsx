import { Autocomplete, DialogActions, Paper, TextField, Box, Typography } from "@mui/material";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../../auth/firebaseConfig";
import Button from '../../../components/common/Button';
import DriverManagementModal from "../../../components/DriverManagementModal";
import { Driver } from "../../../types/calendar-types";

interface AssignDriverPopupProps {
  assignDriver: (driver: Driver | null) => void;
  setPopupMode: (mode: string) => void;
}

export default function AssignDriverPopup({ assignDriver, setPopupMode }: AssignDriverPopupProps) {
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
    }

    const handleSave = () => {
      if (!driver) {
        setError("Please select a driver.");
        return;
      }
      setError("");
      assignDriver(driver);
      resetAndClose();
    };

    useEffect(() => {
        const fetchDrivers = async () => {
          setLoading(true);
          setError("");
          try {
            const driversCollectionRef = collection(db, "Drivers");
            const driversSnapshot = await getDocs(driversCollectionRef);

            if (!driversSnapshot.empty) {
              const driversData = driversSnapshot.docs.map((doc) => ({
                id: doc.id,
                name: doc.data().name || "Unknown Driver",
                phone: doc.data().phone || "",
                email: doc.data().email || "",
              }));
              setDrivers(driversData);
            } else {
              setDrivers([]); 
            }
          } catch (error) {
            console.error("Error fetching drivers:", error);
            setError("Failed to load drivers. Please try again.");
          } finally {
            setLoading(false);
          }
        };
        fetchDrivers();
      }, []);

    return (
        <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1 }}>

              <Autocomplete
                options={[{ id: '__modal__', name: 'Manage Drivers' }, ...drivers]}
                getOptionLabel={(option) => option.name}
                filterOptions={(options, state) => {
                  const filtered = options.filter((option) =>
                    option.name.toLowerCase().includes(state.inputValue.toLowerCase())
                  );
                  return state.inputValue === '' ? filtered.slice(0, 7) : filtered;
                }}
                value={driver}
                onChange={(event, newValue) => {
                  if (!newValue) {
                    setDriver(null);
                  } else if (newValue.id === '__modal__') {
                    setIsDriverModalOpen(true);
                  } else {
                    setDriver(newValue);
                  }
                  if (error) setError("");
                }}
                inputValue={driverSearchQuery}
                onInputChange={(event, newInputValue) => {
                  setDriverSearchQuery(newInputValue);
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderOption={(props, option) =>
                  option.id === '__modal__' ? (
                    <li {...props} key="manage-drivers-option">
                      <span
                        style={{
                          color: '#257E68',
                          fontWeight: 'bold',
                          cursor: 'pointer',
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
                            color: 'black',
                            fontWeight: 'bold',
                            display: 'inline-block',
                            marginRight: '10px',
                          }}
                        >
                          {option.name}
                        </p>
                        <p style={{ color: 'grey', display: 'inline-block' }}>
                          {option.phone ? `(${option.phone})` : ''}
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
                      '.MuiOutlinedInput-root': {
                        height: '40px',
                      },
                      '.MuiOutlinedInput-input': {
                        display: 'flex',
                        alignItems: 'center',
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
                sx={{ minWidth: '250px' }}
              />

              <DriverManagementModal
                open={isDriverModalOpen}
                onClose={() => setIsDriverModalOpen(false)}
                drivers={drivers}
                onDriversChange={(updatedDrivers) => {
                  setDrivers(updatedDrivers);
                }}
              />
            </Box>

            <DialogActions sx={{ pt: 2, pb: 1, pr: 1 }}>
                <Button
                  variant="secondary"
                  onClick={resetAndClose}
                  size="medium"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={!driver || loading}
                  size="medium"
                >
                  Save
                </Button>
            </DialogActions>
        </>
    )
}