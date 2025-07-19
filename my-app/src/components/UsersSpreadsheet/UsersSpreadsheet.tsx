import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  useMediaQuery,
  Card,
  Typography,
  Stack,
  Chip,
  Divider,
  Alert,
  CircularProgress,
} from "@mui/material";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../auth/firebaseConfig";
import { authUserService } from "../../services/AuthUserService";
import { sortData, SortDirection } from "../../utils/sorting";
import "./UsersSpreadsheet.css";
import DeleteUserModal from "./DeleteUserModal";
import CreateUserModal from "./CreateUserModal";
import { AuthUserRow, UserType } from "../../types";
import { useAuth } from "../../auth/AuthProvider";

// Define a type for fields that can either be computed or direct keys of AuthUserRow
type Field = {
  key: keyof AuthUserRow | "fullname";
  label: string;
  type: string;
  compute?: (data: AuthUserRow) => string;
};

// Map UserType enum to display string
const getRoleDisplayName = (role: UserType): string => {
  switch (role) {
    case UserType.Admin: return "Admin";
    case UserType.Manager: return "Manager";
    case UserType.ClientIntake: return "Client Intake";
    default: return "Unknown";
  }
};

interface UsersSpreadsheetProps {
  onAuthStateChangedOverride?: (auth: any, callback: any) => () => void;
}

