import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../auth/firebaseConfig"; // Ensure the correct path
import { Search, Filter } from "lucide-react";
import "./DeliverySpreadsheet.css";
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
  IconButton,
  Checkbox,
  Menu,
  MenuItem,
  TextField,
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  DialogTitle,
  Autocomplete,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { auth } from "../../auth/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

// Define TypeScript types for row data
interface RowData {
  id: string;
  clientid: string;
  firstName: string;
  lastName: string;
  phone?: string;
  houseNumber?: number;
  address: string;
  tags?: string[];
  ward?: string; // Add this field
  assignedDriver?: string; // Add this field
  assignedTime?: string; // Add this field
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
      other: string[];
      softFood: boolean;
      vegan: boolean;
      vegetarian: boolean;
    };
  };
}

// Define a type for fields that can either be computed or direct keys of RowData
type Field =
  | {
      key: "checkbox";
      label: "";
      type: "checkbox";
      compute?: never;
    }
  | {
      key: "fullname";
      label: "Client";
      type: "text";
      compute: (data: RowData) => string;
    }
  | {
      key: keyof Omit<RowData, "id" | "firstName" | "lastName" | "deliveryDetails">;
      label: string;
      type: string;
      compute?: never;
    }
  | {
      key: "tags";
      label: "Tags";
      type: "text";
      compute: (data: RowData) => string;
    }
  | {
      key: "deliveryDetails.deliveryInstructions";
      label: "Delivery Instructions";
      type: "text";
      compute: (data: RowData) => string;
    };

interface Driver{
  id: string;
  name: string;
  phone: string
  email: string;
}

// Define fields for table columns
const fields: Field[] = [
  {
    key: "checkbox",
    label: "",
    type: "checkbox",
  },
  {
    key: "fullname",
    label: "Client",
    type: "text",
    compute: (data: RowData) => `${data.lastName}, ${data.firstName}`,
  },
  {
    key: "tags",
    label: "Tags",
    type: "text",
    compute: (data: RowData) => {
      const tags = data.tags || [];
      return tags.length > 0 ? tags.join(", ") : "None";
    },
  },
  { key: "address", label: "Address", type: "text" },
  { key: "ward", label: "Ward", type: "text" }, // Add a new field for "Ward"
  { key: "assignedDriver", label: "Assigned Driver", type: "text" }, // Add a new field for "Assigned Driver"
  { key: "assignedTime", label: "Assigned Time", type: "text" }, // Add a new field for "Assigned Time"
];

// Type Guard to check if a field is a regular field
const isRegularField = (
  field: Field
): field is Extract<Field, { key: keyof RowData }> => {
  return field.key !== "fullname";
};

