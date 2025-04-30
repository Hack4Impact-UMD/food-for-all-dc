import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  useTheme,
  useMediaQuery,
  Card,
  Typography,
  Stack,
  Chip,
  Divider,
} from "@mui/material";
import { onAuthStateChanged } from "firebase/auth";
import { Filter, Search } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../auth/firebaseConfig";
import { useCustomColumns } from "../../hooks/useCustomColumns";
import { ClientService } from "../../services";
import "./Spreadsheet.css";
import DeleteClientModal from "./DeleteClientModal";

// Define TypeScript types for row data
interface RowData {
  id: string;
  clientid?: string;
  uid: string;
  firstName: string;
  lastName: string;
  phone?: string;
  houseNumber?: number;
  address: string;
  deliveryDetails: {
    deliveryInstructions: string;
    dietaryRestrictions: {
      foodAllergens: string[];
      halal: boolean;
      kidneyFriendly: boolean;
      lowSodium: boolean;
      lowSugar: boolean;
      microwaveOnly: boolean;
      noCookingEquipment: boolean;
      otherText: string;
      other: boolean;
      softFood: boolean;
      vegan: boolean;
      heartFriendly: boolean;
      vegetarian: boolean;
    };
  };
  ethnicity: string;
}

// ADDED
interface CustomColumn {
  id: string; // Unique identifier for the column
  label: string; // Header label (e.g., "Custom 1", or user-defined)
  propertyKey: keyof RowData | "none"; // Which property from RowData to display
}

// Define a type for fields that can either be computed or direct keys of RowData
type Field =
  | {
      key: "fullname";
      label: "Name";
      type: "text";
      compute: (data: RowData) => string;
    }
  | {
      key: keyof Omit<RowData, "id" | "firstName" | "lastName" | "deliveryDetails" | "uid" | "clientid">;
      label: string;
      type: string;
      compute?: never;
    }
  | {
      key: "deliveryDetails.dietaryRestrictions";
      label: string;
      type: string;
      compute: (data: RowData) => string;
    }
  | {
      key: "deliveryDetails.deliveryInstructions";
      label: string;
      type: string;
      compute: (data: RowData) => string;
    };

// Type Guard to check if a field is a regular field
const isRegularField = (field: Field): field is Extract<Field, { key: keyof RowData }> => {
  return field.key !== "fullname";
};

