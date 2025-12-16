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
import {
  parseSearchTermsProgressively,
  checkStringContains,
  extractKeyValue,
  globalSearchMatch,
} from "../../utils/searchFilter";
import { useNavigate } from "react-router-dom";
import { auth } from "../../auth/firebaseConfig";
import { authUserService } from "../../services/AuthUserService";
import { sortData, SortDirection } from "../../utils/sorting";
import "./UsersSpreadsheet.css";
import DeleteUserModal from "./DeleteUserModal";
import CreateUserModal from "./CreateUserModal";
import { AuthUserRow, UserType } from "../../types";
import { useAuth } from "../../auth/AuthProvider";

type Field = {
  key: keyof AuthUserRow | "fullname";
  label: string;
  type: string;
  compute?: (data: AuthUserRow) => string;
};

const getRoleDisplayName = (role: UserType): string => {
  switch (role) {
    case UserType.Admin:
      return "Admin";
    case UserType.Manager:
      return "Manager";
    case UserType.ClientIntake:
      return "Client Intake";
    default:
      return "Unknown";
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
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [nameSortDirection, setNameSortDirection] = useState<SortDirection>("asc");
  const [roleSortDirection, setRoleSortDirection] = useState<SortDirection | null>(null);
  const [phoneSortDirection, setPhoneSortDirection] = useState<SortDirection | null>(null);
  const [emailSortDirection, setEmailSortDirection] = useState<SortDirection | null>(null);

  const { userRole } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const handler = onAuthStateChangedOverride || onAuthStateChanged;
    const unsubscribe = handler(auth, (user: any) => {
      if (!user) {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate, onAuthStateChangedOverride]);

  const fields: Field[] = [
    {
      key: "name",
      label: "Name",
      type: "text",
    },
    {
      key: "role",
      label: "Role",
      type: "text",
      compute: (data: AuthUserRow) => getRoleDisplayName(data.role),
    },
    { key: "phone", label: "Phone", type: "text" },
    { key: "email", label: "Email", type: "text" },
  ];

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const users = await authUserService.getAllUsers();
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

  const toggleNameSort = () => {
    setNameSortDirection(nameSortDirection === "asc" ? "desc" : "asc");
    setRoleSortDirection(null);
    setPhoneSortDirection(null);
    setEmailSortDirection(null);
  };

  const toggleRoleSort = () => {
    if (roleSortDirection) {
      setRoleSortDirection(roleSortDirection === "asc" ? "desc" : "asc");
    } else {
      setRoleSortDirection("asc");
    }
    setNameSortDirection("asc");
    setPhoneSortDirection(null);
    setEmailSortDirection(null);
  };

  const togglePhoneSort = () => {
    if (phoneSortDirection) {
      setPhoneSortDirection(phoneSortDirection === "asc" ? "desc" : "asc");
    } else {
      setPhoneSortDirection("asc");
    }
    setNameSortDirection("asc");
    setRoleSortDirection(null);
    setEmailSortDirection(null);
  };

  const toggleEmailSort = () => {
    if (emailSortDirection) {
      setEmailSortDirection(emailSortDirection === "asc" ? "desc" : "asc");
    } else {
      setEmailSortDirection("asc");
    }
    setNameSortDirection("asc");
    setRoleSortDirection(null);
    setPhoneSortDirection(null);
  };

  const sortedRows = useMemo(() => {
    if (roleSortDirection) {
      return sortData(rows, {
        key: "role",
        direction: roleSortDirection,
        getValue: (row: AuthUserRow) => getRoleDisplayName(row.role),
      });
    } else if (phoneSortDirection) {
      return sortData(rows, {
        key: "phone",
        direction: phoneSortDirection,
        getValue: (row: AuthUserRow) => {
          const phone = row.phone || "";
          if (!phone || phone.trim() === "") {
            return phoneSortDirection === "asc" ? "zzz_empty" : "aaa_empty";
          }
          return phone;
        },
      });
    } else if (emailSortDirection) {
      return sortData(rows, {
        key: "email",
        direction: emailSortDirection,
        getValue: (row: AuthUserRow) => row.email || "",
      });
    } else {
      return sortData(rows, {
        key: "name",
        direction: nameSortDirection,
        getValue: (row: AuthUserRow) => row.name.trim().toLowerCase(),
      });
    }
  }, [rows, nameSortDirection, roleSortDirection, phoneSortDirection, emailSortDirection]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleDeleteUser = async (uid: string) => {
    const originalRows = [...rows];
    const safeRows = Array.isArray(rows) ? rows : [];
    const userToDelete = safeRows.find((r) => r.uid === uid);

    setRows(safeRows.filter((row) => row.uid !== uid));
    setDeleteModalOpen(false);
    setSelectedRowId(null);
    setActionFeedback(null);

    try {
      await authUserService.deleteUser(uid);
      setActionFeedback({
        type: "success",
        message: `${userToDelete?.name || "User"} deleted successfully.`,
      });
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (deleteError: any) {
      console.error("Error deleting user: ", deleteError);
      setRows(originalRows);
      const errorMessage =
        deleteError.message ||
        `Failed to delete ${userToDelete?.name || "user"}. Please try again.`;
      setActionFeedback({ type: "error", message: errorMessage });
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, uid: string) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedRowId(uid);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedRowId(null);
  };

  const handleOpenCreateModal = () => {
    setCreateModalOpen(true);
  };

  const safeSortedRows = Array.isArray(sortedRows) ? sortedRows : [];
  const visibleRows = safeSortedRows.filter((row) => {
    const trimmedSearchQuery = searchQuery.trim();
    if (!trimmedSearchQuery) {
      return true;
    }

    const validSearchTerms = parseSearchTermsProgressively(trimmedSearchQuery);

    const keyValueTerms = validSearchTerms.filter((term) => term.includes(":"));
    const nonKeyValueTerms = validSearchTerms.filter((term) => !term.includes(":"));

    let matches = true;

    if (keyValueTerms.length > 0) {
      const visibleFieldKeys = new Set(fields.map((f) => f.key));

      const isVisibleField = (keyword: string): boolean => {
        const lowerKeyword = keyword.toLowerCase();

        const fieldMappings: { [key: string]: string[] } = {
          name: ["name"],
          role: ["role"],
          phone: ["phone"],
          email: ["email"],
        };

        for (const [fieldKey, aliases] of Object.entries(fieldMappings)) {
          if (
            visibleFieldKeys.has(fieldKey as keyof AuthUserRow) &&
            aliases.some((alias) => alias === lowerKeyword)
          ) {
            return true;
          }
        }

        return false;
      };

      matches = keyValueTerms.every((term) => {
        const { keyword, searchValue, isKeyValue: isKeyValueSearch } = extractKeyValue(term);

        if (isKeyValueSearch && searchValue) {
          if (!isVisibleField(keyword)) {
            return true;
          }

          switch (keyword) {
            case "name":
              return checkStringContains(row.name, searchValue);
            case "role":
              return checkStringContains(getRoleDisplayName(row.role), searchValue);
            case "phone":
              return checkStringContains(row.phone, searchValue);
            case "email":
              return checkStringContains(row.email, searchValue);
            default:
              return false;
          }
        }

        return true;
      });
    }

    if (matches && nonKeyValueTerms.length > 0) {
      const searchableFields = ["name", "phone", "email", "role"];
      matches = nonKeyValueTerms.every((term) => {
        if (term === "role") {
          return globalSearchMatch(
            { ...row, role: getRoleDisplayName(row.role) },
            term,
            searchableFields
          );
        }
        return globalSearchMatch(row, term, searchableFields);
      });
    }

    return matches;
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleCloseCreateModal = (refreshNeeded?: boolean) => {
    setCreateModalOpen(false);
    if (refreshNeeded) {
      fetchData();
      setActionFeedback({ type: "success", message: "User created successfully!" });
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

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
        backgroundColor: "var(--color-transparent)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <>
        {/* Feedback Alert */}
        {actionFeedback && (
          <Alert
            severity={actionFeedback.type}
            onClose={() => setActionFeedback(null)}
            sx={{ position: "sticky", top: 0, zIndex: 12, mb: 2 }}
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
            backgroundColor: "var(--color-background-main)",
            pb: 3,
            pt: 0,
            borderBottom: "none",
            boxShadow: "none",
            margin: 0,
            transition: "top 0.3s ease-in-out",
          }}
        >
          <Stack spacing={3}>
            <Box sx={{ position: "relative", width: "100%" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search users (e.g., admin, name:jane, email:test@example.com)"
                style={{
                  width: "100%",
                  height: "50px",
                  backgroundColor: "var(--color-background-gray)",
                  border: "none",
                  borderRadius: "25px",
                  padding: "0 20px",
                  fontSize: "16px",
                  color: "var(--color-text-dark)",
                  boxSizing: "border-box",
                  transition: "all 0.2s ease",
                  boxShadow: "inset 0 2px 3px rgba(0,0,0,0.05)",
                }}
              />
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ "& .MuiButton-root": { height: { sm: "36px" } } }}
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
                  minWidth: { xs: "100%", sm: "100px" },
                  maxWidth: { sm: "120px" },
                  textTransform: "none",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                  },
                  alignSelf: { xs: "stretch", sm: "flex-start" },
                }}
              >
                View All
              </Button>
              <Box
                sx={{
                  flexGrow: 1,
                  display: "flex",
                  justifyContent: { xs: "stretch", sm: "flex-end" },
                }}
              >
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleOpenCreateModal}
                  className="create-user"
                  sx={{
                    backgroundColor: "var(--color-primary-darker)",
                    borderRadius: "25px",
                    px: 2,
                    py: 0.5,
                    minWidth: { xs: "100%", sm: "140px" },
                    maxWidth: { sm: "160px" },
                    textTransform: "none",
                    fontSize: "0.875rem",
                    lineHeight: 1.5,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      backgroundColor: "var(--color-primary-darkest)",
                      transform: "translateY(-2px)",
                      boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                    },
                    alignSelf: { xs: "stretch", sm: "flex-end" },
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
            position: "relative",
            overflow: "visible",
          }}
        >
          {/* Loading Indicator */}
          {isLoading && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(255, 255, 255, 0.7)",
                zIndex: 11,
              }}
            >
              <CircularProgress />
            </Box>
          )}

          {/* Error Message */}
          {!isLoading && error && (
            <Box
              sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}
            >
              <Typography color="error">{error}</Typography>
            </Box>
          )}

          {!isLoading &&
            !error &&
            (isMobile ? (
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
                      },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 600, color: "var(--color-text-dark)" }}
                      >
                        {row.name}
                      </Typography>
                      <Chip label={getRoleDisplayName(row.role)} color="primary" size="small" />
                    </Stack>
                    <Divider sx={{ my: 1 }} />
                    <Stack spacing={1}>
                      <Typography variant="body2" sx={{ color: "var(--color-text-medium)" }}>
                        <strong>Email:</strong> {row.email}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "var(--color-text-medium)" }}>
                        <strong>Phone:</strong> {row.phone}
                      </Typography>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            ) : (
              <TableContainer component={Paper} sx={{ boxShadow: "none", borderRadius: "12px" }}>
                <Table sx={{ minWidth: 650 }} aria-label="users table">
                  <TableHead>
                    <TableRow>
                      {fields.map((field) => (
                        <TableCell
                          key={field.key}
                          className="table-header"
                          sx={{
                            backgroundColor: "var(--color-background-green-tint)",
                            borderBottom: "2px solid var(--color-border-medium)"
                          }}
                        ></TableCell>
                      ))}
                      <TableCell
                        align="right"
                        sx={{ py: 1 }}
                      ></TableCell>
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
                              : field.key === "role"
                                ? getRoleDisplayName(row[field.key as keyof AuthUserRow] as UserType)
                                : (() => {
                                    const val = row[field.key as keyof AuthUserRow];
                                    if (
                                      val === null ||
                                      val === undefined ||
                                      val === "" ||
                                      val === "N/A"
                                    )
                                      return "";
                                    return val.toString();
                                  })()}
                          </TableCell>
                        ))}

                        <TableCell align="right" sx={{ py: 1 }} onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            onClick={(e) => handleMenuOpen(e, row.uid)}
                            sx={{
                              color: "var(--color-text-medium)",
                              "&:hover": {
                                backgroundColor: "rgba(0, 0, 0, 0.04)",
                                color: "var(--color-primary-darker)"
                              }
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
            ))}
        </Box>

        {/* Action Menu (simplified) */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          PaperProps={{ elevation: 3, sx: { borderRadius: "8px", minWidth: "150px" } }}
        >
          <MenuItem
            disabled={
              userRole === UserType.Manager &&
              (Array.isArray(rows) ? rows : []).find((r) => r.uid === selectedRowId)?.role ===
                UserType.Admin
            } //Client Intake does not have access to this page
            onClick={() => {
              if (selectedRowId) {
                setDeleteModalOpen(true);
                setMenuAnchorEl(null);
              }
            }}
            sx={{ py: 1.5, color: "error.main" }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
          </MenuItem>
        </Menu>

        {/* Modals */}
        {/* Debug: Log full user record when modal opens */}
        {deleteModalOpen && (() => {
          const userRecord = (Array.isArray(rows) ? rows : []).find((r) => r.uid === selectedRowId);
          console.log('Full user record for modal:', userRecord);
        })()}
        <DeleteUserModal
          open={deleteModalOpen}
          handleClose={handleCloseDeleteModal}
          handleDelete={() => {
            if (selectedRowId) {
              handleDeleteUser(selectedRowId);
            } else {
              console.error("No user selected for deletion.");
              setActionFeedback({ type: "error", message: "Error: No user selected." });
              handleCloseDeleteModal();
            }
          }}
          userName={
            (Array.isArray(rows) ? rows : []).find((r) => r.uid === selectedRowId)?.name ||
            "this user"
          }
        />
        <CreateUserModal open={createModalOpen} handleClose={handleCloseCreateModal} />
      </>
    </Box>
  );
}

export default UsersSpreadsheet;