const DeliverySpreadsheet: React.FC = () => {
  const [rows, setRows] = useState<RowData[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set()); // Track selected rows

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [innerPopup, setInnerPopup] = useState(false);
  const [popupMode, setPopupMode] = useState("");
  const [driverSearchQuery, setDriverSearchQuery] = useState<string>(""); // New state for driver search
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [time, setTime] = useState<string>("");
  const navigate = useNavigate();
  //get drivers
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const driversCollectionRef = collection(db, "Drivers");
        const driversSnapshot = await getDocs(driversCollectionRef);
  
        if (!driversSnapshot.empty) {
          // Map through the documents and extract their data
          const driversData = driversSnapshot.docs.map((doc) => {
            const data = doc.data();
            // Ensure the data matches the Driver interface
            return {
              id: doc.id,
              name: data.name || "", 
              phone: data.phone || "", 
              email: data.email || "", 
            };
          });
  
          setDrivers(driversData); 
        } else {
          console.log("No drivers found!");
        }
      } catch (error) {
        console.error("Error fetching drivers:", error);
      }
    };
  
    fetchDrivers();
  }, []);


  // Route Protection
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

  useEffect(() => {
    if (popupMode == "") {
      setInnerPopup(false);
    } else {
      setInnerPopup(true);
    }
  }, [popupMode]);

  // Fetch data from Firebase without authentication checks
  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapshot = await getDocs(collection(db, "clients"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<RowData, "id">),
        }));
        setRows(data);
      } catch (error) {
        console.error("Error fetching data: ", error);
      }
    };
    fetchData();
  }, []);

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTime(event.target.value);
    console.log("Selected Time:", event.target.value);
  };

  // Handle deleting a row from Firestore
  const handleDeleteRow = async (id: string) => {
    try {
      await deleteDoc(doc(db, "clients", id));
      setRows(rows.filter((row) => row.id !== id));
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  // Handle editing a row
  const handleEditRow = (id: string) => {
    const rowToEdit = rows.find((row) => row.id === id);
    if (rowToEdit) {
      // Use useNavigate to navigate to the profile page with the user's data
      navigate(`/profile/${id}`, {
        state: { userData: rowToEdit }, // Passing the user data to the profile page via state
      });
    }
  };

  // Handle saving edited row to Firestore
  const handleSaveRow = async (id: string) => {
    const rowToUpdate = rows.find((row) => row.id === id);
    if (rowToUpdate) {
      try {
        const { id, ...rowWithoutId } = rowToUpdate;
        await updateDoc(
          doc(db, "clients", id),
          rowWithoutId as Omit<RowData, "id">
        );
        setEditingRowId(null);
      } catch (error) {
        console.error("Error updating document: ", error);
      }
    }
  };

  // Handle navigating to user details page
  const handleRowClick = (clientid: string) => {
    navigate(`/user/${clientid}`);
  };

  // Handle opening the action menu
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedRowId(id);
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

  // Handle checkbox selection
  const handleCheckboxChange = (id: string) => {
    const newSelectedRows = new Set(selectedRows);
    if (newSelectedRows.has(id)) {
      newSelectedRows.delete(id);
    } else {
      newSelectedRows.add(id);
    }
    setSelectedRows(newSelectedRows);
  };

  // Filter rows based on search query
  let visibleRows = rows.filter(
    (row) =>
      fields.some((field) => {
        const fieldValue = field.compute
          ? field.compute(row)
          : row[field.key as keyof RowData];
        return (
          fieldValue &&
          fieldValue
            .toString()
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );
      })
  );

  return (
    <Box className="box">
      {/* Fixed Container for Search Bar and Create Client Button */}
      <div
        style={{
          position: "fixed",
          width: "90vw",
          zIndex: 1,
          backgroundColor: "#fff",
          padding: "16px 0",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#666666",
                zIndex: 1,
              }}
              size={20}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="SEARCH"
              style={{
                width: "100%",
                height: "60px",
                backgroundColor: "#EEEEEE",
                border: "none",
                borderRadius: "30px",
                padding: "0 48px",
                fontSize: "16px",
                color: "#333333",
                boxSizing: "border-box",
              }}
            />
            <Filter
              style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#666666",
                zIndex: 1,
              }}
              size={20}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "start", gap: "2%" }}>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => setSearchQuery("")}
              className="view-all"
              style={{
                whiteSpace: "nowrap",
                padding: "0% 2%",
                borderRadius: "5px",
                width: "10%",
              }}
            >
              Driver List
            </Button>
            <Button
              variant="contained"
              disabled={selectedRows.size <= 0}
              onClick={() => {
                setPopupMode("Driver");
              }}
              className="view-all"
              sx={{
                whiteSpace: "nowrap",
                padding: "0% 2%",
                borderRadius: "5px",
                width: "10%",
                backgroundColor: (selectedRows.size <= 0 ? "gray" : "#257E68") + " !important",
              }}
            >
              Assign Driver
            </Button>
            <Button
              variant="contained"
              color="secondary"
              className="view-all"
              onClick={() => {
                setPopupMode("Time");
              }}
              disabled={selectedRows.size <= 0}
              sx={{
                whiteSpace: "nowrap",
                padding: "0% 2%",
                borderRadius: "5px",
                width: "10%",
                backgroundColor: (selectedRows.size <= 0 ? "gray" : "#257E68") + " !important",
              }}
            >
              Assign Time
            </Button>
          </div>
        </div>
      </div>

      {/* Controls and Create Client Button */}
      <div
        style={{
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          paddingTop: "20vh",
          paddingBottom: "2vh",
        }}
      >
        {/* Spreadsheet Table */}
        <TableContainer component={Paper} style={{ maxHeight: "65vh", overflowY: "auto" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {fields.map((field) => (
                  <TableCell className="table-header" key={field.key}>
                    <h2>{field.label}</h2>
                  </TableCell>
                ))}
                <TableCell className="table-header"></TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    editingRowId === row.id
                      ? "table-row editing-row"
                      : "table-row"
                  }
                >
                  {fields.map((field) => (
                    <TableCell key={field.key}>
                      {field.key === "checkbox" ? (
                        <Checkbox
                          checked={selectedRows.has(row.id)}
                          onChange={() => handleCheckboxChange(row.id)}
                          sx={{
                            color: "gray",
                            "&.Mui-checked": {
                              color: "#257E68",
                            },
                            "&:hover": {
                              backgroundColor: "rgba(37, 126, 104, 0.1)",
                            },
                          }}
                        />
                      ) : editingRowId === row.id ? (
                        field.key === "fullname" ? (
                          <>
                            <TextField
                              placeholder="First Name"
                              value={row.firstName}
                              variant="outlined"
                              size="small"
                              style={{ marginRight: "8px" }}
                            />
                            <TextField
                              placeholder="Last Name"
                              value={row.lastName}
                              variant="outlined"
                              size="small"
                            />
                          </>
                        ) : isRegularField(field) ? (
                          <TextField
                            type={field.type}
                            value={row[field.key]}
                            variant="outlined"
                            size="small"
                          />
                        ) : null
                      ) : field.key === "fullname" ? (
                        field.compute ? (
                          field.compute(row)
                        ) : (
                          `${row.firstName} ${row.lastName}`
                        )
                      ) : (
                        field.compute ? field.compute(row) : row[field.key]
                      )}
                    </TableCell>
                  ))}
                  <TableCell style={{ textAlign: "right" }}>
                    {editingRowId === row.id ? (
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        onClick={() => handleSaveRow(row.id)}
                        style={{ marginRight: "8px" }}
                      >
                        Save
                      </Button>
                    ) : (
                      <IconButton onClick={(e) => handleMenuOpen(e, row.id)}>
                        <MoreVertIcon />
                      </IconButton>
                    )}
                    <Menu
                      anchorEl={menuAnchorEl}
                      open={Boolean(menuAnchorEl) && selectedRowId === row.id}
                      onClose={handleMenuClose}
                    >
                      <MenuItem onClick={() => handleEditRow(row.id)}>
                        <EditIcon fontSize="small" /> Edit
                      </MenuItem>
                      <MenuItem onClick={() => handleDeleteRow(row.id)}>
                        <DeleteIcon fontSize="small" /> Delete
                      </MenuItem>
                    </Menu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      {/* Popup */}
      <Dialog open={innerPopup} onClose={() => setPopupMode("")}>
        <DialogTitle>{popupMode == "Time" ? "Select a time": "Assign a Driver"}</DialogTitle>
        <DialogContent>
          {popupMode === "Driver" ? (
            <Autocomplete
              freeSolo
              options={drivers} 
              getOptionLabel={(driver) => (typeof driver === "string" ? driver : driver.name)} 
              onChange={(event, value) => {
                if (value && typeof value !== "string") {
                  console.log("Selected Driver ID:", value.id); 
                }
              }}
              onInputChange={(event, newValue) => setDriverSearchQuery(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  variant="outlined"
                  placeholder="Search drivers..."
                  value={driverSearchQuery}
                  onChange={(e) => setDriverSearchQuery(e.target.value)}
                />
              )}
              PaperComponent={({ children }) => (
                <Paper elevation={3}>{children}</Paper>
              )}
              noOptionsText="No drivers found"
            />
          ) : popupMode === "Time" ? (
            <DialogContent>
                  <TextField
                    label="Select Time"
                    type="time"
                    value={time}
                    onChange={handleTimeChange}
                    InputLabelProps={{
                      shrink: true,
                    }}
                    fullWidth
                    variant="outlined"
                  />
            </DialogContent>
          ) : (
            ""
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPopupMode("")}>CANCEL</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeliverySpreadsheet;