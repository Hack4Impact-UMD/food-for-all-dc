import { addDays, format } from "date-fns";
import { query, Timestamp, where } from "firebase/firestore";
import { Filter, Search } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../auth/firebaseConfig";

import { Add, Check, Close, Delete, Edit } from "@mui/icons-material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Grow,
  IconButton,
  Menu,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Select,
  SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { render } from "@testing-library/react";
import { set } from "date-fns";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import "leaflet/dist/leaflet.css";
import { auth } from "../../auth/firebaseConfig";
import DriverManagementModal from "../../components/DriverManagementModal";
import { useCustomColumns } from "../../hooks/useCustomColumns";
import ClusterMap from "./ClusterMap";
import "./DeliverySpreadsheet.css";

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

type DriverOption = Driver | { id: "edit_list"; name: string; phone: ""; email: "" };

interface Cluster {
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
  value: Omit<Driver, "id">;
  onChange: (field: keyof Omit<Driver, "id">, value: string) => void;
  errors: ValidationErrors;
  onClearError: (field: keyof ValidationErrors) => void;
}

interface DeliveryEvent {
  id: string;
  assignedDriverId: string;
  assignedDriverName: string;
  clientId: string;
  clientName: string;
  deliveryDate: Date;
  time: string;
  recurrence: "None" | "Weekly" | "2x-Monthly" | "Monthly";
  repeatsEndOption?: "On" | "After";
  repeatsEndDate?: string;
  repeatsAfterOccurrences?: number;
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
    width: "10%",
  },
  {
    key: "tags",
    label: "Tags",
    type: "text",
    compute: (data: RowData) => {
      const tags = data.tags || [];
      return tags.length > 0 ? tags.join(", ") : "None";
    },
    width: "10%",
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
    width: "12%",
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
      const cluster = clusters.find((c) => c.id.toString() === data.clusterID);
      if (!cluster) return "No Cluster Found";

      //check to make sure driver exists
      if (!cluster.driver) return "No Driver Assigned";

      //find driver name from driver ref
      if (typeof cluster.driver === "object" && cluster.driver.id) {
        const driverId = cluster.driver.id;
        const driver = drivers.find((d) => d.id === driverId);
        return driver ? driver.name : "Driver Not Found";
      }

      return "Driver Not Found";
    },
    width: "10%",
  },
  {
    key: "assignedTime",
    label: "Time",
    type: "text",
    compute: (data: RowData, clusters: Cluster[]) => {
      //case where user is not assigned a cluster
      if (!data.clusterID) return "No Cluster assigned";

      //find cluster from cluster id
      const cluster = clusters.find((c) => c.id.toString() === data.clusterID);
      if (!cluster) return "No Cluster Found";

      //check to make sure driver exists
      if (cluster.time) {
        const toStandardArr = cluster.time.split(":");
        let hours = Number(toStandardArr[0]);
        let mins = Number(toStandardArr[1]);
        let ampm = "";
        if (hours < 12) {
          hours = hours === 0 ? 12 : hours;
          ampm = "AM";
        } else {
          hours = hours === 12 ? 12 : hours % 12;
          ampm = "PM";
        }
        return `${hours}:${mins < 10 ? "0" : ""}${mins} ${ampm}`;
      } else {
        return "No Time Assigned";
      }
    },
    width: "10%",
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
  },
];

// ADDED
interface CustomColumn {
  id: string; // Unique identifier for the column
  label: string; // Header label (e.g., "Custom 1", or user-defined)
  propertyKey: keyof RowData | "none"; // Which property from RowData to display
}

