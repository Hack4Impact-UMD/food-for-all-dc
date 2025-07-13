import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { db } from "../../auth/firebaseConfig";
import { Search, Filter } from "lucide-react";
import { query, Timestamp, updateDoc, where } from "firebase/firestore";
import { TimeUtils } from "../../utils/timeUtils";
import { format, addDays } from "date-fns";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import DeleteIcon from "@mui/icons-material/Delete";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import TodayIcon from "@mui/icons-material/Today";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";

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
  Chip,
  Stack,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { auth } from "../../auth/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import ClusterMap from "./ClusterMap";
import AssignDriverPopup from "./components/AssignDriverPopup";
import GenerateClustersPopup from "./components/GenerateClustersPopup";
import AssignTimePopup from "./components/AssignTimePopup";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import { exportDeliveries, exportDoordashDeliveries } from "./RouteExport";
import Button from "../../components/common/Button";
import ManualAssign from "./components/ManualAssignPopup";
import { RowData as DeliveryRowData } from "./types/deliveryTypes";
import { Driver } from '../../types/calendar-types';
import { CustomRowData, useCustomColumns } from "../../hooks/useCustomColumns";
import ClientService from "../../services/client-service";
import { LatLngTuple } from "leaflet";
import { UserType } from "../../types";

interface ClientOverride {
  clientId: string;
  driver?: string;
  time?: string;
}
import { useAuth } from "../../auth/AuthProvider";
import EventCountHeader from "../../components/EventCountHeader";
import { useLimits } from "../Calendar/components/useLimits";
// interface Driver {
//   id: string;
//   name: string;
//   phone: string
//   email: string;
// }

