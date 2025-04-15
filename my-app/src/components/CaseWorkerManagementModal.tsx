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
} from "@mui/material";
import { Close, Add, Edit, Check, Delete } from "@mui/icons-material";
import { doc, updateDoc, addDoc, deleteDoc, collection } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import { CaseWorker, CaseWorkerFormProps, CaseWorkerManagementModalProps, ValidationErrors } from "../types/types";

// Reusable form fields component
const CaseWorkerFormFields: React.FC<CaseWorkerFormProps> = ({
  value,
  onChange,
  errors,
  onClearError,
}) => {
  const fields: Array<{
    name: keyof Omit<CaseWorker, "id">;
    label: string;
    gridSize?: number;
  }> = [
    { name: "name", label: "Name", gridSize: 4 },
    { name: "organization", label: "Organization", gridSize: 4 },
    { name: "phone", label: "Phone", gridSize: 4 },
    { name: "email", label: "Email", gridSize: 12 },
  ];

  return (
    <Grid container spacing={3}>
      {fields.map((field) => (
        <Grid item xs={12} sm={field.gridSize || 4} key={field.name}>
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
                backgroundColor: "#fff",
              },
            }}
          />
        </Grid>
      ))}
    </Grid>
  );
};

// Main modal component
const CaseWorkerManagementModal: React.FC<CaseWorkerManagementModalProps> = ({
  open,
  onClose,
  caseWorkers,
  onCaseWorkersChange,
}) => {
  const [isAddingCaseWorker, setIsAddingCaseWorker] = useState(false);
  const [editingCaseWorker, setEditingCaseWorker] = useState<CaseWorker | null>(null);
  const [newCaseWorker, setNewCaseWorker] = useState<Omit<CaseWorker, "id">>({
    name: "",
    organization: "",
    phone: "",
    email: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [caseWorkerToDelete, setCaseWorkerToDelete] = useState<CaseWorker | null>(null);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
    return phoneRegex.test(phone.replace(/\s/g, ""));
  };

  const validateCaseWorkerFields = (fields: {
    name: string;
    organization: string;
    phone: string;
    email: string;
  }): ValidationErrors => {
    const newErrors: ValidationErrors = {};

    if (!fields.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!fields.organization.trim()) {
      newErrors.organization = "Organization is required";
    }

    if (!fields.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!validatePhone(fields.phone)) {
      newErrors.phone = "Invalid phone number format";
    }

    if (!fields.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(fields.email)) {
      newErrors.email = "Invalid email format";
    }

    return newErrors;
  };

  const handleCaseWorkerFormChange = (
    setter: React.Dispatch<React.SetStateAction<any>>,
    errorSetter: React.Dispatch<React.SetStateAction<ValidationErrors>>,
    currentValue: Omit<CaseWorker, "id"> | CaseWorker,
    field: keyof Omit<CaseWorker, "id">,
    value: string
  ) => {
    setter((prev: any) => ({ ...prev, [field]: value }));
    errorSetter((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleCaseWorkerSubmit = async (
    caseWorker: Omit<CaseWorker, "id"> | CaseWorker,
    isEditing: boolean
  ) => {
    const validationErrors = validateCaseWorkerFields(caseWorker);
    const errorSetter = isEditing ? setEditErrors : setErrors;
    errorSetter(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      try {
        if (isEditing && "id" in caseWorker) {
          // Update existing case worker
          const caseWorkerRef = doc(db, "CaseWorkers", caseWorker.id);
          await updateDoc(caseWorkerRef, {
            name: caseWorker.name,
            organization: caseWorker.organization,
            phone: caseWorker.phone,
            email: caseWorker.email,
          });
          onCaseWorkersChange(caseWorkers.map((cw) => (cw.id === caseWorker.id ? caseWorker : cw)));
          setEditingCaseWorker(null);
        } else {
          // Add new case worker
          const caseWorkersCollectionRef = collection(db, "CaseWorkers");
          const docRef = await addDoc(caseWorkersCollectionRef, caseWorker);
          onCaseWorkersChange([...caseWorkers, { ...caseWorker, id: docRef.id }]);
          setIsAddingCaseWorker(false);
          setNewCaseWorker({ name: "", organization: "", phone: "", email: "" });
        }
        errorSetter({});
      } catch (error) {
        console.error(`Error ${isEditing ? "updating" : "adding"} case worker:`, error);
      }
    }
  };

  const handleDeleteCaseWorker = async (caseWorkerId: string) => {
    try {
      await deleteDoc(doc(db, "CaseWorkers", caseWorkerId));
      onCaseWorkersChange(caseWorkers.filter((cw) => cw.id !== caseWorkerId));
    } catch (error) {
      console.error("Error deleting case worker:", error);
    }
  };

  const handleDeleteClick = (caseWorker: CaseWorker) => {
    setCaseWorkerToDelete(caseWorker);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (caseWorkerToDelete) {
      await handleDeleteCaseWorker(caseWorkerToDelete.id);
      setDeleteDialogOpen(false);
      setCaseWorkerToDelete(null);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={() => {
          onClose();
          setIsAddingCaseWorker(false);
          setEditingCaseWorker(null);
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
          <Typography variant="h5" sx={{ fontWeight: 600, color: "#1a1a1a" }}>
            Edit Case Worker List
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
          {isAddingCaseWorker ? (
            <Box
              sx={{
                mb: 3,
                mt: 2,
                backgroundColor: "rgba(37, 126, 104, 0.04)",
                p: 3,
                borderRadius: "8px",
                border: "1px solid rgba(37, 126, 104, 0.2)",
              }}
            >
              <Typography variant="h6" sx={{ mb: 3, color: "#257E68", fontWeight: 500 }}>
                Add New Case Worker
              </Typography>
              <CaseWorkerFormFields
                value={newCaseWorker}
                onChange={(field, value) =>
                  handleCaseWorkerFormChange(
                    setNewCaseWorker,
                    setErrors,
                    newCaseWorker,
                    field,
                    value
                  )
                }
                errors={errors}
                onClearError={(field) => setErrors((prev) => ({ ...prev, [field]: undefined }))}
              />
              <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", mt: 3 }}>
                <Button
                  onClick={() => {
                    setIsAddingCaseWorker(false);
                    setNewCaseWorker({ name: "", organization: "", phone: "", email: "" });
                    setErrors({});
                  }}
                  sx={{
                    color: "#257E68",
                    "&:hover": {
                      backgroundColor: "rgba(37, 126, 104, 0.08)",
                    },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => handleCaseWorkerSubmit(newCaseWorker, false)}
                  disabled={
                    !newCaseWorker.name ||
                    !newCaseWorker.organization ||
                    !newCaseWorker.phone ||
                    !newCaseWorker.email
                  }
                  sx={{
                    backgroundColor: "#257E68",
                    "&:hover": { backgroundColor: "#1b5a4a" },
                    "&:disabled": { backgroundColor: "rgba(0, 0, 0, 0.12)" },
                    px: 3,
                  }}
                >
                  Add Case Worker
                </Button>
              </Box>
            </Box>
          ) : (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setIsAddingCaseWorker(true)}
              sx={{
                mb: 3,
                mt: 3,
                backgroundColor: "#257E68",
                "&:hover": { backgroundColor: "#1b5a4a" },
                px: 3,
                py: 1,
              }}
            >
              Add New Case Worker
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
                  <TableCell sx={{ fontWeight: 600, color: "#1a1a1a" }}>Case Worker</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#1a1a1a" }}>Organization</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#1a1a1a" }}>Phone Number</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#1a1a1a" }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#1a1a1a", width: "120px" }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {caseWorkers.map((cw) => (
                  <TableRow
                    key={cw.id}
                    sx={{
                      "&:hover": {
                        backgroundColor: "rgba(0, 0, 0, 0.01)",
                      },
                    }}
                  >
                    <TableCell>
                      {editingCaseWorker?.id === cw.id ? (
                        <TextField
                          value={editingCaseWorker.name}
                          onChange={(e) =>
                            handleCaseWorkerFormChange(
                              setEditingCaseWorker,
                              setEditErrors,
                              editingCaseWorker,
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
                              backgroundColor: "#fff",
                            },
                          }}
                        />
                      ) : (
                        <Typography sx={{ color: "#333", fontWeight: 500 }}>{cw.name}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingCaseWorker?.id === cw.id ? (
                        <TextField
                          value={editingCaseWorker.organization}
                          onChange={(e) =>
                            handleCaseWorkerFormChange(
                              setEditingCaseWorker,
                              setEditErrors,
                              editingCaseWorker,
                              "organization",
                              e.target.value
                            )
                          }
                          size="small"
                          fullWidth
                          error={!!editErrors.organization}
                          helperText={editErrors.organization}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              backgroundColor: "#fff",
                            },
                          }}
                        />
                      ) : (
                        <Typography sx={{ color: "#666" }}>{cw.organization}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingCaseWorker?.id === cw.id ? (
                        <TextField
                          value={editingCaseWorker.phone}
                          onChange={(e) =>
                            handleCaseWorkerFormChange(
                              setEditingCaseWorker,
                              setEditErrors,
                              editingCaseWorker,
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
                              backgroundColor: "#fff",
                            },
                          }}
                        />
                      ) : (
                        <Typography sx={{ color: "#666" }}>{cw.phone}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingCaseWorker?.id === cw.id ? (
                        <TextField
                          value={editingCaseWorker.email}
                          onChange={(e) =>
                            handleCaseWorkerFormChange(
                              setEditingCaseWorker,
                              setEditErrors,
                              editingCaseWorker,
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
                              backgroundColor: "#fff",
                            },
                          }}
                        />
                      ) : (
                        <Typography sx={{ color: "#666" }}>{cw.email}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        {editingCaseWorker?.id === cw.id ? (
                          <>
                            <IconButton
                              onClick={() =>
                                editingCaseWorker && handleCaseWorkerSubmit(editingCaseWorker, true)
                              }
                              sx={{
                                color: "#257E68",
                                "&:hover": {
                                  backgroundColor: "rgba(37, 126, 104, 0.08)",
                                },
                              }}
                              size="small"
                            >
                              <Check />
                            </IconButton>
                            <IconButton
                              onClick={() => setEditingCaseWorker(null)}
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
                              onClick={() => setEditingCaseWorker(cw)}
                              sx={{
                                color: "#257E68",
                                "&:hover": {
                                  backgroundColor: "rgba(37, 126, 104, 0.08)",
                                },
                              }}
                              size="small"
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              onClick={() => handleDeleteClick(cw)}
                              sx={{
                                color: "error.main",
                                "&:hover": {
                                  backgroundColor: "rgba(211, 47, 47, 0.08)",
                                },
                              }}
                              size="small"
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
          Delete Case Worker
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete {caseWorkerToDelete?.name}? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: "#666" }}>
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

export default CaseWorkerManagementModal;
