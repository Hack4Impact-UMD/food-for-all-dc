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
  Select,
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
      other: string[];
      softFood: boolean;
      vegan: boolean;
      vegetarian: boolean;
    };
  };
  ethnicity: string;

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
      key: keyof Omit<RowData, "id" | "firstName" | "lastName" | "deliveryDetails">;
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
    }
  | {
    key: "custom";
    label: string;
    type: "text";
    compute: (data: RowData, customKey: keyof RowData) => string;
  };
  


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

  const [customProperty, setCustomProperty] = useState<keyof RowData>("ethnicity");
  
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
      const { dietaryRestrictions } = data.deliveryDetails;
      if (dietaryRestrictions.halal) restrictions.push("Halal");
      if (dietaryRestrictions.kidneyFriendly) restrictions.push("Kidney Friendly");
      if (dietaryRestrictions.lowSodium) restrictions.push("Low Sodium");
      if (dietaryRestrictions.lowSugar) restrictions.push("Low Sugar");
      if (dietaryRestrictions.microwaveOnly) restrictions.push("Microwave Only");
      if (dietaryRestrictions.noCookingEquipment) restrictions.push("No Cooking Equipment");
      if (dietaryRestrictions.softFood) restrictions.push("Soft Food");
      if (dietaryRestrictions.vegan) restrictions.push("Vegan");
      if (dietaryRestrictions.vegetarian) restrictions.push("Vegetarian");
      if (dietaryRestrictions.foodAllergens.length > 0) restrictions.push(...dietaryRestrictions.foodAllergens);
      if (dietaryRestrictions.other.length > 0) restrictions.push(...dietaryRestrictions.other);
      return restrictions.length > 0 ? restrictions.join(", ") : "None";
    },
  },
  {
    key: "deliveryDetails.deliveryInstructions",
    label: "Delivery Instructions",
    type: "text",
    compute: (data: RowData) => data.deliveryDetails.deliveryInstructions || "None",
  },
  {
    key: "custom",
    label: customProperty.toUpperCase(), // e.g., "DOB" or "LANGUAGE"
    type: "text",
    compute: (data: RowData, key) => {
      // Return the custom value based on the selected key
      return data[key]?.toString() ?? "N/A";
    },
  },
];  
    
  
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
    console.log("hello")
    console.log(`This is the new search${event.target.value}`)
    console.log(event.target.value)
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
  
  //  THIS IS WHERE I NEED TO BE EDITING RIGHT NOW
  // Filter rows based on search query

  let visibleRows = rows.filter(
    (row) =>
      fields.some((field) => {
        let fieldValue: any;
        if (field.key === "custom") {
          // Pass the custom property key (e.g., "dob", "language") to the compute function
          fieldValue = field.compute ? field.compute(row, customProperty) : row[customProperty];
        } else { 
          // Assign to the outer fieldValue rather than creating a new variable
          fieldValue = field.compute
            ? field.compute(row)
            : row[field.key as keyof RowData];
        }
        return (
          fieldValue &&
          fieldValue.toString().toLowerCase().includes(searchQuery.toLowerCase())
        );
      }) 
      // ||
      // row.dietaryRestriction
      //   .toLowerCase()
      //   .includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    console.log("this is search query")
    console.log(searchQuery)
  }, [searchQuery])


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
          <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Button
              variant="contained"
              color="secondary"
              onClick={() => setSearchQuery("")}
              className="view-all"
              style={{
                whiteSpace: "nowrap",
                padding: "0% 2%",
                borderRadius: "30px",
                width:"100px"
              }}
            >
              View All
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={addClient}
              className="create-client"
              style={{
                backgroundColor: "#2E5B4C",
                whiteSpace: "nowrap",
                padding: "8px 16px",
                borderRadius: "30px",
              }}
            >
              + Create Client
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
        <TableContainer component={Paper} style={{maxHeight: "65vh", overflowY: "auto" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {fields.map((field) => (
                  <TableCell className="table-header" key={field.key}>
                    {field.key === "custom" ? (
          // Render dropdown for custom column label
          <Select
            value={customProperty}
            onChange={(e) => setCustomProperty(e.target.value as keyof RowData)}
          >
            <MenuItem value="ethnicity">Ethnicity</MenuItem>
            <MenuItem value="language">Language</MenuItem>
            <MenuItem value="dob">DOB</MenuItem>
            <MenuItem value="gender">Gender</MenuItem>
            <MenuItem value="zipCode">Zip Code</MenuItem>
            <MenuItem value="streetName">Street Name</MenuItem>
            <MenuItem value="ward">Ward</MenuItem>
            <MenuItem value="none">None</MenuItem>
            
          </Select>
        ) : (
          <h2>{field.label}</h2>
        )}
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
            field.compute ? (field.key === "custom" ? field.compute(row, customProperty) : field.compute(row)) : row[field.key]
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
  </Box>
  );
};

export default Spreadsheet;