const Spreadsheet: React.FC = () => {
  const [rows, setRows] = useState<RowData[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<boolean>(false)

  const navigate = useNavigate();

  // ADDED
  const {
    customColumns,
    handleAddCustomColumn,
    handleCustomHeaderChange,
    handleRemoveCustomColumn,
    handleCustomColumnChange,
  } = useCustomColumns();
  // const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  // const handleAddCustomColumn = () => {
  //   const newColumnId = `custom-${Date.now()}`; // unique ID generation
  //   const newColumn: CustomColumn = {
  //     id: newColumnId,
  //     label: `Custom ${customColumns.length + 1}`,
  //     propertyKey: "none",
  //   };
  //   setCustomColumns([...customColumns, newColumn]);
  // };

  // // ADDED
  // const handleCustomColumnChange = (
  //   e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  //   id: string, // ID of the row being edited
  //   propertyKey: keyof RowData
  // ) => {
  //   const newValue = e.target.value; // Get the new value from the input

  //   setRows((prevRows) =>
  //     prevRows.map((row) => {
  //       if (row.id === id) {
  //         return {
  //           ...row,
  //           [propertyKey]: newValue, // Update the property w/ key
  //         };
  //       }
  //       return row;
  //     })
  //   );
  // };

  // // ADDED
  // const handleCustomHeaderChange = (
  //   event: SelectChangeEvent<keyof RowData | "none">,
  //   columnId: string
  // ) => {
  //   const newPropertyKey = event.target.value as keyof RowData | "none"; // Get selected val

  //   setCustomColumns((prevColumns) =>
  //     prevColumns.map((col) => {
  //       if (col.id === columnId) {
  //         return {
  //           ...col,
  //           propertyKey: newPropertyKey,
  //         };
  //       }
  //       return col;
  //     })
  //   );

  //   console.log(
  //     `Custom Column ID: ${columnId}, New Property Key: ${newPropertyKey}`
  //   ); // debugging
  // };

  // const handleRemoveCustomColumn = (columnIdToRemove: string) => {
  //   // Use the state setter function for customColumns
  //   setCustomColumns(
  //     (prevColumns) =>
  //       // Filter the previous columns array
  //       prevColumns.filter((column) => column.id !== columnIdToRemove)
  //     // Keep only the columns whose ID does NOT match the one to remove
  //   );
  // };

  //Route Protection
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      if (!user) {
        console.log("No user is signed in, redirecting to /");
        navigate("/");
      }
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, [navigate]);

  // Define fields for table columns
  const fields: Field[] = [
    {
      key: "fullname",
      label: "Name",
      type: "text",
      compute: (data: RowData) => `${data.lastName}, ${data.firstName}`,
    },
    { key: "address", label: "Address", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    {
      key: "deliveryDetails.dietaryRestrictions",
      label: "Dietary Restrictions",
      type: "text",
      compute: (data: RowData) => {
        const restrictions = [];
        const dietaryRestrictions = data.deliveryDetails?.dietaryRestrictions;
        if (!dietaryRestrictions) return "None";
        if (dietaryRestrictions.halal) restrictions.push("Halal");
        if (dietaryRestrictions.kidneyFriendly) restrictions.push("Kidney Friendly");
        if (dietaryRestrictions.lowSodium) restrictions.push("Low Sodium");
        if (dietaryRestrictions.lowSugar) restrictions.push("Low Sugar");
        if (dietaryRestrictions.microwaveOnly) restrictions.push("Microwave Only");
        if (dietaryRestrictions.noCookingEquipment) restrictions.push("No Cooking Equipment");
        if (dietaryRestrictions.softFood) restrictions.push("Soft Food");
        if (dietaryRestrictions.vegan) restrictions.push("Vegan");
        if (dietaryRestrictions.vegetarian) restrictions.push("Vegetarian");
        if (Array.isArray(dietaryRestrictions.foodAllergens) && dietaryRestrictions.foodAllergens.length > 0)
          restrictions.push(...dietaryRestrictions.foodAllergens);
        if (Array.isArray(dietaryRestrictions.other) && dietaryRestrictions.other.length > 0)
          restrictions.push(...dietaryRestrictions.other);
        return restrictions.length > 0 ? restrictions.join(", ") : "None";
      },
    },
    {
      key: "deliveryDetails.deliveryInstructions",
      label: "Delivery Instructions",
      type: "text",
      compute: (data: RowData) =>
        data.deliveryDetails?.deliveryInstructions || "None",
    },
  ];

  // Fetch data from Firebase without authentication checks
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use ClientService instead of direct Firebase calls
        const clientService = ClientService.getInstance();
        const clients = await clientService.getAllClients();
        console.log("Fetched clients:", clients);
        setRows(clients as unknown as RowData[]);
      } catch (error) {
        console.error("Error fetching data: ", error);
      }
    };
    fetchData();
  }, []);

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("hello");
    console.log(`This is the new search${event.target.value}`);
    console.log(event.target.value);
    setSearchQuery(event.target.value);
  };

  // Handle input change for editing a row
  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
    id: string,
    field: keyof RowData
  ) => {
    const updatedRows = rows.map((row) =>
      row.id === id ? { ...row, [field]: e.target.value } : row
    );
    setRows(updatedRows);
  };

  // Handle deleting a row from Firestore
  const handleDeleteRow = async (id: string) => {
    try {
      // Use ClientService instead of direct Firebase calls
      const clientService = ClientService.getInstance();
      console.log("Deleting client with ID:", id);
      await clientService.deleteClient(id);
      setRows(rows.filter((row) => row.uid !== id)); // Filter based on uid
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  // Handle editing a row
  const handleEditRow = (id: string) => {
    console.log("Editing client with ID:", id);
    const rowToEdit = rows.find((row) => row.uid === id);
    if (rowToEdit) {
      // Use useNavigate to navigate to the profile page with the user's data
      navigate(`/profile/${id}`, {
        state: { userData: rowToEdit }, // Passing the user data to the profile page via state
      });
    } else {
      console.error("Could not find client with ID:", id);
    }
  };

  // Handle saving edited row to Firestore
  const handleSaveRow = async (id: string) => {
    const rowToUpdate = rows.find((row) => row.id === id);
    if (rowToUpdate) {
      try {
        const { id, uid, ...rowWithoutIds } = rowToUpdate;
        // Use ClientService instead of direct Firebase calls
        const clientService = ClientService.getInstance();
        console.log("Updating client with ID:", uid);
        await clientService.updateClient(uid, rowWithoutIds as Omit<RowData, "id" | "uid">);
        setEditingRowId(null);
      } catch (error) {
        console.error("Error updating document: ", error);
      }
    }
  };

  // Handle navigating to user details page
  const handleRowClick = (uid: string) => {
    console.log("Navigating to profile with ID:", uid);
    if (!uid) {
      console.error("Invalid ID for navigation:", uid);
      return;
    }
    navigate(`/profile/${uid}`);
  };

  // Handle opening the action menu
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, uid: string) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedRowId(uid);
  };

  // Handle closing the action menu
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedRowId(null);
  };

  // Handle toggling sort order for the Name column
  const toggleSortOrder = () => {
    const sortedRows = [...rows].sort((a, b) => {
      if (a.firstName === b.firstName) {
        return sortOrder === "asc"
          ? a.lastName.localeCompare(b.lastName)
          : b.lastName.localeCompare(a.lastName);
      }
      return sortOrder === "asc"
        ? a.firstName.localeCompare(b.firstName)
        : b.firstName.localeCompare(a.firstName);
    });
    setRows(sortedRows);
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  const toggleSortOrder2 = (fieldKey: keyof RowData) => {
    const sortedRows = [...rows].sort((a, b) => {
      if (typeof a[fieldKey] === "string" && typeof b[fieldKey] === "string") {
        return sortOrder === "asc"
          ? (a[fieldKey] as string).localeCompare(b[fieldKey] as string)
          : (b[fieldKey] as string).localeCompare(a[fieldKey] as string);
      } else if (typeof a[fieldKey] === "number" && typeof b[fieldKey] === "number") {
        return sortOrder === "asc"
          ? (a[fieldKey] as number) - (b[fieldKey] as number)
          : (b[fieldKey] as number) - (a[fieldKey] as number);
      } else {
        return 0; // Handle cases where types mismatch or are not sortable
      }
    });
    setRows(sortedRows);
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  const addClient = () => {
    navigate("/profile");
  };

  const visibleRows = rows.filter((row) => {
  const keywordRegex = /(\w+)(?:\s+\w+)*:\s*("[^"]+"|\S+)/g; // Updated regex to handle multi-word keys
  const matches = [...searchQuery.matchAll(keywordRegex)];
  
  if (matches.length > 0) {
    // For keyword queries, check each key-value pair
    return matches.every(([_, key, value]) => {
      const strippedValue = value.replace(/"/g, "").toLowerCase();
      const searchKey = key.toLowerCase();
      
      // List of numeric fields that should be exactly matched
      const numericFields = ['adults', 'children', 'seniors', 'total'];
      
      // Handle special case for dietary restrictions - check both forms of the key
      if (searchKey === 'dietary' || searchKey === 'dietary restrictions') {
        const dietaryField = fields.find(f => f.key === 'deliveryDetails.dietaryRestrictions');
        if (dietaryField?.compute) {
          const restrictions = dietaryField.compute(row).toLowerCase();
          return restrictions.includes(strippedValue);
        }
        return false;
      }
      
      // Check if we're searching for a numeric field
      if (numericFields.includes(searchKey)) {
        const numValue = parseInt(strippedValue);
        const fieldValue = row[searchKey as keyof RowData];
        return fieldValue === numValue;
      }

      // For non-numeric fields, check static fields with substring match
      const matchesStaticField = fields.some((field) => {
        if (field.key.toLowerCase() === searchKey) {
          const fieldValue = field.compute ? field.compute(row) : row[field.key as keyof RowData];
          return fieldValue != null && fieldValue.toString().toLowerCase().includes(strippedValue);
        }
        return false;
      });

      // Check custom columns that match the search key
      const matchesCustomColumn = customColumns.some((col) => {
        if (col.propertyKey.toLowerCase() === searchKey) {
          const fieldValue = row[col.propertyKey as keyof RowData];
          return fieldValue != null && fieldValue.toString().toLowerCase().includes(strippedValue);
        }
        return false;
      });

      return matchesStaticField || matchesCustomColumn;
    });
       
    } else {
      // Fallback to general search logic for non-keyword queries
      const eachQuery = searchQuery.match(/"[^"]+"|\S+/g) || [];
  
      const quotedQueries = eachQuery.filter(s => s.startsWith('"') && s.endsWith('"') && s.length > 1) || [];
      const nonQuotedQueries = eachQuery.filter(s => s.length === 1 || !s.endsWith('"')) || [];
  
      const containsQuotedQueries = quotedQueries.length === 0
        ? true
        : quotedQueries.every((query) => {
            // Use substring matching instead of exact equality (convert to string)
            const strippedQuery = query.slice(1, -1).trim().toLowerCase();
            const matchesStaticField = fields.some((field) => {
              const fieldValue = field.compute ? field.compute(row) : row[field.key as keyof RowData];
              return (
                fieldValue != null &&
                fieldValue.toString().toLowerCase().includes(strippedQuery)
              );
            });
            const matchesCustomColumn = customColumns.some((col) => {
              if (col.propertyKey !== "none") {
                const fieldValue = row[col.propertyKey as keyof RowData];
                return (
                  fieldValue != null &&
                  fieldValue.toString().toLowerCase().includes(strippedQuery)
                );
              }
              return false;
            });
            return matchesStaticField || matchesCustomColumn;
          });
  
      if (containsQuotedQueries) {
        const containsRegularQuery = nonQuotedQueries.length === 0
          ? true
          : nonQuotedQueries.some((query) => {
              const strippedQuery = query.startsWith('"')
                ? query.slice(1).trim().toLowerCase()
                : query.trim().toLowerCase();
              if (strippedQuery.length === 0) {
                return true;
              }
              const matchesStaticField = fields.some((field) => {
                const fieldValue = field.compute ? field.compute(row) : row[field.key as keyof RowData];
                return fieldValue != null && fieldValue.toString().toLowerCase().includes(strippedQuery);
              });
              const matchesCustomColumn = customColumns.some((col) => {
                if (col.propertyKey !== "none") {
                  const fieldValue = row[col.propertyKey as keyof RowData];
                  return fieldValue != null && fieldValue.toString().toLowerCase().includes(strippedQuery);
                }
                return false;
              });
              return matchesStaticField || matchesCustomColumn;
            });
        return containsRegularQuery;
      } else {
        return false;
      }
    }
  });

  useEffect(() => {
    console.log("this is search query");
    console.log(searchQuery);
  }, [searchQuery]);

  // Add this debugging function
  useEffect(() => {
    if (rows.length > 0) {
      console.log("Sample row data:", rows[0]);
    }
  }, [rows]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

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
        height: "100vh"
      }}
    >
      {/* Fixed Container for Search Bar and Create Client Button */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          width: "100%",
          zIndex: 10,
          backgroundColor: "#fff",
          pb: 3,
          pt: 0,
          borderBottom: "none",
          boxShadow: "none",
          margin: 0
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ position: "relative", width: "100%" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="SEARCH"
              style={{
                width: "100%",
                height: "50px",
                backgroundColor: "#EEEEEE",
                border: "none",
                borderRadius: "25px",
                padding: "0 48px",
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
            justifyContent="space-between"
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
            <Button
              variant="contained"
              color="primary"
              onClick={addClient}
              className="create-client"
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
              + Create Client
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Spreadsheet Content */}
      <Box
        sx={{
          mt: 3,
          mb: 3,
          width: "100%",
          flex: 1,
          overflowY: "auto"
        }}
      >
        {/* Mobile Card View for Small Screens */}
        {isMobile ? (
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
                onClick={() => handleRowClick(row.uid)}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: "#2E5B4C" }}>
                    {row.lastName}, {row.firstName}
                  </Typography>
                  <IconButton 
                    size="small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuOpen(e, row.uid);
                    }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Stack>
                <Divider sx={{ my: 1 }} />
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Address</Typography>
                    <Typography variant="body1">{row.address}</Typography>
                  </Box>
                  {row.phone && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">Phone</Typography>
                      <Typography variant="body1">{row.phone}</Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="body2" color="text.secondary">Dietary Restrictions</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      {fields.find(f => f.key === "deliveryDetails.dietaryRestrictions")?.compute?.(row)?.split(", ").map((restriction, i) => (
                        restriction !== "None" && (
                          <Chip 
                            key={i} 
                            label={restriction} 
                            size="small" 
                            sx={{ 
                              backgroundColor: "#e8f5e9", 
                              color: "#2E5B4C",
                              mb: 0.5 
                            }} 
                          />
                        )
                      )) || <Typography variant="body2">None</Typography>}
                    </Stack>
                  </Box>
                  {/* Custom columns for mobile */}
                  {customColumns.map((col) => (
                    col.propertyKey !== "none" && row[col.propertyKey as keyof RowData] && (
                      <Box key={col.id}>
                        <Typography variant="body2" color="text.secondary">
                          {col.label || col.propertyKey}
                        </Typography>
                        <Typography variant="body1">
                          {row[col.propertyKey as keyof RowData]?.toString() || "N/A"}
                        </Typography>
                      </Box>
                    )
                  ))}
                </Stack>
              </Card>
            ))}
            {/* Menu for mobile */}
            <Menu
              anchorEl={menuAnchorEl}
              open={Boolean(menuAnchorEl)}
              onClose={handleMenuClose}
              PaperProps={{
                elevation: 3,
                sx: { borderRadius: "8px", minWidth: "150px" }
              }}
            >
              <MenuItem 
                onClick={() => {
                  if (selectedRowId) handleEditRow(selectedRowId);
                  handleMenuClose();
                }}
                sx={{ py: 1.5 }}
              >
                <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
              </MenuItem>
              <MenuItem 
                onClick={() => {
                  if (selectedRowId) handleDeleteRow(selectedRowId);
                  handleMenuClose();
                }}
                sx={{ py: 1.5 }}
              >
                <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
              </MenuItem>
            </Menu>
          </Stack>
        ) : (
          /* Table View for Larger Screens */
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
                  {/* Static columns */}
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
                          cursor: field.key === "fullname" ? "pointer" : "default",
                        }}
                        onClick={field.key === "fullname" ? toggleSortOrder : undefined}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#2E5B4C" }}>
                          {field.label}
                        </Typography>
                        {field.key === "fullname" && (
                          sortOrder === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />
                        )}
                      </Stack>
                    </TableCell>
                  ))}

                  {/*  Headers for custom columns */}
                  {customColumns.map((col) => (
                    <TableCell 
                      className="table-header" 
                      key={col.id}
                      sx={{
                        backgroundColor: "#f5f9f7",
                        borderBottom: "2px solid #e0e0e0",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Select
                          value={col.propertyKey}
                          onChange={(event) => handleCustomHeaderChange(event, col.id)}
                          variant="outlined"
                          displayEmpty
                          size="small"
                          sx={{ 
                            minWidth: 120, 
                            color: "#257e68",
                            "& .MuiOutlinedInput-notchedOutline": {
                              borderColor: "#bfdfd4",
                            },
                            "&:hover .MuiOutlinedInput-notchedOutline": {
                              borderColor: "#257e68",
                            },
                          }}
                        >
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="adults">Adults</MenuItem>
                        <MenuItem value="children">Children</MenuItem>
                        <MenuItem value="deliveryFreq">Delivery Freq</MenuItem>
                        <MenuItem value="ethnicity">Ethnicity</MenuItem>
                        <MenuItem value="gender">Gender</MenuItem>
                        <MenuItem value="language">Language</MenuItem>
                        <MenuItem value="notes">Notes</MenuItem>
                        <MenuItem value="referralEntity">Referral Entity</MenuItem>
                        <MenuItem value="tefapCert">TEFAP Cert</MenuItem>
                        <MenuItem value="tags">Tags</MenuItem>
                        <MenuItem value="dob">DOB</MenuItem>
                        <MenuItem value="ward">Ward</MenuItem>
                        </Select>
                        {/*Add Remove Button*/}
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveCustomColumn(col.id)}
                          aria-label={`Remove ${col.label || "custom"} column`}
                          title={`Remove ${col.label || "custom"} column`}
                          sx={{
                            color: "#d32f2f",
                            "&:hover": {
                              backgroundColor: "rgba(211, 47, 47, 0.04)",
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  ))}

                  {/* Add button cell */}
                  <TableCell 
                    className="table-header" 
                    align="right"
                    sx={{
                      backgroundColor: "#f5f9f7",
                      borderBottom: "2px solid #e0e0e0",
                    }}
                  >
                    <IconButton
                      onClick={handleAddCustomColumn}
                      color="primary"
                      aria-label="add custom column"
                      sx={{
                        backgroundColor: "rgba(37, 126, 104, 0.06)",
                        "&:hover": {
                          backgroundColor: "rgba(37, 126, 104, 0.12)",
                        }
                      }}
                    >
                      <AddIcon sx={{ color: "#257e68" }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={editingRowId === row.id ? "table-row editing-row" : "table-row"}
                    sx={{
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                      "&:hover": {
                        backgroundColor: "rgba(46, 91, 76, 0.04)",
                      },
                      "&:nth-of-type(odd)": {
                        backgroundColor: "rgba(246, 248, 250, 0.5)",
                      },
                      "&:nth-of-type(odd):hover": {
                        backgroundColor: "rgba(46, 91, 76, 0.06)",
                      }
                    }}
                    onClick={() => {
                      if (editingRowId !== row.id) {
                        handleRowClick(row.uid);
                      }
                    }}
                  >
                    {fields.map((field) => (
                      <TableCell key={field.key} sx={{ py: 2 }}>
                        {editingRowId === row.id ? (
                          field.key === "fullname" ? (
                            <>
                              <TextField
                                placeholder="First Name"
                                value={row.firstName}
                                variant="outlined"
                                size="small"
                                sx={{ mr: 1, maxWidth: "45%" }}
                              />
                              <TextField
                                placeholder="Last Name"
                                value={row.lastName}
                                variant="outlined"
                                size="small"
                                sx={{ maxWidth: "45%" }}
                              />
                            </>
                          ) : isRegularField(field) ? (
                            <TextField
                              type={field.type}
                              value={row[field.key]}
                              variant="outlined"
                              size="small"
                              fullWidth
                            />
                          ) : null
                        ) : field.key === "fullname" ? (
                          field.compute ? (
                            <Typography
                              component="a"
                              href={`/profile/${row.uid}`}
                              className="client-link"
                              sx={{
                                color: "#2E5B4C",
                                fontWeight: 500,
                                textDecoration: "none",
                                "&:hover": {
                                  textDecoration: "underline",
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/profile/${row.uid}`);
                              }}
                            >
                              {field.compute(row)}
                            </Typography>
                          ) : (
                            <Typography
                              component="a"
                              href={`/profile/${row.uid}`}
                              className="client-link"
                              sx={{
                                color: "#2E5B4C",
                                fontWeight: 500,
                                textDecoration: "none",
                                "&:hover": {
                                  textDecoration: "underline",
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/profile/${row.uid}`);
                              }}
                            >
                              {row.firstName} {row.lastName}
                            </Typography>
                          )
                        ) : field.compute ? (
                          field.key === "deliveryDetails.dietaryRestrictions" ? (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                              {field.compute?.(row)?.split(", ").map((restriction, i) => (
                                restriction !== "None" && (
                                  <Chip 
                                    key={i} 
                                    label={restriction} 
                                    size="small" 
                                    sx={{ 
                                      backgroundColor: "#e8f5e9", 
                                      color: "#2E5B4C",
                                      mb: 0.5 
                                    }} 
                                  />
                                )
                              )) || null}
                            </Stack>
                          ) : (
                            field.compute(row)
                          )
                        ) : (
                          row[field.key]
                        )}
                      </TableCell>
                    ))}

                    {customColumns.map((col) => (
                      <TableCell key={col.id} sx={{ py: 2 }}>
                        {editingRowId === row.id ? (
                          col.propertyKey !== "none" ? (
                            <TextField
                              value={row[col.propertyKey as keyof RowData] ?? ""}
                              onChange={(e) =>
                                handleCustomColumnChange(
                                  e,
                                  row.id,
                                  col.propertyKey as keyof RowData,
                                  setRows
                                )
                              }
                              variant="outlined"
                              size="small"
                              fullWidth
                            />
                          ) : (
                            "N/A"
                          )
                        ) : 
                        col.propertyKey !== "none" ? (
                          (row[col.propertyKey as keyof RowData]?.toString() ?? "N/A")
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                    ))}

                    <TableCell align="right" sx={{ py: 2 }} onClick={(e) => e.stopPropagation()}>
                      {editingRowId === row.id ? (
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => handleSaveRow(row.id)}
                          startIcon={<SaveIcon />}
                          sx={{
                            backgroundColor: "#2E5B4C",
                            borderRadius: "20px",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            "&:hover": {
                              backgroundColor: "#234839",
                            }
                          }}
                        >
                          Save
                        </Button>
                      ) : (
                        <IconButton 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMenuOpen(e, row.uid);
                          }}
                          sx={{
                            color: "#757575",
                            "&:hover": {
                              backgroundColor: "rgba(0, 0, 0, 0.04)",
                              color: "#2E5B4C",
                            }
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      )}
                      <Menu
                        anchorEl={menuAnchorEl}
                        open={Boolean(menuAnchorEl) && selectedRowId === row.uid}
                        onClose={handleMenuClose}
                        PaperProps={{
                          elevation: 3,
                          sx: { borderRadius: "8px", minWidth: "150px" }
                        }}
                      >
                        <MenuItem 
                          onClick={() => {
                            handleEditRow(row.uid);
                            handleMenuClose();
                          }}
                          sx={{ py: 1.5 }}
                        >
                          <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
                        </MenuItem>
                        <MenuItem 
                          onClick={() => {
                            setConfirmDeleteModal(true)
                          }}
                          sx={{ py: 1.5 }}
                        >
                          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
                        </MenuItem>
                      </Menu>
                      <DeleteClientModal handleMenuClose={handleMenuClose} handleDeleteRow={handleDeleteRow} open={confirmDeleteModal} setOpen={setConfirmDeleteModal} id={row.uid}/>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
};

export default Spreadsheet;
