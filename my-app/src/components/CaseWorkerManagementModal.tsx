import React, { useState, useMemo, useCallback, forwardRef } from "react";
import {
  Box,
  Button,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Table,
  TableBody,
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
} from "@mui/material";
import { Close, Add, Edit, Check, Delete } from "@mui/icons-material";
import { doc, updateDoc, addDoc, deleteDoc, collection } from "firebase/firestore";
import { TableComponents, TableVirtuoso } from "react-virtuoso";
import { db } from "../auth/firebaseConfig";
import {
  CaseWorker,
  CaseWorkerFormProps,
  CaseWorkerManagementModalProps,
  ValidationErrors,
} from "../types";
// Import shared utility functions directly from their specific files
import { isValidEmail, isValidPhone, validateCaseWorkerFields } from "../utils/validation";
import { formatPhoneNumber } from "../utils/format";
import dataSources from "../config/dataSources";

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
        <Grid size={{ xs: 12, sm: field.gridSize || 4 }} key={field.name}>
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
                transform: "translate(14px, 16px) scale(1)",
              },
            }}
          />
        </Grid>
      ))}
    </Grid>
  );
};

type SortField = "name" | "organization" | "phone" | "email";
type SortDirection = "asc" | "desc";

const SORT_LABEL_STYLES = {
  "& .MuiTableSortLabel-icon": {
    color: "var(--color-primary) !important",
  },
  "&:hover": {
    color: "var(--color-primary)",
  },
  "&.Mui-active": {
    color: "var(--color-primary)",
  },
};

const COLUMN_SX = {
  name: { width: "22%", minWidth: 160 },
  organization: { width: "22%", minWidth: 160 },
  phone: { width: "18%", minWidth: 140 },
  email: { width: "28%", minWidth: 200, overflowWrap: "anywhere", wordBreak: "break-word" },
  actions: { width: 120, minWidth: 120, textAlign: "right" as const },
};

