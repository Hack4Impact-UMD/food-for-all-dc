import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../auth/firebaseConfig";
import { Search, Filter } from "lucide-react";
import { query, Timestamp, updateDoc, where } from "firebase/firestore";
import { format, addDays } from "date-fns";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import "./DeliverySpreadsheet.css";
import "leaflet/dist/leaflet.css";
import PageDatePicker from "../../components/PageDatePicker/PageDatePicker";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  SelectChangeEvent,
  TextField,
  Menu,
} from "@mui/material";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { auth } from "../../auth/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import ClusterMap from "./ClusterMap";
import AssignDriverPopup from "./components/AssignDriverPopup";
import GenerateClustersPopup from "./components/GenerateClustersPopup";
import AssignTimePopup from "./components/AssignTimePopup";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import { exportDeliveries } from "./RouteExport";
import Button from "../../components/common/Button";
import ManualAssign from "./components/ManualAssignPopup";
import { RowData as DeliveryRowData } from "./types/deliveryTypes";
import { Driver } from '../../types/calendar-types';
import { CustomRowData, useCustomColumns } from "../../hooks/useCustomColumns";
import ClientService from "../../services/client-service";
import { LatLngTuple } from "leaflet";

interface RowData {
  id: string;
  clientid: string;
  firstName: string;
  lastName: string;
  address: string;
  tags?: string[];
  ward?: string;
  clusterId: string;
  coordinates: { lat: number; lng: number }[];
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

// interface Driver {
//   id: string;
//   name: string;
//   phone: string
//   email: string;
// }


// Define a type for fields that can either be computed or direct keys of DeliveryRowData
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
      compute: (data: DeliveryRowData) => string;
    }
    | {
      key: "clusterIdChange";
      label: "Cluster ID";
      type: "select";
      compute?: (data: DeliveryRowData) => string;
    }
  | {
      key: Exclude<keyof Omit<DeliveryRowData, "id" | "firstName" | "lastName" | "deliveryDetails">, "coordinates">;
      label: string;
      type: string;
      compute?: never;
    }
  | {
      key: "tags";
      label: "Tags";
      type: "text";
      compute: (data: DeliveryRowData) => string;
    }
  | {
      key: "assignedDriver";
      label: "Assigned Driver";
      type: "text";
      compute: (data: DeliveryRowData, clusters: Cluster[]) => string;
    }
  | {
      key: "assignedTime";
      label: "Assigned Time";
      type: "text";
      compute: (data: DeliveryRowData, clusters: Cluster[]) => string;
    }
  | {
      key: "deliveryDetails.deliveryInstructions";
      label: "Delivery Instructions";
      type: "text";
      compute: (data: DeliveryRowData) => string;
    };

// Export the Cluster interface
export interface Cluster {
  id: string;
  driver?: any;
  time: string;
  deliveries: string[];
}

interface ClusterDoc {
  docId: string;
  date: Timestamp;
  clusters: Cluster[];
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
  },
  {
    key: "fullname",
    label: "Client",
    type: "text",
    compute: (data: DeliveryRowData) => `${data.lastName}, ${data.firstName}`,
  },
  {
    key: "clusterIdChange",
    label: "Cluster ID",
    type: "select",
    compute: (data: DeliveryRowData) => {
      const cluster = data.clusterId;
      return cluster;
    },
  },
  {
    key: "tags",
    label: "Tags",
    type: "text",
    compute: (data: DeliveryRowData) => {
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
    compute: (data: DeliveryRowData, clusters: Cluster[]) => {
      let driver = "";
      clusters.forEach((cluster) => {
        if (cluster.deliveries?.some((id) => id == data.id)) {
          driver = cluster.driver;
        }
      });
      return driver ? driver : "No driver assigned";
    },
  },
  {
    key: "assignedTime",
    label: "Assigned Time",
    type: "text",
    compute: (data: DeliveryRowData, clusters: Cluster[]) => {
      let time = "";
      clusters.forEach((cluster) => {
        if (cluster.deliveries?.some((id) => id === data.id)) {
          time = cluster.time;
        }
      });

      if (!time) return "No time assigned";

      // Convert 24-hour format to 12-hour AM/PM format
      const [hours, minutes] = time.split(":");
      let hours12 = parseInt(hours, 10);
      const ampm = hours12 >= 12 ? "PM" : "AM";
      hours12 = hours12 % 12;
      hours12 = hours12 ? hours12 : 12; // Convert 0 to 12 for 12 AM

      return `${hours12}:${minutes} ${ampm}`;
    },
  },
];

const times = [
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "17:00", label: "5:00 PM" },
];

// Type Guard to check if a field is a regular field
const isRegularField = (
  field: Field
): field is Extract<Field, { key: Exclude<keyof DeliveryRowData, "coordinates"> }> => {
  return field.key !== "fullname" && 
         field.key !== "tags" && 
         field.key !== "assignedDriver" &&
         field.key !== "assignedTime" &&
         field.key !== "deliveryDetails.deliveryInstructions";
};

