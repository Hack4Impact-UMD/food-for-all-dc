import React, { useState } from "react";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Grid,
  IconButton,
  Typography,
  DialogContentText,
  TableSortLabel,
  Icon,
} from "@mui/material";
import { Close, Add, Edit, Check, Delete } from "@mui/icons-material";
import { doc, updateDoc, addDoc, deleteDoc, collection } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import { Driver } from "../types/calendar-types";
import dataSources from '../config/dataSources';

// Icon components for sorting
const iconStyle = { verticalAlign: 'middle', marginLeft: 6 };
const ChevronUp = () => (
  <Icon fontSize="small" style={iconStyle}>keyboard_arrow_up</Icon>
);
const ChevronDown = () => (
  <Icon fontSize="small" style={iconStyle}>keyboard_arrow_down</Icon>
);
const ChevronUpDown = () => (
  <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1, marginLeft: 6 }}>
    <Icon fontSize="small" style={{ marginBottom: -4 }}>keyboard_arrow_up</Icon>
    <Icon fontSize="small" style={{ marginTop: -4 }}>keyboard_arrow_down</Icon>
  </span>
);

// Types
interface ValidationErrors {
  name?: string;
  phone?: string;
  email?: string;
}

interface DriverFormProps {
  value: Omit<Driver, "id">;
  onChange: (field: keyof Omit<Driver, "id">, value: string) => void;
  errors: ValidationErrors;
  onClearError: (field: keyof ValidationErrors) => void;
}

interface DriverManagementModalProps {
  open: boolean;
  onClose: () => void;
  drivers: Driver[];
  onDriversChange: (drivers: Driver[]) => void;
}

// Reusable form fields component
const DriverFormFields: React.FC<DriverFormProps> = ({ value, onChange, errors, onClearError }) => {
  const fields: Array<{
    name: keyof Omit<Driver, "id">;
    label: string;
    gridSize?: number;
  }> = [
    { name: "name", label: "Name", gridSize: 4 },
    { name: "phone", label: "Phone", gridSize: 4 },
    { name: "email", label: "Email", gridSize: 4 },
  ];

  return (
    <Grid container spacing={3}>
      {fields.map((field) => (
        <Grid size={{ xs: 12, sm: field.gridSize || 4}} key={field.name}>
          <TextField
            fullWidth
            label={field.label}
            value={value[field.name]}
            onChange={(e) => {
              onChange(field.name, e.target.value);
              onClearError(field.name);
            }}
            variant="outlined"
            error={!!errors[field.name]}
            helperText={errors[field.name]}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "var(--color-background-main)",
              },
              "& .MuiInputLabel-outlined:not(.MuiInputLabel-shrink)": {
                transform: "translate(14px, 5px) scale(1)",
              },
            }}
          />
        </Grid>
      ))}
    </Grid>
  );
};

