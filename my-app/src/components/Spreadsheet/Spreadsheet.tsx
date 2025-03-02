import React, { useState, useEffect} from "react";
import { useNavigate} from "react-router-dom";
import { db } from "../../auth/firebaseConfig"; // Ensure the correct path
import { Search, Filter } from "lucide-react";
import "./Spreadsheet.css";
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
  /* Dialog, DialogTitle, DialogContent, DialogActions, */ // Commented out modal components
  Menu,
  MenuItem,
  TextField,
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
  streetName?: string;
  zipCode?: number;
  dietaryRestriction: string;
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
      key: keyof Omit<RowData, "id" | "firstName" | "lastName">;
      label: string;
      type: string;
      compute?: never;
    };

// Define fields for table columns
const fields: Field[] = [
  {
    key: "fullname",
    label: "Name",
    type: "text",
    compute: (data: RowData) => `${data.lastName}, ${data.firstName}`,
  },
  { key: "phone", label: "Phone", type: "text" },
  { key: "houseNumber", label: "House Number", type: "text" },
  { key: "streetName", label: "Street Name", type: "text" },
  { key: "zipCode", label: "Zip Code", type: "text"},
];

// Type Guard to check if a field is a regular field
const isRegularField = (
  field: Field
): field is Extract<Field, { key: keyof RowData }> => {
  return field.key !== "fullname";
};

const Spreadsheet: React.FC = () => {
  const [rows, setRows] = useState<RowData[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  const navigate = useNavigate();
  
  //Route Protection
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user:any) => {
      if (!user) {
        console.log("No user is signed in, redirecting to /");
        navigate("/");
      } 
    });
  
    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, [navigate]);
    
  
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
        state: { userData: rowToEdit },  // Passing the user data to the profile page via state
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
    navigate("/profile")
  }
  
  
  // Filter rows based on search query
  const visibleRows = rows.filter(
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
      }) ||
      row.dietaryRestriction
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  

  return (
    <Box className="box">
      {/* Common Parent Container */}
      <div
        style={{
          maxWidth: "1050px", // Set the maximum width
          margin: "0 auto", // Center horizontally
          padding: "20px",
        }}
      >
        {/* Search Bar */}
        <div
          style={{
            position: "relative",
            width: "100%",
            marginBottom: "20px",
            boxSizing: "border-box",
          }}
        >
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
              height: "60px", // Increased height from 48px to 60px
              backgroundColor: "#EEEEEE",
              border: "none",
              borderRadius: "30px", // Adjusted border-radius for proportional rounding
              padding: "0 48px",
              fontSize: "16px", // Increased font size for better readability
              color: "#333333",
              boxSizing: "border-box", // Include padding in width
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
        {/* Controls and Create Client Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >


          <Button
            variant="contained"
            color="primary"
            onClick={addClient}
            className="create-client"
            style={{
              backgroundColor: "#2E5B4C",
              whiteSpace: "nowrap",
              padding: "8px 16px",
              minWidth: "auto",
            }}
          >
            + Create Client
          </Button>
        </div>
        {/* Spreadsheet Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                {fields.map((field) => (
                  <TableCell className="table-header" key={field.key}>
                    <h2>
                      {field.label}
                      {field.key === "fullname" && (
                        <IconButton
                          className="sort-arrow"
                          size="small"
                          onClick={toggleSortOrder}
                        >
                          {sortOrder === "asc" ? (
                            <ArrowDropUpIcon />
                          ) : (
                            <ArrowDropDownIcon />
                          )}
                        </IconButton>
                      )}
          {field.key === "phone" && (
            <IconButton
              className="sort-arrow"
              size="small"
              onClick={() => toggleSortOrder2("phone")}
            >
              {sortOrder === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
            </IconButton>
          )}
          {field.key === "houseNumber" && (
            <IconButton
              className="sort-arrow"
              size="small"
              onClick={() => toggleSortOrder2("houseNumber")}
            >
              {sortOrder === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
            </IconButton>
          )}
          {field.key === "streetName" && (
            <IconButton
              className="sort-arrow"
              size="small"
              onClick={() => toggleSortOrder2("streetName")}
            >
              {sortOrder === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
            </IconButton>
          )}
          {field.key === "zipCode" && (
            <IconButton
              className="sort-arrow"
              size="small"
              onClick={() => toggleSortOrder2("zipCode")}
            >
              {sortOrder === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
            </IconButton>
          )}
                    </h2>
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
                      {editingRowId === row.id ? (
                        field.key === "fullname" ? (
                          <>
                            <TextField
                              placeholder="First Name"
                              value={row.firstName}
                              onChange={(e) =>
                                handleEditInputChange(e, row.id, "firstName")
                              }
                              variant="outlined"
                              size="small"
                              style={{ marginRight: "8px" }}
                            />
                            <TextField
                              placeholder="Last Name"
                              value={row.lastName}
                              onChange={(e) =>
                                handleEditInputChange(e, row.id, "lastName")
                              }
                              variant="outlined"
                              size="small"
                            />
                          </>
                        ) : isRegularField(field) ? (
                          <TextField
                            type={field.type}
                            value={row[field.key]}
                            onChange={(e) =>
                              handleEditInputChange(
                                e,
                                row.id,
                                field.key as keyof RowData
                              )
                            }
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
                        row[field.key]
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
                        <SaveIcon fontSize="small" /> Save
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
    </Box>
  );
};

export default Spreadsheet;