const UsersSpreadsheet: React.FC<UsersSpreadsheetProps> = ({ onAuthStateChangedOverride }) => {
  const [rows, setRows] = useState<AuthUserRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Sort state for Name column - default to ascending
  const [nameSortDirection, setNameSortDirection] = useState<SortDirection>("asc");
  // Sort state for Role column - no default sort
  const [roleSortDirection, setRoleSortDirection] = useState<SortDirection | null>(null);
  // Sort state for Phone column - no default sort
  const [phoneSortDirection, setPhoneSortDirection] = useState<SortDirection | null>(null);
  // Sort state for Email column - no default sort
  const [emailSortDirection, setEmailSortDirection] = useState<SortDirection | null>(null);
  
  const { userRole } = useAuth();
  const navigate = useNavigate();

  //Route Protection
  React.useEffect(() => {
    const handler = onAuthStateChangedOverride || onAuthStateChanged;
    const unsubscribe = handler(auth, (user: any) => {
      if (!user) {
        console.log("No user is signed in, redirecting to /");
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate, onAuthStateChangedOverride]);

  // Define fields for the user table columns
  const fields: Field[] = [
    {
      key: "name",
      label: "Name",
      type: "text",
    },
    { key: "role", label: "Role", type: "text", compute: (data: AuthUserRow) => getRoleDisplayName(data.role) },
    { key: "phone", label: "Phone", type: "text" },
    { key: "email", label: "Email", type: "text" },
  ];

  // Fetch data using AuthUserService
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const users = await authUserService.getAllUsers();
      console.log("Fetched users:", users);
      setRows(users);
    } catch (fetchError) {
      console.error("Error fetching users: ", fetchError);
      setError("Failed to load users. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle toggling sort for Name column (only asc/desc)
  const toggleNameSort = () => {
    setNameSortDirection(nameSortDirection === "asc" ? "desc" : "asc");
    // Clear other sorts when name sort is activated
    setRoleSortDirection(null);
    setPhoneSortDirection(null);
    setEmailSortDirection(null);
  };

  // Handle toggling sort for Role column (only asc/desc)
  const toggleRoleSort = () => {
    if (roleSortDirection) {
      setRoleSortDirection(roleSortDirection === "asc" ? "desc" : "asc");
    } else {
      setRoleSortDirection("asc");
    }
    // Clear other sorts when role sort is activated
    setNameSortDirection("asc"); // Reset to default but not active
    setPhoneSortDirection(null);
    setEmailSortDirection(null);
  };

  // Handle toggling sort for Phone column (only asc/desc)
  const togglePhoneSort = () => {
    if (phoneSortDirection) {
      setPhoneSortDirection(phoneSortDirection === "asc" ? "desc" : "asc");
    } else {
      setPhoneSortDirection("asc");
    }
    // Clear other sorts when phone sort is activated
    setNameSortDirection("asc"); // Reset to default but not active
    setRoleSortDirection(null);
    setEmailSortDirection(null);
  };

  // Handle toggling sort for Email column (only asc/desc)
  const toggleEmailSort = () => {
    if (emailSortDirection) {
      setEmailSortDirection(emailSortDirection === "asc" ? "desc" : "asc");
    } else {
      setEmailSortDirection("asc");
    }
    // Clear other sorts when email sort is activated
    setNameSortDirection("asc"); // Reset to default but not active
    setRoleSortDirection(null);
    setPhoneSortDirection(null);
  };

  // Apply sorting to rows when sort direction changes
  const sortedRows = useMemo(() => {
    // Determine which column to sort by
    if (roleSortDirection) {
      // Sort by role
      return sortData(rows, {
        key: "role",
        direction: roleSortDirection,
        getValue: (row: AuthUserRow) => getRoleDisplayName(row.role)
      });
    } else if (phoneSortDirection) {
      // Sort by phone
      return sortData(rows, {
        key: "phone",
        direction: phoneSortDirection,
        getValue: (row: AuthUserRow) => {
          const phone = row.phone || "";
          // Sort empty values last in ascending order, first in descending order
          if (!phone || phone.trim() === "") {
            return phoneSortDirection === "asc" ? "zzz_empty" : "aaa_empty";
          }
          return phone;
        }
      });
    } else if (emailSortDirection) {
      // Sort by email
      return sortData(rows, {
        key: "email",
        direction: emailSortDirection,
        getValue: (row: AuthUserRow) => row.email || ""
      });
    } else {
      // Sort by name (default) - simple alphabetical sorting
      return sortData(rows, {
        key: "name",
        direction: nameSortDirection,
        getValue: (row: AuthUserRow) => row.name.trim().toLowerCase()
      });
    }
  }, [rows, nameSortDirection, roleSortDirection, phoneSortDirection, emailSortDirection]);

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Handle deleting a user (only Firestore deletion for now)
  const handleDeleteUser = async (uid: string) => {
    const originalRows = [...rows]; // Store original rows for potential rollback
    const safeRows = Array.isArray(rows) ? rows : [];
    const userToDelete = safeRows.find(r => r.uid === uid); // Find user for feedback messages

    // --- Optimistic UI Update ---
    setRows(safeRows.filter((row) => row.uid !== uid)); // Remove user from UI immediately
    setDeleteModalOpen(false); // Close modal immediately
    setSelectedRowId(null);
    setActionFeedback(null); // Clear previous feedback

    try {
      // --- Call backend service ---
      await authUserService.deleteUser(uid);
      // Backend succeeded! Show success message.
      setActionFeedback({ type: 'success', message: `${userToDelete?.name || 'User'} deleted successfully.` });
      setTimeout(() => setActionFeedback(null), 5000); // Clear success message after 5s

    } catch (deleteError: any) {
      console.error("Error deleting user: ", deleteError);
      // --- Rollback UI on failure ---
      setRows(originalRows); // Restore original rows
      const errorMessage = deleteError.message || `Failed to delete ${userToDelete?.name || 'user'}. Please try again.`;
      setActionFeedback({ type: 'error', message: errorMessage });
      // Keep error message visible until dismissed or another action occurs
    }
    // No 'finally' block needed for modal/ID reset as it's done optimistically
  };

  // Handle opening the action menu
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, uid: string) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedRowId(uid);
  };

  // Handle closing the action menu
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedRowId(null);
  };

  // Handle opening the create user modal
  const handleOpenCreateModal = () => {
    setCreateModalOpen(true);
  };

  // Simplified search logic
  const safeSortedRows = Array.isArray(sortedRows) ? sortedRows : [];
  const visibleRows = safeSortedRows.filter((row) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      row.name.toLowerCase().includes(query) ||
      getRoleDisplayName(row.role).toLowerCase().includes(query) ||
      (row.phone?.toLowerCase() || '').includes(query) ||
      row.email.toLowerCase().includes(query)
    );
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Handle closing the create modal and potentially refreshing data
  const handleCloseCreateModal = (refreshNeeded?: boolean) => {
    setCreateModalOpen(false);
    if (refreshNeeded) {
      fetchData();
      setActionFeedback({ type: 'success', message: 'User created successfully!' });
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  // Handle closing the delete modal
  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false);
    setSelectedRowId(null);
  };

  return (
    <Box
      className="box"
      sx={{
        px: { xs: 2, sm: 3, md: 4 },
        py: 2,
        maxWidth: "100%",
        overflowX: "hidden",
        backgroundColor: "transparent",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
      }}
    >
      {/* Feedback Alert */}
      {actionFeedback && (
        <Alert
          severity={actionFeedback.type}
          onClose={() => setActionFeedback(null)}
          sx={{ position: 'sticky', top: 0, zIndex: 12, mb: 2 }}
        >
          {actionFeedback.message}
        </Alert>
      )}

      {/* Fixed Container for Search Bar and Create User Button */}
      <Box
        sx={{
          position: "sticky",
          top: actionFeedback ? 70 : 0,
          width: "100%",
          zIndex: 10,
          backgroundColor: "#fff",
          pb: 3,
          pt: 0,
          borderBottom: "none",
          boxShadow: "none",
          margin: 0,
          transition: 'top 0.3s ease-in-out',
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ position: "relative", width: "100%" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search"
              style={{
                width: "100%",
                height: "50px",
                backgroundColor: "#EEEEEE",
                border: "none",
                borderRadius: "25px",
                padding: "0 20px",
                fontSize: "16px",
                color: "#333333",
                boxSizing: "border-box",
                transition: "all 0.2s ease",
                boxShadow: "inset 0 2px 3px rgba(0,0,0,0.05)"
              }}
            />
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ '& .MuiButton-root': { height: { sm: '36px' } } }}
          >
            <Button
              variant="contained"
              color="secondary"
              onClick={() => setSearchQuery("")}
              className="view-all"
              sx={{
                borderRadius: "25px",
                px: 2,
                py: 0.5,
                minWidth: { xs: '100%', sm: '100px' },
                maxWidth: { sm: '120px' },
                textTransform: "none",
                fontSize: "0.875rem",
                lineHeight: 1.5,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                transition: "all 0.2s ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                },
                alignSelf: { xs: 'stretch', sm: 'flex-start' }
              }}
            >
              View All
            </Button>

            <Box sx={{ flexGrow: 1, display: "flex", justifyContent: { xs: 'stretch', sm: 'flex-end'} }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenCreateModal}
                className="create-user"
                sx={{
                  backgroundColor: "#2E5B4C",
                  borderRadius: "25px",
                  px: 2,
                  py: 0.5,
                  minWidth: { xs: '100%', sm: '140px' },
                  maxWidth: { sm: '160px' },
                  textTransform: "none",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    backgroundColor: "#234839",
                    transform: "translateY(-2px)",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                  },
                  alignSelf: { xs: 'stretch', sm: 'flex-end' }
                }}
              >
                + Create User
              </Button>
            </Box>
          </Stack>
        </Stack>
      </Box>

      {/* Spreadsheet Content Area */}
      <Box
        sx={{
          mt: 3,
          mb: 3,
          width: "100%",
          flex: 1,
          overflowY: "auto",
          position: 'relative',
        }}
      >
        {/* Loading Indicator */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.7)', zIndex: 11 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error Message */}
        {!isLoading && error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}

        {!isLoading && !error && (
          isMobile ? (
            <Stack spacing={2} sx={{ overflowY: "auto", width: "100%" }}>
              {visibleRows.map((row) => (
                <Card
                  key={row.id}
                  sx={{
                    p: 2,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    borderRadius: "12px",
                    transition: "transform 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    }
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: "#2E5B4C" }}>
                      {row.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, row.uid)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Role</Typography>
                      <Chip
                        label={getRoleDisplayName(row.role)}
                        size="small"
                        sx={{ backgroundColor: "#e8f5e9", color: "#2E5B4C", mt: 0.5 }}
                      />
                    </Box>
                    {row.phone && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">Phone</Typography>
                        <Typography variant="body1">{row.phone}</Typography>
                      </Box>
                    )}
                    <Box>
                      <Typography variant="body2" color="text.secondary">Email</Typography>
                      <Typography variant="body1">{row.email}</Typography>
                    </Box>
                  </Stack>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer
              component={Paper}
              sx={{
                maxHeight: "none",
                overflowY: "auto",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                borderRadius: "12px",
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    {fields.map((field) => (
                      <TableCell
                        className="table-header"
                        key={field.key}
                        sx={{
                          backgroundColor: "#f5f9f7",
                          borderBottom: "2px solid #e0e0e0",
                        }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={0.5}
                          sx={{
                            cursor: "pointer",
                          }}
                          onClick={
                            field.key === "name" ? toggleNameSort :
                            field.key === "role" ? toggleRoleSort :
                            field.key === "phone" ? togglePhoneSort :
                            field.key === "email" ? toggleEmailSort :
                            undefined
                          }
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#2E5B4C" }}>
                            {field.label}
                          </Typography>
                          {field.key === "name" && (
                            !roleSortDirection && !phoneSortDirection && !emailSortDirection ? (
                              nameSortDirection === "asc" ? <ArrowDropUpIcon /> : nameSortDirection === "desc" ? <ArrowDropDownIcon /> : <UnfoldMoreIcon sx={{ color: "#9E9E9E", fontSize: "1.2rem" }} />
                            ) : (
                              roleSortDirection || phoneSortDirection || emailSortDirection ? 
                              <UnfoldMoreIcon sx={{ color: "#9E9E9E", fontSize: "1.2rem" }} /> : null
                            )
                          )}
                          {field.key === "role" && (
                            roleSortDirection ? (
                              roleSortDirection === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />
                            ) : <UnfoldMoreIcon sx={{ color: "#9E9E9E", fontSize: "1.2rem" }} />
                          )}
                          {field.key === "phone" && (
                            phoneSortDirection ? (
                              phoneSortDirection === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />
                            ) : <UnfoldMoreIcon sx={{ color: "#9E9E9E", fontSize: "1.2rem" }} />
                          )}
                          {field.key === "email" && (
                            emailSortDirection ? (
                              emailSortDirection === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />
                            ) : <UnfoldMoreIcon sx={{ color: "#9E9E9E", fontSize: "1.2rem" }} />
                          )}
                        </Stack>
                      </TableCell>
                    ))}

                    <TableCell
                      className="table-header"
                      align="right"
                      sx={{ backgroundColor: "#f5f9f7", borderBottom: "2px solid #e0e0e0" }}
                    >
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={"table-row"}
                      sx={{
                        cursor: "default",
                        transition: "background-color 0.2s",
                        "&:hover": { backgroundColor: "rgba(46, 91, 76, 0.04)" },
                        "&:nth-of-type(odd)": { backgroundColor: "rgba(246, 248, 250, 0.5)" },
                        "&:nth-of-type(odd):hover": { backgroundColor: "rgba(46, 91, 76, 0.06)" }
                      }}
                    >
                      {fields.map((field) => (
                        <TableCell key={field.key} sx={{ py: 1.5 }}>
                          {field.compute
                            ? field.compute(row)
                            : field.key === 'role'
                                ? getRoleDisplayName(row[field.key as keyof AuthUserRow] as UserType)
                                : row[field.key as keyof AuthUserRow]?.toString() ?? "N/A" }
                        </TableCell>
                      ))}

                      <TableCell align="right" sx={{ py: 1 }} onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          onClick={(e) => handleMenuOpen(e, row.uid)}
                          sx={{
                            color: "#757575",
                            "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.04)", color: "#2E5B4C" }
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )
        )}
      </Box>

      {/* Action Menu (simplified) */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        PaperProps={{ elevation: 3, sx: { borderRadius: "8px", minWidth: "150px" } }}
      >
        <MenuItem
          disabled = {userRole === UserType.Manager && (Array.isArray(rows) ? rows : []).find(r => r.uid === selectedRowId)?.role === UserType.Admin} //Client Intake does not have access to this page
          onClick={() => {
            if (selectedRowId) {
              setDeleteModalOpen(true);
              setMenuAnchorEl(null);
            }
          }}
          sx={{ py: 1.5, color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Modals */}
      <DeleteUserModal
        open={deleteModalOpen}
        handleClose={handleCloseDeleteModal}
        handleDelete={() => { 
            if (selectedRowId) {
              handleDeleteUser(selectedRowId)
            } else {
              console.error("No user selected for deletion.");
              setActionFeedback({ type: 'error', message: 'Error: No user selected.' });
              handleCloseDeleteModal();
            }
        }}
        userName={(Array.isArray(rows) ? rows : []).find(r => r.uid === selectedRowId)?.name || 'this user'}
      />
      <CreateUserModal
        open={createModalOpen}
        handleClose={handleCloseCreateModal}
      />
    </Box>
  );
};

export default UsersSpreadsheet;