// Main modal component
const DriverManagementModal: React.FC<DriverManagementModalProps> = ({
  open,
  onClose,
  drivers,
  onDriversChange,
}) => {
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: keyof Driver; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // Sorting handler
  const handleSort = (key: keyof Driver) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Sorted drivers
  const sortedDrivers = React.useMemo(() => {
    const sorted = [...drivers].sort((a, b) => {
      const aValue = (a[sortConfig.key] || '').toString().toLowerCase();
      const bValue = (b[sortConfig.key] || '').toString().toLowerCase();
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [drivers, sortConfig]);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [newDriver, setNewDriver] = useState<Omit<Driver, "id">>({
    name: "",
    phone: "",
    email: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
    return phoneRegex.test(phone.replace(/\s/g, ""));
  };

  const validateDriverFields = (fields: {
    name: string;
    phone?: string;
    email?: string;
  }): ValidationErrors => {
    const newErrors: ValidationErrors = {};

    const name = fields.name ?? "";
    const phone = fields.phone ?? "";
    const email = fields.email ?? "";

    if (!fields.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!validatePhone(phone)) {
      newErrors.phone = "Invalid phone number format";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(email)) {
      newErrors.email = "Invalid email format";
    }

    return newErrors;
  };

  const handleDriverFormChange = (
    setter: React.Dispatch<React.SetStateAction<any>>,
    errorSetter: React.Dispatch<React.SetStateAction<ValidationErrors>>,
    currentValue: Omit<Driver, "id"> | Driver,
    field: keyof Omit<Driver, "id">,
    value: string
  ) => {
    setter((prev: any) => ({ ...prev, [field]: value }));
    errorSetter((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleDriverSubmit = async (driver: Omit<Driver, "id"> | Driver, isEditing: boolean) => {
    const validationErrors = validateDriverFields(driver);
    const errorSetter = isEditing ? setEditErrors : setErrors;
    errorSetter(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      try {
        if (isEditing && "id" in driver) {
          // Update existing driver
          const driverRef = doc(db, dataSources.firebase.driversCollection, driver.id);
          await updateDoc(driverRef, {
            name: driver.name,
            phone: driver.phone,
            email: driver.email,
          });
          onDriversChange(drivers.map((d) => (d.id === driver.id ? driver : d)));
          setEditingDriver(null);
        } else {
          // Add new driver
          const driversCollectionRef = collection(db, dataSources.firebase.driversCollection);
          const docRef = await addDoc(driversCollectionRef, driver);
          //add new driver to the top but under DoorDash
          onDriversChange([
            drivers[0],                           
            { ...driver, id: docRef.id },        
            ...drivers.slice(1)                  
          ]);
          setIsAddingDriver(false);
          setNewDriver({ name: "", phone: "", email: "" });
        }
        errorSetter({});
      } catch (error) {
        console.error(`Error ${isEditing ? "updating" : "adding"} driver:`, error);
      }
    }
  };

  const handleDeleteDriver = async (driverId: string) => {
    try {
  await deleteDoc(doc(db, dataSources.firebase.driversCollection, driverId));
      onDriversChange(drivers.filter((d) => d.id !== driverId));
    } catch (error) {
      console.error("Error deleting driver:", error);
    }
  };

  const handleDeleteClick = (driver: Driver) => {
    setDriverToDelete(driver);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (driverToDelete) {
      await handleDeleteDriver(driverToDelete.id);
      setDeleteDialogOpen(false);
      setDriverToDelete(null);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={() => {
          onClose();
          setIsAddingDriver(false);
          setEditingDriver(null);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "12px",
            maxWidth: "800px",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
            p: 3,
            pb: 2,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 600, color: "var(--color-text-heading)" }}>
            Edit Driver List
          </Typography>
          <IconButton
            onClick={onClose}
            sx={{
              color: "rgba(0, 0, 0, 0.54)",
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.04)",
              },
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {isAddingDriver ? (
            <Box
              sx={{
                mb: 3,
                mt: 2,
                backgroundColor: "rgba(37, 126, 104, 0.04)",
                p: '20px',
                borderRadius: "8px",
                border: "1px solid rgba(37, 126, 104, 0.2)",
              }}
            >
              <Typography variant="h6" sx={{ mb: 3, color: "var(--color-primary)", fontWeight: 500 }}>
                Add New Driver
              </Typography>
              <DriverFormFields
                value={newDriver}
                onChange={(field, value) =>
                  handleDriverFormChange(setNewDriver, setErrors, newDriver, field, value)
                }
                errors={errors}
                onClearError={(field) => setErrors((prev) => ({ ...prev, [field]: undefined }))}
              />
              <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", mt: 3 }}>
                <Button
                  onClick={() => {
                    setIsAddingDriver(false);
                    setNewDriver({ name: "", phone: "", email: "" });
                    setErrors({});
                  }}
                  sx={{
                    color: "var(--color-primary)",
                    "&:hover": {
                      backgroundColor: "rgba(37, 126, 104, 0.08)",
                    },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => handleDriverSubmit(newDriver, false)}
                  disabled={!newDriver.name || !newDriver.phone || !newDriver.email}
                  sx={{
                    backgroundColor: "var(--color-primary)",
                    "&:hover": { backgroundColor: "var(--color-primary-hover-alt)" },
                    "&:disabled": { backgroundColor: "rgba(0, 0, 0, 0.12)" },
                    px: 3,
                  }}
                >
                  Add Driver
                </Button>
              </Box>
            </Box>
          ) : (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setIsAddingDriver(true)}
              sx={{
                mb: 3,
                mt: 3,
                backgroundColor: "var(--color-primary)",
                "&:hover": { backgroundColor: "var(--color-primary-hover-alt)" },
                px: 3,
                py: 1,
              }}
            >
              Add New Driver
            </Button>
          )}

          <TableContainer
            component={Paper}
            sx={{
              boxShadow: "none",
              border: "1px solid rgba(0, 0, 0, 0.12)",
              borderRadius: "8px",
              "& .MuiTableCell-root": {
                py: 2,
              },
            }}
          >
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "rgba(0, 0, 0, 0.02)" }}>
                  <TableCell sx={{ fontWeight: 600, color: "var(--color-text-heading)", cursor: 'pointer' }} onClick={() => handleSort('name')}>
                    <TableSortLabel
                      active={sortConfig.key === 'name'}
                      direction={sortConfig.direction}
                      hideSortIcon={true}
                      IconComponent={() => null}
                    >
                      Driver
                      {sortConfig.key === 'name'
                        ? (sortConfig.direction === 'asc' ? <ChevronUp />
                          : <ChevronDown />)
                        : <ChevronUpDown />}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "var(--color-text-heading)", cursor: 'pointer' }} onClick={() => handleSort('phone')}>
                    <TableSortLabel
                      active={sortConfig.key === 'phone'}
                      direction={sortConfig.direction}
                      hideSortIcon={true}
                      IconComponent={() => null}
                    >
                      Phone Number
                      {sortConfig.key === 'phone'
                        ? (sortConfig.direction === 'asc' ? <ChevronUp />
                          : <ChevronDown />)
                        : <ChevronUpDown />}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "var(--color-text-heading)", cursor: 'pointer' }} onClick={() => handleSort('email')}>
                    <TableSortLabel
                      active={sortConfig.key === 'email'}
                      direction={sortConfig.direction}
                      hideSortIcon={true}
                      IconComponent={() => null}
                    >
                      Email
                      {sortConfig.key === 'email'
                        ? (sortConfig.direction === 'asc' ? <ChevronUp />
                          : <ChevronDown />)
                        : <ChevronUpDown />}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "var(--color-text-heading)", width: "120px" }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedDrivers.map((d) => (
                  <TableRow
                    key={d.id}
                    sx={{
                      "&:hover": {
                        backgroundColor: "rgba(0, 0, 0, 0.01)",
                      },
                    }}
                  >
                    <TableCell>
                      {editingDriver?.id === d.id && editingDriver ? (
                        <TextField
                          value={editingDriver.name || ""}
                          onChange={(e) =>
                            handleDriverFormChange(
                              setEditingDriver,
                              setEditErrors,
                              editingDriver ?? { id: d.id, name: d.name, phone: d.phone, email: d.email },
                              "name",
                              e.target.value
                            )
                          }
                          size="small"
                          fullWidth
                          error={!!editErrors.name}
                          helperText={editErrors.name}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              backgroundColor: "var(--color-background-main)",
                            },
                          }}
                        />
                      ) : (
                        <Typography sx={{ color: "var(--color-text-dark)", fontWeight: 500 }}>{d.name}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingDriver?.id === d.id && editingDriver ? (
                        <TextField
                          value={editingDriver.phone || ""}
                          onChange={(e) =>
                            handleDriverFormChange(
                              setEditingDriver,
                              setEditErrors,
                              editingDriver ?? { id: d.id, name: d.name, phone: d.phone, email: d.email },
                              "phone",
                              e.target.value
                            )
                          }
                          size="small"
                          fullWidth
                          error={!!editErrors.phone}
                          helperText={editErrors.phone}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              backgroundColor: "var(--color-background-main)",
                            },
                          }}
                        />
                      ) : (
                        <Typography sx={{ color: "var(--color-text-medium-alt)" }}>{d.phone}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingDriver?.id === d.id && editingDriver ? (
                        <TextField
                          value={editingDriver.email || ""}
                          onChange={(e) =>
                            handleDriverFormChange(
                              setEditingDriver,
                              setEditErrors,
                              editingDriver ?? { id: d.id, name: d.name, phone: d.phone, email: d.email },
                              "email",
                              e.target.value
                            )
                          }
                          size="small"
                          fullWidth
                          error={!!editErrors.email}
                          helperText={editErrors.email}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              backgroundColor: "var(--color-background-main)",
                            },
                          }}
                        />
                      ) : (
                        <Typography sx={{ color: "var(--color-text-medium-alt)" }}>{d.email}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        {editingDriver?.id === d.id ? (
                          <>
                            <IconButton
                              onClick={() =>
                                editingDriver && handleDriverSubmit(editingDriver, true)
                              }
                              sx={{
                                color: "var(--color-primary)",
                                "&:hover": {
                                  backgroundColor: "rgba(37, 126, 104, 0.08)",
                                },
                              }}
                              size="small"
                            >
                              <Check />
                            </IconButton>
                            <IconButton
                              onClick={() => setEditingDriver(null)}
                              sx={{
                                color: "error.main",
                                "&:hover": {
                                  backgroundColor: "rgba(211, 47, 47, 0.08)",
                                },
                              }}
                              size="small"
                            >
                              <Close />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <IconButton
                              onClick={() => setEditingDriver(d)}
                              sx={{
                                color: "var(--color-primary)",
                                "&:hover": {
                                  backgroundColor: "rgba(37, 126, 104, 0.08)",
                                },
                              }}
                              size="small"
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              onClick={() => handleDeleteClick(d)}
                              sx={{
                                color: "error.main",
                                "&:hover": {
                                  backgroundColor: "rgba(211, 47, 47, 0.08)",
                                },
                              }}
                              size="small"
                              disabled={d.name === "DoorDash"}
                            >
                              <Delete />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        PaperProps={{
          sx: {
            borderRadius: "8px",
            maxWidth: "450px",
          },
        }}
      >
        <DialogTitle id="delete-dialog-title" sx={{ pb: 1 }}>
          Delete Driver
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete {driverToDelete?.name}? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: "var(--color-text-medium-alt)" }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DriverManagementModal;