// Type Guard to check if a field is a regular field
const isRegularField = (
  field: Field
): field is Extract<Field, { key: keyof RowData }> => {
  return (
    field.key !== "fullname" &&
    field.key !== "tags" &&
    field.key !== "assignedDriver" &&
    field.key !== "assignedTime" &&
    field.key !== "phone" &&
    field.key !== "deliveryDetails.deliveryInstructions"
  );
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
  const [newDriver, setNewDriver] = useState<Omit<Driver, "id">>({
    name: "",
    phone: "",
    email: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);

  const [exportCSV, setExportCSV] = useState(false);
  const [exportDoordash, setExportDoordash] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [step, setStep] = useState<number>(0); // 0 = closed, 1 = main menu, 2 = submenu
  const [parentChoice, setParentChoice] = useState<string>("");
  const [clusterNum, setClusterNum] = useState(0);

  //delivery vars
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [deliveriesForDate, setDeliveriesForDate] = useState<DeliveryEvent[]>([]);

  //cluster generation and map vars
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }[]>([]);
  const [generatedClusters, setGeneratedClusters] = useState<{
    [key: string]: number[];
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [maxDeliveries, setMaxDeliveries] = useState(5);
  const [minDeliveries, setMinDeliveries] = useState(1);
  const [clusterError, setClusterError] = useState("");

  // Hooks
  const navigate = useNavigate();
  const {
    customColumns,
    handleAddCustomColumn,
    handleCustomHeaderChange,
    handleRemoveCustomColumn,
    handleCustomColumnChange,
  } = useCustomColumns();

  //get all drivers for assign driver
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

  // fetch deliveries for the selected date
  const fetchDeliveriesForDate = async (date: Date) => {
    try {
      // account for timezone issues
      const startDate = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
      );

      const endDate = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
      );

      const eventsRef = collection(db, "events");
      const q = query(
        eventsRef,
        where("deliveryDate", ">=", Timestamp.fromDate(startDate)),
        where("deliveryDate", "<=", Timestamp.fromDate(endDate))
      );

      const querySnapshot = await getDocs(q);
      const events = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        // get local date
        const deliveryDate = data.deliveryDate.toDate();
        return {
          id: doc.id,
          ...data,
          deliveryDate: new Date(
            deliveryDate.getFullYear(),
            deliveryDate.getMonth(),
            deliveryDate.getDate()
          ),
        };
      }) as DeliveryEvent[];

      //set the deliveries for the date
      setDeliveriesForDate(events);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
    }
  };

  //when the user changes the date, fetch the deliveries for that date
  useEffect(() => {
    fetchDeliveriesForDate(selectedDate);
  }, [selectedDate]);

  // fetch data and geocode existing clusters
  useEffect(() => {
    const fetchDataAndGeocode = async () => {
      if (deliveriesForDate.length === 0) {
        setCoordinates([]);
        setGeneratedClusters({});
        setIsLoading(false);
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, "clients"));
        const allData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<RowData, "id">),
        }));

        // filter to only include clients with deliveries today
        const clientsWithDeliveriesToday = allData.filter((row) =>
          deliveriesForDate.some((delivery) => delivery.clientId === row.id)
        );

        setRows(allData); // keep all rows for the table
        const clientsWithClusters = clientsWithDeliveriesToday.filter(
          (row) => row.clusterID
        );

        if (clientsWithClusters.length > 0) {
          const token = await auth.currentUser?.getIdToken();
          const response = await fetch(
            "https://geocode-addresses-endpoint-lzrplp4tfa-uc.a.run.app",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                addresses: clientsWithClusters.map((row) => row.address),
              }),
            }
          );

          if (response.ok) {
            const { coordinates } = await response.json();
            setCoordinates(coordinates);

            const clusterMap: { [key: string]: number[] } = {};
            clientsWithClusters.forEach((row, index) => {
              const clusterId = `cluster-${row.clusterID}`;
              if (!clusterMap[clusterId]) clusterMap[clusterId] = [];
              clusterMap[clusterId].push(index);
            });

            setGeneratedClusters(clusterMap);
          }
        } else {
          setCoordinates([]);
          setGeneratedClusters({});
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (deliveriesForDate.length > 0) {
      fetchDataAndGeocode();
    } else {
      setCoordinates([]);
      setGeneratedClusters({});
      setIsLoading(false);
    }
  }, [deliveriesForDate]);

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

  // fetch client data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapshot = await getDocs(collection(db, "clients"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<RowData, "id">),
        }));
        console.log("Fetching client data: ", data);
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
    console.log("Email drivers has not been implemented yet");
  };

  // Final option selected (Email/Download)
  const handleFinalAction = (action: string): void => {
    if (action === "Email Drivers") {
      handleEmailDrivers();
    } else if (action === "Download Drivers") {
      setPopupMode("CSV");
    } else if (action === "Download Doordash") {
      setPopupMode("Doordash");
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

  // reset popup selections when closing popup
  const resetSelections = () => {
    setPopupMode("");
    setSelectedClusters(new Set());
    setSelectedRows(new Set());
    setDriver(null);
    setTime("");
    setShowEditDriverList(false);
    setExportCSV(false);
    setExportDoordash(false);
    setClusterNum(0);
    setMinDeliveries(0);
    setMaxDeliveries(10);
    setClusterError("");
  };

  //Handle assigning driver
  const assignDriver = async () => {
    if (driver) {
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

  const updateCluster = async (userId: string, clusterId: string) => {
    try {
      const userRef = doc(db, "clients", userId);
      await setDoc(userRef, { clusterID: clusterId }, { merge: true });
      console.log(`Updated user ${userId} to cluster ${clusterId}`);
    } catch (error) {
      console.error(`Error updating cluster for user ${userId}:`, error);
      throw error;
    }
  };

  //Handle assigning time
  const assignTime = async () => {
    if (time) {
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

  //Handle generating clusters
  const generateClusters = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const addresses = visibleRows.map((row) => row.address);
      if (clusterNum === 0) {
        throw new Error("Must have at least one cluster");
      }

      if (addresses.length === 0) {
        throw new Error("No deliveries for today");
      }

      if (clusterNum * minDeliveries > addresses.length) {
        throw new Error("Minimum deliveries it higher than the deliveries");
      }

      // Convert addresses to coordinates
      const response = await fetch(
        "https://geocode-addresses-endpoint-lzrplp4tfa-uc.a.run.app",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            addresses: addresses,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      const { coordinates } = await response.json();
      setCoordinates(coordinates);
      console.log(coordinates);

      // Generate clusters based on coordinates
      const clusterResponse = await fetch(
        "https://cluster-deliveries-k-means-lzrplp4tfa-uc.a.run.app",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            coords: coordinates,
            drivers_count: clusterNum,
            min_deliveries: minDeliveries,
            max_deliveries: maxDeliveries,
          }),
        }
      );

      const clusterData = await clusterResponse.json();
      setGeneratedClusters(clusterData.clusters);
      console.log(clusterData);

      // Update each user's cluster assignment
      const updatePromises = [];
      for (const [clusterName, indices] of Object.entries(clusterData.clusters)) {
        const clusterNum = clusterName.split("-")[1]; // Get cluster number
        for (const index of indices as number[]) {
          const user = visibleRows[index];
          if (user) {
            updatePromises.push(updateCluster(user.id, clusterNum));
          }
        }
      }

      await Promise.all(updatePromises);

      // Refresh the data
      const snapshot = await getDocs(collection(db, "clients"));
      const updatedData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<RowData, "id">),
      }));
      setRows(updatedData);
      resetSelections();
    } catch (error: any) {
      setClusterError(error.toString());
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
        const rowsWithSameClusterID = rows.filter(
          (row) => row.clusterID === clusterID
        );

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

  // Filter rows to only show clients with deliveries on selected date
  const clientsWithDeliveries = rows.filter((row) =>
    deliveriesForDate.some((delivery) => delivery.clientId === row.id)
  );

  // Filter rows based on search query
  let visibleRows = clientsWithDeliveries.filter((row) => {

    const eachQuery = searchQuery.match(/"[^"]+"|\S+/g) || [];

    const quotedQueries = eachQuery.filter(s => s.startsWith('"') && s.endsWith('"') && s.length > 1) || [];
    const nonQuotedQueries = eachQuery.filter(s => s.length == 1 || !s.endsWith('"')) || [];


    const containsQuotedQueries = quotedQueries.length === 0
    ? true
    : quotedQueries.every((query) => {
      const matchesStaticField = fields.some((field) => {
        let fieldValue: any;

        const strippedQuery = query.slice(1, -1).trim().toLowerCase()
  
        if (field.key === "fullname") {
          fieldValue = field.compute(row);
        } else if (field.key === "tags" && field.compute) {
          fieldValue = field.compute(row);
        } else if (field.key === "assignedDriver" && field.compute) {
          fieldValue = field.compute(row, clusters, drivers);
        } else {
          fieldValue = row[field.key as keyof RowData];
        }
  
        if (field.key === "tags" && field.compute) {
          const untrimmedStrings: String[] = fieldValue.split(',');
          const trimmedStrings = untrimmedStrings.map(str => str.trim());
          return (
            fieldValue != null &&
            trimmedStrings.includes(strippedQuery.toLowerCase())
          );
        }
        return (
          fieldValue != null &&
          fieldValue.toString().toLowerCase() === strippedQuery.toLowerCase()
        );
      });
  
      // Check all custom columns
      const matchesCustomColumn = customColumns.some((col) => {

        const strippedQuery = query.slice(1, -1).trim().toLowerCase()

        if (col.propertyKey !== "none") {
          const fieldValue = row[col.propertyKey as keyof RowData];
          return (
            fieldValue != null &&
            fieldValue.toString().toLowerCase() === strippedQuery.toLowerCase()
          );
        }
        return false;
      });

      // For this query, return true if it matched any field
      return matchesStaticField || matchesCustomColumn;
    });

    if (containsQuotedQueries) {
      const containsRegularQuery = nonQuotedQueries.length === 0
      ? true
      : nonQuotedQueries.some((query) => {
        const strippedQuery = query.startsWith('"')
          ? query.slice(1).trim().toLowerCase()
          : query.trim().toLowerCase()

        if (strippedQuery.length === 0) {
          return true;
        }

        const matchesStaticField = fields.some((field) => {
          let fieldValue: any;

          if (field.key === "fullname") {
            fieldValue = field.compute(row);
          } else if (field.key === "tags" && field.compute) {
            fieldValue = field.compute(row);
          } else if (field.key === "assignedDriver" && field.compute) {
            fieldValue = field.compute(row, clusters, drivers);
          } else {
            fieldValue = row[field.key as keyof RowData];
          }

          if (fieldValue == null) return false;

          const value = fieldValue.toString().toLowerCase();
          return value.includes(strippedQuery)
        })

        const matchesCustomColumn = customColumns.some((col) => {
          if (col.propertyKey !== "none") {
            const fieldValue = row[col.propertyKey as keyof RowData];
    
            return (
              fieldValue != null &&
              fieldValue.toString().toLowerCase().includes(strippedQuery.toLowerCase())
            );
          }
          return false;
        });

        return matchesStaticField || matchesCustomColumn;
      })

      return containsRegularQuery;
    } else {
      return false;
    }
  });


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
    if (event && "nativeEvent" in event) {
      const target = event.nativeEvent.target as HTMLElement;
      const militaryTime = convertTo24Hour(target?.innerText);
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
    if (event.key === "Tab") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Escape") {
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
    <Box
      className="box"
      sx={{ display: "flex", flexDirection: "column", height: "100vh" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            padding: "16px",
            backgroundColor: "#fff",
            zIndex: 10,
            position: "sticky",
            top: 0,
            width: "100%",
          }}
        >
          <Typography
            variant="h4"
            sx={{ marginRight: 2, width: "170px", color: "#787777" }}
          >
            {format(selectedDate, "EEEE")}
          </Typography>

          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "40px",
              height: "40px",
              backgroundColor: "#257E68",
              borderRadius: "90%",
              marginRight: 2,
            }}
          >
            <Typography variant="h5" sx={{ color: "#fff" }}>
              {format(selectedDate, "d")}
            </Typography>
          </Box>

          <IconButton
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            size="large"
            sx={{ color: "#257E68" }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderLeft: "2px solid #257E68",
                borderBottom: "2px solid #257E68",
                transform: "rotate(45deg)",
              }}
            />
          </IconButton>

          <IconButton
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            size="large"
            sx={{ color: "#257E68" }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderLeft: "2px solid #257E68",
                borderBottom: "2px solid #257E68",
                transform: "rotate(-135deg)",
              }}
            />
          </IconButton>

          <Button
            sx={{ width: 50, fontSize: 12, marginLeft: 4 }}
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
        </Box>
        <Button
          variant="contained"
          color="secondary"
          className="view-all"
          onClick={() => {
            setPopupMode("Clusters");
          }}
          sx={{
            whiteSpace: "nowrap",
            padding: "0% 2%",
            borderRadius: "5px",
            width: "10%",
            backgroundColor: "#257E68 !important",
          }}
        >
          Generate<br></br>Clusters
        </Button>
      </div>

      {/* Map Container */}
      <Box
        sx={{
          top: "72px",
          zIndex: 9,
          height: "400px",
          width: "100%",
          backgroundColor: "#fff",
        }}
      >
        {isLoading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <CircularProgress />
          </Box>
        ) : visibleRows.length > 0 ? (
          <ClusterMap
            addresses={visibleRows.map((row) => row.address)}
            coordinates={coordinates}
            clusters={generatedClusters}
            clientNames={visibleRows.map(
              (row) => `${row.firstName} ${row.lastName}`
            )}
          />
        ) : (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              backgroundColor: "#f5f5f5",
              borderRadius: "4px",
              border: "1px solid #ddd",
            }}
          >
            <Typography variant="h6" color="textSecondary">
              No deliveries for selected date
            </Typography>
          </Box>
        )}
      </Box>

      {/* Search Bar */}
      <Box
        sx={{
          width: "100%",
          zIndex: 8,
          backgroundColor: "#fff",
          padding: "16px 0",
          top: "472px",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Box sx={{ position: "relative", width: "100%" }}>
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
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", width: "100%", gap: "2%" }}>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => setSearchQuery("")}
                className="view-all"
                sx={{
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
                  backgroundColor:
                    (selectedRows.size <= 0 ? "gray" : "#257E68") + " !important",
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
                  backgroundColor:
                    (selectedRows.size <= 0 ? "gray" : "#257E68") + " !important",
                }}
              >
                Assign Time
              </Button>
              <Button
                variant="contained"
                color="secondary"
                className="view-all"
                onClick={handleButtonClick}
                sx={{
                  whiteSpace: "nowrap",
                  padding: "0% 2%",
                  borderRadius: "5px",
                  width: "10%",
                  backgroundColor: "#257e68",
                  marginLeft: "auto",
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
                <MenuItem onClick={() => handleParentSelect("Route")}>
                  Route
                </MenuItem>
                <MenuItem onClick={() => handleParentSelect("Doordash")}>
                  Doordash
                </MenuItem>
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
            </Box>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          margin: "0 auto",
          paddingBottom: "2vh",
          width: "100%",
          maxHeight: "none",
        }}
      >
        <TableContainer
          component={Paper}
          sx={{
            maxHeight: "none",
            height: "auto",
            width: "100%",
          }}
        >
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {fields.map((field) => (
                  <TableCell
                    className="table-header"
                    key={field.key}
                    style={{ width: field.width }}
                    sx={{ textAlign: "center" }}
                  >
                    <h2 style={{ fontWeight: "bold" }}>{field.label}</h2>
                  </TableCell>
                ))}
                {/* <TableCell className="table-header"></TableCell> */}
                {/* Adding custom columns */}
                {/*  Headers for custom columns */}
                {customColumns.map((col) => (
                  <TableCell className="table-header" key={col.id}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Select
                        value={col.propertyKey}
                        onChange={(event) => handleCustomHeaderChange(event, col.id)}
                        variant="outlined"
                        displayEmpty
                        sx={{ minWidth: 120, color: "#257e68" }}
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
                      {/*Add Remove Button*/}
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveCustomColumn(col.id)} // Call remove handler
                        aria-label={`Remove ${col.label || "custom"} column`}
                        title={`Remove ${col.label || "custom"} column`} // Tooltip for accessibility
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                ))}

                {/* Add button cell */}
                <TableCell className="table-header" style={{ textAlign: "right" }}>
                  <IconButton
                    onClick={handleAddCustomColumn}
                    color="primary"
                    aria-label="add custom column"
                  >
                    <AddIcon sx={{ color: "#257e68" }} />
                  </IconButton>
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.id} className={"table-row"}>
                  {fields.map((field) => (
                    <TableCell key={field.key} style={{}}>
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
                        <div
                          style={{
                            // Remove white bg from here
                            backgroundColor: "",
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
                          }}
                        >
                          {field.compute(row, clusters, drivers)}
                        </div>
                      ) : field.key === "assignedTime" && field.compute ? (
                        <div
                          style={{
                            // Remove white bg from here
                            backgroundColor: "",
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
                          }}
                        >
                          {field.compute(row, clusters)}
                        </div>
                      ) : field.key === "phone" && field.compute ? (
                        field.compute(row)
                      ) : field.key === "deliveryDetails.deliveryInstructions" ? (
                        <div
                          style={{
                            // Remove black bg here.
                            backgroundColor: "",
                            minHeight: "70px",
                            padding: "10px",
                            display: "flex",
                            alignItems: "left",
                            whiteSpace: "pre-wrap",
                            overflow: "auto",
                            color: "black",
                          }}
                        >
                          {field.compute(row)}
                        </div>
                      ) : isRegularField(field) ? (
                        row[field.key]
                      ) : null}
                    </TableCell>
                  ))}

                  {customColumns.map((col) => (
                    <TableCell key={col.id}>
                      {col.propertyKey !== "none"
                        ? (row[col.propertyKey as keyof RowData]?.toString() ??
                          "N/A")
                        : "N/A"}
                    </TableCell>
                  ))}

                  <TableCell></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Popup Dialog */}
      <Dialog
        open={innerPopup && !showEditDriverList}
        onClose={() => resetSelections()}
        PaperProps={{ sx: { width: "48%", maxWidth: "900px", padding: "0" } }}
      >
        <DialogTitle>
          {popupMode === "Time"
            ? "Select a time"
            : popupMode === "Driver"
              ? "Assign a Driver"
              : popupMode === "Clusters"
                ? "Generate Clusters"
                : popupMode === "CSV"
                  ? "Export Drivers"
                  : popupMode === "Doordash"
                    ? "Export Doordash"
                    : ""}
        </DialogTitle>
        <DialogContent>
          {popupMode === "Driver" ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                minWidth: "300px",
              }}
            >
              <Autocomplete
                freeSolo
                options={[
                  {
                    id: "edit_list",
                    name: "Edit Driver List >",
                    phone: "",
                    email: "",
                  } as DriverOption,
                  ...drivers,
                ]}
                getOptionLabel={(option) => {
                  if (typeof option === "string") return option;
                  return option.name;
                }}
                onChange={(event, value) => {
                  if (value) {
                    if (typeof value !== "string") {
                      if (value.id === "edit_list") {
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
                  if (option.id === "edit_list") return false;
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
                  <li
                    {...props}
                    style={{
                      color: option.id === "edit_list" ? "#257E68" : "inherit",
                      fontWeight: option.id === "edit_list" ? "bold" : "normal",
                    }}
                  >
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
          ) : popupMode === "CSV" ? (
            <Box sx={{ alignItems: "center", textAlign: "center", padding: "1%" }}>
              <Typography variant="h5" sx={{ color: "#257e68", fontWeight: "bold" }}>
                Are you sure you want to export drivers?
              </Typography>
            </Box>
          ) : popupMode === "Doordash" ? (
            <Box sx={{ alignItems: "center", textAlign: "center", padding: "1%" }}>
              <Typography variant="h5" sx={{ color: "#257e68", fontWeight: "bold" }}>
                Are you sure you want to export Doordash?
              </Typography>
            </Box>
          ) : popupMode === "Clusters" ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                padding: "8px 0",
              }}
            >
              {/* Cluster Number Input */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="body1">
                  Enter desired number of clusters:
                </Typography>
                <TextField
                  type="number"
                  value={clusterNum}
                  sx={{ width: "100px" }}
                  onChange={(e) => setClusterNum(Number(e.target.value))}
                  inputProps={{ min: 1 }}
                  size="small"
                  variant="outlined"
                />
              </Box>

              {/* Deliveries Range Input */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginTop: "20px",
                }}
              >
                <Typography variant="body2">
                  <b>
                    <u>Deliveries Per Cluster:</u>
                  </b>
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="body2">Minimum:</Typography>
                  <TextField
                    type="number"
                    value={minDeliveries}
                    sx={{ width: "100px" }}
                    onChange={(e) => setMinDeliveries(Number(e.target.value))}
                    inputProps={{ min: 0 }}
                    size="small"
                    variant="outlined"
                  />

                  <Typography variant="body2">Maximum:</Typography>
                  <TextField
                    type="number"
                    value={maxDeliveries}
                    sx={{ width: "100px" }}
                    onChange={(e) => setMaxDeliveries(Number(e.target.value))}
                    inputProps={{ min: 0 }}
                    size="small"
                    variant="outlined"
                  />
                </Box>
                {clusterError ? (
                  <Typography color="error">{clusterError}</Typography>
                ) : null}
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions
          sx={{
            width: "100%",
            padding: 0,
            display: "flex",
          }}
        >
          <Button
            color="primary"
            sx={{
              flex: 1,
              minWidth: "30%",
              borderRadius: "5%",
              height: "60px",
              margin: "2%",
              backgroundColor: "#257e68",
              fontWeight: "bold",
            }}
            onClick={() => {
              popupMode === "Driver"
                ? assignDriver()
                : popupMode === "Time"
                  ? assignTime()
                  : popupMode === "CSV"
                    ? setExportCSV(true)
                    : popupMode === "Doordash"
                      ? setExportDoordash(true)
                      : popupMode === "Clusters"
                        ? generateClusters()
                        : console.log("invalid");
            }}
          >
            {popupMode === "CSV" || popupMode === "Doordash" ? "YES" : "SAVE"}
          </Button>
          <Button
            color="secondary"
            sx={{
              flex: 1,
              minWidth: "30%",
              borderRadius: "5%",
              height: "60px",
              margin: "2%",
              backgroundColor: "#AEAEAE !important",
              fontWeight: "bold",
            }}
            onClick={() => resetSelections()}
          >
            {popupMode === "CSV" || popupMode === "Doordash" ? "NO" : "CANCEL"}
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

{
  /* <Button
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
</Button> */
}
export default DeliverySpreadsheet;
