import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../auth/firebaseConfig"; 
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
  Checkbox,
  TextField,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Autocomplete,
  Grid,
  IconButton,
  Typography,
  DialogContentText,
  Grow,
  Popper,
  MenuItem,
  MenuList,
  Stack,
  ClickAwayListener,
  Menu
} from "@mui/material";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { auth } from "../../auth/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { Close, Add, Edit, Check, Delete } from "@mui/icons-material";
import DriverManagementModal from "../../components/DriverManagementModal";
import { set } from "date-fns";
import { render } from "@testing-library/react";

// Define TypeScript types for row data
interface RowData {
  id: string;
  clientid: string;
  firstName: string;
  lastName: string;
  address: string;
  phone: string;
  tags?: string[];
  ward?: string;
  clusterID?: string; 
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
      width: string;
    }
  | {
      key: "fullname";
      label: "Client";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    }
  | {
      key: keyof Omit<RowData, "id" | "firstName" | "lastName" | "deliveryDetails">;
      label: string;
      type: string;
      compute?: never;
      width: string;
    }
  | {
      key: "tags";
      label: "Tags";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    }
  | {
      key: "assignedDriver";
      label: "Driver";
      type: "text";
      compute: (data: RowData, clusters: Cluster[], drivers: Driver[]) => string;
      width: string;
    }
  | {
      key: "assignedTime";
      label: "Time";
      type: "text";
      compute: (data: RowData, clusters: Cluster[]) => string;
      width: string;
    }
  | {
      key: "deliveryDetails.deliveryInstructions";
      label: "Instructions";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    }
  | {
      key: "phone";
      label: "Phone Number";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    };

interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
}

type DriverOption = Driver | { id: 'edit_list'; name: string; phone: ''; email: '' };

interface Cluster{
  docId: string;
  id: number;
  driver: any;
  time: string;
  deliveries: any[];
}

interface ValidationErrors {
  name?: string;
  phone?: string;
  email?: string;
}

interface DriverFormProps {
  value: Omit<Driver, 'id'>;
  onChange: (field: keyof Omit<Driver, 'id'>, value: string) => void;
  errors: ValidationErrors;
  onClearError: (field: keyof ValidationErrors) => void;
}

// Define fields for table columns
const fields: Field[] = [
  {
    key: "checkbox",
    label: "",
    type: "checkbox",
    width: "5%",
  },
  {
    key: "fullname",
    label: "Client",
    type: "text",
    compute: (data: RowData) => `${data.lastName}, ${data.firstName}`,
    width: "10%"
  },
  {
    key: "tags",
    label: "Tags",
    type: "text",
    compute: (data: RowData) => {
      const tags = data.tags || [];
      return tags.length > 0 ? tags.join(", ") : "None";
    },
    width: "10%"
  },
  { key: "clusterID", label: "Clusters", type: "text", width: "6%" },
  { key: "address", label: "Address", type: "text", width: "12%" },
  {
    key: "phone",
    label: "Phone Number",
    type: "text",
    compute: (data: RowData) => {
      const number = data.phone || "N/A";
      return number;
    },
    width: "12%"
  },
  { key: "ward", label: "Ward", type: "text", width: "10%" },
  {
    key: "assignedDriver", 
    label: "Driver", 
    type: "text",
    compute: (data: RowData, clusters: Cluster[], drivers: Driver[]) => {
      //case where user is not assigned a cluster
      if (!data.clusterID) return "No Cluster assigned";
      
      //find cluster from cluster id
      const cluster = clusters.find(c => c.id.toString() === data.clusterID);
      if (!cluster) return "No Cluster Found";
      
      //check to make sure driver exists
      if (!cluster.driver) return "No Driver Assigned";
      
      //find driver name from driver ref
      if (typeof cluster.driver === 'object' && cluster.driver.id) {
        const driverId = cluster.driver.id;
        const driver = drivers.find(d => d.id === driverId);
        return driver ? driver.name : "Driver Not Found";
      }
      
      return "Driver Not Found";
    },
    width: "10%"
  },
  {
    key: "assignedTime", 
    label: "Time", 
    type: "text",
    compute: (data: RowData, clusters: Cluster[]) => {
      //case where user is not assigned a cluster
      if (!data.clusterID) return "No Cluster assigned";
      
      //find cluster from cluster id
      const cluster = clusters.find(c => c.id.toString() === data.clusterID);
      if (!cluster) return "No Cluster Found";
      
      //check to make sure driver exists
      if(cluster.time){
        const toStandardArr = cluster.time.split(":");
        let hours = Number(toStandardArr[0]);
        let mins = Number(toStandardArr[1]);
        let ampm = "";
        if(hours < 12){
          hours = hours == 0 ? 12: hours
          ampm = "AM";
        }
        else{
          hours = hours == 12 ? 12 : hours%12;
          ampm = "PM";
        }
        return `${hours}:${mins < 10 ? "0": ""}${mins} ${ampm}`
      }
      else{
        return "No Time Assigned"
      }
    },
    width: "10%"
  },
  {
    key: "deliveryDetails.deliveryInstructions",
    label: "Instructions",
    type: "text",
    compute: (data: RowData) => {
      const instructions = data.deliveryDetails.deliveryInstructions || "";
      return instructions;
    },
    width: "15%",
  }
];

// Type Guard to check if a field is a regular field
const isRegularField = (
  field: Field
): field is Extract<Field, { key: keyof RowData }> => {
  return field.key !== "fullname" && 
         field.key !== "tags" && 
         field.key !== "assignedDriver" &&
         field.key !== "assignedTime" &&
         field.key !== "phone" &&
         field.key !== "deliveryDetails.deliveryInstructions";
};

const DeliverySpreadsheet: React.FC = () => {
  const [rows, setRows] = useState<RowData[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set()); 
  const [innerPopup, setInnerPopup] = useState(false);
  const [popupMode, setPopupMode] = useState("");
  const [driverSearchQuery, setDriverSearchQuery] = useState<string>("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedClusters, setSelectedClusters] = useState<Set<any>>(new Set());
  const [driver, setDriver] = useState<Driver | null>();
  const [time, setTime] = useState<string>("");
  const [showEditDriverList, setShowEditDriverList] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [newDriver, setNewDriver] = useState<Omit<Driver, 'id'>>({ name: '', phone: '', email: '' });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  
  const [exportCSV, setExportCSV] = useState(false);
  const [exportDoordash, setExportDoordash] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [step, setStep] = useState<number>(0); // 0 = closed, 1 = main menu, 2 = submenu
  const [parentChoice, setParentChoice] = useState<string>("");
  const navigate = useNavigate();

  //get drivers
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const driversCollectionRef = collection(db, "Drivers");
        const driversSnapshot = await getDocs(driversCollectionRef);
  
        if (!driversSnapshot.empty) {
          const driversData = driversSnapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name || "", 
            phone: doc.data().phone || "", 
            email: doc.data().email || "", 
          }));
  
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

  //get clusters
  useEffect(() => {
    const fetchClusters = async () => {
      try {
        const clustersCollectionRef = collection(db, "clusters");
        const clustersSnapshot = await getDocs(clustersCollectionRef);
  
        if (!clustersSnapshot.empty) {
          const clustersData = clustersSnapshot.docs.map((doc) => ({
            docId: doc.id,
            id: doc.data().id,
            time: doc.data().time || "", 
            driver: doc.data().driver || null, 
            deliveries: doc.data().deliveries || [], 
          }));
  
          setClusters(clustersData); 
        }
      } catch (error) {
        console.error("Error fetching clusters:", error);
      }
    };  
    fetchClusters();
  }, []);
  
  // Route Protection
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      if (!user) {
        navigate("/");
      }
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, [navigate]);

  //control popup state
  useEffect(() => {
    setInnerPopup(popupMode !== "");
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

  // Button click to open first menu
  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    setAnchorEl(event.currentTarget);
    setStep(1);
  };

  // Close all menus
  const handleClose = (): void => {
    setAnchorEl(null);
    setStep(0);
    setParentChoice("");
  };

  // Select "Route" or "Doordash"
  const handleParentSelect = (choice: string): void => {
    setParentChoice(choice);
    setStep(2);
  };

  const handleEmailDrivers = (): void => {
    console.log("Email drivers has not been implemented yet")
  }

  // Final option selected (Email/Download)
  const handleFinalAction = (action: string): void => {
    if (action === "Email Drivers") {
      handleEmailDrivers();
    } else if (action === "Download Drivers") {
      setPopupMode("CSV")
    } else if (action === "Download Doordash") {
      setPopupMode("Doordash")
    }
    handleClose();
  };

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTime(event.target.value);
  };

  // Reset selections after operations
  const resetSelections = () => {
    setPopupMode("");
    setSelectedClusters(new Set());
    setSelectedRows(new Set());
    setDriver(null);
    setTime("");
    setShowEditDriverList(false);
    setExportCSV(false);
    setExportDoordash(false);
  };

  //Handle assigning driver
  const assignDriver = async () => {
    if(driver){
      try {
        selectedClusters.forEach(async (cluster) => {
          const driverRef = doc(db, "Drivers", driver.id);

          const newCluster = {
            id: cluster.id,
            time: cluster.time,
            deliveries: cluster.deliveries,
            driver: driverRef, 
          };

          const clusterRef = doc(db, "clusters", cluster.docId);
          await setDoc(clusterRef, newCluster); 
        });
        
        //refresh clusters after assignment
        const clustersCollectionRef = collection(db, "clusters");
        const clustersSnapshot = await getDocs(clustersCollectionRef);
        const clustersData = clustersSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            docId: doc.id,
            id: data.id,
            time: data.time || "", 
            driver: data.driver || null, 
            deliveries: data.deliveries || [], 
          };
        });
        setClusters(clustersData);
        
        resetSelections();
      } catch (error) {
        console.error("Error assigning drivers: ", error);
      }
    }
  };

  //Handle assigning time
  const assignTime = async () => {
    if(time){
      try {
        // Use forEach to iterate over the Set
        selectedClusters.forEach(async (cluster) => {
          const newCluster = {
            id: cluster.id,
            time: time,
            deliveries: cluster.deliveries,
            driver: cluster.driver, 
          };
          const clusterRef = doc(db, "clusters", cluster.docId);
          await setDoc(clusterRef, newCluster); 
        });
        
        // refresh clusters after assignment
        const clustersCollectionRef = collection(db, "clusters");
        const clustersSnapshot = await getDocs(clustersCollectionRef);
        const clustersData = clustersSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            docId: doc.id,
            id: data.id,
            time: data.time || "", 
            driver: data.driver || null, 
            deliveries: data.deliveries || [], 
          };
        });
        setClusters(clustersData);
        
        resetSelections();
      } catch (error) {
        console.error("Error assigning time: ", error);
      }
    }
  };

  // Handle checkbox selection
  const handleCheckboxChange = (id: string) => {
    const newSelectedRows = new Set(selectedRows);
    const newSelectedClusters = new Set(selectedClusters);
    const rowToToggle = rows.find((row) => row.id === id);
  
    if (rowToToggle) {
      const clusterID = rowToToggle.clusterID;
      if (clusterID) {
        const cluster = clusters.find((c) => c.id.toString() === clusterID);
        const rowsWithSameClusterID = rows.filter((row) => row.clusterID === clusterID);
        
        if (cluster) {
          // Check if the current row is already selected
          const isSelected = newSelectedRows.has(id);
          
          // Toggle selection for all rows with the same clusterID
          rowsWithSameClusterID.forEach((row) => {
            if (isSelected) {
              newSelectedRows.delete(row.id); // Deselect all
            } else {
              newSelectedRows.add(row.id); // Select all
            }
          });
          
          if (isSelected) {
            newSelectedClusters.delete(cluster);
          } else {
            newSelectedClusters.add(cluster);
          }
        }
      }
    }
    
    setSelectedClusters(newSelectedClusters);
    setSelectedRows(newSelectedRows);
  };

  // Filter rows based on search query
  let visibleRows = rows.filter(
    (row) =>
      fields.some((field) => {
        if (field.key === "checkbox") return false;
        
        if (field.key === "assignedDriver") {
          // Get driver name from cluster
          if (!row.clusterID) return false;
          const cluster = clusters.find(c => c.id.toString() === row.clusterID);
          if (!cluster || !cluster.driver) return false;
          
          const driverId = typeof cluster.driver === 'object' ? cluster.driver.id : null;
          if (!driverId) return false;
          
          const driver = drivers.find(d => d.id === driverId);
          const driverName = driver ? driver.name : "";
          
          return driverName.toLowerCase().includes(searchQuery.toLowerCase());
        }
        
        if (field.key === "assignedTime") {
          // Get time from cluster
          if (!row.clusterID) return false;
          const cluster = clusters.find(c => c.id.toString() === row.clusterID);
          if (!cluster || !cluster.time) return false;
          
          return cluster.time.toLowerCase().includes(searchQuery.toLowerCase());
        }
        
        const fieldValue = field.compute && field.compute.length === 1
          ? field.compute(row)
          : (field.key in row ? row[field.key as keyof RowData] : undefined);
        
        return (
          fieldValue &&
          fieldValue
            .toString()
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );
      })
  );

  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
    };

  const handleClosePopper = (event: Event | React.SyntheticEvent) => {
    if (
      anchorRef.current &&
      anchorRef.current.contains(event.target as HTMLElement)
    ) {
      return;
    }
    if(event && 'nativeEvent' in event) {
      const target = event.nativeEvent.target as HTMLElement;
      const militaryTime =convertTo24Hour(target?.innerText);
      setTime(militaryTime);
    }

    setOpen(false);
  };

  React.useEffect(() => {
    if (time) {
        assignTime();
    }
}, [time]);

       function convertTo24Hour(time: string) {
        let [hours, minutes, modifier] = time.split(/:| /);
    
        // Parse hours and minutes as integers
        hours = parseInt(hours, 10).toString();
        minutes = minutes || "00";
  
        if (modifier === "AM") {
            // Convert "12 AM" to "00"
            hours = hours === "12" ? "00" : hours.padStart(2, "0");
        } else if (modifier === "PM") {
            // Convert "12 PM" to "12" and other PM hours to 24-hour format
            hours = hours === "12" ? "12" : (parseInt(hours, 10) + 12).toString();
        }

        // Ensure hours and minutes are always two digits
        return hours + ":" + minutes;
    }

  function handleListKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  // return focus to the button when we transitioned from !open -> open
  const prevOpen = React.useRef(open);
  React.useEffect(() => {
    if (prevOpen.current === true && open === false) {
      anchorRef.current!.focus();
    }

    prevOpen.current = open;
  }, [open]);

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
          <div style={{ display: "flex", justifyContent: "space-between", gap: "5%", margin: "0.5% 0%" }}>
            <div style={{ display: "flex", justifyContent: "start", gap: "2%", width: "40%" }}>
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
                  width: "30%",
                  marginRight: "5%",
                  backgroundColor: (selectedRows.size <= 0 ? "gray" : "#257E68") + " !important",
                }}
              >
                Assign Driver
              </Button>
              <Button
                ref={anchorRef}
                id="composition-button"
                aria-controls={open ? 'composition-menu' : undefined}
                aria-expanded={open ? 'true' : undefined}
                aria-haspopup="true"
                onClick={handleToggle}
                disabled={selectedRows.size <= 0}
                sx={{
                  whiteSpace: "nowrap",
                  padding: "0% 2%",
                  borderRadius: "5px",
                  width: "30%",
                  backgroundColor: (selectedRows.size <= 0 ? "gray" : "#257E68") + " !important",
                }}
              >
                Assign TIME
              </Button>
              <Popper
                open={open}
                anchorEl={anchorRef.current}
                role={undefined}
                placement="bottom-start"
                transition
                sx={{
                  whiteSpace: "nowrap",
                  padding: "0% 0%",
                  borderRadius: "5px",
                  width: "9%"
                }}
                style={{ zIndex: 1000 }}
              >
                {({ TransitionProps, placement }) => (
                  <Grow
                    {...TransitionProps}
                    style={{
                      transformOrigin:
                        placement === 'bottom-start' ? 'left top' : 'left bottom',
                    }}
                  >
                    <Paper>
                      <ClickAwayListener onClickAway={handleClosePopper}>
                        <MenuList 
                          autoFocusItem={open}
                          id="composition-menu"
                          aria-labelledby="composition-button"
                          onKeyDown={handleListKeyDown}
                        >
                          <MenuItem onClick={handleClosePopper}>9:00 AM</MenuItem>
                          <MenuItem onClick={handleClosePopper}>10:00 AM</MenuItem>
                          <MenuItem onClick={handleClosePopper}>11:00 AM</MenuItem>
                          <MenuItem onClick={handleClosePopper}>12:00 PM</MenuItem>
                          <MenuItem onClick={handleClosePopper}>1:00 PM</MenuItem>
                          <MenuItem onClick={handleClosePopper}>2:00 PM</MenuItem>
                          <MenuItem onClick={handleClosePopper}>3:00 PM</MenuItem>
                          <MenuItem onClick={handleClosePopper}>4:00 PM</MenuItem>
                          <MenuItem onClick={handleClosePopper}>5:00 PM</MenuItem>
                        </MenuList>
                      </ClickAwayListener>
                    </Paper>
                  </Grow>
                )}
              </Popper>
            </div>
            <div style={{ display: "flex", justifyContent: "end", gap: "2%", width: "40%" }}>
              <Button
                  variant="contained"
                  color="secondary"
                  className="view-all"
                  onClick={handleButtonClick}
                  sx={{
                    whiteSpace: "nowrap",
                    padding: "0% 2%",
                    borderRadius: "5px",
                    width: "30%",
                    backgroundColor: "#257e68",
                  }}
                >
                  Export
              </Button>

              {/* Step 1: Main Menu */}
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl) && step === 1}
                onClose={handleClose}
                MenuListProps={{ sx: { minWidth: 140 } }}
              >
                <MenuItem onClick={() => handleParentSelect("Route")}>Route</MenuItem>
                <MenuItem onClick={() => handleParentSelect("Doordash")}>Doordash</MenuItem>
              </Menu>

              {/* Step 2: Submenu based on choice */}
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl) && step === 2}
                onClose={handleClose}
                MenuListProps={{ sx: { minWidth: 140 } }}
              >
                {parentChoice === "Route" && (
                  <>
                    <MenuItem onClick={() => handleFinalAction("Email Drivers")}>
                      Email Drivers
                    </MenuItem>
                    <MenuItem onClick={() => handleFinalAction("Download Drivers")}>
                      Download Drivers
                    </MenuItem>
                  </>
                )}
                {parentChoice === "Doordash" && (
                  <MenuItem onClick={() => handleFinalAction("Download Doordash")}>
                    Download Doordash
                  </MenuItem>
                )}
              </Menu>
            </div>
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
        <TableContainer component={Paper} style={{ maxHeight: "65vh", overflowY: "auto", width: "100%" }}>
          <Table stickyHeader style={{ borderSpacing: "0px", borderCollapse: "collapse" }} size="small">
            <TableHead>
              <TableRow>
                {fields.map((field) => (
                  <TableCell className="table-header" key={field.key} style={{ width: field.width }} sx={{ textAlign: "center" }}>
                    <h2 style={{ fontWeight: "bold" }}>{field.label}</h2>
                  </TableCell>
                ))}
                <TableCell className="table-header"></TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={"table-row"}
                >
                  {fields.map((field) => (
                    <TableCell key={field.key} style={{  }}>
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
                      ) : field.key === "fullname" ? (
                        field.compute(row)
                      ) : field.key === "tags" && field.compute ? (
                        field.compute(row)
                      ) : field.key === "assignedDriver" && field.compute ? (
                        <div style={{
                          backgroundColor: "white",
                          minHeight: "30px", // Ensures a consistent height
                          width: "95%",
                          padding: "5px",
                          display: "flex",
                          fontSize: "13px",
                          textAlign: "center",
                          alignItems: "center",
                          justifyContent: "center",
                          whiteSpace: "pre-wrap",
                          overflow: "auto",
                        }}>
                          { field.compute(row, clusters, drivers) }
                        </div>
                      ) : field.key === "assignedTime" && field.compute ? (
                        <div style={{
                          backgroundColor: "white",
                          minHeight: "30px", // Ensures a consistent height
                          width: "95%",
                          padding: "5px",
                          display: "flex",
                          fontSize: "13px",
                          textAlign: "center",
                          alignItems: "center",
                          justifyContent: "center",
                          whiteSpace: "pre-wrap",
                          overflow: "auto",
                        }}>
                          { field.compute(row, clusters) }
                        </div>
                      ) : field.key === "phone" && field.compute ? (
                        field.compute(row)
                      ) : field.key === "deliveryDetails.deliveryInstructions" ? (
                        <div style={{
                          backgroundColor: "white",
                          minHeight: "70px",
                          padding: "10px",
                          display: "flex",
                          alignItems: "left",
                          whiteSpace: "pre-wrap",
                          overflow: "auto",
                        }}>
                          { field.compute(row) }
                        </div>
                      ) : isRegularField(field) ? (
                        row[field.key]
                      ) : null}
                    </TableCell>
                  ))}
                  <TableCell></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      {/* Popup */}
      <Dialog open={innerPopup && !showEditDriverList} onClose={() => setPopupMode("")} PaperProps={{sx: {width: "48%", maxWidth: "900px", padding: "0"}}}>
        {/* <DialogTitle>{popupMode == "Time" ? "Select a time": "Assign a Driver"}</DialogTitle> */}
        <DialogContent style={{ padding: "2% 0% 2% 2%"}}>
          {popupMode === "Driver" ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: '300px' }}>
              <Autocomplete
                freeSolo
                options={[
                  { id: 'edit_list', name: 'Edit Driver List >', phone: '', email: '' } as DriverOption,
                  ...drivers
                ]}
                getOptionLabel={(option) => {
                  if (typeof option === "string") return option;
                  return option.name;
                }}
                onChange={(event, value) => {
                  if (value) {
                    if (typeof value !== "string") {
                      if (value.id === 'edit_list') {
                        setShowEditDriverList(true);
                        setDriver(null); // Clear selected driver when opening edit list
                      } else {
                        setDriver(value as Driver);
                      }
                    }
                  } else {
                    setDriver(null); // Clear selected driver when no value
                  }
                }}
                isOptionEqualToValue={(option, value) => {
                  // Prevent "Edit Driver List" from being selected as a value
                  if (option.id === 'edit_list') return false;
                  return option.id === value.id;
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
                renderOption={(props, option) => (
                  <li {...props} style={{ 
                    color: option.id === 'edit_list' ? '#257E68' : 'inherit',
                    fontWeight: option.id === 'edit_list' ? 'bold' : 'normal'
                  }}>
                    {option.name}
                  </li>
                )}
                PaperComponent={({ children }) => (
                  <Paper elevation={3}>{children}</Paper>
                )}
                noOptionsText="No drivers found"
              />
            </Box>
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
          ) : popupMode === "CSV" ? (
            <DialogContent>
              <div style={{ alignItems: "center", textAlign: "center", padding: "1%" }}>
                <h2 style={{ color: "#257e68", fontWeight: "bold", fontSize: "24px" }}>Are you sure you want to export drivers?</h2>
              </div>
            </DialogContent>
          ) : popupMode === "Doordash" ? (
            <DialogContent>
              <div style={{ alignItems: "center", textAlign: "center", padding: "1%" }}>
                <h2 style={{ color: "#257e68", fontWeight: "bold", fontSize: "24px" }}>Are you sure you want to export Doordash?</h2>
              </div>
            </DialogContent>
          ) : (
            ""
          )}
        </DialogContent>
        <DialogActions
          sx={{
            width: "100%",
            padding: 0,
            display: "flex"
          }}
        >
          <Button
            color = "primary"
            sx = {{
              flex: 1,
              minWidth: "30%",
              borderRadius: "5%",
              height: "60px",
              margin: "2%",
              backgroundColor: "#257e68",
              fontWeight: "bold",
            }}
            onClick={() => {
              (popupMode === "Driver") ? assignDriver() :
              (popupMode === "CSV") ? setExportCSV(true) :
              (popupMode === "Doordash") ? setExportDoordash(true) :
              assignTime()
            }}
          >
            {(popupMode === "CSV" || popupMode === "Doordash") ? "YES" : "SAVE"}
          </Button>
          <Button
            color = "secondary"
            sx = {{
              flex: 1,
              minWidth: "30%",
              borderRadius: "5%",
              height: "60px",
              margin: "2%",
              backgroundColor: "#AEAEAE !important",
              fontWeight: "bold",
            }}
            onClick={() => {
              setPopupMode("");
              (popupMode === "Driver") ? setDriver(null) :
              (popupMode === "CSV") ? setExportCSV(false) :
              (popupMode === "Doordash") ? setExportDoordash(false) :
              setTime("")
            }}
          >
            {(popupMode === "CSV" || popupMode === "Doordash") ? "NO" : "CANCEL"}
          </Button>
        </DialogActions>
        
      </Dialog>

      {/* Replace the old driver management modal with the new component */}
      <DriverManagementModal
        open={showEditDriverList}
        onClose={() => {
          setShowEditDriverList(false);
          setPopupMode("");
        }}
        drivers={drivers}
        onDriversChange={setDrivers}
      />
    </Box>
  );
};


{/* <Button
  fullWidth
  sx={{
    flex: 1,
    minWidth: "50%",
    borderRadius: 0,
    height: "60px",
    fontSize: "1rem",
    margin: 0,
    borderRight: "1px solid #257e68"
  }}
  onClick={() => {popupMode == "Driver" ? assignDriver(): assignTime()}}
>
  SAVE
</Button>
<Button
  fullWidth
  sx={{
    flex: 1,
    minWidth: "50%",
    borderRadius: 0,
    height: "60px",
    fontSize: "1rem",
    margin: 0,
    borderLeft: "1px solid #257e68"
  }}
  onClick={() => {setPopupMode(""); popupMode == "Driver" ? setDriver(null): setTime("")}}
>
  CANCEL
</Button> */}
export default DeliverySpreadsheet;