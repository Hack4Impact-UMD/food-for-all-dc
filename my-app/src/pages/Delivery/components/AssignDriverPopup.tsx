import { Autocomplete, DialogActions, Paper, TextField, Box, Typography } from "@mui/material";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../../auth/firebaseConfig";
import Button from '../../../components/common/Button';

interface Driver {
    id: string;
    name: string;
    phone: string;
    email: string;
}

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
                  options={drivers}
                  getOptionLabel={(option) => option.name}
                  value={driver}
                  onChange={(event, newValue) => {
                      setDriver(newValue);
                      if (error) setError("");
                  }}
                  inputValue={driverSearchQuery}
                  onInputChange={(event, newInputValue) => {
                      setDriverSearchQuery(newInputValue);
                  }}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Select Driver"
                        variant="outlined"
                        fullWidth
                        size="small"
                        error={!!error}
                        helperText={error || (loading ? "Loading drivers..." : drivers.length === 0 ? "No drivers available" : "")}
                        sx={{
                          '.MuiOutlinedInput-root': {
                            height: '40px',
                          },
                          '.MuiOutlinedInput-input': {
                            display: 'flex',
                            alignItems: 'center',
                          }
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