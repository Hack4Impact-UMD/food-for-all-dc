import React, { useState, useEffect } from "react";
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
  CircularProgress,
  Typography,
  IconButton,
  Menu,
  MenuItem,
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
import { ClientProfile } from "../../types/types";
import { idText } from "typescript";

interface RowData {
  id: string;
  clientid: string;
  firstName: string;
  lastName: string;
  address: string;
  tags?: string[];
  ward?: string;
  clusterId: string; 
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
      key: "clusterId";
      label: "Cluster ID";
      type: "text";
      compute: (data: RowData, clusters: Cluster[], drivers: Driver[]) => string;
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

interface Driver{
  id: string;
  name: string;
  phone: string
  email: string;
}

interface Cluster {
  id: string;
  driver?: any;
  time: string;
  deliveries: string[]; // Array of client IDs
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
    compute: (data: RowData) => `${data.lastName}, ${data.firstName}`,
  },
  { key: "clusterId", 
    label: "Cluster ID", 
    type: "text",
    compute: (data: RowData, clusters: Cluster[], drivers: Driver[]) => {
      let id = "";
      clusters.forEach((cluster)=>{
        if(cluster.deliveries?.some((id) => id == data.id)){
          id = cluster.id;
          data.clusterId = id;
        }
      })
      return id ? id: "No cluster found";
    },
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
  { key: "ward", label: "Ward", type: "text" },
  {
    key: "assignedDriver", 
    label: "Assigned Driver", 
    type: "text",
    compute: (data: RowData, clusters: Cluster[], drivers: Driver[]) => {
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
    compute: (data: RowData, clusters: Cluster[]) => {
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
): field is Extract<Field, { key: keyof RowData }> => {
  return field.key !== "fullname" && 
         field.key !== "tags" && 
         field.key !== "assignedDriver" &&
         field.key !== "assignedTime";
};

const DeliverySpreadsheet: React.FC = () => {
  let testing = false
  const [rows, setRows] = useState<RowData[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set()); 
  const [innerPopup, setInnerPopup] = useState(false);
  const [popupMode, setPopupMode] = useState("");
  const [driverSearchQuery, setDriverSearchQuery] = useState<string>("");
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const [clusters, setClusters] = useState<Cluster[]>([])

  const [selectedClusters, setSelectedClusters] = useState<Set<any>>(new Set());
  const [driver, setDriver] = useState<Driver | null>();
  const [time, setTime] = useState<string>("");
  const [clusterNum, setClusterNum] = useState(0);

  //delivery vars
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [deliveriesForDate, setDeliveriesForDate] = useState<DeliveryEvent[]>([]);

  //cluster generation and map vars
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }[]>([]);
  const [generatedClusters, setGeneratedClusters] = useState<{ [key: string]: number[] }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [maxDeliveries, setMaxDeliveries] = useState(5);
  const [minDeliveries, setMinDeliveries] = useState(1);
  const [clusterError, setClusterError] = useState("");

  const [clusterDoc, setClusterDoc] = useState<ClusterDoc | null>()

  const navigate = useNavigate();

  useEffect(()=>{
    console.log("coords")
    console.log(coordinates)
  },[coordinates])

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
      const startDate = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0, 0, 0 
      ));
      
      const endDate = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23, 59, 59
      ));
  
      const eventsRef = collection(db, "events");
      const q = query(
        eventsRef,
        where("deliveryDate", ">=", Timestamp.fromDate(startDate)),
        where("deliveryDate", "<=", Timestamp.fromDate(endDate))
      );
  
      const querySnapshot = await getDocs(q);
      const events = querySnapshot.docs.map(doc => {
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
          )
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
        const clientsWithDeliveriesToday = allData.filter(row => 
          deliveriesForDate.some(delivery => delivery.clientId === row.id)
        );
        
        setRows(allData); // keep all rows for the table
        let addresses = clientsWithDeliveriesToday.map(row => row.address)
        if (clientsWithDeliveriesToday.length > 0 && addresses.length > 0) {
          const token = await auth.currentUser?.getIdToken();
           const response = await fetch(testing ? "": 'https://geocode-addresses-endpoint-lzrplp4tfa-uc.a.run.app', {
          // const response = await fetch('', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              addresses: addresses
            }),
          });
          
          if (response.ok) {
            const { coordinates } = await response.json();
            setCoordinates(coordinates);
            
            const clusterMap: { [key: string]: number[] } = {};
            clientsWithDeliveriesToday.forEach((row, index) => {
              const clusterId = `${row.clusterId}`;
              if (!clusterMap[clusterId]) clusterMap[clusterId] = [];
              clusterMap[clusterId].push(index);
            });
            
            setGeneratedClusters(clusterMap);
            setIsLoading(false);
          }
        } else {
          setCoordinates([]);
          setGeneratedClusters({});
        }
      } catch (error) {
        console.error("Error:", error);
      } 
    };
    
    if (deliveriesForDate.length > 0) {
      setIsLoading(true)
      fetchDataAndGeocode();
    } else {
      setCoordinates([]);
      setGeneratedClusters({});
      setIsLoading(false);
    }
  }, [deliveriesForDate, clusters]);

  //get clusters
  useEffect(() => {
    const fetchClusters = async () => {
      try {
        // account for timezone issues
        const startDate = new Date(Date.UTC(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          0, 0, 0
        ));
        
        const endDate = new Date(Date.UTC(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          23, 59, 59
        ));
  
        const clustersCollectionRef = collection(db, "clusters");
        const q = query(
          clustersCollectionRef,
          where("date", ">=", Timestamp.fromDate(startDate)),
          where("date", "<=", Timestamp.fromDate(endDate))
        );
        
        const clustersSnapshot = await getDocs(q);
        if (!clustersSnapshot.empty) {
          // There should only be one document per date
          const doc = clustersSnapshot.docs[0];
          const clustersData = {
            docId: doc.id,
            date: doc.data().date.toDate(),
            clusters: doc.data().clusters || []
          };
          console.log("here: ")
          console.log(clustersData)
          setClusterDoc(clustersData)
          setClusters(clustersData.clusters);
        }
        else{
          setGeneratedClusters({})
        }
      } catch (error) {
        console.error("Error fetching clusters:", error);
      }
    };  
    fetchClusters();
  }, [selectedDate]); // Re-fetch when date changes
  
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
        setRows(data);
      } catch (error) {
        console.error("Error fetching data: ", error);
      }
    };
    fetchData();
  }, []);

  // handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTime(event.target.value);
  };

  const handleClusterChange = async (row: any, newCluster: string) => {
    if (row && row.id && newCluster && newCluster != row.clusterId && Number(newCluster) <= clusters.length) {
      let index = clusters.findIndex((cluster) => { return cluster.id == row.clusterId });
      let oldList = clusters[index].deliveries?.filter((id) => id != row.id);
      clusters[Number(newCluster) - 1].deliveries.push(row.id);
      clusters[index] = {
        ...clusters[index],
        deliveries: oldList
      };
  
      setClusters([...clusters]);
  
      // Update generatedClusters to reflect the change
      const updatedGeneratedClusters: { [key: string]: number[] } = {};
      clusters.forEach((cluster) => {
        updatedGeneratedClusters[cluster.id] = cluster.deliveries
          .map(deliveryId => rows.findIndex(row => row.id === deliveryId))
          .filter(index => index !== -1);
      });
      setGeneratedClusters(updatedGeneratedClusters);
  
      if (clusterDoc) {
        const clusterRef = doc(db, "clusters", clusterDoc.docId);
        const newClusterDoc = {
          ...clusterDoc,
          clusters: clusters
        };
        await setDoc(clusterRef, newClusterDoc);
      }
  
      row.clusterId = newCluster;
    }
  };

  // reset popup selections when closing popup
  const resetSelections = () => {
    setPopupMode("");
    setSelectedClusters(new Set());
    setSelectedRows(new Set());
    setDriver(null);
    setTime("");
    setClusterNum(0);
    setMinDeliveries(0);
    setMaxDeliveries(10);
    setClusterError("");
  };

  //Handle assigning driver
  const assignDriver = async () => {
    if(driver){
      try {
        // Use forEach to iterate over the Set
        selectedClusters.forEach(async (targetCluster) => {
          let targetIndex = clusters.findIndex((cluster) => cluster.id == targetCluster.id)
          const newCluster = {
            id: targetCluster.id,
            time: targetCluster.time,
            driver: driver.name, 
            deliveries: targetCluster.deliveries
          };
          clusters[targetIndex] = newCluster
        });

        if(clusterDoc){
          const clusterRef = doc(db, "clusters", clusterDoc.docId);
          const newClusterDoc = {
            ...clusterDoc,
            clusters: clusters
          }
          await setDoc(clusterRef, newClusterDoc); 
        }        
        resetSelections();
      } catch (error) {
        console.error("Error assigning driver: ", error);
      }
    }
  };

  const updateClusters = async (clusterMap: any) => {
    try {
      let newClusters: Cluster[] = []
      Object.keys(clusterMap).forEach((clusterId)=>{
        if(clusterId != "doordash"){
          let newDeliveries = clusterMap[clusterId].map((index: string)=>{return visibleRows[Number(index)].id});
          newClusters.push({
            deliveries: newDeliveries,
            driver: "",
            time: "",
            id: clusterId
          })
        }
      })
      return newClusters
    } catch (error) {
      throw error;
    }
  };

  //Handle assigning time
  const assignTime = async () => {
    if(time){
      try {
        // Use forEach to iterate over the Set
        selectedClusters.forEach(async (targetCluster) => {
          let targetIndex = clusters.findIndex((cluster) => cluster.id == targetCluster.id)
          const newCluster = {
            id: targetCluster.id,
            time: time,
            driver: targetCluster.driver, 
            deliveries: targetCluster.deliveries
          };
          clusters[targetIndex] = newCluster
        });

        if(clusterDoc){
          const clusterRef = doc(db, "clusters", clusterDoc.docId);
          const newClusterDoc = {
            ...clusterDoc,
            clusters: clusters
          }
          await setDoc(clusterRef, newClusterDoc); 
        }
                
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
        const addresses = visibleRows.map(row => row.address);
        // Validate cluster number
          if (!clusterNum || clusterNum <= 0) {
            throw new Error("Please enter a valid number of clusters (must be at least 1)");
          }

          // Validate we have deliveries to cluster
          if (addresses.length === 0) {
            throw new Error("No deliveries scheduled for the selected date");
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
          // const response = await fetch('', {
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
        // const clusterResponse = await fetch('', {
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
        setGeneratedClusters(clusterData.clusters);
        let newClusters = await updateClusters(clusterData.clusters)
        if(clusterDoc){
          const clusterRef = doc(db, "clusters", clusterDoc.docId);
          const newClusterDoc = {
            ...clusterDoc,
            clusters: newClusters
          }
          await setDoc(clusterRef, newClusterDoc); 
        }
        else{
          const docRef = doc(collection(db, "clusters"));
          const now = new Date();
          const midnightToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0, 0, 0, 0
          );

          let newClusterDoc = {
            clusters: newClusters,
            docId: docRef.id,
            date: Timestamp.fromDate(midnightToday)
          }
          await setDoc(docRef, {newClusterDoc});
          setClusterDoc(newClusterDoc)
        }       
        
        //Refresh the data
        const snapshot = await getDocs(collection(db, "clients"));
        const updatedData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<RowData, "id">),
        }));
        setClusters(newClusters);
        setIsLoading(false);
        resetSelections();
      } catch (error: any) {
        setClusterError(error.toString());
      } finally{
        setIsLoading(false)
      }
    };

  // Handle checkbox selection
  const handleCheckboxChange = (row: RowData) => {
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

  // Filter rows to only show clients with deliveries on selected date
  const clientsWithDeliveries = rows.filter(row => 
    deliveriesForDate.some(delivery => delivery.clientId === row.id)
  );

  

  // Filter rows based on search query
  let visibleRows = clientsWithDeliveries.filter(
    (row) =>
      fields.some((field) => {
        if (field.key === "checkbox") return false;

        if (field.key === "clusterId") {
          if (!row.clusterId) return false;
          console.log(clusters)
          const cluster = clusters?.find(c => c.id.toString() === row.clusterId);
          if (!cluster || !cluster.driver) return false;
          
          const driverId = typeof cluster.driver === 'object' ? cluster.driver.id : null;
          if (!driverId) return false;
          
          const driver = drivers.find(d => d.id === driverId);
          const driverName = driver ? driver.name : "";
          
          return driverName.toLowerCase().includes(searchQuery.toLowerCase());
        }
        
        if (field.key === "assignedDriver") {
          // Get driver name from cluster
          if (!row.clusterId) return false;
          const cluster = clusters?.find(c => c.id.toString() === row.clusterId);
          if (!cluster || !cluster.driver) return false;
          
          const driverId = typeof cluster.driver === 'object' ? cluster.driver.id : null;
          if (!driverId) return false;
          
          const driver = drivers.find(d => d.id === driverId);
          const driverName = driver ? driver.name : "";
          
          return driverName.toLowerCase().includes(searchQuery.toLowerCase());
        }
        
        if (field.key === "assignedTime") {
          // Get time from cluster
          if (!row.clusterId) return false;
          const cluster = clusters?.find(c => c.id.toString() === row.clusterId);
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
                backgroundColor: "#257E68" + " !important",
              }}
            >
              Generate<br></br>Clusters
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
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : visibleRows.length > 0 ? (
          <ClusterMap 
            addresses={clientsWithDeliveries.map(row => row.address)}
            coordinates={coordinates}
            clusters={generatedClusters}
            clientNames={clientsWithDeliveries.map(row => `${row.firstName} ${row.lastName}`)}
            wards={clientsWithDeliveries.map(row => row.ward || "No ward")}
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
                          onChange={() => handleCheckboxChange(row)}
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
                      ) : field.key === "clusterId" && field.compute ? (
                        field.compute(row, clusters, drivers) === "No cluster found" ? (
                          <p>No cluster Assigned</p>
                        ) : (
                          <input 
                            type="number"
                            value={field.compute(row, clusters, drivers)}
                            max={clusters.length}
                            min={1}
                            onChange={(e) => {
                              //remove leading 0s
                              const newCluster = Number(e.target.value).toString()
                              if (newCluster !== field.compute(row, clusters, drivers) && 
                                Number(newCluster) > 0 && 
                                Number(newCluster) <= clusters.length) {
                                console.log(newCluster);
                                handleClusterChange(row, newCluster);
                              }
                            }}
                          />
                        )
                      ) : field.key === "assignedDriver" && field.compute ? (
                        field.compute(row, clusters, drivers)
                      ) : field.key === "assignedTime" && field.compute ? (
                        field.compute(row, clusters)
                      ) : isRegularField(field) ? (
                        row[field.key]
                      ) : null}
                    </TableCell>
                  ))}
                       {/* bruh i cant remove this empty cell or else the whole table breaks */}
                      <TableCell style={{ textAlign: "right" }}></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
  
      {/* Popup Dialog */}
      <Dialog open={innerPopup} onClose={() => resetSelections()}>
        <DialogTitle>{popupMode == "Time" ? "Select a time": popupMode == "Driver" ? "Assign a Driver": popupMode == "Clusters" ? "Generate Clusters" : ""}</DialogTitle>
        <DialogContent>
          {popupMode === "Driver" ? (
            <Autocomplete
              freeSolo
              options={drivers} 
              getOptionLabel={(driver) => (typeof driver === "string" ? driver : driver.name)} 
              onChange={(event, value) => {
                if (value && typeof value !== "string") {
                  setDriver(value); 
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
              sx={{ width: '200px' }}
            />
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
          ) : popupMode == "Clusters" ? (
            <div style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: "20px",
              padding: "8px 0"
            }}>
              {/* Cluster Number Input */}
              <div style={{
                display: "flex", 
                alignItems: "center", 
                gap: "10px",
                justifyContent: "space-between"
              }}>
                <Typography variant="body1">Enter desired number of clusters:</Typography>
                <TextField
                  type="number"
                  value={clusterNum}
                  sx={{ width: "100px" }}
                  onChange={(e) => setClusterNum(Number(e.target.value))}
                  inputProps={{ min: 1 }}
                  size="small"
                  variant="outlined"
                />
              </div>
  
              {/* Deliveries Range Input */}
              <div style={{
                display: "flex", 
                flexDirection: "column",
                gap: "10px",
                marginTop: "20px"
              }}>
                <Typography variant="body2"><b><u>Deliveries Per Cluster:</u></b></Typography>
                <div style={{
                  display: "flex", 
                  alignItems: "center", 
                  gap: "10px",
                  justifyContent: "space-between"
                }}>
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
                </div>
                {clusterError ? <p style={{color:"red"}}>{clusterError}</p> : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { 
            popupMode === "Driver" ? assignDriver() : 
            popupMode === "Time" ? assignTime() : 
            popupMode === "Clusters" ? generateClusters() : 
            console.log("invalid")
          }}>SAVE</Button>
          <Button onClick={() => resetSelections()}>CANCEL</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeliverySpreadsheet;