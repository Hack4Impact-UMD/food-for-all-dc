// ...existing code...

// Place helper functions after RowData type and StyleChip definition

// Import allowedPropertyKeys from useCustomColumns for single source of truth
import { allowedPropertyKeys } from "../../hooks/useCustomColumns";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SaveIcon from "@mui/icons-material/Save";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { styled } from "@mui/material/styles";
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
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  DialogContentText,
} from "@mui/material";

// StyleChip definition for custom column rendering
const StyleChip = styled(Chip)(({ theme }) => ({
  fontWeight: 500,
  fontSize: "0.85rem",
  backgroundColor: theme.palette.primary.light,
  color: theme.palette.primary.contrastText,
  borderRadius: 8,
  padding: "0 8px",
  margin: "2px 2px 2px 0",
  cursor: "pointer",
  '&:hover': {
    backgroundColor: theme.palette.primary.main,
  },
}));
import { onAuthStateChanged } from "firebase/auth";
import { writeBatch, doc } from "firebase/firestore";
import { Filter, Search } from "lucide-react";
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../auth/firebaseConfig";
import { useCustomColumns } from "../../hooks/useCustomColumns";
import ClientService from "../../services/client-service";
import DeliveryService from "../../services/delivery-service";
import { exportQueryResults, exportAllClients } from "./export";
import "./Spreadsheet.css";
import DeleteClientModal from "./DeleteClientModal";

// Define TypeScript types for row data
export interface RowData {
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
  tags?: string[];
  referralEntity?: {
    id: string;
    name: string;
    organization: string;
  };
  adults?: number;
  children?: number;
  deliveryFreq?: string;
  gender?: "Male" | "Female" | "Other";
  language?: string;
  notes?: string;
  tefapCert?: string;
  dob?: string;
  ward?: string;
  zipCode?: string;
}
// Place helper functions after RowData type and StyleChip definition
function getCustomColumnValue(row: RowData, propertyKey: string): string {
  if (!propertyKey || propertyKey === "none") return "";
  if (propertyKey.includes(".")) {
    const keys = propertyKey.split(".");
    let value: any = row;
    for (const k of keys) {
      value = value && value[k as keyof typeof value];
      if (value === undefined) return "";
    }
    return value !== undefined && value !== null ? value.toString() : "";
  }
  const val = row[propertyKey as keyof RowData];
  return val !== undefined && val !== null ? val.toString() : "";
}

function getCustomColumnDisplay(row: RowData, propertyKey: string): React.ReactNode {
  if (!propertyKey || propertyKey === "none") return "N/A";
  // Handle referralEntity (object)
  if (propertyKey === "referralEntity" && row.referralEntity) {
    const entity = row.referralEntity;
    return `${entity?.name ?? 'N/A'}, ${entity?.organization ?? 'N/A'}`;
  }
  // Handle tags (array)
  if (propertyKey === "tags" && Array.isArray(row.tags)) {
    return row.tags.length > 0
      ? row.tags.map((tag: string, i: number) => (
          <StyleChip
            key={i}
            label={tag}
            size="small"
            onClick={(e: React.MouseEvent) => e.preventDefault()}
            sx={{ mb: 0.5, mr: 0.5 }}
          />
        ))
      : "N/A";
  }
  // Handle nested keys
  if (propertyKey.includes(".")) {
    const keys = propertyKey.split(".");
    let value: any = row;
    for (const k of keys) {
      value = value && value[k as keyof typeof value];
      if (value === undefined) return "N/A";
    }
    return value !== undefined && value !== null ? value.toString() : "N/A";
  }
  // Default: direct value
  const value = row[propertyKey as keyof RowData];
  return value !== undefined && value !== null ? value.toString() : "N/A";
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOption, setExportOption] = useState<"QueryResults" | "AllClients" | null>(null);
  const [clientIdToDelete, setClientIdToDelete] = useState<string | null>(null);

  // Track which column is currently being sorted
  const [sortedColumn, setSortedColumn] = useState<string>(() => {
    // Always default to fullname (Name) column, ignore persisted value
    return "fullname";
  });

  //default to asc if not found in local store
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    // Always default to ascending order, ignore persisted value
    return "asc";
  });

  // Initialize default sorting on first load
  useEffect(() => {
    // Always set default sort to fullname ascending on first load
    setSortedColumn("fullname");
    setSortOrder("asc");
  }, []);

  const navigate = useNavigate();

  // ADDED

  const {
    customColumns,
    handleAddCustomColumn,
    handleCustomHeaderChange,
    handleRemoveCustomColumn,
    handleCustomColumnChange,
  } = useCustomColumns({ page: "Spreadsheet" });