const DeliverySpreadsheet: React.FC = () => {
  const testing = false;
  const [rows, setRows] = useState<DeliveryRowData[]>([]);
  const [rawClientData, setRawClientData] = useState<DeliveryRowData[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [innerPopup, setInnerPopup] = useState(false);
  const [popupMode, setPopupMode] = useState("");
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedClusters, setSelectedClusters] = useState<Set<any>>(new Set());
  const [exportOption, setExportOption] = useState<"Routes" | "Doordash" | null>(null);
  const [emailOrDownload, setEmailOrDownload] = useState<"Email" | "Download" | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [deliveriesForDate, setDeliveriesForDate] = useState<DeliveryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clusterDoc, setClusterDoc] = useState<ClusterDoc | null>();
  const navigate = useNavigate();
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const {
    customColumns,
    handleAddCustomColumn,
    handleCustomHeaderChange,
    handleRemoveCustomColumn,
    handleCustomColumnChange,
  } = useCustomColumns();
  const [customRows, setCustomRows] = useState<CustomRowData[]>([])


  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setOpen(true);
    setAnchorEl(event.currentTarget);
  };

  const [menuOpen, setOpen] = useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const handleClose = (event: Event | React.SyntheticEvent) => {
    if (
      anchorRef.current &&
      anchorRef.current.contains(event.target as HTMLElement)
    ) {
      return;
    }
    if(event && 'nativeEvent' in event) {
      const target = event.nativeEvent.target as HTMLElement;
      const timeValue =  target.getAttribute("data-key");
      if (timeValue) {
        assignTime(timeValue);
      }
    }
    setOpen(false);
  };


  // Calculate Cluster Options
  const clusterOptions = useMemo(() => {
    const existingIds = clusters.map((c) => parseInt(c.id, 10)).filter((id) => !isNaN(id));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const nextId = (maxId + 1).toString();
    const availableIds = clusters.map(c => c.id).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const options = [
      ...availableIds.map(id => ({ value: id, label: id })),
      { value: nextId, label: nextId }
    ];
    options.pop()
    if(options.length == 0){
      options.push({value:"", label:"No Current Clusters"})
    }
    return options;
  }, [clusters]);

  // fetch deliveries for the selected date
  const fetchDeliveriesForDate = async (dateForFetch: Date) => {
    try {
      // account for timezone issues
      const startDate = new Date(
        Date.UTC(
          dateForFetch.getFullYear(),
          dateForFetch.getMonth(),
          dateForFetch.getDate(),
          0,
          0,
          0
        )
      );

      const endDate = new Date(
        Date.UTC(
          dateForFetch.getFullYear(),
          dateForFetch.getMonth(),
          dateForFetch.getDate(),
          23,
          59,
          59
        )
      );

      const eventsRef = collection(db, "events");
      const q = query(
        eventsRef,
        where("deliveryDate", ">=", Timestamp.fromDate(startDate)),
        where("deliveryDate", "<=", Timestamp.fromDate(endDate))
      );

      const querySnapshot = await getDocs(q);

      // Check if the date is still the selected one before updating state
      if (dateForFetch.getTime() !== selectedDate.getTime()) {
        console.log("Stale delivery fetch ignored for date:", dateForFetch);
        return; // Don't update state with stale data
      }

      const events = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          deliveryDate: data.deliveryDate.toDate(), // preserve as-is (already correct local representation)
        };
      }) as DeliveryEvent[];

      //set the deliveries for the date
      setDeliveriesForDate(events);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      // Clear state only if the error corresponds to the *currently* selected date
      if (dateForFetch.getTime() === selectedDate.getTime()) {
        setDeliveriesForDate([]);
      }
    }
  };

  //when the user changes the date, fetch the deliveries for that date
  useEffect(() => {
    const currentFetchDate = selectedDate; // Capture date at effect run time
    fetchDeliveriesForDate(currentFetchDate);
    // No explicit cleanup needed with the check inside the async function
  }, [selectedDate]);

  useEffect(() => {
    const fetchDataAndGeocode = async () => {
      // If deliveriesForDate is updated, it's for the current selectedDate
      // because fetchDeliveriesForDate filters stale updates.

      // setIsLoading(true) is moved here to only show loading when processing clients
      // setIsLoading(true); // Already set by the caller effect

    try {
      // Get the client IDs for the deliveries on the selected date
      const clientIds = deliveriesForDate.map(delivery => delivery.clientId).filter(id => id && id.trim() !== "");
      // Firestore 'in' queries are limited to 10 items per query
      const chunkSize = 10;
      let clientsWithDeliveriesOnSelectedDate: DeliveryRowData[] = [];
      for (let i = 0; i < clientIds.length; i += chunkSize) {
        const chunk = clientIds.slice(i, i + chunkSize);
        if (chunk.length === 0) continue;
        const q = query(
          collection(db, "clients"),
          where("__name__", "in", chunk)
        );
        const snapshot = await getDocs(q);
        const chunkData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as DeliveryRowData));
        clientsWithDeliveriesOnSelectedDate = clientsWithDeliveriesOnSelectedDate.concat(chunkData);
      }
      setRawClientData(clientsWithDeliveriesOnSelectedDate);
    } catch (error) {
      console.error("Error fetching/geocoding client data:", error);
      setRawClientData([]); // Clear data on error
    } finally {
      //Stop loading after processing
      setIsLoading(false); 
    }
  };
  
  if (deliveriesForDate.length > 0) {
    // Set loading to true *before* starting the async fetch/geocode process
    setIsLoading(true);
    fetchDataAndGeocode();
  } else {
    // If deliveries are empty (either initially or after fetch),
    // ensure client data is clear and loading is stopped.
    setRawClientData([]);
    // Do NOT clear clusters here, as they are fetched independently
    setIsLoading(false);
  }
