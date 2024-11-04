import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
} from "firebase/firestore";

// Define TypeScript types for row data
interface RowData {
  id: string;
  clientid: string;
  firstname: string;
  lastname: string;
  phone: string;
  housenumber: string;
  streetname: string;
  zipcode: string;
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
    key: keyof Omit<RowData, "id" | "firstname" | "lastname">;
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
    compute: (data: RowData) => `${data.lastname}, ${data.firstname}`,
  },
  { key: "phone", label: "Phone", type: "text" },
  { key: "housenumber", label: "House Number", type: "text" },
  { key: "streetname", label: "Street Name", type: "text" },
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
  /* 
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newRow, setNewRow] = useState<Omit<RowData, "id">>({
    clientid: "",
    firstname: "",
    lastname: "",
    phone: "",
    housenumber: "",
    streetname: "",
    zipcode: "",
    dietaryRestriction: "",
  });
  */ // Commented out modal-related state variables

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  /* 
  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
    field: keyof Omit<RowData, "id">
  ) => {
    setNewRow({ ...newRow, [field]: e.target.value });
  };
  
  const handleAddRow = async () => {
    if (newRow.firstname && newRow.lastname) {
      try {
        const docRef = await addDoc(collection(db, "clients"), newRow);
        setRows([...rows, { id: docRef.id, ...newRow }]);
        setNewRow({
          clientid: "",
          firstname: "",
          lastname: "",
          phone: "",
          housenumber: "",
          streetname: "",
          zipcode: "",
          dietaryRestriction: "",
        });
        setIsModalOpen(false);
      } catch (error) {
        console.error("Error adding document: ", error);
      }
    } else {
      alert("First Name and Last Name are required.");
    }
  };
  */ // Commented out modal-related functions

  const navigate = useNavigate();

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

  // Handle deleting a row from Firestore
  const handleDeleteRow = async (id: string) => {
    try {
      await deleteDoc(doc(db, "clients", id));
      setRows(rows.filter((row) => row.id !== id));
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  // Handle initiating edit mode for a row
  const handleEditRow = (id: string) => {
    setEditingRowId(id);
    setMenuAnchorEl(null);
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
  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    id: string
  ) => {
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
      if (a.firstname === b.firstname) {
        return sortOrder === "asc"
          ? a.lastname.localeCompare(b.lastname)
          : b.lastname.localeCompare(a.lastname);
      }
      return sortOrder === "asc"
        ? a.firstname.localeCompare(b.firstname)
        : b.firstname.localeCompare(a.firstname);
    });
    setRows(sortedRows);
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  // Filter rows based on search query
  const visibleRows = rows.filter(
    (row) =>
      fields.some((field) => {
        const fieldValue = field.compute
          ? field.compute(row)
          : row[field.key as keyof RowData];
        return (
          fieldValue &&
          fieldValue.toString().toLowerCase().includes(searchQuery.toLowerCase())
        );
      }) ||
      row.dietaryRestriction.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.zipcode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* 
  // Open the modal for creating a new client
  const openModal = () => {
    setIsModalOpen(true);
  };
  
  // Close the modal and reset newRow state
  const closeModal = () => {
    setIsModalOpen(false);
    setNewRow({
      clientid: "",
      firstname: "",
      lastname: "",
      phone: "",
      housenumber: "",
      streetname: "",
      zipcode: "",
      dietaryRestriction: "",
    });
  };
  */ // Commented out modal-related functions

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
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <button
              style={{
                background: "#2E5B4C",
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: "24px", // Make it oval
                cursor: "pointer",
              }}
            >
              VIEW ALL
            </button>
            <button
              style={{
                background: "transparent",
                color: "#666",
                padding: "8px 16px",
                border: "1px solid #666", // Added border for visibility
                borderRadius: "24px", // Make it oval
                cursor: "pointer",
              }}
            >
              TYPE
            </button>
            <button
              style={{
                background: "transparent",
                color: "#666",
                padding: "8px 16px",
                border: "1px solid #666", // Added border for visibility
                borderRadius: "24px", // Make it oval
                cursor: "pointer",
              }}
            >
              LOCATION
            </button>
          </div>

          <Button
            variant="contained"
            color="primary"
            /* onClick={openModal} */ // Removed onClick handler
            className="create-client"
            style={{
              backgroundColor: "#2E5B4C",
              whiteSpace: "nowrap", // Prevent text wrapping
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
                              value={row.firstname}
                              onChange={(e) =>
                                handleEditInputChange(
                                  e,
                                  row.id,
                                  "firstname"
                                )
                              }
                              variant="outlined"
                              size="small"
                              style={{ marginRight: "8px" }}
                            />
                            <TextField
                              placeholder="Last Name"
                              value={row.lastname}
                              onChange={(e) =>
                                handleEditInputChange(
                                  e,
                                  row.id,
                                  "lastname"
                                )
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
                        field.compute
                          ? field.compute(row)
                          : `${row.firstname} ${row.lastname}`
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
                      <IconButton
                        onClick={(e) => handleMenuOpen(e, row.id)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    )}
                    <Menu
                      anchorEl={menuAnchorEl}
                      open={
                        Boolean(menuAnchorEl) && selectedRowId === row.id
                      }
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

        {/* 
        // Create Client Modal
        <Dialog open={isModalOpen} onClose={closeModal}>
          <DialogTitle>Create New Client</DialogTitle>
          <DialogContent>
            <TextField
              placeholder="First Name"
              value={newRow.firstname}
              onChange={(e) => handleInputChange(e, "firstname")}
              type="text"
              variant="outlined"
              size="small"
              fullWidth
              margin="dense"
            />
            <TextField
              placeholder="Last Name"
              value={newRow.lastname}
              onChange={(e) => handleInputChange(e, "lastname")}
              type="text"
              variant="outlined"
              size="small"
              fullWidth
              margin="dense"
            />
            <TextField
              placeholder="Client ID"
              value={newRow.clientid}
              onChange={(e) => handleInputChange(e, "clientid")}
              type="text"
              variant="outlined"
              size="small"
              fullWidth
              margin="dense"
            />
            <TextField
              placeholder="Phone"
              value={newRow.phone}
              onChange={(e) => handleInputChange(e, "phone")}
              type="text"
              variant="outlined"
              size="small"
              fullWidth
              margin="dense"
            />
            <TextField
              placeholder="House Number"
              value={newRow.housenumber}
              onChange={(e) => handleInputChange(e, "housenumber")}
              type="text"
              variant="outlined"
              size="small"
              fullWidth
              margin="dense"
            />
            <TextField
              placeholder="Street Name"
              value={newRow.streetname}
              onChange={(e) => handleInputChange(e, "streetname")}
              type="text"
              variant="outlined"
              size="small"
              fullWidth
              margin="dense"
            />
            <TextField
              placeholder="Zip Code"
              value={newRow.zipcode}
              onChange={(e) => handleInputChange(e, "zipcode")}
              type="text"
              variant="outlined"
              size="small"
              fullWidth
              margin="dense"
            />
            <TextField
              placeholder="Dietary Restriction"
              value={newRow.dietaryRestriction}
              onChange={(e) => handleInputChange(e, "dietaryRestriction")}
              type="text"
              variant="outlined"
              size="small"
              fullWidth
              margin="dense"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeModal} color="secondary">
              Cancel
            </Button>
            <Button
              onClick={handleAddRow}
              color="primary"
              variant="contained"
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
        */} {/* Commented out modal JSX */}
      </div>
    </Box>
  );
};

export default Spreadsheet;
