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
  Dialog,
  DialogContent,
  DialogTitle,
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
import AssignDriverPopup from "./components/AssignDriverPopup";
import GenerateClustersPopup from "./components/GenerateClustersPopup";
import AssignTimePopup from "./components/AssignTimePopup";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";

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

interface Driver {
  id: string;
  name: string;
  phone: string
  email: string;
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
      compute: (data: RowData, clusters: Cluster[]) => string;
    }
  | {
      key: Exclude<keyof Omit<RowData, "id" | "firstName" | "lastName" | "deliveryDetails">, "coordinates">;
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
      compute: (data: RowData, clusters: Cluster[]) => string;
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
    compute: (data: RowData) => `${data.lastName}, ${data.firstName}`,
  },
  { key: "clusterId", 
    label: "Cluster ID", 
    type: "text",
    compute: (data: RowData, clusters: Cluster[]) => {
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
    compute: (data: RowData, clusters: Cluster[]) => {
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
): field is Extract<Field, { key: Exclude<keyof RowData, "coordinates"> }> => {
  return field.key !== "fullname" && 
         field.key !== "tags" && 
         field.key !== "assignedDriver" &&
         field.key !== "assignedTime" &&
         field.key !== "deliveryDetails.deliveryInstructions";
};

const DeliverySpreadsheet: React.FC = () => {
  const testing = false;
  const [rows, setRows] = useState<RowData[]>([]);
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

useEffect(() => {
  const fetchDataAndGeocode = async () => {
    if (deliveriesForDate.length === 0) {
      setClusters([]);
      setIsLoading(false);
      return;
    }

    try {
      const snapshot = await getDocs(collection(db, "clients"));
      const allData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<RowData, "id">),
      }));
      
      // filter to only include clients with deliveries on the selected date
      const clientsWithDeliveriesOnSelectedDate = allData.filter(row => 
        deliveriesForDate.some(delivery => delivery.clientId === row.id)
      );

      const addresses = clientsWithDeliveriesOnSelectedDate.map(row => row.address);
      
      setRows(allData);
      
      if (clientsWithDeliveriesOnSelectedDate.length > 0 && addresses.length > 0) {
        const token = await auth.currentUser?.getIdToken();
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
        
        if (response.ok) {
          const { coordinates } = await response.json();
          
          // update only the rows that need coordinates
          const updatedRows = allData.map(row => {
            // find if this row is in the filtered list
            const index = clientsWithDeliveriesOnSelectedDate.findIndex(filteredRow => filteredRow.id === row.id);
            if (index !== -1 && coordinates[index]) {
              // if yes, add coordinates
              return {
                ...row,
                coordinates: coordinates[index]
              };
            }
            return row;
          });
          
          setRows(updatedRows);
          setIsLoading(false);
        }
      } else {
        setClusters([]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error:", error);
      setIsLoading(false);
    }
  };
  
  if (deliveriesForDate.length > 0) {
    setIsLoading(true)
    fetchDataAndGeocode();
  } else {
    setClusters([]);
    setIsLoading(false);
  }
}, [deliveriesForDate]);

  //get clusters
  useEffect(() => {
    fetchClustersFromToday();
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


  const fetchClustersFromToday = async () => {
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
        setClusterDoc(clustersData)
        setClusters(clustersData.clusters);
      }
      else{
        setClusters([])
      }
    } catch (error) {
      console.error("Error fetching clusters:", error);
    }
  };  

  // handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleClusterChange = async (row: any, newCluster: string) => {
    if (row && row.id && newCluster && newCluster != row.clusterId && Number(newCluster) <= clusters.length) {
      const index = clusters.findIndex((cluster)=>{return cluster.id == row.clusterId});
      const oldList = clusters[index].deliveries?.filter((id)=>id!=row.id);
      clusters[Number(newCluster) -1].deliveries.push(row.id)
      clusters[index] = {
        ...clusters[index],
        deliveries: oldList
      }

      setClusters([...clusters])


      if(clusterDoc){
        const clusterRef = doc(db, "clusters", clusterDoc.docId);
        const newClusterDoc = {
          ...clusterDoc,
          clusters: clusters
        }
        await setDoc(clusterRef, newClusterDoc); 
      }   
  
      row.clusterId = newCluster
    }
  };

  // reset popup selections when closing popup
  const resetSelections = () => {
    setPopupMode("");
    setSelectedClusters(new Set());
    setSelectedRows(new Set());
  };

  //Handle assigning driver
  const assignDriver = async (driver: Driver) => {
    if(driver){
      try {
        selectedClusters.forEach(async (targetCluster) => {
          const targetIndex = clusters.findIndex((cluster) => cluster.id == targetCluster.id)
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
    if(time){
      try {
        selectedClusters.forEach(async (targetCluster) => {
          const targetIndex = clusters.findIndex((cluster) => cluster.id == targetCluster.id)
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
      setClusters(newClusters)

      //update cluster or create new cluster date
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

        const newClusterDoc = {
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
    // }
    // catch (e){
    //   throw e
    // }
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

  const clientsWithDeliveriesOnSelectedDate = rows.filter(row => 
    deliveriesForDate.some(delivery => delivery.clientId === row.id)
  );
  
  const visibleRows = clientsWithDeliveriesOnSelectedDate.filter(row => {
    if (!searchQuery) return true; // Show all if no search query
    
    const searchTerm = searchQuery.toLowerCase().trim();
    
    return (
      row.firstName.toLowerCase().includes(searchTerm) ||
      row.lastName.toLowerCase().includes(searchTerm)
    );
  });

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
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", width: "100%", gap: "2%" }}>
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
                {/* Add empty cell for the action menu */}
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
                  {fields.map((field) => (
                    <TableCell
                      key={field.key}
                      style={{ 
                        textAlign: "center", 
                        padding: "10px", 
                      }}
                    >
                      {field.type === "checkbox" ? (
                        <Checkbox
                          size="small"
                          checked={selectedRows.has(row.id)}
                          onChange={() => handleCheckboxChange(row)}
                        />
                      ) : (
                        field.compute
                          ? (
                              field.key === 'assignedDriver' || 
                              field.key === 'assignedTime' || 
                              field.key === 'clusterId' 
                            ) ? field.compute(row, clusters) 
                              : field.compute(row) 
                          : isRegularField(field)
                          ? row[field.key]
                          : null
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                  <input
                    className="clusterSelector"
                    type="text"
                    value={row.clusterId || ""}
                    onChange={(e) => handleClusterChange(row, e.target.value)}
                  />
                </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {popupMode === "Driver" && (
        <AssignDriverPopup
          open={innerPopup}
          onClose={resetSelections}
          onAssignDriver={assignDriver}
          selectedClusters={selectedClusters}
        />
      )}

      {popupMode === "Time" && (
        <AssignTimePopup
          open={innerPopup}
          onClose={resetSelections}
          onAssignTime={assignTime}
          selectedClusters={selectedClusters}
        />
      )}

      {popupMode === "Clusters" && (
        <GenerateClustersPopup
          open={innerPopup}
          onClose={resetSelections}
          onGenerateClusters={generateClusters}
          visibleRows={visibleRows}
        />
      )}
    </Box>
  );
};

export default DeliverySpreadsheet;