// Only depends on deliveriesForDate. isLoading is managed internally.
}, [deliveriesForDate]);

  //get clusters
  useEffect(() => {
    fetchClustersFromToday(selectedDate);
  }, [selectedDate]);

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

  const fetchClustersFromToday = async (dateForFetch: Date) => {
    try {
      // account for timezone issues
      const startDate = new Date(
        Date.UTC(
          dateForFetch.getFullYear(),
          dateForFetch.getMonth(),
          dateForFetch.getDate(),
          0,
          0,
          0
        )
      );

      const endDate = new Date(
        Date.UTC(
          dateForFetch.getFullYear(),
          dateForFetch.getMonth(),
          dateForFetch.getDate(),
          23,
          59,
          59
        )
      );

      const clustersCollectionRef = collection(db, "clusters");
      const q = query(
        clustersCollectionRef,
        where("date", ">=", Timestamp.fromDate(startDate)),
        where("date", "<=", Timestamp.fromDate(endDate))
      );

      const clustersSnapshot = await getDocs(q);

      // Check if the date is still the selected one before updating state
      if (dateForFetch.getTime() !== selectedDate.getTime()) {
        console.log("Stale cluster fetch ignored for date:", dateForFetch);
        return; // Don't update state with stale data
      }

      if (!clustersSnapshot.empty) {
        // There should only be one document per date
        const doc = clustersSnapshot.docs[0];
        const clustersData = {
          docId: doc.id,
          date: doc.data().date.toDate(),
          clusters: doc.data().clusters || [],
        };
        setClusterDoc(clustersData);
        setClusters(clustersData.clusters);
      } else {
        setClusterDoc(null); // Clear clusterDoc when no clusters found
        setClusters([]);
      }
    } catch (error) {
      console.error("Error fetching clusters:", error);
      // Clear state only if the error corresponds to the *currently* selected date
      if (dateForFetch.getTime() === selectedDate.getTime()) {
        setClusterDoc(null);
        setClusters([]);
      }
    }
  };

  // handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleClusterChange = async (row: DeliveryRowData, newClusterIdStr: string) => {
    const oldClusterId = row.clusterId || "";
    const newClusterId = newClusterIdStr;

    if (!row || !row.id || newClusterId === oldClusterId || !clusterDoc) {
      console.log("Cluster change aborted (no change, missing data, or no clusterDoc)");
      return;
    }

    let updatedClusters = [...clusters];
    const clusterExists = clusters.some((cluster) => cluster.id === newClusterId);

    if (oldClusterId) {
      updatedClusters = updatedClusters.map(cluster => {
        if (cluster.id === oldClusterId) {
          return {
            ...cluster,
            deliveries: cluster.deliveries?.filter(id => id !== row.id) ?? []
          };
        }
        return cluster;
      });
    }

    if (newClusterId) {
      if (clusterExists) {
        updatedClusters = updatedClusters.map((cluster) => {
          if (cluster.id === newClusterId) {
            return {
              ...cluster,
              deliveries: [...(cluster.deliveries ?? []), row.id],
            };
          }
          return cluster;
        });
      } else {
        const newCluster: Cluster = {
          id: newClusterId,
          deliveries: [row.id],
          driver: "",
          time: "",
        };
        updatedClusters.push(newCluster);
      }
    }

    updatedClusters.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

    setClusters(updatedClusters);

    try {
      const clusterRef = doc(db, "clusters", clusterDoc.docId);
      await updateDoc(clusterRef, { clusters: updatedClusters });
      console.log(
        `Successfully moved ${row.id} from cluster ${oldClusterId || "none"} to ${newClusterId || "none"}`
      );

      // setRows(prevRows => prevRows.map(r => r.id === row.id ? { ...r, clusterId: newClusterId } : r));
    } catch (error) {
      console.error("Error updating clusters in Firestore:", error);
    }
  };

  const handleEmailOrDownload = async (option: "Email" | "Download") => {
    setEmailOrDownload(option);
    setPopupMode("");

    if (exportOption === "Routes") {
      if (option === "Email") {
        // Logic to email Routes

        try {
          // Trigger the Google Cloud Function for emailing Routes
          const response = await fetch(
            `https://route-exports-251910218620.us-central1.run.app?deliveryDate=${format(selectedDate, "yyyy-MM-dd")}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (response.ok) {
            const result = await response.text();
            console.log("Email sent successfully:", result);
            alert("Routes emailed successfully!");
          } else {
            console.error("Failed to email Routes:", response.statusText);
            alert("Failed to email Routes. Please try again.");
          }
        } catch (error) {
          console.error("Error emailing Routes:", error);
          alert("An error occurred while emailing Routes. Please try again.");
        }



        console.log("Emailing Routes...");
        // Add your email logic here
      } else if (option === "Download") {
        // Pass visibleRows and clusters to exportDeliveries
        exportDeliveries(format(selectedDate, "yyyy-MM-dd"), rows, clusters);
        console.log("Downloading Routes...");
        // Add your download logic here
      }
    } else if (exportOption === "Doordash") {
      if (option === "Email") {
        // Logic to email Doordash
        console.log("Emailing Doordash...");

        try {
          // Trigger the Google Cloud Function for emailing Doordash
          const response = await fetch(
            `https://route-exports-251910218620.us-central1.run.app?deliveryDate=${format(selectedDate, "yyyy-MM-dd")}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (response.ok) {
            const result = await response.text();
            console.log("Email sent successfully:", result);
            alert("Doordash deliveries emailed successfully!");
          } else {
            console.error("Failed to email Doordash deliveries:", response.statusText);
            alert("Failed to email Doordash deliveries. Please try again.");
          }
        } catch (error) {
          console.error("Error emailing Doordash deliveries:", error);
          alert("An error occurred while emailing Doordash deliveries. Please try again.");
        }
        // Add your email logic here
      } else if (option === "Download") {
        // Logic to download Doordash
        console.log("Downloading Doordash...");
        // Add your download logic here
      }
    }
  };

  // reset popup selections when closing popup
  const resetSelections = () => {
    setPopupMode("");
    setExportOption(null);
    setEmailOrDownload(null);
    setSelectedClusters(new Set());
    setSelectedRows(new Set());
  };

  //Handle assigning driver
  const assignDriver = async (driver: Driver | null) => {
    if (!driver || !clusterDoc) {
      console.log("Assign driver aborted: Driver is null or clusterDoc is missing.");
      resetSelections();
      return;
    }

    try {
      const updatedClusters = clusters.map((cluster) => {
        const isSelected = Array.from(selectedClusters).some(
          (selected) => selected.id === cluster.id
        );
        if (isSelected) {
          return {
            ...cluster,
            driver: driver.name,
          };
        }
        return cluster;
      });

      setClusters(updatedClusters);

      const clusterRef = doc(db, "clusters", clusterDoc.docId);
      await updateDoc(clusterRef, { clusters: updatedClusters });

      resetSelections();
    } catch (error) {
      console.error("Error assigning driver: ", error);
    }
  };

  const updateClusters = async (clusterMap: { [key: string]: string[] }) => {
    const newClusters: Cluster[] = [];
    Object.keys(clusterMap).forEach((clusterId) => {
      // Exclude "doordash" if it's a special case (though unlikely with ID mapping now)
      if (clusterId !== "doordash") { 
        // The value in clusterMap[clusterId] is already the array of client IDs
        const clientIdsForCluster = clusterMap[clusterId]; 
        
        newClusters.push({
          deliveries: clientIdsForCluster, // Directly use the array of client IDs
          driver: "", // Initialize with defaults or fetch existing if needed
          time: "",   // Initialize with defaults or fetch existing if needed
          id: clusterId,
        });
      }
    });

    // Sort clusters numerically by ID for consistency
    newClusters.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

    return newClusters;
  };

  //Handle assigning time
  const assignTime = async (time: string) => {
    if (time && clusterDoc) {
      try {
        // Create a new clusters array with updated time assignments
        const updatedClusters = clusters.map((cluster) => {
          // Check if this cluster is among the selected ones (using ID for comparison)
          const isSelected = Array.from(selectedClusters).some(
            (selected) => selected.id === cluster.id
          );
          if (isSelected) {
            // Return a *new* cluster object with the assigned time
            return {
              ...cluster,
              time: time, // Assign the new time
            };
          }
          // Return the original cluster object if not selected
          return cluster;
        });

        setClusters(updatedClusters); // Update state with the new immutable array

        // Update Firestore using updateDoc
        const clusterRef = doc(db, "clusters", clusterDoc.docId);
        // Only update the 'clusters' field
        await updateDoc(clusterRef, { clusters: updatedClusters });

        resetSelections();
      } catch (error) {
        console.error("Error assigning time: ", error);
      }
    }
  };

  const initClustersForDay = async (newClusters: Cluster[]) => {
    const docRef = doc(collection(db, "clusters"));

    // Use selectedDate to ensure consistency with fetched data
    const clusterDate = new Date(Date.UTC(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      0, 0, 0, 0
    ));

    const newClusterDoc = {
      clusters: newClusters,
      docId: docRef.id,
      date: Timestamp.fromDate(clusterDate) // Use consistent date
    }

    // Firestore expects the data object directly for setDoc - Corrected
    await setDoc(docRef, newClusterDoc); 
    setClusters(newClusters); // Update state after successful Firestore creation
    setClusterDoc(newClusterDoc)
  }

  const manualAssign = async (assignedClusters: string[], clusters: number) => {
    //make blank cluster template
    const newClusters: Cluster[] = Array.from({ length: clusters }, (_, i) => ({
      id: (i + 1).toString(),
      driver: "",
      time: "",
      deliveries: [],
    }));
    
    //populate deliveries for clusters
    assignedClusters.forEach((clusterIndex, deliveryIndex) => {
      const numericIndex = parseInt(clusterIndex) - 1;
      if (numericIndex >= 0 && numericIndex < newClusters.length) {
        // Use visibleRows here
        newClusters[numericIndex].deliveries.push(visibleRows[deliveryIndex].id);
      } else {
        console.warn(`Invalid cluster index: ${clusterIndex}`);
      }
    });


    if(clusterDoc){
      const clusterRef = doc(db, "clusters", clusterDoc.docId);
      // Only update the 'clusters' field using updateDoc
      await updateDoc(clusterRef, { clusters: newClusters });
      setClusters(newClusters); // Update state after successful Firestore update
      // Update the local clusterDoc state's clusters as well
      setClusterDoc(prevDoc => prevDoc ? { ...prevDoc, clusters: newClusters } : null);
    }
    else{
      initClustersForDay(newClusters);
    }       
    resetSelections()
  };

  // Helper function to check if coordinates are valid
  const isValidCoordinate = (coord: LatLngTuple | { lat: number; lng: number } | undefined | null): coord is LatLngTuple | { lat: number; lng: number } => {
    if (!coord) return false;
    if (Array.isArray(coord)) { // Check for LatLngTuple [number, number]
      return coord.length === 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number' && (coord[0] !== 0 || coord[1] !== 0);
    }
    // Check for { lat: number, lng: number }
    return typeof coord.lat === 'number' && typeof coord.lng === 'number' && (coord.lat !== 0 || coord.lng !== 0);
  };

  const generateClusters = async (
    clusterNum: number,
    minDeliveries: number,
    maxDeliveries: number
  ) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Authentication token not found.");
    }

    // --- Validation (keep existing validation) ---
    if (!clusterNum || clusterNum <= 0) {
      throw new Error("Please enter a valid number of clusters (must be at least 1)");
    }
    // Use visibleRows here
    if (visibleRows.length === 0) {
      throw new Error("No deliveries scheduled for the selected date or matching filters");
    }
    // ... (keep other validations for min/max deliveries, cluster count etc.) ...
    const totalMinRequired = clusterNum * minDeliveries;
    const totalMaxAllowed = clusterNum * maxDeliveries;
    if (totalMinRequired > visibleRows.length) {
      throw new Error(
        `Not enough deliveries for ${clusterNum} clusters with minimum ${minDeliveries} each.\n` +
        `Required: ${totalMinRequired} | Available: ${visibleRows.length}\n` +
        `Please reduce cluster count or minimum deliveries.`
      );
    }
    if (visibleRows.length > totalMaxAllowed) {
       throw new Error(
        `Too many deliveries for ${clusterNum} clusters with maximum ${maxDeliveries} each.\n` +
        `Allowed: ${totalMaxAllowed} | Available: ${visibleRows.length}\n` +
        `Please increase cluster count or maximum deliveries.`
      );
    }
    const maxRecommendedClusters = Math.min(
      Math.ceil(visibleRows.length / 2), // At least 2 deliveries per cluster
      visibleRows.length // Can't have more clusters than deliveries
    );
    if (clusterNum > maxRecommendedClusters) {
      throw new Error(
        `Too many clusters requested (${clusterNum}).\n` +
        `Recommended maximum for ${visibleRows.length} deliveries: ${maxRecommendedClusters}`
      );
    }
    // --- End Validation ---

    setPopupMode("");
    setIsLoading(true);

    try { // Wrap the core logic in try/finally to ensure loading state is reset

      const clientsToGeocode: { id: string; address: string; originalIndex: number }[] = [];
      const existingCoordsMap = new Map<string, LatLngTuple | { lat: number; lng: number }>();
      const finalCoordinates: (LatLngTuple | null)[] = new Array(visibleRows.length).fill(null); // Initialize with nulls

      // 1 & 2: Separate clients and collect existing coords
      visibleRows.forEach((row: DeliveryRowData, index: number) => {
        if (isValidCoordinate(row.coordinates)) {
           // Normalize coordinate format if necessary (e.g., always use [lat, lng])
           const coords = Array.isArray(row.coordinates)
             ? row.coordinates
             : [row.coordinates.lat, row.coordinates.lng];
           existingCoordsMap.set(row.id, coords as LatLngTuple);
           finalCoordinates[index] = coords as LatLngTuple; // Pre-fill with existing
        } else {
          clientsToGeocode.push({ id: row.id, address: row.address, originalIndex: index });
        }
      });

      // 3. Conditional Geocoding
      if (clientsToGeocode.length > 0) {
        console.log(`Geocoding ${clientsToGeocode.length} addresses...`);
        const addressesToFetch = clientsToGeocode.map(client => client.address);
        const geocodeResponse = await fetch(
          testing ? "" : "https://geocode-addresses-endpoint-lzrplp4tfa-uc.a.run.app",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ addresses: addressesToFetch }),
          }
        );

        if (!geocodeResponse.ok) {
          const errorText = await geocodeResponse.text();
          console.error("Geocoding failed:", errorText);
          throw new Error(`Failed to geocode addresses. Status: ${geocodeResponse.status}`);
        }

        const { coordinates: fetchedCoords } = await geocodeResponse.json();

        if (!Array.isArray(fetchedCoords) || fetchedCoords.length !== clientsToGeocode.length) {
           throw new Error("Geocoding response format is incorrect or length mismatch.");
        }

        // 4. Update Firestore & 5. Combine Coordinates (Part 1: Newly fetched)
        const updatePromises: Promise<void>[] = [];
        fetchedCoords.forEach((coords: LatLngTuple | null, i: number) => {
          const client = clientsToGeocode[i];
          if (isValidCoordinate(coords)) {
            finalCoordinates[client.originalIndex] = coords; // Add newly fetched coords
            // Schedule Firestore update (don't await here individually to speed up)
            updatePromises.push(
               ClientService.getInstance().updateClientCoordinates(client.id, coords)
                 .catch(err => console.error(`Failed to update coordinates for client ${client.id}:`, err)) // Log errors but don't fail the whole process
            );
          } else {
            console.warn(`Failed to geocode address for client ${client.id}: ${client.address}. Skipping this client.`);
            // Keep finalCoordinates[client.originalIndex] as null
          }
        });

         // Wait for all Firestore updates to attempt completion
         await Promise.all(updatePromises);
         console.log("Finished attempting coordinate updates in Firestore.");
      } else {
        console.log("No new addresses to geocode.");
      }

      // Filter out any clients that couldn't be geocoded (their entry in finalCoordinates will be null)
      const validCoordsForClustering = finalCoordinates.filter(coords => coords !== null) as LatLngTuple[];
      // Keep track of the original indices corresponding to validCoordsForClustering
      const originalIndicesForValidCoords = visibleRows
         .map((_: DeliveryRowData, index: number) => index)
         .filter((index: number) => finalCoordinates[index] !== null);

      if (validCoordsForClustering.length === 0) {
         throw new Error("No valid coordinates available for clustering after geocoding.");
      }

      // Adjust clusterNum if it exceeds the number of valid points
      const adjustedClusterNum = Math.min(clusterNum, validCoordsForClustering.length);
      if (adjustedClusterNum !== clusterNum) {
         console.warn(`Adjusted cluster count from ${clusterNum} to ${adjustedClusterNum} due to invalid coordinates.`);
      }

      // Adjust min/max deliveries if necessary based on valid coordinates count
      const adjustedMaxDeliveries = Math.min(maxDeliveries, validCoordsForClustering.length);
      const adjustedMinDeliveries = Math.min(minDeliveries, adjustedMaxDeliveries); // Min cannot be > Max

      // --- Re-validate with adjusted numbers ---
      const adjustedTotalMinRequired = adjustedClusterNum * adjustedMinDeliveries;
      const adjustedTotalMaxAllowed = adjustedClusterNum * adjustedMaxDeliveries;

      if (adjustedTotalMinRequired > validCoordsForClustering.length) {
        throw new Error(
          `Not enough valid deliveries (${validCoordsForClustering.length}) for ${adjustedClusterNum} clusters with adjusted minimum ${adjustedMinDeliveries} each.\n` +
          `Required: ${adjustedTotalMinRequired}. Issue might be due to failed geocoding.`
        );
      }
      if (validCoordsForClustering.length > adjustedTotalMaxAllowed) {
         throw new Error(
          `Too many valid deliveries (${validCoordsForClustering.length}) for ${adjustedClusterNum} clusters with adjusted maximum ${adjustedMaxDeliveries} each.\n` +
          `Allowed: ${adjustedTotalMaxAllowed}. Issue might be due to failed geocoding.`
        );
      }
      // --- End Re-validation ---


      console.log(`Generating ${adjustedClusterNum} clusters for ${validCoordsForClustering.length} valid coordinates...`);
      // 6. Call Clustering
      const clusterResponse = await fetch(
        testing ? "" : "https://cluster-deliveries-k-means-lzrplp4tfa-uc.a.run.app",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            coords: validCoordsForClustering, // Use only valid coordinates
            drivers_count: adjustedClusterNum,
            min_deliveries: adjustedMinDeliveries, // Use adjusted values
            max_deliveries: adjustedMaxDeliveries, // Use adjusted values
          }),
        }
      );

      if (!clusterResponse.ok) {
        const errorText = await clusterResponse.text();
        console.error("Clustering failed:", errorText);
        throw new Error(`Failed to generate clusters. Status: ${clusterResponse.status}`);
      }

      const clusterData = await clusterResponse.json(); // e.g., { clusters: { "1": [0, 3], "2": [1, 2] } } where indices refer to validCoordsForClustering

      // 7. Associate Clusters back to Client IDs
      // The clusterData indices refer to the `validCoordsForClustering` array.
      // We need to map these back to the original client IDs using `originalIndicesForValidCoords`.
      const clustersWithClientIds: { [key: string]: string[] } = {};
      for (const clusterName in clusterData.clusters) {
        clustersWithClientIds[clusterName] = clusterData.clusters[clusterName].map((indexInValidCoords: number) => {
          const originalIndex = originalIndicesForValidCoords[indexInValidCoords];
          return visibleRows[originalIndex].id; // Get client ID from original visibleRows
        });
      }

      // Update Firestore and local state with the new cluster assignments (using client IDs)
      const newClusters = await updateClusters(clustersWithClientIds); // Pass the map with client IDs

      if (clusterDoc) {
        const clusterRef = doc(db, "clusters", clusterDoc.docId);
        await updateDoc(clusterRef, { clusters: newClusters });
        setClusters(newClusters);
        setClusterDoc(prevDoc => prevDoc ? { ...prevDoc, clusters: newClusters } : null);
      } else {
        await initClustersForDay(newClusters); // Make sure this also sets state correctly
      }

      resetSelections();

    } catch (error: any) {
       console.error("Error during cluster generation:", error);
       // Re-throw the error so the popup can display it
       throw error;
    } finally {
      setIsLoading(false); // Ensure loading indicator is turned off
    }
  };

  // Handle checkbox selection
  const handleCheckboxChange = (row: DeliveryRowData) => {
    const newSelectedRows = new Set(selectedRows);
    const newSelectedClusters = new Set(selectedClusters);
    const rowToToggle = row;

    if (rowToToggle) {
      const clusterId = rowToToggle.clusterId;
      if (clusterId) {
        const cluster = clusters?.find((c) => c.id.toString() === clusterId);
        const rowsWithSameClusterID = rows.filter((row) => row.clusterId === clusterId);

        if (cluster) {
          // Check if the current row is already selected
          const isSelected = newSelectedRows.has(row.id);

          // Toggle selection for all rows with the same clusterId
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

  const clientsWithDeliveriesOnSelectedDate = rows.filter((row) =>
    deliveriesForDate.some((delivery) => delivery.clientId === row.id)
  );
  
  // const visibleRows = rows.filter(row => {
  //   if (!searchQuery) return true; // Show all if no search query
    
  //   const searchTerm = searchQuery.toLowerCase().trim();
    
  //   return (
  //     row.firstName.toLowerCase().includes(searchTerm) ||
  //     row.lastName.toLowerCase().includes(searchTerm)
  //   );
  // });

  const visibleRows = rows.filter((row) => {
    const keywordRegex = /(\w+):\s*("[^"]+"|\S+)/g; // Matches key: "value" or key: value
    const matches = [...searchQuery.matchAll(keywordRegex)];
  
    if (matches.length > 0) {
      // For keyword queries, check that each provided value is a substring of the corresponding field
      return matches.every(([_, key, value]) => {
        const strippedValue = value.replace(/"/g, "").toLowerCase(); // Remove quotes and lowercase
        
        // Check static fields with a substring match
        const matchesStaticField = fields.some((field) => {
          const fieldValue = field.compute ? field.compute(row, clusters) : row[field.key as keyof DeliveryRowData];
          return (
            fieldValue != null &&
            fieldValue.toString().toLowerCase().includes(strippedValue)
          );
        });
    
        // Check custom columns with a substring match
        const matchesCustomColumn = customColumns.some((col) => {
          if (col.propertyKey !== "none") {
            const fieldValue = row[col.propertyKey as keyof DeliveryRowData];
            return (
              fieldValue != null &&
              fieldValue.toString().toLowerCase().includes(strippedValue)
            );
          }
          return false;
        });
    
        return matchesStaticField || matchesCustomColumn;
      });
    } else {
      // Fallback to general search logic
      const eachQuery = searchQuery.match(/"[^"]+"|\S+/g) || [];
      
      const quotedQueries = eachQuery.filter(s => s.startsWith('"') && s.endsWith('"') && s.length > 1) || [];
      const nonQuotedQueries = eachQuery.filter(s => s.length === 1 || !s.endsWith('"')) || [];
    
      const containsQuotedQueries = quotedQueries.length === 0
        ? true
        : quotedQueries.every((query) => {
            // Use substring matching instead of exact equality
            const strippedQuery = query.slice(1, -1).trim().toLowerCase();
            const matchesStaticField = fields.some((field) => {
              const fieldValue = field.compute ? field.compute(row, clusters) : row[field.key as keyof DeliveryRowData];
              return (
                fieldValue != null &&
                fieldValue.toString().toLowerCase().includes(strippedQuery)
              );
            });
            const matchesCustomColumn = customColumns.some((col) => {
              if (col.propertyKey !== "none") {
                const fieldValue = row[col.propertyKey as keyof DeliveryRowData];
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
                const fieldValue = field.compute ? field.compute(row, clusters) : row[field.key as keyof DeliveryRowData];
                if (fieldValue == null) return false;
                return fieldValue.toString().toLowerCase().includes(strippedQuery);
              });
              const matchesCustomColumn = customColumns.some((col) => {
                if (col.propertyKey !== "none") {
                  const fieldValue = row[col.propertyKey as keyof DeliveryRowData];
                  return (
                    fieldValue != null &&
                    fieldValue.toString().toLowerCase().includes(strippedQuery)
                  );
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

  // Synchronize rows state with rawClientData and clusters
  useEffect(() => {
    if (rawClientData.length === 0) {
      setRows([]);
      return;
    }

    const synchronizedRows = rawClientData.map((client) => {
      let assignedClusterId = "";
      clusters.forEach((cluster) => {
        if (cluster.deliveries?.includes(client.id)) {
          assignedClusterId = cluster.id;
        }
      });
      return { ...client, clusterId: assignedClusterId };
    });

    setRows(synchronizedRows);
  }, [rawClientData, clusters]);

  return (
    <Box className="box" sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{display: "flex", alignItems: "center", justifyContent:"space-between"}}>

      <Box sx={{ 
        display: "flex",
        alignItems: "center",
        padding: "16px",
        backgroundColor: "#fff",
        zIndex: 10,
        position: "sticky",
        top: 0,
        width: "100%"
      }}>
        <Typography variant="h4" sx={{ marginRight: 2, width: "170px", color: "#787777" }}>
          {format(selectedDate, 'EEEE')}
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
          <Typography variant="h5" sx={{ color: "#fff"}}>
            {format(selectedDate, 'd')}
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
          variant="secondary"
          size="small"
          style={{ width: 50, fontSize: 12, marginLeft: 16 }}
          onClick={() => setSelectedDate(new Date())}
        >
          Today
        </Button>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <PageDatePicker setSelectedDate={(date) => setSelectedDate(date)} marginLeft="1rem" />
        </Box>
      </Box>
      <Button
        variant="primary"
        size="medium"
        style={{
          whiteSpace: "nowrap",
          padding: "0% 2%",
          borderRadius: 5,
          width: "auto",
          marginRight: '16px'
        }}
        onClick={() => setPopupMode("ManualClusters")}
      >
        Manual Assign
      </Button>

      <Button
        variant="primary"
        size="medium"
        style={{
          whiteSpace: "nowrap",
          padding: "0% 2%",
          borderRadius: 5,
          width: "auto",
          marginRight: '16px'
        }}
        onClick={() => setPopupMode("Clusters")}
      >
        Generate Clusters
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
          // Removed position: "relative"
        }}
      >
        {isLoading ? (
          // Revert to rendering the indicator directly
          <LoadingIndicator /> 
        ) : visibleRows.length > 0 ? (
          <ClusterMap clusters={clusters} visibleRows={visibleRows as any} />
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
                padding: "0 24px",
                fontSize: "16px",
                color: "#333333",
                boxSizing: "border-box",
              }}
            />
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", marginTop: "16px" }}>
            {/* Left group: Assign Driver and Assign Time */}
            <Box sx={{ display: "flex", width: "100%", gap: "2%" }}>
              <Button
                variant="primary"
                size="medium"
                disabled={selectedRows.size <= 0}
                style={{
                  whiteSpace: "nowrap",
                  padding: "0% 2%",
                  borderRadius: 5,
                  width: "10%",
                }}
                onClick={() => setPopupMode("Driver")}
              >
                Assign Driver
              </Button>
              <Button
                id="demo-positioned-button"
                aria-controls={open ? 'demo-positioned-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleClick}
                disabled={selectedRows.size <= 0}
                style={{
                  whiteSpace: "nowrap",
                  padding: "0% 2%",
                  borderRadius: 5,
                  width: "10%",
                }}
              >
                Assign Time
              </Button>
              <Menu
                id="demo-positioned-menu"
                aria-labelledby="demo-positioned-button"
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'left',
                }}
                 MenuListProps={{
                  "aria-labelledby": "demo-positioned-button",
                  sx: { width: anchorEl ? anchorEl.offsetWidth : '200px' } 
                }}
              >
                {Object.values(times).map(({value, label, ...restUserProps}) => (
                  <MenuItem key={value} data-key={value} onClick={handleClose}>{label}</MenuItem>
                ))}
              </Menu>
            </Box>
            {/* Right group: Export button */}
            <Box>
              <Button
                variant="primary"
                size="medium"
                style={{
                  whiteSpace: "nowrap",
                  padding: "0% 2%",
                  borderRadius: 5,
                  width: "6rem",
                }}
                onClick={() => setPopupMode("Export")}
              >
                Export
              </Button>
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
          <Table>
            <TableHead>
              <TableRow>
                {fields.map((field) => (
                  <TableCell
                    key={field.key}
                    className="table-header"
                    style={{
                      width: field.type === "checkbox" ? "20px" : "auto",
                      textAlign: "center",
                      padding: "10px",
                    }}
                  >
                    {field.label}
                  </TableCell>
                ))}
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
                        <MenuItem value="dob">DOB</MenuItem>
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
                {/* Add empty cell for the action menu - keeping this for now */}
                {/* <TableCell 
                  className="table-header"
                  style={{
                    width: "50px",
                    textAlign: "center",
                    padding: "10px",
                  }}
                ></TableCell> */}
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.id} className="table-row">
                  {fields.map((field) => {
                    // Render the table cell based on field type
                    return (
                      <TableCell
                        key={field.key}
                        style={{
                          textAlign: "center",
                          padding: "10px",
                          minWidth: field.type === "select" ? "150px" : "auto",
                        }}
                      >
                        {field.type === "checkbox" ? (
                          <Checkbox
                            size="small"
                            checked={selectedRows.has(row.id)}
                            onChange={() => handleCheckboxChange(row)}
                          />
                        ) : field.type === "select" && field.key === "clusterIdChange" ? (
                          // Render Select for clusterIdChange
                          <FormControl
                            variant="standard"
                            size="small"
                            sx={{ marginBottom: "0px !important", minWidth: 120 }}
                          >
                            <Select
                              labelId={`cluster-select-label-${row.id}`}
                              id={`cluster-select-${row.id}`}
                              value={row.clusterId || ""}
                              onChange={(event: SelectChangeEvent<string>) =>
                                handleClusterChange(row, event.target.value)
                              }
                              label="Cluster ID"
                              sx={{
                                fontSize: "inherit",
                                "& .MuiSelect-select": { padding: "4px 10px" },
                                "&:before": { borderBottom: "none" },
                                "&:hover:not(.Mui-disabled):before": { borderBottom: "none" },
                                "&:after": { borderBottom: "none" },
                                ".MuiSvgIcon-root": { fontSize: "1rem" },
                              }}
                            >
                              {clusterOptions.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label === "Unassigned" ? option.label : option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : field.compute ? (
                          // Render computed fields (other than the select)
                          field.key === "assignedDriver" || field.key === "assignedTime" ? (
                            field.compute(row, clusters)
                          ) : (
                            field.compute(row)
                          ) // Assumes other compute fields don't need clusters
                        ) : isRegularField(field) ? (
                          // Render regular fields (address, ward)
                          // Cast to string as these are the only expected types here
                          String(row[field.key as "address" | "ward"] ?? "")
                        ) : // Default case: render nothing or a placeholder
                          null}
                      </TableCell>
                    ); // End return for TableCell
                  })}
                   {customColumns.map((col) => (
                                        <TableCell key={col.id} sx={{ py: 2 }}>
                                          {editingRowId === row.id ? (
                                            col.propertyKey !== "none" ? (
                                              <TextField
                                                value={row[col.propertyKey as keyof DeliveryRowData] ?? ""}
                                                onChange={(e) =>
                                                  handleCustomColumnChange(
                                                    e,
                                                    row.id,
                                                    col.propertyKey as keyof CustomRowData,
                                                    setCustomRows
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
                                            // Check if the property key is 'referralEntity' and the value is an object
                                            col.propertyKey === 'referralEntity' && typeof row.referralEntity === 'object' && row.referralEntity !== null ?
                                            // Format as "Name, Organization"
                                            `${row.referralEntity.name ?? 'N/A'}, ${row.referralEntity.organization ?? 'N/A'}`
                                            : (row[col.propertyKey as keyof DeliveryRowData]?.toString() ?? "N/A") // Fallback for other types
                                          ) : (
                                            "N/A"
                                          )}
                                        </TableCell>
                                      ))}
                  {/* Empty Table cell so custom columns dont look weird */}
                  <TableCell></TableCell>
                </TableRow>
                
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Assign Driver Popup */}
      <Dialog open={popupMode === "Driver"} onClose={resetSelections} maxWidth="xs" fullWidth>
        <DialogTitle>Assign Driver</DialogTitle>
        <DialogContent>
          <AssignDriverPopup assignDriver={assignDriver} setPopupMode={setPopupMode} />
        </DialogContent>
      </Dialog>

      {/* Assign Time Popup */}
      <Dialog open={popupMode === "Time"} onClose={resetSelections} maxWidth="xs" fullWidth>
        <DialogTitle>Assign Time</DialogTitle>
        <DialogContent>
          <AssignTimePopup assignTime={assignTime} setPopupMode={setPopupMode} />
        </DialogContent>
      </Dialog>

      {/* Export Options Popup */}
      
      <Dialog open={popupMode === "Export"} onClose={resetSelections} maxWidth="xs" fullWidth>
        <DialogTitle>Export Options</DialogTitle>
        <DialogContent sx={{ pt: 3, overflow: "visible" }}>
          {!exportOption ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Button variant="primary" color="primary" onClick={() => setExportOption("Routes")}>
                Routes
              </Button>
              <Button
                variant="secondary"
                color="secondary"
                onClick={() => setExportOption("Doordash")}
              >
                Doordash
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Typography variant="subtitle1">Selected Option: {exportOption}</Typography>
              <Button
                variant="primary"
                color="primary"
                onClick={() => {
                  handleEmailOrDownload("Email");
                  resetSelections();
                }}
              >
                Email
              </Button>
              <Button
                variant="secondary"
                color="secondary"
                onClick={() => {
                  handleEmailOrDownload("Download");
                  resetSelections();
                }}
              >
                Download
              </Button>
              <Button variant="secondary" color="secondary" onClick={() => setExportOption(null)}>
                Back
              </Button>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate Clusters Popup */}
      {popupMode === "Clusters" && (
        <Dialog open onClose={resetSelections} maxWidth="xs" fullWidth>
          <DialogTitle>Generate Clusters</DialogTitle>
          <DialogContent>
            <GenerateClustersPopup
              onGenerateClusters={generateClusters}
              onClose={resetSelections}
            />
          </DialogContent>
        </Dialog>
      )}

      {popupMode === "ManualClusters" && (
        <Dialog open onClose={resetSelections} maxWidth="xs" fullWidth>
          <DialogTitle>Assign Clusters</DialogTitle>
          <DialogContent>
            <ManualAssign
              manualAssign={manualAssign}
              allDeliveries = {visibleRows as any}
              onClose={resetSelections}
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

export default DeliverySpreadsheet;
