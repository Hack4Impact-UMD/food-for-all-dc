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

// Define TypeScript types for row data
interface RowData {
  id: string;
  clientid: string;
  firstName: string;
  lastName: string;
  address: string;
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
      key: "assignedDriver";
      label: "Assigned Driver";
      type: "text";
      compute: (data: RowData, clusters: Cluster[], drivers: Driver[]) => string;
    }
  | {
      key: "assignedTime";
      label: "Assigned Time";
      type: "text";
      compute: (data: RowData, clusters: Cluster[]) => string;
    }
  | {
      key: "deliveryDetails.deliveryInstructions";
      label: "Delivery Instructions";
      type: "text";
      compute: (data: RowData) => string;
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
  },
  {
    key: "fullname",
    label: "Client",
    type: "text",
    compute: (data: RowData) => `${data.lastName}, ${data.firstName}`,
  },
  { key: "clusterID", label: "Cluster ID", type: "text"},
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
  { key: "ward", label: "Ward", type: "text" },
  {
    key: "assignedDriver", 
    label: "Assigned Driver", 
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
    }
  },
  {
    key: "assignedTime", 
    label: "Assigned Time", 
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
    }
  },
];

// Type Guard to check if a field is a regular field
const isRegularField = (
  field: Field
): field is Extract<Field, { key: keyof RowData }> => {
  return field.key !== "fullname" && 
         field.key !== "tags" && 
         field.key !== "assignedDriver" &&
         field.key !== "assignedTime";
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
        <TableContainer component={Paper} style={{ maxHeight: "65vh", overflowY: "auto", width: "100%"}}>
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
                  className={"table-row"}
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
                      ) : field.key === "fullname" ? (
                        field.compute(row)
                      ) : field.key === "tags" && field.compute ? (
                        field.compute(row)
                      ) : field.key === "assignedDriver" && field.compute ? (
                        field.compute(row, clusters, drivers)
                      ) : field.key === "assignedTime" && field.compute ? (
                        field.compute(row, clusters)
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
      <Dialog open={innerPopup && !showEditDriverList} onClose={() => setPopupMode("")}>
        <DialogTitle>{popupMode == "Time" ? "Select a time": "Assign a Driver"}</DialogTitle>
        <DialogContent>
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
          ) : (
            ""
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {popupMode == "Driver" ? assignDriver(): assignTime()}}>SAVE</Button>
          <Button onClick={() => {setPopupMode(""); popupMode == "Driver" ? setDriver(null): setTime("")}}>CANCEL</Button>
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

export default DeliverySpreadsheet;