// ...existing code...





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

  //store sort order and column locally
  useEffect(() => {
    localStorage.setItem("ffaSortOrderSpreadsheet", sortOrder);
    localStorage.setItem("ffaSortedColumnSpreadsheet", sortedColumn);
  }, [sortOrder, sortedColumn]);

  // Compute sorted rows using useMemo to ensure data is always sorted
  const safeRows = Array.isArray(rows) ? rows : [];
  const sortedRows = useMemo(() => {
    if (safeRows.length === 0) return safeRows;
    if (sortedColumn === "deliveryDetails.dietaryRestrictions") {
      const getDietString = (row: any) => {
        const dr = row.deliveryDetails?.dietaryRestrictions;
        if (!dr || typeof dr !== 'object') return "None";
        const keys = [
          "halal", "kidneyFriendly", "lowSodium", "lowSugar", "microwaveOnly", "noCookingEquipment", "softFood", "vegan", "vegetarian", "heartFriendly"
        ];
        const items = keys.filter(k => dr[k]).map(k => k);
        if (Array.isArray(dr.foodAllergens) && dr.foodAllergens.length > 0) items.push("foodAllergens");
        if (Array.isArray(dr.other) && dr.other.length > 0) items.push("other");
        if (dr.otherText && dr.otherText.trim() !== "") items.push(dr.otherText.trim());
        // Treat empty restrictions as 'None'
        if (items.length === 0) return "None";
        const joined = items.join(", ");
        if (!joined || joined.trim() === "") return "None";
        return joined;
      };
      const withChips: any[] = [];
      const withNone: any[] = [];
      for (const row of safeRows) {
  if (getDietString(row) === "None") {
          withNone.push(row);
        } else {
          withChips.push(row);
        }
      }
      // Sort chips group alphabetically by diet string
      withChips.sort((a, b) => {
        const dietA = getDietString(a);
        const dietB = getDietString(b);
        return sortOrder === "asc"
          ? dietA.localeCompare(dietB, undefined, { sensitivity: 'base' })
          : dietB.localeCompare(dietA, undefined, { sensitivity: 'base' });
      });
      // Sort 'None' group by name for stable order
      const getFullName = (row: any) => {
        const lastName = (row.lastName || "").trim();
        const firstName = (row.firstName || "").trim();
        if (!lastName && !firstName) return "";
        if (!lastName) return firstName.toLowerCase();
        if (!firstName) return lastName.toLowerCase();
        return `${lastName}, ${firstName}`.toLowerCase();
      };
      withNone.sort((a, b) => {
        const nameA = getFullName(a);
        const nameB = getFullName(b);
        return sortOrder === "asc"
          ? nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
          : nameB.localeCompare(nameA, undefined, { sensitivity: 'base' });
      });
      // Concatenate groups: chips first for asc, chips last for desc
      return sortOrder === "asc"
        ? [...withChips, ...withNone]
        : [...withNone, ...withChips];
    }
    return [...safeRows].sort((a, b) => {

      // ...existing code for other columns...
      let valueA = "";
      let valueB = "";

      const getFullName = (row: RowData) => {
        const lastName = (row.lastName || "").trim();
        const firstName = (row.firstName || "").trim();
        if (!lastName && !firstName) return "";
        if (!lastName) return firstName.toLowerCase();
        if (!firstName) return lastName.toLowerCase();
        return `${lastName}, ${firstName}`.toLowerCase();
      };

      // ...existing code for switch/case and default sorting...
      switch (sortedColumn) {
        case "fullname":
          valueA = getFullName(a);
          valueB = getFullName(b);
          break;
        case "address":
          valueA = (a.address || "").toLowerCase();
          valueB = (b.address || "").toLowerCase();
          break;
        case "phone":
          valueA = (a.phone || "").toLowerCase();
          valueB = (b.phone || "").toLowerCase();
          break;
        case "deliveryDetails.deliveryInstructions":
          valueA = (a.deliveryDetails?.deliveryInstructions || "none").toLowerCase();
          valueB = (b.deliveryDetails?.deliveryInstructions || "none").toLowerCase();
          break;
        default: {
          const rawValueA = a[sortedColumn as keyof RowData];
          const rawValueB = b[sortedColumn as keyof RowData];
          const numA = Number(rawValueA);
          const numB = Number(rawValueB);
          const isNumericA = !isNaN(numA) && isFinite(numA) && rawValueA !== null && rawValueA !== undefined && String(rawValueA).trim() !== "";
          const isNumericB = !isNaN(numB) && isFinite(numB) && rawValueB !== null && rawValueB !== undefined && String(rawValueB).trim() !== "";
          if (isNumericA && isNumericB) {
            const result = sortOrder === "asc" ? numA - numB : numB - numA;
            return result;
          }
          const getSortableValue = (value: any): string => {
            if (value === null || value === undefined) return "";
            if (Array.isArray(value)) return value.join(", ").toLowerCase();
            if (typeof value === 'object') {
              if (value.name || value.organization) {
                return `${value.name || ""} ${value.organization || ""}`.trim().toLowerCase();
              }
              return JSON.stringify(value).toLowerCase();
            }
            return String(value).toLowerCase();
          };
          valueA = getSortableValue(rawValueA);
          valueB = getSortableValue(rawValueB);
          break;
        }
      }
      if (!valueA && !valueB) return 0;
      if (!valueA) return sortOrder === "asc" ? -1 : 1;
      if (!valueB) return sortOrder === "asc" ? 1 : -1;
      const result = sortOrder === "asc"
        ? valueA.localeCompare(valueB, undefined, { sensitivity: 'base' })
        : valueB.localeCompare(valueA, undefined, { sensitivity: 'base' });
      return result;
    });
  }, [rows, sortOrder, sortedColumn]);

  // Define fields for table columns
  // Always include 'deliveryDetails.dietaryRestrictions' in allowedPropertyKeys and fields for custom columns
  const fields: Field[] = [
    {
      key: "fullname",
      label: "Name",
      type: "text",
      compute: (data: RowData) => `${data.lastName}, ${data.firstName}`,
    },
    { key: "address", label: "Address", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    // Do NOT remove this field, always keep it for custom columns
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
        if (dietaryRestrictions.heartFriendly) restrictions.push("Heart Friendly");
        if (Array.isArray(dietaryRestrictions.foodAllergens) && dietaryRestrictions.foodAllergens.length > 0)
          restrictions.push(...dietaryRestrictions.foodAllergens);
        if (Array.isArray(dietaryRestrictions.other) && dietaryRestrictions.other.length > 0)
          restrictions.push(...dietaryRestrictions.other);
        if (dietaryRestrictions.otherText && dietaryRestrictions.otherText.trim() !== "")
          restrictions.push(dietaryRestrictions.otherText.trim());
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
        const { clients } = await clientService.getAllClientsForSpreadsheet();
        // ...existing code...
        // No default sorting - let our sortedRows useMemo handle all sorting
        setRows(clients);
      } catch (error) {
        console.error("Error fetching data: ", error);
      }
    };
    fetchData();
  }, []);

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // ...existing code...
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

  const handleDeleteRow = async (id: string) => {
    const batch = writeBatch(db);

    try {
      console.log(`Starting deletion process for client: ${id}`);

      const deliveryService = DeliveryService.getInstance();
      const clientDeliveries = await deliveryService.getEventsByClientId(id);

      console.log(`Found ${clientDeliveries.length} deliveries to delete for client ${id}`);

      clientDeliveries.forEach(delivery => {
        batch.delete(doc(db, 'events', delivery.id));
      });

      batch.delete(doc(db, 'clients', id));

      await batch.commit();

      console.log(`Successfully deleted client ${id} and ${clientDeliveries.length} deliveries`);
      setRows(rows.filter((row) => row.uid !== id));

    } catch (error) {
      console.error("Error deleting client and deliveries: ", error);
    }
  };

  // Handle editing a row
  const handleEditRow = (id: string) => {
    // ...existing code...
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
        // ...existing code...
        await clientService.updateClient(uid, rowWithoutIds as Omit<RowData, "id" | "uid">);
        setEditingRowId(null);
      } catch (error) {
        console.error("Error updating document: ", error);
      }
    }
  };

  // Handle navigating to user details page
  const handleRowClick = (uid: string) => {
    // ...existing code...
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

  // ...existing code...
  const handleExportClick = () => {
    setExportDialogOpen(true);
  };

  const parseSearchQuery = (query: string) => {
    //match either quoted phrases or unquoted terms
    const regex = /(?:("|')((?:\\\1|.)+?)\1)|([^\s"']+)/g;
    const matches = [];
    let match;
    
    while ((match = regex.exec(query)) !== null) {
      //push either the quoted content or the unquoted term 
      matches.push(match[2] || match[3]);
    }
    
    return matches;
  };

    //function to determine if a search is incomplete or not
    const hasUnclosedQuotes = (str: string): boolean => {
      let singleQuotes = 0;
      let doubleQuotes = 0;
      let prevChar = '';
      
      for (const char of str) {
        if (char === "'" && prevChar !== '\\') {
          singleQuotes++;
        } else if (char === '"' && prevChar !== '\\') {
          doubleQuotes++;
        }
        prevChar = char;
      }
      
      return (singleQuotes % 2 !== 0) || (doubleQuotes % 2 !== 0);
    };

  // Display only the rows that match the search query - combining advanced search with sorted rows
  const filteredRows = sortedRows.filter((row) => {
    const trimmedSearchQuery = searchQuery.trim();
    if (!trimmedSearchQuery) {
      return true; // Show all if search is empty
    }

    //if search is empty or has unclosed quotes then show all rows
    if (!trimmedSearchQuery || hasUnclosedQuotes(trimmedSearchQuery)) {
      return true;
    }

    //parse the search query into individual terms
    const searchTerms = parseSearchQuery(trimmedSearchQuery);

    //function to check if a value contains the search query string
    const checkStringContains = (value: any, query: string): boolean => {
      if (value === undefined || value === null) {
        return false;
      }
      return String(value).toLowerCase().includes(query.toLowerCase());
    };

    //function to check for numbers, dates, or items in an array
    const checkValueOrInArray = (value: any, query: string): boolean => {
      if (value === undefined || value === null) {
        return false;
      }
      const lowerQuery = query.toLowerCase();
      if (Array.isArray(value)) {
        return value.some(item => String(item).toLowerCase().includes(lowerQuery));
      }
      return String(value).toLowerCase().includes(lowerQuery);
    };

    return searchTerms.every(term => {
      //check if this is a key:value search
      const parts = term.split(/:(.*)/s) 
      let isKeyValueSearch = false;
      let keyword = "";
      let searchValue = "";

      if (parts.length > 1) {
        keyword = parts[0].trim().toLowerCase();
        searchValue = parts[1].trim();
        if (searchValue) {
          isKeyValueSearch = true;
        }
      }

      if (isKeyValueSearch) {
        //key value search logic
        switch (keyword) {
          case "name":
            return checkStringContains(`${row.firstName} ${row.lastName}`, searchValue) ||
                  checkStringContains(row.firstName, searchValue) ||
                  checkStringContains(row.lastName, searchValue);
          case "address":
            return checkStringContains(row.address, searchValue);
          case "phone":
            return checkStringContains(row.phone, searchValue);
          case "dietary restrictions":
          case "dietary": {
            const dietaryField = fields.find(f => f.key === "deliveryDetails.dietaryRestrictions");
            return dietaryField?.compute ? checkStringContains(dietaryField.compute(row), searchValue) : false;
          }
          case "delivery instructions":
          case "instructions": {
            const instructionsField = fields.find(f => f.key === "deliveryDetails.deliveryInstructions");
            return instructionsField?.compute ? checkStringContains(instructionsField.compute(row), searchValue) : false;
          }
          case "ethnicity":
            return checkStringContains(row.ethnicity, searchValue);
          case "adults":
            return checkValueOrInArray((row as any).adults, searchValue);
          case "children":
            return checkValueOrInArray((row as any).children, searchValue);
          case "gender":
            return checkStringContains((row as any).gender, searchValue);
          case "notes":
            return checkStringContains((row as any).notes, searchValue);
          case "referral entity":
          case "referral": {
            const referralEntity = (row as any).referralEntity;
            if (referralEntity && typeof referralEntity === 'object') {
              return checkStringContains(referralEntity.name, searchValue) ||
                    checkStringContains(referralEntity.organization, searchValue);
            }
            return false;
          }
          case "referral entity name":
            return checkStringContains((row as any).referralEntity?.name, searchValue);
          case "referral entity organization":
            return checkStringContains((row as any).referralEntity?.organization, searchValue);
          case "tags":
          case "tag":
            return checkValueOrInArray((row as any).tags, searchValue);
          case "dob":
            return checkValueOrInArray((row as any).dob, searchValue);
          case "ward":
            return checkValueOrInArray((row as any).ward, searchValue);
          case "client id":
          case "clientid":
            return checkValueOrInArray(row.clientid, searchValue) || checkValueOrInArray(row.uid, searchValue);
          case "delivery freq":
          case "delivery frequency":
            return checkStringContains((row as any).deliveryFreq, searchValue);
          case "language":
            return checkStringContains((row as any).language, searchValue);
          case "tefap cert":
          case "tefap":
            return checkStringContains((row as any).tefapCert, searchValue);
          case "zip":
          case "zipcode":
          case "zip code":
            return checkStringContains((row as any).zipCode, searchValue);
          case "house number":
            return checkValueOrInArray(row.houseNumber, searchValue);
          case "coordinates":
            return checkStringContains((row as any).coordinates, searchValue);
          default:
            //check custom columns if keyword matches
            return customColumns.some((col) => {
              if (col.propertyKey !== "none" && col.propertyKey.toLowerCase().includes(keyword)) {
                const fieldValue = row[col.propertyKey as keyof RowData];
                return checkStringContains(fieldValue, searchValue);
              }
              return false;
            });
        }
      } else {
        //global search for this term
        const globalSearchValue = term.toLowerCase();
        
        //check all relevant fields
        if (checkStringContains(`${row.firstName} ${row.lastName}`, globalSearchValue)) return true;
        if (checkStringContains(row.address, globalSearchValue)) return true;
        if (checkStringContains(row.phone, globalSearchValue)) return true;

        const dietaryField = fields.find(f => f.key === "deliveryDetails.dietaryRestrictions");
        if (dietaryField?.compute && checkStringContains(dietaryField.compute(row), globalSearchValue)) return true;

        const instructionsField = fields.find(f => f.key === "deliveryDetails.deliveryInstructions");
        if (instructionsField?.compute && checkStringContains(instructionsField.compute(row), globalSearchValue)) return true;
        
        if (checkStringContains(row.ethnicity, globalSearchValue)) return true;

        const dynamicKeysAndValues: any[] = [
          (row as any).adults, (row as any).children, (row as any).deliveryFreq,
          (row as any).gender, (row as any).language, (row as any).notes,
          (row as any).tefapCert, (row as any).dob, (row as any).ward,
          (row as any).zipCode, row.houseNumber, (row as any).coordinates,
          row.clientid, row.uid
        ];
        if (dynamicKeysAndValues.some(val => checkValueOrInArray(val, globalSearchValue))) return true;

        if (checkValueOrInArray((row as any).tags, globalSearchValue)) return true;

        const referralEntity = (row as any).referralEntity;
        if (referralEntity && typeof referralEntity === 'object') {
          if (checkStringContains(referralEntity.name, globalSearchValue)) return true;
          if (checkStringContains(referralEntity.organization, globalSearchValue)) return true;
        }

        //check custom columns
        const matchesCustomColumn = customColumns.some((col) => {
          if (col.propertyKey !== "none") {
            const fieldValue = row[col.propertyKey as keyof RowData];
            return checkStringContains(fieldValue, globalSearchValue);
          }
          return false;
        });
        if (matchesCustomColumn) return true;
        
        return false;
      }
    });
  });

  const handleExportOptionSelect = (option: "QueryResults" | "AllClients") => {
    setExportOption(option);
    setExportDialogOpen(false);
    if (option === "QueryResults") {
      exportQueryResults(filteredRows, customColumns);
    } else if (option === "AllClients") {
      exportAllClients(sortedRows);
    }
  };

  const handleCancel = () => {
    setExportDialogOpen(false);
    setExportOption(null);
  };

  
  // Handle toggling sort order for any column
  const handleColumnSort = (columnKey: string) => {
    if (sortedColumn === columnKey) {
      // Same column clicked - toggle sort order
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Different column clicked - switch to new column with ascending order
      setSortedColumn(columnKey);
      setSortOrder("asc");
    }
  };

  const addClient = () => {
    navigate("/profile");
  };

  useEffect(() => {
    // ...existing code...
  }, [searchQuery]);

  // Add this debugging function
  useEffect(() => {
    if (sortedRows.length > 0) {
      // ...existing code...
    }
  }, [sortedRows]);

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
        // Remove height and overflowY to prevent outside scrollbar
        mt:0
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
            {/* Export Button */}
            <Button
              variant="contained"
              color="primary"
              onClick={handleExportClick}
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
              Export
            </Button>

            <Dialog open={exportDialogOpen} onClose={handleCancel} maxWidth="xs" fullWidth>
              <DialogTitle>Export Options</DialogTitle>
              <DialogContent sx={{ pt: 3, overflow: "visible" }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleExportOptionSelect("QueryResults")}
                  >
                    Export Query Results
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => handleExportOptionSelect("AllClients")}
                  >
                    Export All Clients
                  </Button>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCancel} color="error">
                  Cancel
                </Button>
              </DialogActions>
            </Dialog>


            <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "flex-end" }}>
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
            </Box>
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
          overflowY: "visible"
        }}
      >
        {/* Mobile Card View for Small Screens */}
        {isMobile ? (
          <Stack spacing={2} sx={{ overflowY: "auto", width: "100%" }}>
            {(Array.isArray(filteredRows) ? filteredRows : []).map((row) => (
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
                    {(() => {
                      const restrictions = fields.find(f => f.key === "deliveryDetails.dietaryRestrictions")?.compute?.(row);
                      if (restrictions === "None") {
                        return <Typography variant="body2" color="text.secondary">None</Typography>;
                      }
                      return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {restrictions?.split(", ").map((restriction, i) => (
                            <Chip
                              key={i}
                              label={restriction}
                              size="small"
                              sx={{
                                backgroundColor: "#e8f5e9",
                                color: "#2E5B4C",
                                fontSize: "0.75rem",
                                height: "24px",
                                fontWeight: 500,
                                border: "1px solid #c8e6c9",
                                "&:hover": {
                                  backgroundColor: "#e8f5e9",
                                  cursor: "default"
                                }
                              }}
                            />
                          ))}
                        </Box>
                      );
                    })()}
                  </Box>
                  {/* Custom columns for mobile */}
                  {customColumns.map((col) => (
                    col.propertyKey !== "none" && (
                      <Box key={col.id}>
                        <Typography variant="body2" color="text.secondary">
                          {col.label || col.propertyKey}
                        </Typography>
                        <Typography variant="body1">
                          {col.propertyKey === "deliveryDetails.dietaryRestrictions"
                            ? fields.find(f => f.key === "deliveryDetails.dietaryRestrictions")?.compute?.(row)
                            : row[col.propertyKey as keyof RowData]?.toString() || "N/A"}
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
                  if (selectedRowId) setClientIdToDelete(selectedRowId);
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
              maxHeight: "60vh",
              overflowY: "auto",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              borderRadius: "12px",
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ position: 'sticky', top: 0, zIndex: 2 }}>
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
                          cursor: "pointer", // All columns are now sortable
                        }}
                        onClick={() => handleColumnSort(field.key)}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#2E5B4C" }}>
                          {field.label}
                        </Typography>
                        {sortedColumn === field.key ? (
                          sortOrder === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />
                        ) : (
                          <UnfoldMoreIcon sx={{ color: "#9E9E9E", fontSize: "1.2rem" }} />
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
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.5}
                        sx={{
                          cursor: col.propertyKey !== "none" ? "pointer" : "default", // Only sortable if column has data
                        }}
                        onClick={() => col.propertyKey !== "none" && handleColumnSort(col.propertyKey)}
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
                            onClick={(e) => e.stopPropagation()} // Prevent sort when clicking dropdown
                          >
                            {[...allowedPropertyKeys].map((key: string) => {
                              let label = key;
                              if (key === "none") label = "None";
                              if (key === "address") label = "Address";
                              if (key === "adults") label = "Adults";
                              if (key === "children") label = "Children";
                              if (key === "deliveryFreq") label = "Delivery Freq";
                              if (key === "deliveryDetails.dietaryRestrictions") label = "Dietary Restrictions";
                              if (key === "ethnicity") label = "Ethnicity";
                              if (key === "gender") label = "Gender";
                              if (key === "language") label = "Language";
                              if (key === "notes") label = "Notes";
                              if (key === "referralEntity") label = "Referral Entity";
                              if (key === "tefapCert") label = "TEFAP Cert";
                              if (key === "tags") label = "Tags";
                              if (key === "dob") label = "DOB";
                              if (key === "ward") label = "Ward";
                              if (key === "zipCode") label = "Zip Code";
                              return <MenuItem key={key} value={key}>{label}</MenuItem>;
                            })}
                          </Select>
                          {/*Add Remove Button*/}
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent sort when clicking remove
                              handleRemoveCustomColumn(col.id);
                            }}
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
                        {/* Show sort icon if this custom column is currently sorted */}
                        {col.propertyKey !== "none" && (
                          sortedColumn === col.propertyKey ? (
                            sortOrder === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />
                          ) : (
                            <UnfoldMoreIcon sx={{ color: "#9E9E9E", fontSize: "1.2rem" }} />
                          )
                        )}
                      </Stack>
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
                {(Array.isArray(filteredRows) ? filteredRows : []).map((row) => (
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
                      <TableCell 
                        key={field.key} 
                        sx={{ 
                          py: 2,
                          // Add word-wrap styles for delivery instructions and dietary restrictions
                          ...(field.key === "deliveryDetails.deliveryInstructions" && {
                            maxWidth: '200px',
                            wordWrap: 'break-word',
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap'
                          })
                        }}
                      >
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
                        ) : (field as any).compute ? (
                          field.key === "deliveryDetails.dietaryRestrictions" ? (
                            (() => {
                              const dr = row.deliveryDetails?.dietaryRestrictions;
                              if (!dr) {
                                return (
                                  <Typography sx={{ fontSize: '0.875rem', color: '#757575', fontStyle: 'italic' }}>None</Typography>
                                );
                              }
                              const chips: { label: string; color: string; border: string; textColor: string }[] = [];
                              // Boolean restrictions (green)
                              [
                                { key: 'halal', label: 'Halal' },
                                { key: 'kidneyFriendly', label: 'Kidney Friendly' },
                                { key: 'lowSodium', label: 'Low Sodium' },
                                { key: 'lowSugar', label: 'Low Sugar' },
                                { key: 'microwaveOnly', label: 'Microwave Only' },
                                { key: 'noCookingEquipment', label: 'No Cooking Equipment' },
                                { key: 'softFood', label: 'Soft Food' },
                                { key: 'vegan', label: 'Vegan' },
                                { key: 'vegetarian', label: 'Vegetarian' },
                                { key: 'heartFriendly', label: 'Heart Friendly' },
                              ].forEach(opt => {
                                // Use type assertion to ensure key is keyof typeof dr
                                if (dr[opt.key as keyof typeof dr]) {
                                  chips.push({ label: opt.label, color: '#e8f5e9', border: '#c8e6c9', textColor: '#2E5B4C' });
                                }
                              });
                              // Allergies (light red)
                              if (Array.isArray(dr.foodAllergens) && dr.foodAllergens.length > 0) {
                                dr.foodAllergens.forEach((allergy: string) => {
                                  if (allergy && allergy.trim()) {
                                    chips.push({ label: allergy, color: '#FFEBEE', border: '#FFCDD2', textColor: '#C62828' });
                                  }
                                });
                              }
                              // Other (light purple)
                              if (dr.otherText && dr.otherText.trim()) {
                                chips.push({ label: dr.otherText, color: '#F3E8FF', border: '#CEB8FF', textColor: '#6C2EB7' });
                              }
                              if (chips.length === 0) {
                                return (
                                  <Typography sx={{ fontSize: '0.875rem', color: '#757575', fontStyle: 'italic' }}>None</Typography>
                                );
                              }
                              return (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: '250px' }}>
                                  {chips.map((chip, i) => (
                                    <Chip
                                      key={i}
                                      label={chip.label}
                                      size="small"
                                      sx={{
                                        backgroundColor: chip.color,
                                        color: chip.textColor,
                                        fontSize: '0.75rem',
                                        height: '20px',
                                        fontWeight: 500,
                                        border: `1px solid ${chip.border}`,
                                        '& .MuiChip-label': { px: 1 },
                                        '&:hover': { backgroundColor: chip.color, cursor: 'default' }
                                      }}
                                    />
                                  ))}
                                </Box>
                              );
                            })()
                          ) : field.key === "deliveryDetails.deliveryInstructions" ? (
                            <div style={{
                              maxWidth: '200px',
                              wordWrap: 'break-word',
                              overflowWrap: 'anywhere',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {(field as any).compute(row)}
                            </div>
                          ) : (
                            (field as any).compute(row)
                          )
                        ) : (
                          row[field.key as keyof RowData]
                        )}
                      </TableCell>
                    ))}

                    {customColumns.map((col) => (
                      <TableCell 
                        key={col.id} 
                        sx={{ 
                          py: 2,
                          ...((col.propertyKey.includes('notes') || col.propertyKey.includes('deliveryInstructions')) && {
                            maxWidth: '200px',
                            wordWrap: 'break-word',
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap'
                          })
                        }}
                      >
                        {editingRowId === row.id ? (
                          col.propertyKey !== "none" ? (
                            <TextField
                              value={getCustomColumnValue(row, col.propertyKey) ?? ""}
                              onChange={(e) =>
                                handleCustomColumnChange(
                                  e,
                                  row.id,
                                  col.propertyKey,
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
                            getCustomColumnDisplay(row, col.propertyKey)
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
                            setClientIdToDelete(row.uid);
                            handleMenuClose();
                          }}
                          sx={{ py: 1.5 }}
                        >
                          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
                        </MenuItem>
                      </Menu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
      {/* Centralized Delete Confirmation Modal */}
      <DeleteClientModal
        handleMenuClose={() => setClientIdToDelete(null)}
        handleDeleteRow={handleDeleteRow}
        open={Boolean(clientIdToDelete)}
        setOpen={(isOpen: boolean) => {
          if (!isOpen) {
            setClientIdToDelete(null);
          }
        }}
        id={clientIdToDelete ?? ""}
      />
    </Box>
  );
};

export default Spreadsheet;