const StyleChip = styled(Chip)({
  backgroundColor: 'var(--color-primary)',
  color: '#fff',
  ":hover": {
    backgroundColor: 'var(--color-primary)',
    cursor: 'text'
  },
  // Disable ripple effect and pointer events
  '& .MuiTouchRipple-root': {
    display: 'none'
  },
  '&:active': {
    boxShadow: 'none',
    transform: 'none'
  },
  '&:focus': {
    boxShadow: 'none'
  },
  // Make text selectable
  userSelect: 'text',
  WebkitUserSelect: 'text'
});

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
      compute: (data: DeliveryRowData, clusters: Cluster[], clientOverrides?: ClientOverride[]) => string;
    }
  | {
      key: "assignedTime";
      label: "Assigned Time";
      type: "text";
      compute: (data: DeliveryRowData, clusters: Cluster[], clientOverrides?: ClientOverride[]) => string;
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
  clientOverrides?: ClientOverride[];
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
  { key: "zipCode", label: "Zip Code", type: "text" },
  { key: "ward", label: "Ward", type: "text" },
  {
    key: "assignedDriver",
    label: "Assigned Driver",
    type: "text",
    compute: (data: DeliveryRowData, clusters: Cluster[], clientOverrides: ClientOverride[] = []) => {
      // Check for individual override first
      const override = clientOverrides.find(override => override.clientId === data.id);
      if (override && override.driver) {
        return override.driver;
      }
      
      // Fall back to cluster assignment
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
    compute: (data: DeliveryRowData, clusters: Cluster[], clientOverrides: ClientOverride[] = []) => {
      // Check for individual override first
      const override = clientOverrides.find(override => override.clientId === data.id);
      if (override && override.time) {
        // Convert 24-hour format to 12-hour AM/PM format
        const [hours, minutes] = override.time.split(":");
        let hours12 = parseInt(hours, 10);
        const ampm = hours12 >= 12 ? "PM" : "AM";
        hours12 = hours12 % 12;
        hours12 = hours12 ? hours12 : 12; // Convert 0 to 12 for 12 AM
        return `${hours12}:${minutes} ${ampm}`;
      }
      
      // Fall back to cluster assignment
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
  {
    key: "deliveryDetails.deliveryInstructions",
    label: "Delivery Instructions",
    type: "text",
    compute: (data: DeliveryRowData) => {
      const instructions = data.deliveryDetails?.deliveryInstructions;
      return instructions && instructions.trim() !== '' ? instructions : 'No instructions';
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
  const { userRole } = useAuth();
  const limits = useLimits();
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

  const parseDateFromUrl = (dateString: string | null): Date => {
    if (!dateString) return new Date();
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? new Date() : date;
    } catch {
      return new Date();
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = searchParams.get('date');
  const [selectedDate, setSelectedDate] = useState<Date>(parseDateFromUrl(initialDate));

  const [deliveriesForDate, setDeliveriesForDate] = useState<DeliveryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clusterDoc, setClusterDoc] = useState<ClusterDoc | null>();
  const [clientOverrides, setClientOverrides] = useState<ClientOverride[]>([]);
  const navigate = useNavigate();  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  
  // Sorting state - default to sorting by fullname (Client) in ascending order
  // Always default to sorting by name (fullname) ascending on first load or reload
  const [sortedColumn, setSortedColumn] = useState<string>(() => {
    // Ignore any persisted value, always default to fullname
    return "fullname";
  });
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    // Ignore any persisted value, always default to asc
    return "asc";
  });
  const [sortTimestamp, setSortTimestamp] = useState<number>(Date.now());

  const {
    customColumns,
    handleAddCustomColumn,
    handleCustomHeaderChange,
    handleRemoveCustomColumn,
    handleCustomColumnChange,
  } = useCustomColumns({page: 'DeliverySpreadsheet'});


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
    if (event && 'nativeEvent' in event) {
      const target = event.nativeEvent.target as HTMLElement;
      const timeValue = target.getAttribute("data-key");
      if (timeValue) {
        assignTime(timeValue);
      }
    }
    setOpen(false);
  };

  const clusterColors = [
    "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF",
    "#00FFFF", "#FFA500", "#800080", "#008000", "#000080",
    "#FF4500", "#4B0082", "#FF6347", "#32CD32", "#9370DB",
    "#FF69B4", "#40E0D0", "#FF8C00", "#7CFC00", "#8A2BE2",
    "#FF1493", "#1E90FF", "#228B22", "#9400D3", "#DC143C",
    "#20B2AA", "#9932CC", "#FFD700", "#8B0000", "#4169E1"
  ];
  const clusterColorMap = (id: string): string => {

    const clusterId = id || "";
    let colorIndex = 0;

    if (clusterId) {
      // Assuming cluster IDs are like "Cluster 1", "Cluster 2", etc.
      // Extract the number part for color assignment.
      // If format is different, adjust parsing logic.
      const match = clusterId.match(/\d+/);
      const clusterNumber = match ? parseInt(match[0], 10) : 0;
      if (!isNaN(clusterNumber)) {
        colorIndex = (clusterNumber - 1) % clusterColors.length; // Use number-1 for 0-based index
      } else {
        // Fallback for non-numeric IDs or parsing failures - hash the ID?
        let hash = 0;
        for (let i = 0; i < clusterId.length; i++) {
          hash = clusterId.charCodeAt(i) + ((hash << 5) - hash);
        }
        colorIndex = Math.abs(hash) % clusterColors.length;
      }
    }

    return clusterColors[colorIndex];
  };

  // Calculate Cluster Options
  const clusterOptions = useMemo(() => {
    const existingIds = clusters.map((c) => parseInt(c.id, 10)).filter((id) => !isNaN(id));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const nextId = (maxId + 1).toString();
    const availableIds = clusters.map(c => c.id).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const options = [
      ...availableIds.map(id => ({ value: id, label: id, color: clusterColorMap(id) })),
      { value: nextId, label: nextId, color: clusterColorMap(nextId) } // Add next available ID
    ];
    options.pop();
    if (options.length == 0) {
      options.push({
        value: "", label: "No Current Clusters",
        color: "#cccccc"
      });
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



  // Helper function to determine if a field is a regular (non-computed) field
  const isRegularField = (field: Field): field is Extract<Field, { compute?: never }> => {
    return !field.compute;
  };

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
          clientOverrides: doc.data().clientOverrides || [],
        };
        setClusterDoc(clustersData);
        setClusters(clustersData.clusters);
        setClientOverrides(clustersData.clientOverrides || []);
      } else {
        setClusterDoc(null); // Clear clusterDoc when no clusters found
        setClusters([]);
        setClientOverrides([]);
      }
    } catch (error) {
      console.error("Error fetching clusters:", error);
      // Clear state only if the error corresponds to the *currently* selected date
      if (dateForFetch.getTime() === selectedDate.getTime()) {
        setClusterDoc(null);
        setClusters([]);
        setClientOverrides([]);
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

      // setRows(prevRows => prevRows.map r => r.id === row.id ? { ...r, clusterId: newClusterId } : r));
    } catch (error) {
      console.error("Error updating clusters in Firestore:", error);
    }
  };

  const handleEmailOrDownload = async (option: "Email" | "Download") => {
    setEmailOrDownload(option);
    setPopupMode("");

    if (exportOption === "Routes") {
      if (option === "Email") {
        alert("Unimplemented");
      } else if (option === "Download") {
        // Pass rows and clusters to exportDeliveries
        exportDeliveries(TimeUtils.fromJSDate(selectedDate).toISODate() || "", rows, clusters);
        console.log("Downloading Routes...");
        // Add your download logic here
      }
    } else if (exportOption === "Doordash") {
      if (option === "Email") {
        alert("Unimplemented");
      } else if (option === "Download") {
        // Export DoorDash deliveries grouped by time
        exportDoordashDeliveries(TimeUtils.fromJSDate(selectedDate).toISODate() || "", rows, clusters);
        console.log("Downloading Doordash...");
      }
    }
  };

  // reset popup selections when closing popup
  // Handle individual client updates from the map (individual overrides)
  const handleIndividualClientUpdate = async (clientId: string, newClusterId: string, newDriver?: string, newTime?: string) => {
    if (!clusterDoc) {
      console.log("Individual client update aborted: clusterDoc is missing.");
      return;
    }

    try {
      // Update or add individual client override
      const existingOverrideIndex = clientOverrides.findIndex(override => override.clientId === clientId);
      let updatedOverrides = [...clientOverrides];

      if (existingOverrideIndex >= 0) {
        // Update existing override
        updatedOverrides[existingOverrideIndex] = {
          clientId,
          driver: newDriver,
          time: newTime
        };
      } else {
        // Add new override
        updatedOverrides.push({
          clientId,
          driver: newDriver,
          time: newTime
        });
      }

      // Remove override if both driver and time are empty/undefined
      if (!newDriver && !newTime) {
        updatedOverrides = updatedOverrides.filter(override => override.clientId !== clientId);
      }

      // Update local state
      setClientOverrides(updatedOverrides);

      // Handle cluster assignment separately
      const currentClient = rows.find(row => row.id === clientId);
      const oldClusterId = currentClient?.clusterId || "";

      let updatedClusters = [...clusters];

      // Remove client from old cluster if it exists
      if (oldClusterId && oldClusterId !== newClusterId) {
        updatedClusters = updatedClusters.map(cluster => {
          if (cluster.id === oldClusterId) {
            return {
              ...cluster,
              deliveries: cluster.deliveries?.filter(id => id !== clientId) ?? []
            };
          }
          return cluster;
        });
      }

      // Add client to new cluster if specified and different from current
      if (newClusterId && newClusterId !== oldClusterId) {
        const clusterExists = clusters.some((cluster) => cluster.id === newClusterId);
        
        if (clusterExists) {
          updatedClusters = updatedClusters.map((cluster) => {
            if (cluster.id === newClusterId) {
              return {
                ...cluster,
                deliveries: [...(cluster.deliveries ?? []), clientId],
              };
            }
            return cluster;
          });
        } else {
          // Create new cluster without driver/time (those should be set at cluster level)
          const newCluster: Cluster = {
            id: newClusterId,
            deliveries: [clientId],
            driver: "",
            time: "",
          };
          updatedClusters.push(newCluster);
        }
      }

      // Sort clusters numerically
      updatedClusters.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

      // Update cluster state
      setClusters(updatedClusters);

      // Update Firebase with cluster changes and client overrides
      const clusterRef = doc(db, "clusters", clusterDoc.docId);
      await updateDoc(clusterRef, { 
        clusters: updatedClusters,
        clientOverrides: updatedOverrides
      });

      // Remove the client from selected rows since their cluster assignment changed
      if (oldClusterId !== newClusterId) {
        const newSelectedRows = new Set(selectedRows);
        const newSelectedClusters = new Set(selectedClusters);
        
        // Remove the client from selected rows
        newSelectedRows.delete(clientId);
        
        // If the old cluster no longer has any selected clients, remove it from selected clusters
        if (oldClusterId) {
          const oldCluster = clusters.find(c => c.id === oldClusterId);
          if (oldCluster) {
            const hasSelectedClientsInOldCluster = oldCluster.deliveries.some(id => 
              id !== clientId && newSelectedRows.has(id)
            );
            if (!hasSelectedClientsInOldCluster) {
              // Remove the old cluster from selected clusters
              const clusterToRemove = Array.from(newSelectedClusters).find(c => c.id === oldClusterId);
              if (clusterToRemove) {
                newSelectedClusters.delete(clusterToRemove);
              }
            }
          }
        }
        
        setSelectedRows(newSelectedRows);
        setSelectedClusters(newSelectedClusters);
      }

      console.log(
        `Successfully updated client ${clientId}:`,
        `cluster: ${oldClusterId || "none"} -> ${newClusterId || "none"}`,
        newDriver ? `driver override: ${newDriver}` : '',
        newTime ? `time override: ${newTime}` : ''
      );

    } catch (error) {
      console.error("Error updating individual client:", error);
    }
  };

  const resetSelections = () => {
    setPopupMode("");
    setExportOption(null);
    setEmailOrDownload(null);
    // Keep selectedRows and selectedClusters checked so users can make multiple assignments
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

      // Clear individual driver overrides for clients in the affected clusters
      const affectedClientIds = new Set<string>();
      clusters.forEach((cluster) => {
        const isSelected = Array.from(selectedClusters).some(
          (selected) => selected.id === cluster.id
        );
        if (isSelected) {
          cluster.deliveries.forEach(clientId => affectedClientIds.add(clientId));
        }
      });

      const updatedOverrides = clientOverrides.map(override => {
        if (affectedClientIds.has(override.clientId)) {
          // Clear the driver field for affected clients
          return { ...override, driver: undefined };
        }
        return override;
      }).filter(override => override.driver || override.time); // Remove overrides with no data

      setClientOverrides(updatedOverrides);

      const clusterRef = doc(db, "clusters", clusterDoc.docId);
      await updateDoc(clusterRef, { 
        clusters: updatedClusters,
        clientOverrides: updatedOverrides
      });

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

        // Clear individual time overrides for clients in the affected clusters
        const affectedClientIds = new Set<string>();
        clusters.forEach((cluster) => {
          const isSelected = Array.from(selectedClusters).some(
            (selected) => selected.id === cluster.id
          );
          if (isSelected) {
            cluster.deliveries.forEach(clientId => affectedClientIds.add(clientId));
          }
        });

        const updatedOverrides = clientOverrides.map(override => {
          if (affectedClientIds.has(override.clientId)) {
            // Clear the time field for affected clients
            return { ...override, time: undefined };
          }
          return override;
        }).filter(override => override.driver || override.time); // Remove overrides with no data

        setClientOverrides(updatedOverrides);

        // Update Firestore using updateDoc
        const clusterRef = doc(db, "clusters", clusterDoc.docId);
        // Only update the 'clusters' field
        await updateDoc(clusterRef, { 
          clusters: updatedClusters,
          clientOverrides: updatedOverrides
        });

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
      date: Timestamp.fromDate(clusterDate), // Use consistent date
      clientOverrides: []
    }

    // Firestore expects the data object directly for setDoc - Corrected
    await setDoc(docRef, newClusterDoc);
    setClusters(newClusters); // Update state after successful Firestore creation
    setClusterDoc(newClusterDoc)
    setClientOverrides([]);
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


    if (clusterDoc) {
      const clusterRef = doc(db, "clusters", clusterDoc.docId);
      // Only update the 'clusters' field using updateDoc
      await updateDoc(clusterRef, { 
        clusters: newClusters,
        clientOverrides: clientOverrides
      });
      setClusters(newClusters); // Update state after successful Firestore update
      // Update the local clusterDoc state's clusters as well
      setClusterDoc(prevDoc => prevDoc ? { ...prevDoc, clusters: newClusters } : null);
    }
    else {
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
        await updateDoc(clusterRef, { 
          clusters: newClusters,
          clientOverrides: clientOverrides
        });
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

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('date', date.toISOString());
    setSearchParams(newSearchParams);
  };

  const visibleRows = rows.filter((row) => {
    const keywordRegex = /(\w+):\s*("[^"]+"|\S+)/g; // Matches key: "value" or key: value
    const matches = [...searchQuery.matchAll(keywordRegex)];

    if (matches.length > 0) {
      // For keyword queries, check that each provided value is a substring of the corresponding field
      return matches.every(([_, key, value]) => {
        const strippedValue = value.replace(/"/g, "").toLowerCase(); // Remove quotes and lowercase

        // Check static fields with a substring match
        const matchesStaticField = fields.some((field) => {
          const fieldValue = field.compute ? field.compute(row, clusters, clientOverrides) : row[field.key as keyof DeliveryRowData];
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
              const fieldValue = field.compute ? field.compute(row, clusters, clientOverrides) : row[field.key as keyof DeliveryRowData];
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
                const fieldValue = field.compute ? field.compute(row, clusters, clientOverrides) : row[field.key as keyof DeliveryRowData];
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

  // Create sorted version of visible rows - supports fullname, clusterIdChange, tags, address, ward, assignedDriver, assignedTime, deliveryInstructions, and custom columns sorting
  const sortedRows = useMemo(() => {
    const sorted = [...visibleRows].sort((a, b) => {
      // Dietary Restrictions sorting: group all with tags before all without tags (no interleaving)
      if (sortedColumn === "dietaryRestrictions") {
        const hasDietA = Array.isArray(a.tags) && a.tags.length > 0;
        const hasDietB = Array.isArray(b.tags) && b.tags.length > 0;
        // Always group: all with tags, then all without tags, preserving original order within each group
        if (hasDietA && !hasDietB) return sortOrder === "asc" ? -1 : 1;
        if (!hasDietA && hasDietB) return sortOrder === "asc" ? 1 : -1;
        // If both are the same (both have tags or both don't), preserve original order
        return 0;
      }
      if (sortedColumn === "fullname") {
        // For fullname field, sort by lastname, firstname format
        const fullnameA = `${a.lastName}, ${a.firstName}`.toLowerCase();
        const fullnameB = `${b.lastName}, ${b.firstName}`.toLowerCase();

        // Handle empty values - empty strings sort first in ascending, last in descending
        if (!fullnameA && !fullnameB) return 0;
        if (!fullnameA) return sortOrder === "asc" ? -1 : 1;
        if (!fullnameB) return sortOrder === "asc" ? 1 : -1;

        const result = sortOrder === "asc"
          ? fullnameA.localeCompare(fullnameB, undefined, { sensitivity: 'base' })
          : fullnameB.localeCompare(fullnameA, undefined, { sensitivity: 'base' });

        return result;
      } else if (sortedColumn === "clusterIdChange") {
        // For clusterId field, sort by the current clusterId value (dropdown selection)
        const clusterIdA = a.clusterId || "";
        const clusterIdB = b.clusterId || "";

        // Handle empty values - empty strings (unassigned) sort first in ascending, last in descending
        if (!clusterIdA && !clusterIdB) return 0;
        if (!clusterIdA) return sortOrder === "asc" ? -1 : 1;
        if (!clusterIdB) return sortOrder === "asc" ? 1 : -1;

        // Parse as numbers for proper numeric sorting
        const numA = parseInt(clusterIdA, 10);
        const numB = parseInt(clusterIdB, 10);

        // If both are valid numbers, sort numerically
        if (!isNaN(numA) && !isNaN(numB)) {
          const result = sortOrder === "asc" ? numA - numB : numB - numA;
          return result;
        }

        // If one or both are not numbers, fall back to string comparison
        return sortOrder === "asc"
          ? clusterIdA.localeCompare(clusterIdB, undefined, { sensitivity: 'base' })
          : clusterIdB.localeCompare(clusterIdA, undefined, { sensitivity: 'base' });
      } else if (sortedColumn === "tags") {
        // For tags field, sort by presence of tags
        const hasTagsA = a.tags && Array.isArray(a.tags) && a.tags.length > 0;
        const hasTagsB = b.tags && Array.isArray(b.tags) && b.tags.length > 0;

        // If both have tags or both don't have tags, maintain original order
        if (hasTagsA === hasTagsB) return 0;

        // Sort by presence: with tags first in ascending, without tags first in descending
        if (sortOrder === "asc") {
          return hasTagsA ? -1 : 1; // hasTagsA comes first
        } else {
          return hasTagsA ? 1 : -1; // !hasTagsA (no tags) comes first
        }
      } else if (sortedColumn === "zipCode") {
        // For zipCode field, sort alphabetically (A-Z/Z-A)
        const zipCodeA = (a.zipCode || "").toLowerCase();
        const zipCodeB = (b.zipCode || "").toLowerCase();

        // Handle empty values - empty strings sort first in ascending, last in descending
        if (!zipCodeA && !zipCodeB) return 0;
        if (!zipCodeA) return sortOrder === "asc" ? -1 : 1;
        if (!zipCodeB) return sortOrder === "asc" ? 1 : -1;

        return sortOrder === "asc"
          ? zipCodeA.localeCompare(zipCodeB, undefined, { sensitivity: 'base' })
          : zipCodeB.localeCompare(zipCodeA, undefined, { sensitivity: 'base' });
      } else if (sortedColumn === "ward") {
        // For ward field, sort alphabetically (A-Z/Z-A)
        const wardA = (a.ward || "").toLowerCase();
        const wardB = (b.ward || "").toLowerCase();

        // Handle empty values - empty strings sort first in ascending, last in descending
        if (!wardA && !wardB) return 0;
        if (!wardA) return sortOrder === "asc" ? -1 : 1;
        if (!wardB) return sortOrder === "asc" ? 1 : -1;

        return sortOrder === "asc"
          ? wardA.localeCompare(wardB, undefined, { sensitivity: 'base' })
          : wardB.localeCompare(wardA, undefined, { sensitivity: 'base' });
      } else if (sortedColumn === "assignedDriver") {
        // For assignedDriver field, sort by driver name alphabetically
        // Use the compute function to get the driver name
        let driverA = "";
        let driverB = "";
        
        clusters.forEach((cluster) => {
          if (cluster.deliveries?.some((id) => id === a.id)) {
            driverA = cluster.driver || "";
          }
          if (cluster.deliveries?.some((id) => id === b.id)) {
            driverB = cluster.driver || "";
          }
        });

        driverA = driverA.toLowerCase();
        driverB = driverB.toLowerCase();

        // Handle empty values - empty strings (no driver assigned) sort first in ascending, last in descending
        if (!driverA && !driverB) return 0;
        if (!driverA) return sortOrder === "asc" ? -1 : 1;
        if (!driverB) return sortOrder === "asc" ? 1 : -1;

        return sortOrder === "asc"
          ? driverA.localeCompare(driverB, undefined, { sensitivity: 'base' })
          : driverB.localeCompare(driverA, undefined, { sensitivity: 'base' });
      } else if (sortedColumn === "assignedTime") {
        // For assignedTime field, sort by time in chronological order (AM before PM)
        // Use the compute function to get the time string
        let timeA = "";
        let timeB = "";
        
        clusters.forEach((cluster) => {
          if (cluster.deliveries?.some((id) => id === a.id)) {
            timeA = cluster.time || "";
          }
          if (cluster.deliveries?.some((id) => id === b.id)) {
            timeB = cluster.time || "";
          }
        });

        // Handle empty values - empty strings (no time assigned) sort first in ascending, last in descending
        if (!timeA && !timeB) return 0;
        if (!timeA) return sortOrder === "asc" ? -1 : 1;
        if (!timeB) return sortOrder === "asc" ? 1 : -1;

        // Convert time strings to comparable format (24-hour for proper chronological sorting)
        const parseTime = (timeStr: string): number => {
          if (!timeStr) return 0;
          const [hours, minutes] = timeStr.split(":");
          return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
        };

        const timeValueA = parseTime(timeA);
        const timeValueB = parseTime(timeB);

        return sortOrder === "asc" ? timeValueA - timeValueB : timeValueB - timeValueA;
      } else if (sortedColumn === "deliveryDetails.deliveryInstructions") {
        // For delivery instructions field, sort alphabetically with special handling for empty instructions
        const instructionsA = (a.deliveryDetails?.deliveryInstructions || "").toLowerCase().trim();
        const instructionsB = (b.deliveryDetails?.deliveryInstructions || "").toLowerCase().trim();

        // Handle empty values - empty instructions sort first in ascending, last in descending
        if (!instructionsA && !instructionsB) return 0;
        if (!instructionsA) return sortOrder === "asc" ? -1 : 1;
        if (!instructionsB) return sortOrder === "asc" ? 1 : -1;

        return sortOrder === "asc"
          ? instructionsA.localeCompare(instructionsB, undefined, { sensitivity: 'base' })
          : instructionsB.localeCompare(instructionsA, undefined, { sensitivity: 'base' });
      } else {
        // Handle custom column sorting
        const customColumn = customColumns.find(col => col.propertyKey === sortedColumn);
        if (customColumn && customColumn.propertyKey !== "none") {
          let valueA = "";
          let valueB = "";

          // Get values for custom column
          if (customColumn.propertyKey === 'referralEntity' && typeof a.referralEntity === 'object' && a.referralEntity !== null) {
            valueA = `${a.referralEntity.name ?? ''}, ${a.referralEntity.organization ?? ''}`.toLowerCase();
          } else if (customColumn.propertyKey.includes('deliveryInstructions')) {
            valueA = (a.deliveryDetails?.deliveryInstructions || "").toLowerCase().trim();
          } else {
            const rawValueA = a[customColumn.propertyKey as keyof DeliveryRowData];
            if (typeof rawValueA === 'object' && rawValueA !== null) {
              if (rawValueA.name || rawValueA.organization) {
                valueA = `${rawValueA.name || ""} ${rawValueA.organization || ""}`.trim().toLowerCase();
              } else {
                valueA = JSON.stringify(rawValueA).toLowerCase();
              }
            } else {
              valueA = String(rawValueA || "").toLowerCase();
            }
          }

          if (customColumn.propertyKey === 'referralEntity' && typeof b.referralEntity === 'object' && b.referralEntity !== null) {
            valueB = `${b.referralEntity.name ?? ''}, ${b.referralEntity.organization ?? ''}`.toLowerCase();
          } else if (customColumn.propertyKey.includes('deliveryInstructions')) {
            valueB = (b.deliveryDetails?.deliveryInstructions || "").toLowerCase().trim();
          } else {
            const rawValueB = b[customColumn.propertyKey as keyof DeliveryRowData];
            if (typeof rawValueB === 'object' && rawValueB !== null) {
              if (rawValueB.name || rawValueB.organization) {
                valueB = `${rawValueB.name || ""} ${rawValueB.organization || ""}`.trim().toLowerCase();
              } else {
                valueB = JSON.stringify(rawValueB).toLowerCase();
              }
            } else {
              valueB = String(rawValueB || "").toLowerCase();
            }
          }

          // Handle empty values - empty strings sort first in ascending, last in descending
          if (!valueA && !valueB) return 0;
          if (!valueA) return sortOrder === "asc" ? -1 : 1;
          if (!valueB) return sortOrder === "asc" ? 1 : -1;

          return sortOrder === "asc"
            ? valueA.localeCompare(valueB, undefined, { sensitivity: 'base' })
            : valueB.localeCompare(valueA, undefined, { sensitivity: 'base' });
        }
      }

      // If no sorting column is set or unsupported column, return unsorted
      return 0;
    });

    return sorted;
  }, [visibleRows, sortOrder, sortedColumn, clusters, customColumns]);

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

  // Handle column header click for sorting - supports fullname, clusterIdChange, tags, address, ward, assignedDriver, assignedTime, deliveryInstructions, and custom columns
  const handleSort = (field: Field | { key: string }) => {
    const fieldKey = String(field.key);
    
    // Allow sorting on supported columns and any custom column
    const supportedColumns = ["fullname", "clusterIdChange", "tags", "zipCode", "ward", "assignedDriver", "assignedTime", "deliveryDetails.deliveryInstructions"];
    const isCustomColumn = customColumns.some(col => col.propertyKey === fieldKey);
    
    if (!supportedColumns.includes(fieldKey) && !isCustomColumn) {
      return;
    }

    if (fieldKey === sortedColumn) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to ascending
      setSortedColumn(fieldKey);
      setSortOrder("asc");
    }
    
    // Force table re-render with new timestamp
    setSortTimestamp(Date.now());
  };

  return (
    <Box className="box" sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

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
        <Typography variant="h5" sx={{ marginRight: 2,  color: "#787777" }}>
          {format(selectedDate, 'EEEE - MMMM, dd/yyyy',)} 
        </Typography>
        
  
        <IconButton
          onClick={() => handleDateChange(addDays(selectedDate, -1))}
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
          onClick={() => handleDateChange(addDays(selectedDate, 1))}
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
          style={{
            width: '4.25rem',
            height: '2.5rem',
            minWidth: '4.25rem',
            minHeight: '2.5rem',
            maxHeight: '2.5rem',
            fontSize: 12,
            marginLeft: 16,
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0
          }}
          onClick={() => setSelectedDate(new Date())}
          startIcon={<TodayIcon sx={{ marginRight: '-8px', marginLeft: '-2px' }} />}
        >
          Today
        </Button>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <PageDatePicker setSelectedDate={handleDateChange}  marginLeft="1rem" />
        </Box>
      </Box>
      <Button
        variant="primary"
        size="medium"
        disabled={userRole === UserType.ClientIntake}
        style={{
          whiteSpace: "nowrap",
          padding: "0% 2%",
          borderRadius: 5,
          width: "auto",
          marginRight: '16px'
        }}
        onClick={() => setPopupMode("ManualClusters")}
        startIcon={<AddIcon />}
      >
        Manual Assign
      </Button>
        
      <Button
        variant="primary"
        size="medium"
        disabled={userRole === UserType.ClientIntake}
        style={{
          whiteSpace: "nowrap",
          padding: "0% 2%",
          borderRadius: 5,
          width: "auto",
          marginRight: '16px'
        }}
        onClick={() => setPopupMode("Clusters")}
        startIcon={<GroupWorkIcon />}
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
          <ClusterMap clusters={clusters} visibleRows={visibleRows as any} clientOverrides={clientOverrides} onClusterUpdate={handleIndividualClientUpdate} />
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
            <Box sx={{ display: "flex", width: "100%", gap: "8px", flexWrap: "wrap" }}>
              <Button
                variant="primary"
                size="medium"
                icon={<AssignmentIndIcon />}
                disabled={selectedRows.size <= 0}
                style={{
                  whiteSpace: "nowrap",
                  borderRadius: 5,
                  marginRight: '8px'
                }}
                onClick={() => setPopupMode("Driver")}
              >
                Assign Driver
              </Button>
              <Button
                variant="primary"
                size="medium"
                id="demo-positioned-button"

                aria-controls={open ? 'demo-positioned-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                icon={<AccessTimeIcon />}
                onClick={handleClick}
                disabled={selectedRows.size <= 0}
                style={{
                  whiteSpace: "nowrap",
                  borderRadius: 5,
                  marginRight: '8px'
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
                {Object.values(times).map(({ value, label, ...restUserProps }) => (
                  <MenuItem key={value} data-key={value} onClick={handleClose}>{label}</MenuItem>
                ))}
              </Menu>
            </Box>
            {/* Right group: Export button */}
            <Box>
              <Button
                variant="primary"
                size="medium"
                icon={<FileDownloadIcon />}
                style={{
                  whiteSpace: "nowrap",
                  borderRadius: 5,
                  marginRight: '8px',
                  padding: 'var(--spacing-sm) calc(var(--spacing-xl) + 8px)',
                  height: 'var(--button-height)'
                }}
                onClick={() => setPopupMode("Export")}
              >
                Export
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
      {/* Add daily limit calculation and pass to EventCountHeader */}
      {(() => {
        // Calculate the daily limit for the selected date
        const selectedDateObj = TimeUtils.fromJSDate(selectedDate);
        const dayOfWeek = selectedDateObj.weekday % 7; // Luxon weekday: 1=Monday, convert to 0=Sunday format
        const adjustedDayOfWeek = dayOfWeek === 7 ? 0 : dayOfWeek; // Convert Sunday from 7 to 0
        const dailyLimit = limits && limits.length > adjustedDayOfWeek ? limits[adjustedDayOfWeek] : undefined;
        
        return <EventCountHeader events={rows} limit={dailyLimit} />;
      })()}
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
          <Table sx={{ tableLayout: 'auto', width: '100%' }}>
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
                      cursor: (field.key === "fullname" || field.key === "clusterIdChange" || field.key === "tags" || field.key === "zipCode" || field.key === "ward" || field.key === "assignedDriver" || field.key === "assignedTime" || field.key === "deliveryDetails.deliveryInstructions") ? "pointer" : "default",
                      userSelect: "none",
                    }}
                    onClick={() => (field.key === "fullname" || field.key === "clusterIdChange" || field.key === "tags" || field.key === "zipCode" || field.key === "ward" || field.key === "assignedDriver" || field.key === "assignedTime" || field.key === "deliveryDetails.deliveryInstructions") && handleSort(field)}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                      {field.label}
                      {(field.key === "fullname" || field.key === "clusterIdChange" || field.key === "tags" || field.key === "zipCode" || field.key === "ward" || field.key === "assignedDriver" || field.key === "assignedTime" || field.key === "deliveryDetails.deliveryInstructions") && (
                        <>
                          {String(field.key) === sortedColumn ? (
                            sortOrder === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />
                          ) : (
                            <UnfoldMoreIcon sx={{ opacity: 0.3 }} />
                          )}
                        </>
                      )}
                    </Box>
                  </TableCell>
                ))}
                {customColumns.map((col) => (
                    <TableCell 
                      className="table-header" 
                      key={col.id}
                      style={{
                        userSelect: "none",
                        cursor: col.propertyKey !== "none" ? "pointer" : "default",
                      }}
                      onClick={() => col.propertyKey !== "none" && handleSort({ key: col.propertyKey } as Field)}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Select
                            value={col.propertyKey}
                            onChange={(event) => handleCustomHeaderChange(event, col.id)}
                            variant="outlined"
                            displayEmpty
                            size="small"
                            onClick={(e) => e.stopPropagation()} // Prevent sorting when clicking dropdown
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
                          <MenuItem value="address">Address</MenuItem>
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
                        </Box>
                        {/* Show sort icon if this custom column is currently sorted */}
                        {col.propertyKey !== "none" && (
                          sortedColumn === col.propertyKey ? (
                            sortOrder === "asc" ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />
                          ) : (
                            <UnfoldMoreIcon sx={{ opacity: 0.3 }} />
                          )
                        )}
                        {/*Add Remove Button*/}
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
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
                    </TableCell>
                  ))}
                  {/* Add button cell */}
                  <TableCell 
                    className="table-header" 
                    align="right"
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
              {sortedRows.map((row, index) => (
                <TableRow key={`${sortTimestamp}-${index}-${row.id}`} className="table-row">
                  {fields.map((field) => {
                    // Render the table cell based on field type
                    return (
                      <TableCell
                        key={field.key}
                        style={{
                          textAlign: "center",
                          padding: "10px",
                          minWidth: field.type === "select" ? "150px" : "auto",
                          maxWidth: field.key === "zipCode" || field.key === "deliveryDetails.deliveryInstructions" ? "200px" : "auto",
                          wordWrap: "break-word",
                          overflowWrap: "anywhere",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {field.type === "checkbox" ? (
                          <Checkbox
                            size="small"
                            disabled={userRole === UserType.ClientIntake}
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
                              disabled={userRole === UserType.ClientIntake}
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
                                  <Chip
                                    label={option.label === "Unassigned" ? option.label : option.label}
                                    style={typeof option.color === 'string' ?
                                      { backgroundColor: option.color, color: 'white', border: '1px solid black', fontWeight: 'bold', textShadow: '.5px .5px .5px #000, -.5px .5px .5px #000, -.5px -.5px 0px #000, .5px -.5px 0px #000' }
                                      : undefined}
                                    onClick={(e) => e.stopPropagation()}
                                    sx={{
                                      pointerEvents: 'none',
                                      '& .MuiTouchRipple-root': {
                                        display: 'none'
                                      }
                                    }}
                                  />
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : field.compute ? (
                          // Render computed fields (other than the select)
                          field.key === "assignedDriver" || field.key === "assignedTime" ? (
                            field.compute(row, clusters, clientOverrides)
                          ) : field.key === "fullname" ? (
                            // Render fullname as a link to client profile
                            <Link
                              to={`/profile/${row.id}`}
                              style={{
                                color: "#2E5B4C",
                                textDecoration: "none",
                                fontWeight: "500",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                              onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {field.compute(row)}
                            </Link>
                          ) : field.key === "deliveryDetails.deliveryInstructions" ? (
                            // Render delivery instructions with word wrapping
                            <div style={{ 
                              maxWidth: '200px', 
                              wordWrap: 'break-word', 
                              overflowWrap: 'anywhere', 
                              whiteSpace: 'pre-wrap' 
                            }}>
                              {(field as Extract<Field, { key: "deliveryDetails.deliveryInstructions" }>).compute(row)}
                            </div>
                          ) : field.key === "tags" ? (

                              // Render tags field
                              row.tags && row.tags.length > 0 ? (
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
                                  {row.tags.map((tag, index) => (
                                    <StyleChip key={index}
                                      label={tag}
                                      size="small"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation();
                                      }}
                                    />
                                  ))}
                                </Box>
                              ) : (
                                "No Tags"
                              )
                            ) : ( 
                            field.compute(row)
                          ) // Assumes other compute fields don't need clusters
                        ) : isRegularField(field) ? (
                          // Render regular fields (zipCode, ward)
                          // Cast to string as these are the only expected types here
                          String(row[field.key as "zipCode" | "ward"] ?? "")
                        ) : // Default case: render nothing or a placeholder
                          null}
                      </TableCell>
                    ); // End return for TableCell
                  })}
                  {customColumns.map((col) => (
                    <TableCell 
                      key={col.id} 
                      sx={{ 
                        py: 2,
                        maxWidth: '200px',
                        overflow: 'hidden',
                        wordWrap: 'break-word',
                        overflowWrap: 'anywhere',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {col.propertyKey !== "none" ? (
                        col.propertyKey === 'referralEntity' && typeof row.referralEntity === 'object' && row.referralEntity !== null ?
                        `${row.referralEntity.name ?? 'N/A'}, ${row.referralEntity.organization ?? 'N/A'}`
                        : col.propertyKey.includes('deliveryInstructions') ? (
                          (() => {
                            const instructions = row.deliveryDetails?.deliveryInstructions;
                            return instructions && instructions.trim() !== '' ? instructions : 'No instructions';
                          })()
                        ) : (row[col.propertyKey as keyof DeliveryRowData]?.toString() ?? "N/A")
                      ) : (
                        "N/A"
                      )} 
                    </TableCell>
                  ))}
                  {/* Add button cell */}
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
              <Button variant="primary" color="primary" onClick={() => setExportOption("Routes")} startIcon={<FileDownloadIcon />}> 
                Routes
              </Button>
              <Button
                variant="secondary"
                color="secondary"
                onClick={() => setExportOption("Doordash")}
                startIcon={<FileDownloadIcon />}
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
              allDeliveries={visibleRows as any}
              onClose={resetSelections}
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

export default DeliverySpreadsheet;
