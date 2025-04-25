import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../auth/firebaseConfig"; 
import { Search, Filter } from "lucide-react";
import { query, Timestamp, updateDoc, where } from "firebase/firestore";
import { format, addDays } from "date-fns";
import MoreVertIcon from "@mui/icons-material/MoreVert";

import "./DeliverySpreadsheet.css";
import 'leaflet/dist/leaflet.css';
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
} from "@mui/material";
import {
  collection,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { auth } from "../../auth/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import ClusterMap from "./ClusterMap";
import AssignDriverPopup from "./components/AssignDriverPopup";
import GenerateClustersPopup from "./components/GenerateClustersPopup";
import AssignTimePopup from "./components/AssignTimePopup";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import Button from '../../components/common/Button';
import ManualAssign from "./components/ManualAssignPopup";
import { DeliveryRowData } from "./types/deliveryTypes";

interface Driver {
  id: string;
  name: string;
  phone: string
  email: string;
}


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
      compute?: never;
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

interface Cluster {
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
      clusters.forEach((cluster)=>{
        if(cluster.deliveries?.some((id) => id == data.id)){
          driver = cluster.driver;
        }
      })
      return driver ? driver: "No driver assigned"
    }
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
      const [hours, minutes] = time.split(':');
      let hours12 = parseInt(hours, 10);
      const ampm = hours12 >= 12 ? 'PM' : 'AM';
      hours12 = hours12 % 12;
      hours12 = hours12 ? hours12 : 12; // Convert 0 to 12 for 12 AM
      
      return `${hours12}:${minutes} ${ampm}`;
    }
  },
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
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedClusters, setSelectedClusters] = useState<Set<any>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [deliveriesForDate, setDeliveriesForDate] = useState<DeliveryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clusterDoc, setClusterDoc] = useState<ClusterDoc | null>()
  const navigate = useNavigate();

  // Calculate Cluster Options
  const clusterOptions = useMemo(() => {
    const existingIds = clusters.map(c => parseInt(c.id, 10)).filter(id => !isNaN(id));
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
      const startDate = new Date(Date.UTC(
        dateForFetch.getFullYear(),
        dateForFetch.getMonth(),
        dateForFetch.getDate(),
        0, 0, 0 
      ));
      
      const endDate = new Date(Date.UTC(
        dateForFetch.getFullYear(),
        dateForFetch.getMonth(),
        dateForFetch.getDate(),
        23, 59, 59
      ));
  
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

      const events = querySnapshot.docs.map(doc => {
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
      const clientIds = deliveriesForDate.map(delivery => delivery.clientId);
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
          ...(doc.data() as Omit<DeliveryRowData, "id">),
        }));
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
      const startDate = new Date(Date.UTC(
        dateForFetch.getFullYear(),
        dateForFetch.getMonth(),
        dateForFetch.getDate(),
        0, 0, 0
      ));
      
      const endDate = new Date(Date.UTC(
        dateForFetch.getFullYear(),
        dateForFetch.getMonth(),
        dateForFetch.getDate(),
        23, 59, 59
      ));

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
          clusters: doc.data().clusters || []
        };
        setClusterDoc(clustersData)
        setClusters(clustersData.clusters);
      }
      else{
        setClusterDoc(null); // Clear clusterDoc when no clusters found
        setClusters([])
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
    const clusterExists = clusters.some(cluster => cluster.id === newClusterId);
  
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
        updatedClusters = updatedClusters.map(cluster => {
          if (cluster.id === newClusterId) {
            return {
              ...cluster,
              deliveries: [...(cluster.deliveries ?? []), row.id]
            };
          }
          return cluster;
        });
      } else {
        const newCluster: Cluster = {
          id: newClusterId,
          deliveries: [row.id],
          driver: "",
          time: ""
        };
        updatedClusters.push(newCluster);
      }
    }

    updatedClusters.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  
    setClusters(updatedClusters);
  
    try {
      const clusterRef = doc(db, "clusters", clusterDoc.docId);
      await updateDoc(clusterRef, { clusters: updatedClusters });
      console.log(`Successfully moved ${row.id} from cluster ${oldClusterId || 'none'} to ${newClusterId || 'none'}`);
  
      // setRows(prevRows => prevRows.map(r => r.id === row.id ? { ...r, clusterId: newClusterId } : r));
    } catch (error) {
      console.error("Error updating clusters in Firestore:", error);
    }
  };

  // reset popup selections when closing popup
  const resetSelections = () => {
    setPopupMode("");
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
      const updatedClusters = clusters.map(cluster => {
        const isSelected = Array.from(selectedClusters).some(selected => selected.id === cluster.id);
        if (isSelected) {
          return {
            ...cluster,
            driver: driver.name
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

  const updateClusters = async (clusterMap: any) => {
    const newClusters: Cluster[] = [];
    Object.keys(clusterMap).forEach((clusterId)=>{
      if(clusterId != "doordash"){
        const newDeliveries = clusterMap[clusterId].map((index: string)=>{return visibleRows[Number(index)].id});
        newClusters.push({
          deliveries: newDeliveries,
          driver: "",
          time: "",
          id: clusterId
        })
      }
    })
    return newClusters;
  };

  //Handle assigning time
  const assignTime = async (time: string) => {
    if(time && clusterDoc){
      try {
        // Create a new clusters array with updated time assignments
        const updatedClusters = clusters.map(cluster => {
          // Check if this cluster is among the selected ones (using ID for comparison)
          const isSelected = Array.from(selectedClusters).some(selected => selected.id === cluster.id);
          if (isSelected) {
            // Return a *new* cluster object with the assigned time
            return {
              ...cluster,
              time: time // Assign the new time
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

  //Handle generating clusters
  const generateClusters = async (clusterNum: number, minDeliveries: number, maxDeliveries: number) => {
    const token = await auth.currentUser?.getIdToken();
    const addresses = visibleRows.map(row => row.address);
    // Removed unnecessary try/catch
    // try{
      // Validate cluster number
      if (!clusterNum || clusterNum <= 0) {
        throw new Error("Please enter a valid number of clusters (must be at least 1)");
      }

      // Validate we have deliveries to cluster
      if (addresses.length === 0) {
        throw new Error("No deliveries scheduled for the selected date");
      }

      // Validate maxDeliveries is within range
      if (maxDeliveries > addresses.length) {
        throw new Error(`Max deliveries is too high for ${addresses.length} deliveries. Please decrease it.`);
      }

      // Validate min deliveries is reasonable
      if (minDeliveries < 0) {
        throw new Error("Minimum deliveries per cluster cannot be negative");
      }

      // Validate max deliveries is reasonable
      if (maxDeliveries <= 0) {
        throw new Error("Maximum deliveries per cluster must be at least 1");
      }

      // Validate min <= max
      if (minDeliveries > maxDeliveries) {
        throw new Error("Minimum deliveries cannot exceed maximum deliveries");
      }

      // Calculate total required and available deliveries
      const totalMinRequired = clusterNum * minDeliveries;
      const totalMaxAllowed = clusterNum * maxDeliveries;
      
      // Validate we have enough deliveries for the minimum
      if (totalMinRequired > addresses.length) {
        throw new Error(
          `Not enough deliveries for ${clusterNum} clusters with minimum ${minDeliveries} each.\n` +
          `Required: ${totalMinRequired} | Available: ${addresses.length}\n` +
          `Please reduce cluster count or minimum deliveries.`
        );
      }

      // Validate we don't have too many deliveries for the maximum
      if (addresses.length > totalMaxAllowed) {
        throw new Error(
          `Too many deliveries for ${clusterNum} clusters with maximum ${maxDeliveries} each.\n` +
          `Allowed: ${totalMaxAllowed} | Available: ${addresses.length}\n` +
          `Please increase cluster count or maximum deliveries.`
        );
      }
      // Validate cluster count isn't excessive
      const maxRecommendedClusters = Math.min(
        Math.ceil(addresses.length / 2),  // At least 2 deliveries per cluster
        addresses.length  // Can't have more clusters than deliveries
      );
      
      if (clusterNum > maxRecommendedClusters) {
        throw new Error(
          `Too many clusters requested (${clusterNum}).\n` +
          `Recommended maximum for ${addresses.length} deliveries: ${maxRecommendedClusters}`
        );
      }
      setPopupMode("")
      setIsLoading(true)
      const response = await fetch(testing ? "": 'https://geocode-addresses-endpoint-lzrplp4tfa-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addresses: addresses
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch");
      }
    
      const { coordinates } = await response.json();
      // Generate clusters based on coordinates
      const clusterResponse = await fetch(testing? "": 'https://cluster-deliveries-k-means-lzrplp4tfa-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coords: coordinates,
          drivers_count: clusterNum,
          min_deliveries: minDeliveries,  
          max_deliveries: maxDeliveries
        }),
      });
  
      const clusterData = await clusterResponse.json();
      const newClusters = await updateClusters(clusterData.clusters)
      // setClusters(newClusters) // State is set within the if/else block

      //update cluster or create new cluster date
      if(clusterDoc){
        const clusterRef = doc(db, "clusters", clusterDoc.docId);
        // Only update the 'clusters' field using updateDoc
        await updateDoc(clusterRef, { clusters: newClusters });
        setClusters(newClusters); // Update state after successful Firestore update
        // Update the local clusterDoc state's clusters as well
        setClusterDoc(prevDoc => prevDoc ? { ...prevDoc, clusters: newClusters } : null);
      }
      else{
        initClustersForDay(newClusters)
      }       
      
      //Refresh the data - REMOVED Redundant fetch
      // const snapshot = await getDocs(collection(db, "clients"));
      // const updatedData = snapshot.docs.map((doc) => ({
      //  id: doc.id,
      //  ...(doc.data() as Omit<DeliveryRowData, "id">),
      // }));
      // setClusters(newClusters); // REMOVED - Redundant state update, handled in if/else
      setIsLoading(false);
      resetSelections();
    // }
    // catch (e){
    //   throw e
    // }
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

  const clientsWithDeliveriesOnSelectedDate = rows.filter(row => 
    deliveriesForDate.some(delivery => delivery.clientId === row.id)
  );
  
  const visibleRows = rows.filter(row => {
    if (!searchQuery) return true; // Show all if no search query
    
    const searchTerm = searchQuery.toLowerCase().trim();
    
    return (
      row.firstName.toLowerCase().includes(searchTerm) ||
      row.lastName.toLowerCase().includes(searchTerm)
    );
  });

  // Synchronize rows state with rawClientData and clusters
  useEffect(() => {
    if (rawClientData.length === 0) {
      setRows([]);
      return;
    }

    const synchronizedRows = rawClientData.map(client => {
      let assignedClusterId = "";
      clusters.forEach(cluster => {
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
      <Box sx={{ 
        top: "72px", 
        zIndex: 9, 
        height: "400px",
        width: "100%",
        backgroundColor: "#fff"
      }}>
        {isLoading ? (
          <LoadingIndicator />
        ) : visibleRows.length > 0 ? (
          <ClusterMap 
            clusters={clusters}
            visibleRows={visibleRows}
          />
        ) : (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}>
            <Typography variant="h6" color="textSecondary">
              No deliveries for selected date
            </Typography>
          </Box>
        )}
      </Box>
  
      {/* Search Bar */}
      <Box sx={{
        width: "100%",
        zIndex: 8,
        backgroundColor: "#fff",
        padding: "16px 0",
        top: "472px",
      }}>
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
          <Box sx={{ display: "flex", justifyContent: "space-between", marginTop: '16px' }}>
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
                variant="secondary"
                size="medium"
                onClick={() => setPopupMode("Time")}
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
            </Box>
          </Box>
        </Box>
      </Box>
  
      <Box sx={{ 
        flex: 1, 
        display: "flex", 
        flexDirection: "column",
        margin: "0 auto",
        paddingBottom: "2vh",
        width: "100%",
        maxHeight: "none" 
      }}>
        <TableContainer component={Paper} sx={{ 
              maxHeight: "none",
              height: "auto", 
              width: "100%" 
          }}>
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
                {/* Add empty cell for the action menu - keeping this for now */}
                <TableCell 
                  className="table-header"
                  style={{ 
                    width: "50px",
                    textAlign: "center", 
                    padding: "10px", 
                  }}
                ></TableCell>
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
                          minWidth: field.type === 'select' ? '150px' : 'auto',
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
                          <FormControl variant="standard" size="small" sx={{ marginBottom: '0px !important', minWidth: 120 }}>
                            <Select
                              labelId={`cluster-select-label-${row.id}`}
                              id={`cluster-select-${row.id}`}
                              value={row.clusterId || ""}
                              onChange={(event: SelectChangeEvent<string>) => handleClusterChange(row, event.target.value)}
                              label="Cluster ID"
                              sx={{ 
                                fontSize: 'inherit',
                                '& .MuiSelect-select': { padding: '4px 10px' },
                                '&:before': { borderBottom: 'none' },
                                '&:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                                '&:after': { borderBottom: 'none' },
                                '.MuiSvgIcon-root': { fontSize: '1rem' }
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
                          (field.key === 'assignedDriver' || field.key === 'assignedTime')
                            ? field.compute(row, clusters)
                            : field.compute(row) // Assumes other compute fields don't need clusters
                        ) : isRegularField(field) ? (
                          // Render regular fields (address, ward)
                          // Cast to string as these are the only expected types here
                          String(row[field.key as 'address' | 'ward'] ?? '')
                        ) : (
                          // Default case: render nothing or a placeholder
                          null
                        )}
                      </TableCell>
                    ); // End return for TableCell
                  })}
                  {/* Empty TableCell to align with the extra header cell (if kept) */}
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
          <AssignDriverPopup
            assignDriver={assignDriver}
            setPopupMode={setPopupMode}
          />
        </DialogContent>
      </Dialog>

      {/* Assign Time Popup */}
      <Dialog open={popupMode === "Time"} onClose={resetSelections} maxWidth="xs" fullWidth>
        <DialogTitle>Assign Time</DialogTitle>
        <DialogContent>
          <AssignTimePopup
            assignTime={assignTime}
            setPopupMode={setPopupMode}
          />
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
              allDeliveries = {visibleRows}
              onClose={resetSelections}
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

export default DeliverySpreadsheet;