const WRAP_TEXT_SX = {
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const VirtuosoTableScroller = forwardRef<HTMLDivElement>((props, ref) => (
  <TableContainer
    component={Paper}
    {...props}
    ref={ref}
    sx={{
      boxShadow: "none",
      border: "1px solid rgba(0, 0, 0, 0.12)",
      borderRadius: "8px",
      minHeight: 520,
      maxHeight: "60vh",
      "& .MuiTableCell-root": {
        py: 2,
      },
    }}
  />
));

VirtuosoTableScroller.displayName = "VirtuosoTableScroller";

const VirtuosoTableHead = forwardRef<HTMLTableSectionElement>((props, ref) => (
  <TableHead {...props} ref={ref} />
));

VirtuosoTableHead.displayName = "VirtuosoTableHead";

const VirtuosoTableBody = forwardRef<HTMLTableSectionElement>((props, ref) => (
  <TableBody {...props} ref={ref} />
));

VirtuosoTableBody.displayName = "VirtuosoTableBody";

const VirtuosoTableComponents: TableComponents<CaseWorker> = {
  Scroller: VirtuosoTableScroller,
  Table: (props) => <Table {...props} sx={{ tableLayout: "fixed" }} />,
  TableHead: VirtuosoTableHead,
  TableRow: (props) => (
    <TableRow
      {...props}
      sx={{
        "&:hover": {
          backgroundColor: "rgba(0, 0, 0, 0.01)",
        },
      }}
    />
  ),
  TableBody: VirtuosoTableBody,
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

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Handle sort changes
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort case workers based on current sort field and direction
  const sortedCaseWorkers = useMemo(() => {
    const sorted = [...caseWorkers].sort((a, b) => {
      let aValue = (a[sortField] || "").toLowerCase();
      let bValue = (b[sortField] || "").toLowerCase();

      if (sortField === "phone") {
        aValue = (a[sortField] || "").replace(/\D/g, "");
        bValue = (b[sortField] || "").replace(/\D/g, "");
      }

      if (aValue < bValue) {
        return sortDirection === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [caseWorkers, sortField, sortDirection]);

  const handleNewCaseWorkerChange = useCallback(
    (field: keyof Omit<CaseWorker, "id">, value: string) => {
      setNewCaseWorker((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    []
  );

  const handleEditCaseWorkerChange = useCallback(
    (field: keyof Omit<CaseWorker, "id">, value: string) => {
      setEditingCaseWorker((prev) => (prev ? { ...prev, [field]: value } : prev));
      setEditErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    []
  );

  const handleCaseWorkerSubmit = useCallback(
    async (caseWorker: Omit<CaseWorker, "id"> | CaseWorker, isEditing: boolean) => {
      const validationErrors = validateCaseWorkerFields(caseWorker);
      const errorSetter = isEditing ? setEditErrors : setErrors;
      errorSetter(validationErrors);

      if (Object.keys(validationErrors).length === 0) {
        try {
          if (isEditing && "id" in caseWorker) {
            const caseWorkerRef = doc(db, dataSources.firebase.caseWorkersCollection, caseWorker.id);
            await updateDoc(caseWorkerRef, {
              name: caseWorker.name,
              organization: caseWorker.organization,
              phone: caseWorker.phone,
              email: caseWorker.email,
            });
            onCaseWorkersChange(
              caseWorkers.map((cw) => (cw.id === caseWorker.id ? caseWorker : cw))
            );
            setEditingCaseWorker(null);
          } else {
            const caseWorkersCollectionRef = collection(
              db,
              dataSources.firebase.caseWorkersCollection
            );
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
    },
    [caseWorkers, onCaseWorkersChange]
  );

  const handleDeleteCaseWorker = async (caseWorkerId: string) => {
    try {
      await deleteDoc(doc(db, dataSources.firebase.caseWorkersCollection, caseWorkerId));
      onCaseWorkersChange(caseWorkers.filter((cw) => cw.id !== caseWorkerId));
    } catch (error) {
      console.error("Error deleting case worker:", error);
    }
  };

  const handleDeleteClick = useCallback((caseWorker: CaseWorker) => {
    setCaseWorkerToDelete(caseWorker);
    setDeleteDialogOpen(true);
  }, []);

  const handleStartEdit = useCallback((caseWorker: CaseWorker) => {
    setEditingCaseWorker(caseWorker);
    setEditErrors({});
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingCaseWorker(null);
    setEditErrors({});
  }, []);

  const handleDeleteConfirm = async () => {
    if (caseWorkerToDelete) {
      await handleDeleteCaseWorker(caseWorkerToDelete.id);
      setDeleteDialogOpen(false);
      setCaseWorkerToDelete(null);
    }
  };

  const renderRow = useCallback(
    (_: number, cw: CaseWorker) => (
      <>
        <TableCell sx={COLUMN_SX.name}>
          {editingCaseWorker?.id === cw.id ? (
            <TextField
              value={editingCaseWorker.name}
              onChange={(e) => handleEditCaseWorkerChange("name", e.target.value)}
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
            <Typography sx={{ color: "var(--color-text-dark)", fontWeight: 500 }}>
              {cw.name}
            </Typography>
          )}
        </TableCell>
        <TableCell sx={COLUMN_SX.organization}>
          {editingCaseWorker?.id === cw.id ? (
            <TextField
              value={editingCaseWorker.organization}
              onChange={(e) => handleEditCaseWorkerChange("organization", e.target.value)}
              size="small"
              fullWidth
              error={!!editErrors.organization}
              helperText={editErrors.organization}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "var(--color-background-main)",
                },
              }}
            />
          ) : (
            <Typography sx={{ color: "var(--color-text-medium-alt)", ...WRAP_TEXT_SX }}>
              {cw.organization}
            </Typography>
          )}
        </TableCell>
        <TableCell sx={COLUMN_SX.phone}>
          {editingCaseWorker?.id === cw.id ? (
            <TextField
              value={editingCaseWorker.phone}
              onChange={(e) => handleEditCaseWorkerChange("phone", e.target.value)}
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
            <Typography sx={{ color: "var(--color-text-medium-alt)" }}>
              {formatPhoneNumber(cw.phone)}
            </Typography>
          )}
        </TableCell>
        <TableCell sx={COLUMN_SX.email}>
          {editingCaseWorker?.id === cw.id ? (
            <TextField
              value={editingCaseWorker.email}
              onChange={(e) => handleEditCaseWorkerChange("email", e.target.value)}
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
            <Typography sx={{ color: "var(--color-text-medium-alt)", ...WRAP_TEXT_SX }}>
              {cw.email}
            </Typography>
          )}
        </TableCell>
        <TableCell sx={COLUMN_SX.actions}>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            {editingCaseWorker?.id === cw.id ? (
              <>
                <IconButton
                  onClick={() =>
                    editingCaseWorker && handleCaseWorkerSubmit(editingCaseWorker, true)
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
                  onClick={handleCancelEdit}
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
                  onClick={() => handleStartEdit(cw)}
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
      </>
    ),
    [
      editErrors,
      editingCaseWorker,
      handleCaseWorkerSubmit,
      handleCancelEdit,
      handleDeleteClick,
      handleEditCaseWorkerChange,
      handleStartEdit,
    ]
  );

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
          <Typography variant="h5" sx={{ fontWeight: 600, color: "var(--color-text-heading)" }}>
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
              <Typography
                variant="h6"
                sx={{ mb: 3, color: "var(--color-primary)", fontWeight: 500 }}
              >
                Add New Case Worker
              </Typography>
              <CaseWorkerFormFields
                value={newCaseWorker}
                onChange={handleNewCaseWorkerChange}
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
                  onClick={() => handleCaseWorkerSubmit(newCaseWorker, false)}
                  disabled={
                    !newCaseWorker.name ||
                    !newCaseWorker.organization ||
                    !newCaseWorker.phone ||
                    !newCaseWorker.email
                  }
                  sx={{
                    backgroundColor: "var(--color-primary)",
                    "&:hover": { backgroundColor: "var(--color-primary-hover-alt)" },
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
                backgroundColor: "var(--color-primary)",
                "&:hover": { backgroundColor: "var(--color-primary-hover-alt)" },
                px: 3,
                py: 1,
              }}
            >
              Add New Case Worker
            </Button>
          )}

          <TableVirtuoso
            data={sortedCaseWorkers}
            components={VirtuosoTableComponents}
            fixedHeaderContent={() => (
              <TableRow sx={{ backgroundColor: "rgba(0, 0, 0, 0.02)" }}>
                <TableCell
                  sx={{ ...COLUMN_SX.name, fontWeight: 600, color: "var(--color-text-heading)" }}
                >
                  <TableSortLabel
                    active={sortField === "name"}
                    direction={sortField === "name" ? sortDirection : "asc"}
                    onClick={() => handleSort("name")}
                    sx={SORT_LABEL_STYLES}
                  >
                    Case Worker
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sx={{
                    ...COLUMN_SX.organization,
                    fontWeight: 600,
                    color: "var(--color-text-heading)",
                  }}
                >
                  <TableSortLabel
                    active={sortField === "organization"}
                    direction={sortField === "organization" ? sortDirection : "asc"}
                    onClick={() => handleSort("organization")}
                    sx={SORT_LABEL_STYLES}
                  >
                    Organization
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sx={{ ...COLUMN_SX.phone, fontWeight: 600, color: "var(--color-text-heading)" }}
                >
                  <TableSortLabel
                    active={sortField === "phone"}
                    direction={sortField === "phone" ? sortDirection : "asc"}
                    onClick={() => handleSort("phone")}
                    sx={SORT_LABEL_STYLES}
                  >
                    Phone Number
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sx={{ ...COLUMN_SX.email, fontWeight: 600, color: "var(--color-text-heading)" }}
                >
                  <TableSortLabel
                    active={sortField === "email"}
                    direction={sortField === "email" ? sortDirection : "asc"}
                    onClick={() => handleSort("email")}
                    sx={SORT_LABEL_STYLES}
                  >
                    Email
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sx={{
                    ...COLUMN_SX.actions,
                    fontWeight: 600,
                    color: "var(--color-text-heading)",
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            )}
            itemContent={renderRow}
          />
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
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ color: "var(--color-text-medium-alt)" }}
          >
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
