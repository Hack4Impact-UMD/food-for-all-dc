import { RowData as DeliveryRowData } from "./types/deliveryTypes";
import { Driver } from "../../types/calendar-types";
import { useCustomColumns, allowedPropertyKeys } from "../../hooks/useCustomColumns";
import { clientService } from "../../services/client-service";
import { LatLngTuple } from "leaflet";
import { UserType } from "../../types";
import { useAuth } from "../../auth/AuthProvider";
import EventCountHeader from "../../components/EventCountHeader";
import { useLimits } from "../Calendar/components/useLimits";

interface ClientOverride {
  clientId: string;
  driver?: string;
  time?: string;
}
// ...existing code...
// ...existing code...
// ...existing code...
import React, { useState, useEffect, useMemo, Suspense } from "react";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { getEventsByViewType } from "../Calendar/components/getEventsByViewType";
import CircularProgress from "@mui/material/CircularProgress";
import { DayPilot } from "@daypilot/daypilot-lite-react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { db } from "../../auth/firebaseConfig";
import dataSources from "../../config/dataSources";
import { useClientData } from "../../context/ClientDataContext";
import { ClientProfile } from "../../types/client-types";

import {
  parseSearchTermsProgressively,
  checkStringContains as utilCheckStringContains,
  extractKeyValue,
  globalSearchMatch,
} from "../../utils/searchFilter";
import { query, Timestamp, updateDoc, where, orderBy } from "firebase/firestore";
import { TimeUtils } from "../../utils/timeUtils";
import { TableVirtuoso, TableVirtuosoHandle } from "react-virtuoso";
import { format, addDays } from "date-fns";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import DeleteIcon from "@mui/icons-material/Delete";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
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
  Menu,
  Chip,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { styled } from "@mui/material/styles";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { auth } from "../../auth/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
// ...existing code...
// Ensure clients are loaded for event query
const ClusterMap = React.lazy(() => import("./ClusterMap"));
import AssignDriverPopup from "./components/AssignDriverPopup";
import GenerateClustersPopup from "./components/GenerateClustersPopup";
import AssignTimePopup from "./components/AssignTimePopup";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import { exportDeliveries, exportDoordashDeliveries } from "./RouteExport";
import Button from "@mui/material/Button";
// ...existing code...

import DietaryRestrictionsLegend from "../../components/DietaryRestrictionsLegend";
import { deliveryDate } from "../../utils/deliveryDate";

const StyleChip = styled(Chip)({
  backgroundColor: "var(--color-primary)",
  color: "var(--color-background-main)",
  ":hover": {
    backgroundColor: "var(--color-primary)",
    cursor: "text",
  },
  // Disable ripple effect and pointer events
  "& .MuiTouchRipple-root": {
    display: "none",
  },
  "&:active": {
    boxShadow: "none",
    transform: "none",
  },
  "&:focus": {
    boxShadow: "none",
  },
  // Make text selectable
  userSelect: "text",
  WebkitUserSelect: "text",
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
      key: Exclude<
        keyof Omit<DeliveryRowData, "id" | "firstName" | "lastName" | "deliveryDetails">,
        "coordinates"
      >;
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
      compute: (
        data: DeliveryRowData,
        clusters: Cluster[],
        clientOverrides?: ClientOverride[]
      ) => string;
    }
  | {
      key: "assignedTime";
      label: "Assigned Time";
      type: "text";
      compute: (
        data: DeliveryRowData,
        clusters: Cluster[],
        clientOverrides?: ClientOverride[]
      ) => string;
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

// Helper to remove undefined fields from clientOverrides before writing to Firestore
const sanitizeClientOverridesForFirestore = (overrides: ClientOverride[]): ClientOverride[] => {
  return overrides.map((override) => {
    const cleaned: ClientOverride = {
      clientId: override.clientId,
    };

    if (override.driver !== undefined) {
      cleaned.driver = override.driver;
    }

    if (override.time !== undefined) {
      cleaned.time = override.time;
    }

    return cleaned;
  });
};

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
    compute: (
      data: DeliveryRowData,
      clusters: Cluster[],
      clientOverrides: ClientOverride[] = []
    ) => {
      // Check for individual override first
      const override = clientOverrides.find((override) => override.clientId === data.id);
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
    compute: (
      data: DeliveryRowData,
      clusters: Cluster[],
      clientOverrides: ClientOverride[] = []
    ) => {
      // Check for individual override first
      const override = clientOverrides.find((override) => override.clientId === data.id);
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
      return instructions && instructions.trim() !== "" ? instructions : "No instructions";
    },
  },
];

const times = (() => {
  const intervals = [];
  const startHour = 8;
  const endHour = 17;
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
      if (hour === endHour && min > 0) continue; // Don't add 5:30 PM
      const value = `${hour.toString().padStart(2, "0")}:${min === 0 ? "00" : "30"}`;
      // Format label as 12-hour time
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? "AM" : "PM";
      const label = `${displayHour}:${min === 0 ? "00" : "30"} ${ampm}`;
      intervals.push({ value, label });
    }
  }
  return intervals;
})();

// Type Guard to check if a field is a regular field
const isRegularField = (
  field: Field
): field is Extract<Field, { key: Exclude<keyof DeliveryRowData, "coordinates"> }> => {
  return (
    field.key !== "fullname" &&
    field.key !== "tags" &&
    field.key !== "assignedDriver" &&
    field.key !== "assignedTime" &&
    field.key !== "deliveryDetails.deliveryInstructions"
  );
};

const DeliverySpreadsheet: React.FC = () => {
  // For custom cluster dropdown menu anchor
  const [anchorEls, setAnchorEls] = useState<{ [rowId: string]: HTMLElement | null }>({});
  // Track temporary select value for each row to allow '__add__' selection
  const [selectValues, setSelectValues] = useState<{ [rowId: string]: string }>({});
  // Dummy state to force re-render of Select when needed
  const [selectResetKey, setSelectResetKey] = useState(0);
  // Ref map for each row's Select
  const selectRefs = React.useRef<{ [key: string]: HTMLInputElement | null }>({});
  // Ref for TableVirtuoso to enable scrolling to specific rows
  const virtuosoRef = React.useRef<TableVirtuosoHandle>(null);
  // Workaround for opening modal after Select closes (track row id)
  const [pendingOpenAddClusterModalRow, setPendingOpenAddClusterModalRow] = useState<string | null>(
    null
  );

  // Effect: open modal if pendingOpenAddClusterModalRow is set
  useEffect(() => {
    if (pendingOpenAddClusterModalRow) {
      setAddClusterModalOpen(true);
      setNumClustersToAdd(1);
      setPendingOpenAddClusterModalRow(null);
      setSelectResetKey((prev) => prev + 1); // force Select to re-render
    }
  }, [pendingOpenAddClusterModalRow]);
  // Add Cluster Modal State (for "+" cluster add)
  const [addClusterModalOpen, setAddClusterModalOpen] = useState(false);
  const [numClustersToAdd, setNumClustersToAdd] = useState(1);
  // Reset clusters to empty for the current day
  const handleResetClusters = async () => {
    // Close map popup if open
    if (typeof window !== "undefined" && (window as any).closeMapPopup) {
      (window as any).closeMapPopup();
    }
    if (!clusterDoc) return;
    try {
      const clusterRef = doc(db, dataSources.firebase.clustersCollection, clusterDoc.docId);
      await updateDoc(clusterRef, { clusters: [], clientOverrides: [] });
      setClusters([]);
      setClientOverrides([]);
    } catch (error) {
      console.error("Error resetting clusters:", error);
    }
  };
  const { clients: clientsFromContext, loading: clientsLoading } = useClientData();
  const testing = false;
  const { userRole } = useAuth();
  const limits = useLimits();
  const [rows, setRows] = useState<DeliveryRowData[]>([]);
  const [rawClientData, setRawClientData] = useState<DeliveryRowData[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const [popupMode, setPopupMode] = useState("");
  const [clusters, setClustersOriginal] = useState<Cluster[]>([]);
  const [selectedClusters, setSelectedClusters] = useState<Set<any>>(new Set());
  const [exportOption, setExportOption] = useState<"Routes" | "Doordash" | null>(null);

  const [driversRefreshTrigger, setDriversRefreshTrigger] = useState<number>(0);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  // Suppress highlight clearing when switching rows/popups
  const suppressClearHighlightRef = React.useRef(false);

  // Helper function to deduplicate clusters by ID
  const deduplicateClusters = (clusters: Cluster[]): Cluster[] => {
    return clusters.filter(
      (cluster: Cluster, index: number, self: Cluster[]) =>
        index === self.findIndex((c: Cluster) => c.id === cluster.id)
    );
  };

  // Safe wrapper for setClusters that always deduplicates
  const setClusters = (clusters: Cluster[]) => {
    const deduplicated = deduplicateClusters(clusters);
    setClustersOriginal(deduplicated);
  };

  const parseDateFromUrl = (dateString: string | null): Date => {
    return deliveryDate.parseDateParam(dateString);
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = searchParams.get("date");
  const [selectedDate, setSelectedDate] = useState<Date>(parseDateFromUrl(initialDate));

  const [deliveriesForDate, setDeliveriesForDate] = useState<
    Array<Omit<DeliveryEvent, "deliveryDate"> & { deliveryDate: Date | import("luxon").DateTime }>
  >([]);

  // Granular loading states for better UX
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(false);
  const [isLoadingClientDetails, setIsLoadingClientDetails] = useState(false);
  const [isLoadingClusters, setIsLoadingClusters] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Still needed for clustering operations

  // Computed loading state - show loading only for critical operations
  const isMainLoading = clientsLoading || isLoadingDeliveries || isLoadingClientDetails;
  const [clusterDoc, setClusterDoc] = useState<ClusterDoc | null>();
  const [clientOverrides, setClientOverrides] = useState<ClientOverride[]>([]);
  const navigate = useNavigate();

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

  const {
    customColumns,
    handleAddCustomColumn,
    handleCustomHeaderChange,
    handleRemoveCustomColumn,
  } = useCustomColumns({ page: "DeliverySpreadsheet" });

  // Function to trigger driver refresh across components
  const triggerDriverRefresh = () => {
    setDriversRefreshTrigger((prev) => prev + 1);
  };

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setOpen(true);
    setAnchorEl(event.currentTarget);
  };

  const [menuOpen, setOpen] = useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const handleClose = (event: Event | React.SyntheticEvent) => {
    if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
      return;
    }
    if (event && "nativeEvent" in event) {
      const target = event.nativeEvent.target as HTMLElement;
      const timeValue = target.getAttribute("data-key");
      if (timeValue) {
        assignTime(timeValue);
      }
    }
    setOpen(false);
  };

  const assignTime = async (time: string) => {
    if (time && clusterDoc) {
      try {
        // Individual time assignment for selected clients (not cluster-level)
        const selectedRowsArray = Array.from(selectedRows);

        if (selectedRowsArray.length === 0) {
          return;
        }

        // Create or update individual time overrides for each selected client
        let updatedOverrides = [...clientOverrides];

        selectedRowsArray.forEach((clientId) => {
          const existingOverrideIndex = updatedOverrides.findIndex(
            (override) => override.clientId === clientId
          );
          if (existingOverrideIndex >= 0) {
            // Update existing override
            updatedOverrides[existingOverrideIndex] = {
              ...updatedOverrides[existingOverrideIndex],
              time: time,
            };
          } else {
            // Add new override
            updatedOverrides.push({
              clientId,
              driver: undefined,
              time: time,
            });
          }
        });

        // Clean up overrides - remove any that have neither driver nor time
        updatedOverrides = updatedOverrides.filter((override) => override.driver || override.time);

        setClientOverrides(updatedOverrides);

        // Update Firestore - we don't need to modify clusters since time is now individual
        const clusterRef = doc(db, dataSources.firebase.clustersCollection, clusterDoc.docId);
        await updateDoc(clusterRef, {
          clusters: clusters, // Keep clusters unchanged
          clientOverrides: sanitizeClientOverridesForFirestore(updatedOverrides),
        });

        resetSelections();
      } catch (error) {
        console.error("Error assigning time: ", error);
      }
    }
  };

  const clusterColors = [
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#FF00FF",
    "#00FFFF",
    "#FFA500",
    "#800080",
    "#008000",
    "#000080",
    "#FF4500",
    "#4B0082",
    "#FF6347",
    "#32CD32",
    "#9370DB",
    "#FF69B4",
    "#40E0D0",
    "#FF8C00",
    "#7CFC00",
    "#8A2BE2",
    "#FF1493",
    "#1E90FF",
    "#228B22",
    "#9400D3",
    "#DC143C",
    "#20B2AA",
    "#9932CC",
    "#FFD700",
    "#8B0000",
    "#4169E1",
  ];
  const clusterColorMap = (id: string): string => {
    const clusterId = id || "";
    let colorIndex = 0;

    if (clusterId) {
      // Ensure clusterId is a string before calling .match()
      const clusterIdStr = String(clusterId);
      // Assuming cluster IDs are like "1", "2", etc.
      // Extract the number part for color assignment.
      const match = clusterIdStr.match(/\d+/);
      const clusterNumber = match ? parseInt(match[0], 10) : NaN;
      if (!isNaN(clusterNumber) && clusterNumber > 0) {
        colorIndex = (clusterNumber - 1) % clusterColors.length; // Use number-1 for 0-based index
      } else {
        // Fallback for non-numeric IDs or parsing failures - hash the ID
        let hash = 0;
        for (let i = 0; i < clusterIdStr.length; i++) {
          hash = clusterIdStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        colorIndex = Math.abs(hash) % clusterColors.length;
      }
    }

    return clusterColors[colorIndex];
  };

  // Calculate Cluster Options
  // Extend type for cluster options
  type ClusterOption = { value: string; label: string; color: string; isAdd?: boolean };
  const clusterOptions: ClusterOption[] = useMemo(() => {
    // Get unique cluster IDs and remove duplicates
    const uniqueIds = [...new Set(clusters.map((c) => c.id))];
    // Sort the unique IDs
    const availableIds = uniqueIds.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    // Create options from existing unique IDs ONLY
    const options: ClusterOption[] = availableIds.map((id) => ({
      value: id,
      label: id,
      color: clusterColorMap(id),
    }));
    // Add the special "+" option at the end only if clusters exist
    if (clusters.length > 0) {
      options.push({
        value: "__add__",
        label: "Add Cluster",
        color: "var(--color-border-input)",
        isAdd: true,
      });
    }
    return options;
  }, [clusters]);

  // fetch deliveries for the selected date
  // Centralized event query for deliveries
  const fetchDeliveriesForDate = async (dateForFetch: Date) => {
    setIsLoadingDeliveries(true);

    try {
      // Map RowData to ClientProfile format for getEventsByViewType
      const clientsForQuery = clientsFromContext.map((client) => ({
        uid: client.uid,
        firstName: client.firstName,
        lastName: client.lastName,
      })) as ClientProfile[];

      const { updatedEvents } = await getEventsByViewType({
        viewType: "Day",
        currentDate: new DayPilot.Date(dateForFetch),
        clients: clientsForQuery,
      });

      // Check if the date is still the selected one before updating state
      if (dateForFetch.getTime() !== selectedDate.getTime()) {
        return;
      }
      // Convert event type for spreadsheet compatibility
      const convertedEvents = updatedEvents
        .map((event) => {
          let deliveryDate = event.deliveryDate;
          // If it's a Firestore Timestamp, convert to JS Date
          if (
            deliveryDate &&
            typeof deliveryDate === "object" &&
            "seconds" in deliveryDate &&
            typeof deliveryDate.seconds === "number" &&
            typeof deliveryDate.toDate === "function"
          ) {
            deliveryDate = deliveryDate.toDate();
          }
          // Only allow JS Date or Luxon DateTime
          if (
            deliveryDate instanceof Date ||
            (deliveryDate &&
              typeof deliveryDate === "object" &&
              "isValid" in deliveryDate &&
              typeof deliveryDate.isValid === "boolean")
          ) {
            return {
              ...event,
              deliveryDate,
              recurrence: event.recurrence === "Custom" ? "None" : event.recurrence,
            };
          }
          // Otherwise, skip this event
          return null;
        })
        .filter(Boolean) as Array<
        Omit<DeliveryEvent, "deliveryDate"> & { deliveryDate: Date | import("luxon").DateTime }
      >;
      setDeliveriesForDate(convertedEvents);
      const fetchEndTime = performance.now();
    } catch (error) {
      const fetchEndTime = performance.now();

      if (dateForFetch.getTime() === selectedDate.getTime()) {
        setDeliveriesForDate([]);
      }
    } finally {
      setIsLoadingDeliveries(false);
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
        const clientIds = deliveriesForDate
          .map((delivery) => delivery.clientId)
          .filter((id) => id && id.trim() !== "");

        // Firestore 'in' queries are limited to 10 items per query
        const chunkSize = 10;
        let clientsWithDeliveriesOnSelectedDate: DeliveryRowData[] = [];
        for (let i = 0; i < clientIds.length; i += chunkSize) {
          const chunk = clientIds.slice(i, i + chunkSize);
          if (chunk.length === 0) continue;
          const q = query(
            collection(db, dataSources.firebase.clientsCollection),
            where("__name__", "in", chunk)
          );
          const snapshot = await getDocs(q);
          const chunkData = snapshot.docs.map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
              }) as DeliveryRowData
          );
          clientsWithDeliveriesOnSelectedDate =
            clientsWithDeliveriesOnSelectedDate.concat(chunkData);
        }
        setRawClientData(clientsWithDeliveriesOnSelectedDate);
        const processEndTime = performance.now();
      } catch (error) {
        const processEndTime = performance.now();

        setRawClientData([]); // Clear data on error
      } finally {
        //Stop loading after processing
        setIsLoadingClientDetails(false);
      }
    };

    if (deliveriesForDate.length > 0) {
      // Set loading to true *before* starting the async fetch/geocode process
      setIsLoadingClientDetails(true);
      fetchDataAndGeocode();
    } else {
      // If deliveries are empty (either initially or after fetch),
      // ensure client data is clear and loading is stopped.
      setRawClientData([]);
      // Do NOT clear clusters here, as they are fetched independently
      setIsLoadingClientDetails(false);
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

  // Helper function to determine if a field is a regular (non-computed) field

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

      const clustersCollectionRef = collection(db, dataSources.firebase.clustersCollection);
      const q = query(
        clustersCollectionRef,
        where("date", ">=", Timestamp.fromDate(startDate)),
        where("date", "<=", Timestamp.fromDate(endDate)),
        orderBy("date", "asc")
      );

      const clustersSnapshot = await getDocs(q);

      // Check if the date is still the selected one before updating state
      if (dateForFetch.getTime() !== selectedDate.getTime()) {
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
        // Set clusters (deduplication is handled automatically by setClusters wrapper)
        setClusters(clustersData.clusters);
        setClientOverrides(clustersData.clientOverrides || []);
      } else {
        // No clusters found for this date

        setClusterDoc(null); // Clear clusterDoc when no clusters found
        setClusters([]);
        setClientOverrides([]);
      }
    } catch (error) {
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
    let newClusterId = newClusterIdStr;

    // If the newClusterId is '__add__', find the next highest numeric cluster ID
    if (newClusterIdStr === "__add__") {
      const numericIds = clusters.map((c) => parseInt(c.id, 10)).filter((n) => !isNaN(n));
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      newClusterId = (maxId + 1).toString();
    }

    if (!row || !row.id || newClusterId === oldClusterId || !clusterDoc) {
      return;
    }

    let updatedClusters = [...clusters];
    const clusterExists = clusters.some((cluster) => cluster.id === newClusterId);

    if (oldClusterId) {
      updatedClusters = updatedClusters.map((cluster) => {
        if (cluster.id === oldClusterId) {
          return {
            ...cluster,
            deliveries: cluster.deliveries?.filter((id) => id !== row.id) ?? [],
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

    // Set clusters (deduplication is handled automatically by setClusters wrapper)
    setClusters(updatedClusters);

    // Inherit time assignment from existing cluster clients
    let updatedOverrides = [...clientOverrides];
    if (clusterExists) {
      const targetCluster = updatedClusters.find((c) => c.id === newClusterId);
      if (targetCluster?.deliveries?.length > 1) {
        const otherClientIds = targetCluster.deliveries.filter((id) => id !== row.id);
        const existingTimeOverride = clientOverrides.find(
          (override) => otherClientIds.includes(override.clientId) && override.time
        );

        if (existingTimeOverride) {
          const existingOverrideIndex = updatedOverrides.findIndex(
            (override) => override.clientId === row.id
          );

          if (existingOverrideIndex >= 0) {
            updatedOverrides[existingOverrideIndex] = {
              ...updatedOverrides[existingOverrideIndex],
              time: existingTimeOverride.time,
            };
          } else {
            updatedOverrides.push({
              clientId: row.id,
              driver: undefined,
              time: existingTimeOverride.time,
            });
          }

          updatedOverrides = updatedOverrides.filter((override) => override.driver || override.time);
          setClientOverrides(updatedOverrides);
        }
      }
    }

    try {
      const clusterRef = doc(db, dataSources.firebase.clustersCollection, clusterDoc.docId);
      await updateDoc(clusterRef, {
        clusters: deduplicateClusters(updatedClusters),
        clientOverrides: sanitizeClientOverridesForFirestore(updatedOverrides),
      });

      // setRows(prevRows => prevRows.map r => r.id === row.id ? { ...r, clusterId: newClusterId } : r));
    } catch (error) {
      console.error("Error updating clusters in Firestore:", error);
    }
  };

  const handleEmailOrDownload = async (option: "Email" | "Download") => {
    setPopupMode("");

    if (exportOption === "Routes") {
      if (option === "Email") {
        alert("Unimplemented");
      } else if (option === "Download") {
        // Pass rows and clusters to exportDeliveries
        exportDeliveries(TimeUtils.fromJSDate(selectedDate).toISODate() || "", rows, clusters);
      }
    } else if (exportOption === "Doordash") {
      if (option === "Email") {
        alert("Unimplemented");
      } else if (option === "Download") {
        // Export DoorDash deliveries grouped by time
        exportDoordashDeliveries(
          TimeUtils.fromJSDate(selectedDate).toISODate() || "",
          rows,
          clusters
        );
      }
    }
  };

  // reset popup selections when closing popup
  // Handle individual client updates from the map (individual overrides)

  // Driver assignment per cluster (used by AssignDriverPopup)
  const assignDriver = async (driver: Driver | null) => {
    if (!driver || !clusterDoc) return;

    try {
      // Update selected clusters with the new driver
      const updatedClusters = clusters.map((cluster) => {
        const isSelected = Array.from(selectedClusters).some(
          (selected) => selected.id === cluster.id
        );
        if (isSelected) {
          return {
            ...cluster,
            driver: driver.name, // Assign driver name to cluster
          };
        }
        return cluster;
      });

      setClusters(updatedClusters);

      // Clear any individual driver overrides for clients in selected clusters
      // (cluster driver takes precedence over individual overrides)
      const affectedClientIds = new Set<string>();
      clusters.forEach((cluster) => {
        const isSelected = Array.from(selectedClusters).some(
          (selected) => selected.id === cluster.id
        );
        if (isSelected) {
          cluster.deliveries.forEach((clientId) => affectedClientIds.add(clientId));
        }
      });

      const updatedOverrides = clientOverrides
        .map((override) => {
          if (affectedClientIds.has(override.clientId)) {
            return { ...override, driver: undefined };
          }
          return override;
        })
        .filter((override) => override.driver || override.time);

      setClientOverrides(updatedOverrides);

      // Update Firestore
      const clusterRef = doc(db, dataSources.firebase.clustersCollection, clusterDoc.docId);
      await updateDoc(clusterRef, {
        clusters: updatedClusters,
        clientOverrides: sanitizeClientOverridesForFirestore(updatedOverrides),
      });

      resetSelections();
    } catch (error) {
      console.error("Error assigning driver: ", error);
    }
  };

  const handleIndividualClientUpdate = async (
    clientId: string,
    newClusterId: string,
    newDriver?: string,
    newTime?: string
  ) => {
    if (!clusterDoc) {
      return;
    }

    // Special handling for "+ Add Cluster" from map popup
    if (newClusterId === "__add_new_cluster__") {
      // Find the next available cluster number (as string)
      const clusterNumbers = clusters.map((c) => parseInt(c.id, 10)).filter((n) => !isNaN(n));
      const nextClusterNum = clusterNumbers.length > 0 ? Math.max(...clusterNumbers) + 1 : 1;
      const nextClusterId = nextClusterNum.toString();
      // Call self recursively to assign to the new cluster
      await handleIndividualClientUpdate(clientId, nextClusterId, newDriver, newTime);
      // Close and reopen the popup to force refresh
      if (
        typeof window !== "undefined" &&
        (window as any).closeMapPopup &&
        (window as any).openMapPopup
      ) {
        (window as any).closeMapPopup();
        setTimeout(() => {
          (window as any).openMapPopup(clientId);
        }, 200);
      }
      return;
    }

    try {
      // Update or add individual client override
      const existingOverrideIndex = clientOverrides.findIndex(
        (override) => override.clientId === clientId
      );
      let updatedOverrides = [...clientOverrides];

      if (existingOverrideIndex >= 0) {
        // Update existing override
        updatedOverrides[existingOverrideIndex] = {
          clientId,
          driver: newDriver,
          time: newTime,
        };
      } else {
        // Add new override
        updatedOverrides.push({
          clientId,
          driver: newDriver,
          time: newTime,
        });
      }

      // Remove override if both driver and time are empty/undefined
      if (!newDriver && !newTime) {
        updatedOverrides = updatedOverrides.filter((override) => override.clientId !== clientId);
      }

      // Update local state
      setClientOverrides(updatedOverrides);

      // Handle cluster assignment separately
      const currentClient = rows.find((row) => row.id === clientId);
      const oldClusterId = currentClient?.clusterId || "";

      let updatedClusters = [...clusters];

      // Remove client from old cluster if it exists
      if (oldClusterId && oldClusterId !== newClusterId) {
        updatedClusters = updatedClusters.map((cluster) => {
          if (cluster.id === oldClusterId) {
            return {
              ...cluster,
              deliveries: cluster.deliveries?.filter((id) => id !== clientId) ?? [],
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

      // Set clusters (deduplication is handled automatically by setClusters wrapper)
      setClusters(updatedClusters);

      // Update Firebase with cluster changes and client overrides
      const clusterRef = doc(db, dataSources.firebase.clustersCollection, clusterDoc.docId);
      await updateDoc(clusterRef, {
        clusters: deduplicateClusters(updatedClusters),
        clientOverrides: sanitizeClientOverridesForFirestore(updatedOverrides),
      });

      // Remove the client from selected rows since their cluster assignment changed
      if (oldClusterId !== newClusterId) {
        const newSelectedRows = new Set(selectedRows);
        const newSelectedClusters = new Set(selectedClusters);

        // Remove the client from selected rows
        newSelectedRows.delete(clientId);

        // If the old cluster no longer has any selected clients, remove it from selected clusters
        if (oldClusterId) {
          const oldCluster = clusters.find((c) => c.id === oldClusterId);
          if (oldCluster) {
            const hasSelectedClientsInOldCluster = oldCluster.deliveries.some(
              (id) => id !== clientId && newSelectedRows.has(id)
            );
            if (!hasSelectedClientsInOldCluster) {
              // Remove the old cluster from selected clusters
              const clusterToRemove = Array.from(newSelectedClusters).find(
                (c) => c.id === oldClusterId
              );
              if (clusterToRemove) {
                newSelectedClusters.delete(clusterToRemove);
              }
            }
          }
        }

        setSelectedRows(newSelectedRows);
        setSelectedClusters(newSelectedClusters);
      }
    } catch (error) {
      console.error("Error updating individual client:", error);
    }
  };

  const resetSelections = () => {
    setPopupMode("");
    setExportOption(null);

    // Keep selectedRows and selectedClusters checked so users can make multiple assignments
  };

  //Handle assigning driver
  // ...existing code...

  const initClustersForDay = async (newClusters: Cluster[]) => {
    const docRef = doc(collection(db, dataSources.firebase.clustersCollection));

    // Use selectedDate to ensure consistency with fetched data
    const clusterDate = new Date(
      Date.UTC(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        0,
        0,
        0,
        0
      )
    );

    const newClusterDoc = {
      clusters: newClusters,
      docId: docRef.id,
      date: Timestamp.fromDate(clusterDate), // Use consistent date
      clientOverrides: [],
    };

    // Firestore expects the data object directly for setDoc - Corrected
    await setDoc(docRef, newClusterDoc);
    setClusters(newClusters); // Update state after successful Firestore creation
    setClusterDoc(newClusterDoc);
    setClientOverrides([]);
  };

  // Helper function to check if coordinates are valid
  const isValidCoordinate = (
    coord: LatLngTuple | { lat: number; lng: number } | undefined | null
  ): coord is LatLngTuple | { lat: number; lng: number } => {
    if (!coord) return false;
    if (Array.isArray(coord)) {
      // Check for LatLngTuple [number, number]
      return (
        coord.length === 2 &&
        typeof coord[0] === "number" &&
        typeof coord[1] === "number" &&
        (coord[0] !== 0 || coord[1] !== 0)
      );
    }
    // Check for { lat: number, lng: number }
    return (
      typeof coord.lat === "number" &&
      typeof coord.lng === "number" &&
      (coord.lat !== 0 || coord.lng !== 0)
    );
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
        `🚫 Can't create ${clusterNum} routes - not enough deliveries!\n\n` +
          `You have ${visibleRows.length} deliveries, but need at least ${totalMinRequired} deliveries (${clusterNum} routes × ${minDeliveries} minimum each).\n\n` +
          `💡 Try one of these:\n` +
          `• Use fewer routes (try ${Math.floor(visibleRows.length / minDeliveries)} or less)\n` +
          `• Lower the minimum deliveries per route`
      );
    }
    if (visibleRows.length > totalMaxAllowed) {
      const suggestedClusters = Math.ceil(visibleRows.length / maxDeliveries);
      const suggestedMaxDeliveries = Math.ceil(visibleRows.length / clusterNum);
      throw new Error(
        `🚫 Your routes can't handle all ${visibleRows.length} deliveries!\n\n` +
          `With ${clusterNum} routes and max ${maxDeliveries} deliveries each, you can only handle ${totalMaxAllowed} deliveries.\n` +
          `That leaves ${visibleRows.length - totalMaxAllowed} deliveries unassigned! 😬\n\n` +
          `💡 Try one of these:\n` +
          `• Use more routes (try ${suggestedClusters} routes)\n` +
          `• Allow more deliveries per route (try ${suggestedMaxDeliveries} max per route)`
      );
    }
    const maxRecommendedClusters = Math.min(
      Math.ceil(visibleRows.length / 2), // At least 2 deliveries per cluster
      visibleRows.length // Can't have more clusters than deliveries
    );
    if (clusterNum > maxRecommendedClusters) {
      throw new Error(
        `🤔 That's too many routes for efficient delivery!\n\n` +
          `You requested ${clusterNum} routes for only ${visibleRows.length} deliveries.\n` +
          `This would create routes with very few deliveries each (not very efficient for drivers).\n\n` +
          `💡 For best results, try ${maxRecommendedClusters} routes or fewer.\n` +
          `This ensures each driver gets at least 2 deliveries per route.`
      );
    }
    // --- End Validation ---

    setPopupMode("");
    setIsLoading(true);

    try {
      // Wrap the core logic in try/finally to ensure loading state is reset

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
        const addressesToFetch = clientsToGeocode.map((client) => client.address);
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
              clientService
                .updateClientCoordinates(client.id, coords)
                .catch((err: Error) =>
                  console.error(`Failed to update coordinates for client ${client.id}:`, err)
                ) // Log errors but don't fail the whole process
            );
          } else {
            console.warn(
              `Failed to geocode address for client ${client.id}: ${client.address}. Skipping this client.`
            );
            // Keep finalCoordinates[client.originalIndex] as null
          }
        });

        // Wait for all Firestore updates to attempt completion
        await Promise.all(updatePromises);
      }

      // Filter out any clients that couldn't be geocoded (their entry in finalCoordinates will be null)
      const validCoordsForClustering = finalCoordinates.filter(
        (coords) => coords !== null
      ) as LatLngTuple[];
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
        console.warn(
          `Adjusted cluster count from ${clusterNum} to ${adjustedClusterNum} due to invalid coordinates.`
        );
      }

      // Adjust min/max deliveries if necessary based on valid coordinates count
      const adjustedMaxDeliveries = Math.min(maxDeliveries, validCoordsForClustering.length);
      const adjustedMinDeliveries = Math.min(minDeliveries, adjustedMaxDeliveries); // Min cannot be > Max

      // --- Re-validate with adjusted numbers ---
      const adjustedTotalMinRequired = adjustedClusterNum * adjustedMinDeliveries;
      const adjustedTotalMaxAllowed = adjustedClusterNum * adjustedMaxDeliveries;

      if (adjustedTotalMinRequired > validCoordsForClustering.length) {
        const invalidAddresses = visibleRows.length - validCoordsForClustering.length;
        throw new Error(
          `🗺️ Address issues are preventing cluster creation!\n\n` +
            `Some addresses couldn't be found on the map (${invalidAddresses} failed), leaving only ${validCoordsForClustering.length} valid deliveries.\n` +
            `This isn't enough for ${adjustedClusterNum} routes with ${adjustedMinDeliveries} minimum deliveries each.\n\n` +
            `💡 Try:\n` +
            `• Fix the addresses that couldn't be found\n` +
            `• Use fewer routes\n` +
            `• Lower the minimum deliveries per route`
        );
      }
      if (validCoordsForClustering.length > adjustedTotalMaxAllowed) {
        const invalidAddresses = visibleRows.length - validCoordsForClustering.length;
        const suggestedClusters = Math.ceil(
          validCoordsForClustering.length / adjustedMaxDeliveries
        );
        const suggestedMaxDeliveries = Math.ceil(
          validCoordsForClustering.length / adjustedClusterNum
        );
        throw new Error(
          `🗺️ Too many deliveries even after address verification!\n\n` +
            `Found ${validCoordsForClustering.length} valid addresses (${invalidAddresses} couldn't be located), but your ${adjustedClusterNum} routes can only handle ${adjustedTotalMaxAllowed} deliveries max.\n\n` +
            `💡 Try:\n` +
            `• Use more routes (try ${suggestedClusters} routes)\n` +
            `• Allow more deliveries per route (try ${suggestedMaxDeliveries} max per route)`
        );
      }
      // --- End Re-validation ---

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
        clustersWithClientIds[clusterName] = clusterData.clusters[clusterName].map(
          (indexInValidCoords: number) => {
            const originalIndex = originalIndicesForValidCoords[indexInValidCoords];
            return visibleRows[originalIndex].id; // Get client ID from original visibleRows
          }
        );
      }

      // Update Firestore and local state with the new cluster assignments (using client IDs)
      // Stub updateClusters: convert clustersWithClientIds to array of Cluster objects
      const updateClusters = async (clustersWithClientIds: { [key: string]: string[] }) => {
        // This is a stub. Replace with real logic as needed.
        return Object.entries(clustersWithClientIds).map(([id, deliveries]) => ({
          id,
          deliveries,
          driver: "",
          time: "",
        }));
      };
      const newClusters = await updateClusters(clustersWithClientIds); // Pass the map with client IDs

      if (clusterDoc) {
        const clusterRef = doc(db, dataSources.firebase.clustersCollection, clusterDoc.docId);
        await updateDoc(clusterRef, {
          clusters: newClusters,
          clientOverrides: sanitizeClientOverridesForFirestore(clientOverrides),
        });
        setClusters(newClusters);
        setClusterDoc((prevDoc) => (prevDoc ? { ...prevDoc, clusters: newClusters } : null));
      } else {
        await initClustersForDay(newClusters); // Make sure this also sets state correctly
      }

      resetSelections();
    } catch (error: unknown) {
      console.error("Error during cluster generation:", error);
      // Re-throw the error so the popup can display it
      throw error;
    } finally {
      setIsLoading(false); // Ensure loading indicator is turned off
    }
  };

  // Handle checkbox selection (radio button behavior - only one cluster can be selected)
  const handleCheckboxChange = (row: DeliveryRowData) => {
    const newSelectedRows = new Set<string>();
    const newSelectedClusters = new Set<Cluster>();
    const clickedClusterId = row.clusterId;

    if (clickedClusterId) {
      const clickedCluster = clusters?.find((c) => c.id.toString() === clickedClusterId);

      if (clickedCluster) {
        // Check if this cluster is already selected
        const isCurrentlySelected = Array.from(selectedClusters).some(
          (selected) => selected.id === clickedClusterId
        );

        if (!isCurrentlySelected) {
          // Select all rows with the clicked cluster ID
          const rowsWithSameClusterID = rows.filter((row) => row.clusterId === clickedClusterId);
          rowsWithSameClusterID.forEach((row) => {
            newSelectedRows.add(row.id);
          });
          newSelectedClusters.add(clickedCluster);
        }
        // If it's already selected, clicking it will deselect (newSelectedRows and newSelectedClusters remain empty)
      }
    }

    setSelectedClusters(newSelectedClusters);
    setSelectedRows(newSelectedRows);
  };

  const handleRowClick = (clientId: string, fromTable = true) => {
    // Suppress highlight clearing for this row switch
    suppressClearHighlightRef.current = true;
    if (fromTable && highlightedRowId === clientId) {
      setHighlightedRowId(null);
      if ((window as any).closeMapPopup) {
        (window as any).closeMapPopup();
      }
    } else {
      setHighlightedRowId(clientId);
      if ((window as any).openMapPopup) {
        (window as any).openMapPopup(clientId);
      }
    }
  };

  const handleMarkerClick = (clientId: string) => {
    handleRowClick(clientId, false);

    // Scroll to the highlighted row with smooth animation
    if (virtuosoRef.current && sortedRows.length > 0) {
      const rowIndex = sortedRows.findIndex((row) => row.id === clientId);
      if (rowIndex !== -1) {
        // Use setTimeout to ensure the highlight state has been updated
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({
            index: rowIndex,
            align: "center",
            behavior: "smooth",
          });
        }, 100);
      }
    }
  };

  const clearRowHighlight = () => {
    if (suppressClearHighlightRef.current) {
      suppressClearHighlightRef.current = false;
      return;
    }
    setHighlightedRowId(null);
  };

  const clientsWithDeliveriesOnSelectedDate = rows.filter((row) =>
    deliveriesForDate.some((delivery) => delivery.clientId === row.id)
  );

  const handleDateChange = (date: Date) => {
    const normalized = deliveryDate.toJSDate(date);
    setSelectedDate(normalized);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("date", deliveryDate.toISODateString(normalized));
    setSearchParams(newSearchParams);
  };

  const visibleRows = rows.filter((row) => {
    const trimmedSearchQuery = searchQuery.trim();
    if (!trimmedSearchQuery) {
      return true;
    }

    const validSearchTerms = parseSearchTermsProgressively(trimmedSearchQuery);

    const keyValueTerms = validSearchTerms.filter((term) => term.includes(":"));
    const nonKeyValueTerms = validSearchTerms.filter((term) => !term.includes(":"));

    let matches = true;

    if (keyValueTerms.length > 0) {
      const checkStringContains = utilCheckStringContains;

      const checkValueOrInArray = (value: unknown, query: string): boolean => {
        if (value === undefined || value === null) {
          return false;
        }
        const lowerQuery = query.toLowerCase();
        if (Array.isArray(value)) {
          return value.some((item) => String(item).toLowerCase().includes(lowerQuery));
        }
        return String(value).toLowerCase().includes(lowerQuery);
      };

      const visibleFieldKeys = new Set([
        ...fields.map((f) => f.key).filter((key) => key !== "checkbox"),
        ...customColumns.map((col) => col.propertyKey).filter((key) => key !== "none"),
      ]);

      const isVisibleField = (keyword: string): boolean => {
        const lowerKeyword = keyword.toLowerCase();

        const fieldMappings: { [key: string]: string[] } = {
          fullname: ["name", "client"],
          clusterIdChange: ["cluster", "cluster id"],
          tags: ["tags", "tag"],
          zipCode: ["zip", "zipcode", "zip code"],
          ward: ["ward"],
          assignedDriver: ["driver", "assigned driver"],
          assignedTime: ["time", "assigned time"],
          "deliveryDetails.deliveryInstructions": ["delivery instructions", "instructions"],
        };

        for (const [fieldKey, aliases] of Object.entries(fieldMappings)) {
          if (visibleFieldKeys.has(fieldKey) && aliases.some((alias) => alias === lowerKeyword)) {
            return true;
          }
        }

        const customColumnMappings: { [key: string]: string[] } = {
          address: ["address"],
          adults: ["adults"],
          children: ["children"],
          deliveryFreq: ["delivery freq", "delivery frequency"],
          "deliveryDetails.dietaryRestrictions": ["dietary restrictions"],
          ethnicity: ["ethnicity"],
          gender: ["gender"],
          language: ["language"],
          notes: ["notes"],
          phone: ["phone"],
          referralEntity: ["referral entity", "referral"],
          tags: ["tags", "tag"],
          tefapCert: ["tefap", "tefap cert"],
          dob: ["dob"],
          lastDeliveryDate: ["last delivery date"],
        };

        for (const [propertyKey, aliases] of Object.entries(customColumnMappings)) {
          if (
            visibleFieldKeys.has(propertyKey) &&
            aliases.some((alias) => alias === lowerKeyword)
          ) {
            return true;
          }
        }

        return false;
      };

      matches = keyValueTerms.every((term) => {
        const { keyword, searchValue, isKeyValue: isKeyValueSearch } = extractKeyValue(term);

        if (isKeyValueSearch && searchValue) {
          if (!isVisibleField(keyword)) {
            return true;
          }
          switch (keyword) {
            case "name":
            case "client":
              return (
                checkStringContains(`${row.firstName} ${row.lastName}`, searchValue) ||
                checkStringContains(row.firstName, searchValue) ||
                checkStringContains(row.lastName, searchValue)
              );
            case "address":
              return checkStringContains(row.address, searchValue);
            case "ward":
              return checkStringContains(row.ward, searchValue);
            case "zip":
            case "zipcode":
            case "zip code":
              return checkStringContains(row.zipCode, searchValue);
            case "cluster":
            case "cluster id":
              return checkStringContains(row.clusterId, searchValue);
            case "driver":
            case "assigned driver": {
              const driverName = fields
                .find((f) => f.key === "assignedDriver")
                ?.compute?.(row, clusters);
              return checkStringContains(driverName, searchValue);
            }
            case "time":
            case "assigned time": {
              const assignedTime = fields
                .find((f) => f.key === "assignedTime")
                ?.compute?.(row, clusters);
              return checkStringContains(assignedTime, searchValue);
            }
            case "delivery instructions":
            case "instructions": {
              const instructions = (
                fields.find((f) => f.key === "deliveryDetails.deliveryInstructions") as Extract<
                  Field,
                  { key: "deliveryDetails.deliveryInstructions" }
                >
              ).compute?.(row);
              return checkStringContains(instructions, searchValue);
            }
            case "tags":
            case "tag":
              return checkValueOrInArray(row.tags, searchValue);
            case "phone":
              return checkStringContains(row.phone, searchValue);
            case "ethnicity":
              return checkStringContains(row.ethnicity, searchValue);
            case "adults":
              return checkValueOrInArray(row.adults, searchValue);
            case "children":
              return checkValueOrInArray(row.children, searchValue);
            case "delivery freq":
            case "delivery frequency":
              return checkStringContains(row.deliveryFreq, searchValue);
            case "gender":
              return checkStringContains(row.gender, searchValue);
            case "language":
              return checkStringContains(row.language, searchValue);
            case "notes":
              return checkStringContains(row.notes, searchValue);
            case "tefap":
            case "tefap cert":
              return checkStringContains(row.tefapCert, searchValue);
            case "dob":
              return checkValueOrInArray(row.dob, searchValue);
            case "referral entity":
            case "referral": {
              if (row.referralEntity && typeof row.referralEntity === "object") {
                return (
                  checkStringContains(row.referralEntity.name, searchValue) ||
                  checkStringContains(row.referralEntity.organization, searchValue)
                );
              }
              return false;
            }
            default: {
              const matchesCustomColumn = customColumns.some((col) => {
                if (col.propertyKey !== "none" && col.propertyKey.toLowerCase().includes(keyword)) {
                  if (col.propertyKey in row) {
                    const fieldValue = row[col.propertyKey as keyof DeliveryRowData];
                    return checkStringContains(fieldValue, searchValue);
                  }
                }
                return false;
              });
              return matchesCustomColumn;
            }
          }
        }

        return true;
      });
    }

    if (matches && nonKeyValueTerms.length > 0) {
      const searchableFields = [
        "firstName",
        "lastName",
        "address",
        "phone",
        "ward",
        "zipCode",
        "clusterId",
        "tags",
        "deliveryDetails.deliveryInstructions",
        ...customColumns.map((col) => col.propertyKey).filter((key) => key !== "none"),
      ];
      matches = nonKeyValueTerms.every((term) => globalSearchMatch(row, term, searchableFields));
    }

    return matches;
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

        const result =
          sortOrder === "asc"
            ? fullnameA.localeCompare(fullnameB, undefined, { sensitivity: "base" })
            : fullnameB.localeCompare(fullnameA, undefined, { sensitivity: "base" });

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
          ? clusterIdA.localeCompare(clusterIdB, undefined, { sensitivity: "base" })
          : clusterIdB.localeCompare(clusterIdA, undefined, { sensitivity: "base" });
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
          ? zipCodeA.localeCompare(zipCodeB, undefined, { sensitivity: "base" })
          : zipCodeB.localeCompare(zipCodeA, undefined, { sensitivity: "base" });
      } else if (sortedColumn === "ward") {
        // For ward field, sort alphabetically (A-Z/Z-A)
        const wardA = (a.ward || "").toLowerCase();
        const wardB = (b.ward || "").toLowerCase();

        // Handle empty values - empty strings sort first in ascending, last in descending
        if (!wardA && !wardB) return 0;
        if (!wardA) return sortOrder === "asc" ? -1 : 1;
        if (!wardB) return sortOrder === "asc" ? 1 : -1;

        return sortOrder === "asc"
          ? wardA.localeCompare(wardB, undefined, { sensitivity: "base" })
          : wardB.localeCompare(wardA, undefined, { sensitivity: "base" });
      } else if (sortedColumn === "assignedDriver") {
        // For assignedDriver field, sort by driver name alphabetically
        // Use the compute function to get the driver name (accounts for individual overrides)
        const assignedDriverField = fields.find((f) => f.key === "assignedDriver") as Extract<
          Field,
          { key: "assignedDriver" }
        >;
        const driverA = assignedDriverField?.compute?.(a, clusters, clientOverrides) || "";
        const driverB = assignedDriverField?.compute?.(b, clusters, clientOverrides) || "";

        const driverALower = driverA.toLowerCase();
        const driverBLower = driverB.toLowerCase();

        // Group "No driver assigned" entries together and sort them last in ascending order
        const noDriverA = driverA === "No driver assigned";
        const noDriverB = driverB === "No driver assigned";

        if (noDriverA && noDriverB) return 0;
        if (noDriverA) return sortOrder === "asc" ? 1 : -1; // No driver assigned goes to end in asc
        if (noDriverB) return sortOrder === "asc" ? -1 : 1; // No driver assigned goes to end in asc

        return sortOrder === "asc"
          ? driverALower.localeCompare(driverBLower, undefined, { sensitivity: "base" })
          : driverBLower.localeCompare(driverALower, undefined, { sensitivity: "base" });
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
          ? instructionsA.localeCompare(instructionsB, undefined, { sensitivity: "base" })
          : instructionsB.localeCompare(instructionsA, undefined, { sensitivity: "base" });
      } else {
        // Handle custom column sorting
        const customColumn = customColumns.find((col) => col.propertyKey === sortedColumn);
        if (customColumn && customColumn.propertyKey !== "none") {
          // Special sorting for dietary restrictions custom column
          if (
            customColumn.propertyKey === "deliveryDetails.dietaryRestrictions" ||
            customColumn.propertyKey === "dietaryRestrictions"
          ) {
            const getDietString = (row: DeliveryRowData) => {
              const dr = row.deliveryDetails?.dietaryRestrictions;
              if (!dr || typeof dr !== "object") return "None";
              const keys = [
                "halal",
                "kidneyFriendly",
                "lowSodium",
                "lowSugar",
                "microwaveOnly",
                "noCookingEquipment",
                "softFood",
                "vegan",
                "vegetarian",
                "heartFriendly",
              ];
              const items = keys.filter((k) => dr[k]).map((k) => k);
              if (Array.isArray(dr.foodAllergens) && dr.foodAllergens.length > 0)
                items.push(...dr.foodAllergens);
              if (Array.isArray(dr.other) && dr.other.length > 0) items.push(...dr.other);
              if (dr.otherText && dr.otherText.trim() !== "") items.push(dr.otherText.trim());
              if (items.length === 0) return "None";
              return items.join(", ");
            };
            const dietA = getDietString(a);
            const dietB = getDietString(b);
            const isNoneA = dietA === "None";
            const isNoneB = dietB === "None";
            if (isNoneA && !isNoneB) return sortOrder === "asc" ? 1 : -1;
            if (!isNoneA && isNoneB) return sortOrder === "asc" ? -1 : 1;
            return sortOrder === "asc"
              ? dietA.localeCompare(dietB, undefined, { sensitivity: "base" })
              : dietB.localeCompare(dietA, undefined, { sensitivity: "base" });
          }
          // Default custom column sorting
          let valueA = "";
          let valueB = "";
          if (
            customColumn.propertyKey === "referralEntity" &&
            typeof a.referralEntity === "object" &&
            a.referralEntity !== null
          ) {
            valueA = `${a.referralEntity.name || ""}, ${a.referralEntity.organization || ""}`
              .trim()
              .toLowerCase();
          } else if (customColumn.propertyKey.includes("deliveryInstructions")) {
            valueA = (a.deliveryDetails?.deliveryInstructions || "").toLowerCase().trim();
          } else {
            const rawValueA = a[customColumn.propertyKey as keyof DeliveryRowData];
            if (typeof rawValueA === "object" && rawValueA !== null) {
              if (rawValueA.name || rawValueA.organization) {
                valueA = `${rawValueA.name || ""} ${rawValueA.organization || ""}`
                  .trim()
                  .toLowerCase();
              } else {
                valueA = JSON.stringify(rawValueA).toLowerCase();
              }
            } else {
              valueA = String(rawValueA || "").toLowerCase();
            }
          }
          if (
            customColumn.propertyKey === "referralEntity" &&
            typeof b.referralEntity === "object" &&
            b.referralEntity !== null
          ) {
            valueB =
              `${b.referralEntity.name ?? ""}, ${b.referralEntity.organization ?? ""}`.toLowerCase();
          } else if (customColumn.propertyKey.includes("deliveryInstructions")) {
            valueB = (b.deliveryDetails?.deliveryInstructions || "").toLowerCase().trim();
          } else {
            const rawValueB = b[customColumn.propertyKey as keyof DeliveryRowData];
            if (typeof rawValueB === "object" && rawValueB !== null) {
              if (rawValueB.name || rawValueB.organization) {
                valueB = `${rawValueB.name || ""} ${rawValueB.organization || ""}`
                  .trim()
                  .toLowerCase();
              } else {
                valueB = JSON.stringify(rawValueB).toLowerCase();
              }
            } else {
              valueB = String(rawValueB || "").toLowerCase();
            }
          }
          if (!valueA && !valueB) return 0;
          if (!valueA) return sortOrder === "asc" ? -1 : 1;
          if (!valueB) return sortOrder === "asc" ? 1 : -1;
          return sortOrder === "asc"
            ? valueA.localeCompare(valueB, undefined, { sensitivity: "base" })
            : valueB.localeCompare(valueA, undefined, { sensitivity: "base" });
        }
      }

      // If no sorting column is set or unsupported column, return unsorted
      return 0;
    });

    return sorted;
  }, [visibleRows, sortOrder, sortedColumn, clusters, customColumns, clientOverrides]);

  useEffect(() => {
    if (highlightedRowId && !visibleRows.some((row) => row.id === highlightedRowId)) {
      setHighlightedRowId(null);
      if ((window as any).closeMapPopup) {
        (window as any).closeMapPopup();
      }
    }
  }, [visibleRows, highlightedRowId]);

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

      // Find the latest delivery event for this client
      let lastDeliveryDate = "";
      if (Array.isArray(deliveriesForDate) && deliveriesForDate.length > 0) {
        // Find all events for this client
        const clientDeliveries = deliveriesForDate.filter(
          (ev) => ev.clientId === client.id && ev.deliveryDate
        );
        if (clientDeliveries.length > 0) {
          // Get the latest delivery date
          const latest = clientDeliveries.reduce((a, b) => {
            const aDate =
              a.deliveryDate instanceof Date
                ? a.deliveryDate
                : (a.deliveryDate?.toJSDate?.() ?? null);
            const bDate =
              b.deliveryDate instanceof Date
                ? b.deliveryDate
                : (b.deliveryDate?.toJSDate?.() ?? null);
            return aDate && bDate && aDate > bDate ? a : b;
          });
          const latestDate =
            latest.deliveryDate instanceof Date
              ? latest.deliveryDate
              : (latest.deliveryDate?.toJSDate?.() ?? null);
          if (latestDate) {
            lastDeliveryDate = deliveryDate.toISODateString(latestDate);
          }
        }
      }

      // Patch: If lastDeliveryDate is 'N/A', set to ''
      const patchedClient = { ...client, clusterId: assignedClusterId, lastDeliveryDate };
      if (
        "lastDeliveryDate" in patchedClient &&
        typeof patchedClient.lastDeliveryDate === "string" &&
        patchedClient.lastDeliveryDate.trim().toUpperCase() === "N/A"
      ) {
        patchedClient.lastDeliveryDate = "";
      }
      return patchedClient;
    });

    setRows(synchronizedRows);
  }, [rawClientData, clusters]);

  // TableVirtuoso MUI integration components
  const TableComponent = React.forwardRef<HTMLTableElement, React.ComponentProps<typeof Table>>(
    (props, ref) => (
      <Table {...props} ref={ref} stickyHeader sx={{ tableLayout: "auto", width: "100%" }} />
    )
  );
  TableComponent.displayName = "VirtuosoTable";

  const TableHeadComponent = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
  >((props, ref) => <thead {...props} ref={ref} />);
  TableHeadComponent.displayName = "VirtuosoTableHead";

  const TableRowComponent = React.forwardRef<
    HTMLTableRowElement,
    React.ComponentProps<typeof TableRow> & { "data-row-id"?: string; "data-highlighted"?: boolean }
  >((props, ref) => {
    const isHighlighted = props["data-highlighted"];
    return (
      <TableRow
        {...props}
        ref={ref}
        className={["table-row", "delivery-anim-row", props.className].filter(Boolean).join(" ")}
        sx={{
          backgroundColor: isHighlighted ? "rgba(144, 238, 144, 0.7) !important" : "inherit",
          border: isHighlighted ? "2px solid #90EE90 !important" : "none",
          cursor: "pointer",
          "&:hover": {
            backgroundColor: isHighlighted
              ? "rgba(144, 238, 144, 0.7) !important"
              : "rgba(144, 238, 144, 0.3) !important",
          },
        }}
        onClick={() => props["data-row-id"] && handleRowClick(props["data-row-id"])}
      />
    );
  });
  TableRowComponent.displayName = "VirtuosoTableRow";

  const TableBodyComponent = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
  >((props, ref) => <tbody {...props} ref={ref} />);
  TableBodyComponent.displayName = "VirtuosoTableBody";

  const VirtuosoTableComponents = {
    Table: TableComponent,
    TableHead: TableHeadComponent,
    TableRow: TableRowComponent,
    TableBody: TableBodyComponent,
  } as const;

  // Handle column header click for sorting - supports fullname, clusterIdChange, tags, address, ward, assignedDriver, assignedTime, deliveryInstructions, and custom columns
  const handleSort = (field: Field | { key: string }) => {
    const fieldKey = String(field.key);

    // Allow sorting on supported columns and any custom column
    const supportedColumns = [
      "fullname",
      "clusterIdChange",
      "tags",
      "zipCode",
      "ward",
      "assignedDriver",
      "assignedTime",
      "deliveryDetails.deliveryInstructions",
    ];
    const isCustomColumn = customColumns.some((col) => col.propertyKey === fieldKey);

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
  };

  return (
    <Box className="box" sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            padding: "16px",
            backgroundColor: "var(--color-background-main)",
            zIndex: 10,
            position: "sticky",
            top: 0,
            width: "100%",
          }}
        >
          <Typography
            variant="h5"
            sx={{ color: "var(--color-text-secondary)", width: "350px", textAlign: "center" }}
          >
            {format(selectedDate, "EEEE - MMMM, dd/yyyy")}
          </Typography>

          <IconButton
            onClick={() => handleDateChange(addDays(selectedDate, -1))}
            size="large"
            sx={{ color: "var(--color-primary)" }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderLeft: "2px solid var(--color-primary)",
                borderBottom: "2px solid var(--color-primary)",
                transform: "rotate(45deg)",
              }}
            />
          </IconButton>

          <IconButton
            onClick={() => handleDateChange(addDays(selectedDate, 1))}
            size="large"
            sx={{ color: "var(--color-primary)", marginRight: 2 }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderLeft: "2px solid var(--color-primary)",
                borderBottom: "2px solid var(--color-primary)",
                transform: "rotate(-135deg)",
              }}
            />
          </IconButton>

          <Button
            variant="outlined"
            size="small"
            style={{
              width: "4.25rem",
              height: "var(--spacing-xl40)",
              minWidth: "4.25rem",
              minHeight: "var(--spacing-xl40)",
              maxHeight: "var(--spacing-xl40)",
              fontSize: 12,
              marginLeft: 16,
              borderRadius: "var(--border-radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            onClick={() => setSelectedDate(new Date())}
            startIcon={<TodayIcon sx={{ marginRight: "-8px", marginLeft: "-2px" }} />}
          >
            Today
          </Button>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <PageDatePicker setSelectedDate={handleDateChange} selectedDate={selectedDate} marginLeft="1rem" />
          </Box>
        </Box>

        <Button
          variant="contained"
          size="medium"
          disabled={userRole === UserType.ClientIntake || isLoading}
          style={{
            whiteSpace: "nowrap",
            borderRadius: 5,
            marginRight: "8px",
            minWidth: "auto",
            width: "auto",
            fontSize: "0.875rem",
            padding: "8px 16px",
          }}
          onClick={() => setPopupMode("Clusters")}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <GroupWorkIcon />}
        >
          {isLoading ? "Generating..." : "Generate Clusters"}
        </Button>

        <Button
          variant="outlined"
          size="medium"
          style={{
            whiteSpace: "nowrap",
            borderRadius: 5,
            marginLeft: "0px",
            minWidth: "auto",
            width: "auto",
            fontSize: "0.875rem",
            padding: "8px 16px",
          }}
          onClick={handleResetClusters}
          startIcon={<RestartAltIcon />}
        >
          Reset Clusters
        </Button>
      </div>

      {/* Map Container */}
      <Box
        sx={{
          top: "72px",
          zIndex: 9,
          height: "400px",
          width: "100%",
          backgroundColor: "var(--color-background-main)",
          // Removed position: "relative"
        }}
      >
        {isMainLoading ? (
          // Revert to rendering the indicator directly
          <LoadingIndicator />
        ) : visibleRows.length > 0 ? (
          <Suspense fallback={<LoadingIndicator />}>
            <ClusterMap
              clusters={clusters}
              visibleRows={visibleRows}
              clientOverrides={clientOverrides}
              onClusterUpdate={handleIndividualClientUpdate}
              onOpenPopup={handleRowClick}
              onMarkerClick={handleMarkerClick}
              onClearHighlight={clearRowHighlight}
              refreshDriversTrigger={driversRefreshTrigger}
            />
          </Suspense>
        ) : (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "400px", // Explicitly set to match container height
              width: "100%",
              backgroundColor: "var(--color-background-body)",
              borderRadius: "4px",
              border: "1px solid var(--color-border-light)",
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
          backgroundColor: "var(--color-background-main)",
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
              placeholder='Search deliveries (e.g., ward:7, driver:maria, name:"john smith")'
              style={{
                width: "100%",
                height: "60px",
                backgroundColor: "var(--color-background-gray)",
                border: "none",
                borderRadius: "30px",
                padding: "0 24px",
                fontSize: "16px",
                color: "var(--color-text-dark)",
                boxSizing: "border-box",
              }}
            />
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", marginTop: "16px" }}>
            {/* Left group: Assign Driver and Assign Time */}
            <Box sx={{ display: "flex", width: "100%", gap: "8px", flexWrap: "wrap" }}>
              <Button
                variant="contained"
                size="medium"
                startIcon={<AssignmentIndIcon />}
                disabled={selectedRows.size <= 0}
                style={{
                  whiteSpace: "nowrap",
                  borderRadius: 5,
                  marginRight: "0px",
                  minWidth: "auto",
                  width: "auto",
                  fontSize: "0.875rem",
                  padding: "8px 16px",
                }}
                onClick={() => setPopupMode("Driver")}
              >
                Assign Driver
              </Button>
              <Button
                variant="contained"
                size="medium"
                id="demo-positioned-button"
                aria-controls={open ? "demo-positioned-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={open ? "true" : undefined}
                startIcon={<AccessTimeIcon />}
                onClick={handleClick}
                disabled={selectedRows.size <= 0}
                style={{
                  whiteSpace: "nowrap",
                  borderRadius: 5,
                  marginRight: "0px",
                  minWidth: "auto",
                  width: "auto",
                  fontSize: "0.875rem",
                  padding: "8px 16px",
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
                  vertical: "bottom",
                  horizontal: "left",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "left",
                }}
                MenuListProps={{
                  "aria-labelledby": "demo-positioned-button",
                  sx: {
                    width: anchorEl ? anchorEl.offsetWidth : "200px",
                    maxHeight: 320, // ~8 items visible
                    overflowY: "auto",
                  },
                }}
              >
                {Object.values(times).map(({ value, label }) => (
                  <MenuItem key={value} data-key={value} onClick={handleClose}>
                    {label}
                  </MenuItem>
                ))}
              </Menu>
            </Box>
            {/* Right group: Export button */}
            <Box>
              <Button
                variant="contained"
                size="medium"
                startIcon={<FileDownloadIcon />}
                style={{
                  whiteSpace: "nowrap",
                  borderRadius: 5,
                  marginRight: "0px",
                  minWidth: "auto",
                  width: "auto",
                  fontSize: "0.875rem",
                  padding: "8px 16px",
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
        const dailyLimit =
          limits && limits.length > adjustedDayOfWeek ? limits[adjustedDayOfWeek] : undefined;

        return <EventCountHeader events={deliveriesForDate} limit={dailyLimit} />;
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
        {/* Dietary Restrictions Color Legend - only show when column is added */}
        {customColumns.some(
          (col) =>
            col.propertyKey === "deliveryDetails.dietaryRestrictions" ||
            col.propertyKey === "dietaryRestrictions"
        ) && <DietaryRestrictionsLegend />}

        <TableContainer
          component={Paper}
          sx={{
            height: isLoading || sortedRows.length > 0 ? "60vh" : "auto",
            width: "100%",
          }}
        >
          {isLoading ? (
            // Skeleton loader
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {fields.map((field) => (
                    <TableCell
                      key={field.key}
                      className="table-header"
                      style={{
                        width:
                          field.type === "checkbox"
                            ? "60px"
                            : field.key === "fullname"
                              ? "250px"
                              : field.key === "clusterIdChange"
                                ? "180px"
                                : field.key === "deliveryDetails.deliveryInstructions"
                                  ? "300px"
                                  : field.key === "assignedDriver" || field.key === "assignedTime"
                                    ? "180px"
                                    : "150px",
                        textAlign: "center",
                        padding: "10px",
                        backgroundColor: "var(--color-background-green-tint)",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 1,
                        }}
                      >
                        {field.label}
                      </Box>
                    </TableCell>
                  ))}
                  {customColumns.map((col) => (
                    <TableCell
                      key={col.id}
                      className="table-header"
                      style={{
                        width: "150px",
                        backgroundColor: "var(--color-background-green-tint)",
                      }}
                    >
                      Custom Column
                    </TableCell>
                  ))}
                  <TableCell
                    className="table-header"
                    style={{
                      width: "50px",
                      backgroundColor: "var(--color-background-green-tint)",
                    }}
                  >
                    +
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.from({ length: 8 }).map((_, skeletonIndex) => (
                  <TableRow key={`skeleton-${skeletonIndex}`}>
                    {fields.map((field) => (
                      <TableCell
                        key={field.key}
                        style={{
                          textAlign: "center",
                          padding: "10px",
                          width:
                            field.type === "checkbox"
                              ? "60px"
                              : field.key === "fullname"
                                ? "250px"
                                : field.key === "clusterIdChange"
                                  ? "180px"
                                  : field.key === "deliveryDetails.deliveryInstructions"
                                    ? "300px"
                                    : field.key === "assignedDriver" || field.key === "assignedTime"
                                      ? "180px"
                                      : "150px",
                        }}
                      >
                        {field.type === "checkbox" ? (
                          <Box sx={{ display: "flex", justifyContent: "center" }}>
                            <Box
                              sx={{
                                width: 20,
                                height: 20,
                                backgroundColor: "var(--color-border-medium)",
                                borderRadius: "4px",
                                animation: "pulse 1.5s ease-in-out infinite",
                                "@keyframes pulse": {
                                  "0%, 100%": { opacity: 0.4 },
                                  "50%": { opacity: 0.8 },
                                },
                              }}
                            />
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              height: 20,
                              backgroundColor: "var(--color-border-medium)",
                              borderRadius: "4px",
                              animation: "pulse 1.5s ease-in-out infinite",
                              animationDelay: `${skeletonIndex * 0.1}s`,
                              "@keyframes pulse": {
                                "0%, 100%": { opacity: 0.4 },
                                "50%": { opacity: 0.8 },
                              },
                            }}
                          />
                        )}
                      </TableCell>
                    ))}
                    {customColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        style={{ width: "150px", textAlign: "center", padding: "10px" }}
                      >
                        <Box
                          sx={{
                            height: 20,
                            backgroundColor: "var(--color-border-medium)",
                            borderRadius: "4px",
                            animation: "pulse 1.5s ease-in-out infinite",
                            animationDelay: `${skeletonIndex * 0.1}s`,
                            "@keyframes pulse": {
                              "0%, 100%": { opacity: 0.4 },
                              "50%": { opacity: 0.8 },
                            },
                          }}
                        />
                      </TableCell>
                    ))}
                    <TableCell style={{ width: "50px" }}>
                      {/* Empty space for add button */}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : sortedRows.length > 0 ? (
            <TableVirtuoso
              ref={virtuosoRef}
              style={{ height: "100%" }}
              data={sortedRows}
              components={VirtuosoTableComponents}
              itemContent={(index, row) => {
                const isHighlighted = highlightedRowId === row.id;
                return (
                  <Box
                    sx={{
                      display: "contents", // This makes the Box behave like it's not there for layout
                      "& > td": {
                        backgroundColor: isHighlighted
                          ? "rgba(144, 238, 144, 0.7) !important"
                          : "inherit",
                        borderTop: isHighlighted ? "2px solid #90EE90 !important" : "none",
                        borderBottom: isHighlighted ? "2px solid #90EE90 !important" : "none",
                        "&:first-of-type": {
                          borderLeft: isHighlighted ? "2px solid #90EE90 !important" : "none",
                        },
                        "&:last-of-type": {
                          borderRight: isHighlighted ? "2px solid #90EE90 !important" : "none",
                        },
                      },
                    }}
                    onClick={() => handleRowClick(row.id)}
                  >
                    {fields.map((field) => (
                      <TableCell
                        key={field.key}
                        style={{
                          textAlign: "center",
                          padding: "10px",
                          width:
                            field.type === "checkbox"
                              ? "60px"
                              : field.key === "fullname"
                                ? "250px"
                                : field.key === "clusterIdChange"
                                  ? "180px"
                                  : field.key === "deliveryDetails.deliveryInstructions"
                                    ? "300px"
                                    : field.key === "assignedDriver" || field.key === "assignedTime"
                                      ? "180px"
                                      : "150px",
                        }}
                      >
                        {field.type === "checkbox" ? (
                          <Checkbox
                            size="small"
                            disabled={userRole === UserType.ClientIntake}
                            checked={selectedRows.has(row.id)}
                            onChange={() => handleCheckboxChange(row)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : field.type === "select" && field.key === "clusterIdChange" ? (
                          // Custom Cluster Dropdown
                          <FormControl variant="standard" size="small" sx={{ minWidth: 120 }}>
                            <Select
                              value={row.clusterId || ""}
                              disabled={userRole === UserType.ClientIntake}
                              onChange={(event: SelectChangeEvent<string>) =>
                                handleClusterChange(row, event.target.value)
                              }
                              sx={{
                                fontSize: "inherit",
                                "& .MuiSelect-select": {
                                  padding: "4px 10px",
                                  backgroundColor: row.clusterId
                                    ? clusterColorMap(row.clusterId)
                                    : "transparent",
                                  color: row.clusterId ? "white" : "inherit",
                                  fontWeight: row.clusterId ? "bold" : "normal",
                                  textShadow: row.clusterId
                                    ? ".5px .5px .5px #000, -.5px .5px .5px #000, -.5px -.5px 0px var(--color-border-black), .5px -.5px 0px #000"
                                    : undefined,
                                  borderRadius: "4px",
                                },
                                "&:before": { borderBottom: "none" },
                                "&:hover:not(.Mui-disabled):before": { borderBottom: "none" },
                                "&:after": { borderBottom: "none" },
                              }}
                            >
                              {clusters.length === 0 ? (
                                <MenuItem disabled value="">
                                  <span style={{ color: "var(--color-text-light)" }}>
                                    No Clusters
                                  </span>
                                </MenuItem>
                              ) : (
                                clusterOptions.map((option) =>
                                  option.value === "__add__" ? (
                                    <MenuItem key="__add__" value="__add__">
                                      <Chip
                                        label={"+ Add Cluster"}
                                        sx={{
                                          backgroundColor: "var(--color-border-input)",
                                          color: "var(--color-text-dark)",
                                          fontWeight: "bold",
                                          border: "1px solid var(--color-text-light)",
                                        }}
                                      />
                                    </MenuItem>
                                  ) : (
                                    <MenuItem key={option.value} value={option.value}>
                                      <Chip
                                        label={option.label}
                                        style={
                                          typeof option.color === "string"
                                            ? {
                                                backgroundColor: option.color,
                                                color: "var(--color-white)",
                                                border: "1px solid black",
                                                fontWeight: "bold",
                                                textShadow:
                                                  ".5px .5px .5px var(--color-border-black), -.5px .5px .5px #000, -.5px -.5px 0px #000, .5px -.5px 0px var(--color-border-black)",
                                              }
                                            : undefined
                                        }
                                        sx={{
                                          pointerEvents: "none",
                                          "& .MuiChip-label": {
                                            textShadow:
                                              typeof option.color === "string"
                                                ? ".5px .5px .5px #000, -.5px .5px .5px #000, -.5px -.5px 0px #000, .5px -.5px 0px #000"
                                                : undefined,
                                          },
                                        }}
                                      />
                                    </MenuItem>
                                  )
                                )
                              )}
                            </Select>
                          </FormControl>
                        ) : field.compute ? (
                          (() => {
                            const computedValue =
                              field.key === "assignedDriver" || field.key === "assignedTime"
                                ? field.compute?.(row, clusters, clientOverrides)
                                : field.compute?.(row);

                            if (field.key === "fullname") {
                              return (
                                <Link
                                  to={`/profile/${row.id}`}
                                  style={{
                                    color: "var(--color-primary-darker)",
                                    textDecoration: "none",
                                    fontWeight: "500",
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {computedValue}
                                </Link>
                              );
                            } else if (field.key === "tags") {
                              const tags = computedValue as string;
                              return tags === "None" ? (
                                <span
                                  style={{ color: "var(--color-text-medium)", fontStyle: "italic" }}
                                >
                                  None
                                </span>
                              ) : (
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "4px",
                                    justifyContent: "center",
                                  }}
                                >
                                  {tags.split(", ").map((tag: string, index: number) => (
                                    <Chip
                                      key={index}
                                      label={tag}
                                      size="small"
                                      sx={{
                                        backgroundColor: "var(--color-success-button)",
                                        color: "var(--color-white)",
                                        fontSize: "0.75rem",
                                      }}
                                    />
                                  ))}
                                </div>
                              );
                            } else {
                              return computedValue;
                            }
                          })()
                        ) : (
                          (() => {
                            const val = row[field.key as keyof DeliveryRowData];
                            // Only for LastDeliveryDate, always blank if missing or 'N/A'
                            // Globally blank out any cell with 'N/A'
                            if (
                              val === null ||
                              val === undefined ||
                              val === "" ||
                              (typeof val === "string" && val.trim().toUpperCase() === "N/A")
                            )
                              return "";
                            return val.toString();
                          })()
                        )}
                      </TableCell>
                    ))}
                    {customColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        style={{
                          width: "150px",
                          textAlign: "center",
                          padding: "10px",
                        }}
                      >
                        {col.propertyKey !== "none"
                          ? col.propertyKey === "address"
                            ? `${row.address || ""}${row.address2 ? " " + row.address2 : ""}`.trim()
                            : col.propertyKey === "deliveryDetails.dietaryRestrictions"
                              ? (() => {
                                  const dr = row.deliveryDetails?.dietaryRestrictions;
                                  if (!dr)
                                    return (
                                      <span
                                        style={{
                                          color: "var(--color-text-medium)",
                                          fontStyle: "italic",
                                        }}
                                      >
                                        None
                                      </span>
                                    );
                                  const restrictions: string[] = [];
                                  if (dr.vegetarian) restrictions.push("Vegetarian");
                                  if (dr.vegan) restrictions.push("Vegan");
                                  if (dr.glutenFree) restrictions.push("Gluten Free");
                                  if (dr.nutFree) restrictions.push("Nut Free");
                                  if (dr.dairyFree) restrictions.push("Dairy Free");
                                  if (dr.halal) restrictions.push("Halal");
                                  if (dr.kosher) restrictions.push("Kosher");
                                  if (dr.other) {
                                    const otherStr = String(dr.other).trim();
                                    if (otherStr) restrictions.push(`Other: ${otherStr}`);
                                  }

                                  return restrictions.length > 0 ? (
                                    <Box
                                      sx={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 0.5,
                                        justifyContent: "center",
                                      }}
                                    >
                                      {restrictions.map((restriction, index) => (
                                        <Chip
                                          key={index}
                                          label={restriction}
                                          size="small"
                                          sx={{
                                            backgroundColor: "var(--color-warning)",
                                            color: "var(--color-white)",
                                            fontSize: "0.7rem",
                                          }}
                                        />
                                      ))}
                                    </Box>
                                  ) : (
                                    <span
                                      style={{
                                        color: "var(--color-text-medium)",
                                        fontStyle: "italic",
                                      }}
                                    >
                                      None
                                    </span>
                                  );
                                })()
                              : col.propertyKey.includes("deliveryInstructions")
                                ? (() => {
                                    const instructions = row.deliveryDetails?.deliveryInstructions;
                                    return instructions && instructions.trim() !== ""
                                      ? instructions
                                      : "No instructions";
                                  })()
                                : col.propertyKey ===
                                    "deliveryDetails.dietaryRestrictions.dietaryPreferences"
                                  ? row.deliveryDetails?.dietaryRestrictions?.dietaryPreferences &&
                                    row.deliveryDetails?.dietaryRestrictions?.dietaryPreferences.trim() !==
                                      ""
                                    ? row.deliveryDetails?.dietaryRestrictions?.dietaryPreferences.trim()
                                    : ""
                                  : (() => {
                                      const val = row[col.propertyKey as keyof DeliveryRowData];
                                      if (
                                        col.propertyKey === "LastDeliveryDate" ||
                                        col.propertyKey === "lastDeliveryDate"
                                      ) {
                                        if (
                                          val === null ||
                                          val === undefined ||
                                          val === "" ||
                                          (typeof val === "string" &&
                                            val.trim().toUpperCase() === "N/A")
                                        )
                                          return "";
                                      }
                                      if (
                                        col.propertyKey === "ReferralEntity" ||
                                        col.propertyKey === "referralEntity"
                                      ) {
                                        if (val && typeof val === "object") {
                                          const name = val.name || "";
                                          const org = val.organization || "";
                                          const display = [name, org].filter(Boolean).join(", ");
                                          return display || "";
                                        }
                                      }
                                      return val?.toString() ?? "";
                                    })()
                          : ""}
                      </TableCell>
                    ))}
                    <TableCell style={{ width: "50px" }}>{/* Add button space */}</TableCell>
                  </Box>
                );
              }}
              fixedHeaderContent={() => (
                <TableRow>
                  {fields.map((field) => (
                    <TableCell
                      key={field.key}
                      className="table-header"
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 3,
                        width:
                          field.type === "checkbox"
                            ? "60px"
                            : field.key === "fullname"
                              ? "250px"
                              : field.key === "clusterIdChange"
                                ? "180px"
                                : field.key === "deliveryDetails.deliveryInstructions"
                                  ? "300px"
                                  : field.key === "assignedDriver" || field.key === "assignedTime"
                                    ? "180px"
                                    : "150px",
                        textAlign: "center",
                        padding: "10px",
                        cursor:
                          field.key === "fullname" ||
                          field.key === "clusterIdChange" ||
                          field.key === "tags" ||
                          field.key === "zipCode" ||
                          field.key === "ward" ||
                          field.key === "assignedDriver" ||
                          field.key === "assignedTime" ||
                          field.key === "deliveryDetails.deliveryInstructions"
                            ? "pointer"
                            : "default",
                        userSelect: "none",
                        backgroundColor: "var(--color-background-green-tint)",
                      }}
                      onClick={() =>
                        (field.key === "fullname" ||
                          field.key === "clusterIdChange" ||
                          field.key === "tags" ||
                          field.key === "zipCode" ||
                          field.key === "ward" ||
                          field.key === "assignedDriver" ||
                          field.key === "assignedTime" ||
                          field.key === "deliveryDetails.deliveryInstructions") &&
                        handleSort(field)
                      }
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 1,
                        }}
                      >
                        {field.label}
                        {(field.key === "fullname" ||
                          field.key === "clusterIdChange" ||
                          field.key === "tags" ||
                          field.key === "zipCode" ||
                          field.key === "ward" ||
                          field.key === "assignedDriver" ||
                          field.key === "assignedTime" ||
                          field.key === "deliveryDetails.deliveryInstructions") && (
                          <>
                            {String(field.key) === sortedColumn ? (
                              sortOrder === "asc" ? (
                                <ArrowDropUpIcon />
                              ) : (
                                <ArrowDropDownIcon />
                              )
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
                        position: "sticky",
                        top: 0,
                        zIndex: 3,
                        width: "150px",
                        userSelect: "none",
                        cursor: col.propertyKey !== "none" ? "pointer" : "default",
                        backgroundColor: "var(--color-background-green-tint)",
                      }}
                      onClick={() =>
                        col.propertyKey !== "none" && handleSort({ key: col.propertyKey } as Field)
                      }
                    >
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
                            color: "var(--color-primary)",
                            "& .MuiOutlinedInput-notchedOutline": {
                              borderColor: "#bfdfd4",
                            },
                            "&:hover .MuiOutlinedInput-notchedOutline": {
                              borderColor: "var(--color-primary)",
                            },
                          }}
                        >
                          {allowedPropertyKeys.map((key: string) => {
                            let label = key;
                            if (key === "none") label = "None";
                            if (key === "address") label = "Address";
                            if (key === "adults") label = "Adults";
                            if (key === "children") label = "Children";
                            if (key === "deliveryFreq") label = "Delivery Freq";
                            if (key === "deliveryDetails.dietaryRestrictions")
                              label = "Dietary Restrictions";
                            if (key === "deliveryDetails.dietaryRestrictions.dietaryPreferences")
                              label = "Dietary Preferences";
                            if (key === "ethnicity") label = "Ethnicity";
                            if (key === "gender") label = "Gender";
                            if (key === "language") label = "Language";
                            if (key === "notes") label = "Notes";
                            if (key === "phone") label = "Phone";
                            if (key === "referralEntity") label = "Referral Entity";
                            if (key === "tags") label = "Tags";
                            if (key === "tefapCert") label = "TEFAP Cert";
                            if (key === "dob") label = "DOB";
                            if (key === "lastDeliveryDate") label = "Last Delivery Date";
                            return (
                              <MenuItem key={key} value={key}>
                                {label}
                              </MenuItem>
                            );
                          })}
                        </Select>
                        {/* Show sort icon if this custom column is currently sorted */}
                        {col.propertyKey !== "none" &&
                          (sortedColumn === col.propertyKey ? (
                            sortOrder === "asc" ? (
                              <ArrowDropUpIcon />
                            ) : (
                              <ArrowDropDownIcon />
                            )
                          ) : (
                            <UnfoldMoreIcon sx={{ opacity: 0.3 }} />
                          ))}
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
                            color: "var(--color-error-text)",
                            "&:hover": {
                              backgroundColor: "rgba(211, 47, 47, 0.04)",
                            },
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
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 3,
                      backgroundColor: "var(--color-background-green-tint)",
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
                        },
                      }}
                    >
                      <AddIcon sx={{ color: "var(--color-primary)" }} />
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
              )}
            />
          ) : (
            // No data state - just show headers
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {fields.map((field) => (
                    <TableCell
                      key={field.key}
                      className="table-header"
                      style={{
                        width:
                          field.type === "checkbox"
                            ? "60px"
                            : field.key === "fullname"
                              ? "250px"
                              : field.key === "clusterIdChange"
                                ? "180px"
                                : field.key === "deliveryDetails.deliveryInstructions"
                                  ? "300px"
                                  : field.key === "assignedDriver" || field.key === "assignedTime"
                                    ? "180px"
                                    : "150px",
                        textAlign: "center",
                        padding: "10px",
                        cursor:
                          field.key === "fullname" ||
                          field.key === "clusterIdChange" ||
                          field.key === "tags" ||
                          field.key === "zipCode" ||
                          field.key === "ward" ||
                          field.key === "assignedDriver" ||
                          field.key === "assignedTime" ||
                          field.key === "deliveryDetails.deliveryInstructions"
                            ? "pointer"
                            : "default",
                        userSelect: "none",
                        backgroundColor: "var(--color-background-green-tint)",
                      }}
                      onClick={() =>
                        (field.key === "fullname" ||
                          field.key === "clusterIdChange" ||
                          field.key === "tags" ||
                          field.key === "zipCode" ||
                          field.key === "ward" ||
                          field.key === "assignedDriver" ||
                          field.key === "assignedTime" ||
                          field.key === "deliveryDetails.deliveryInstructions") &&
                        handleSort(field)
                      }
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 1,
                        }}
                      >
                        {field.label}
                        {(field.key === "fullname" ||
                          field.key === "clusterIdChange" ||
                          field.key === "tags" ||
                          field.key === "zipCode" ||
                          field.key === "ward" ||
                          field.key === "assignedDriver" ||
                          field.key === "assignedTime" ||
                          field.key === "deliveryDetails.deliveryInstructions") && (
                          <>
                            {String(field.key) === sortedColumn ? (
                              sortOrder === "asc" ? (
                                <ArrowDropUpIcon />
                              ) : (
                                <ArrowDropDownIcon />
                              )
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
                        width: "150px",
                        userSelect: "none",
                        cursor: col.propertyKey !== "none" ? "pointer" : "default",
                        backgroundColor: "var(--color-background-green-tint)",
                      }}
                      onClick={() =>
                        col.propertyKey !== "none" && handleSort({ key: col.propertyKey } as Field)
                      }
                    >
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
                            color: "var(--color-primary)",
                            "& .MuiOutlinedInput-notchedOutline": {
                              borderColor: "#bfdfd4",
                            },
                            "&:hover .MuiOutlinedInput-notchedOutline": {
                              borderColor: "var(--color-primary)",
                            },
                          }}
                        >
                          {allowedPropertyKeys.map((key: string) => {
                            let label = key;
                            if (key === "none") label = "None";
                            if (key === "address") label = "Address";
                            if (key === "adults") label = "Adults";
                            if (key === "children") label = "Children";
                            if (key === "deliveryFreq") label = "Delivery Freq";
                            if (key === "deliveryDetails.dietaryRestrictions")
                              label = "Dietary Restrictions";
                            if (key === "ethnicity") label = "Ethnicity";
                            if (key === "gender") label = "Gender";
                            if (key === "language") label = "Language";
                            if (key === "notes") label = "Notes";
                            if (key === "phone") label = "Phone";
                            if (key === "referralEntity") label = "Referral Entity";
                            if (key === "tefapCert") label = "TEFAP Cert";
                            if (key === "dob") label = "DOB";
                            if (key === "lastDeliveryDate") label = "Last Delivery Date";
                            return (
                              <MenuItem key={key} value={key}>
                                {label}
                              </MenuItem>
                            );
                          })}
                        </Select>
                        {/* Show sort icon if this custom column is currently sorted */}
                        {col.propertyKey !== "none" &&
                          (sortedColumn === col.propertyKey ? (
                            sortOrder === "asc" ? (
                              <ArrowDropUpIcon />
                            ) : (
                              <ArrowDropDownIcon />
                            )
                          ) : (
                            <UnfoldMoreIcon sx={{ opacity: 0.3 }} />
                          ))}
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
                            color: "var(--color-error-text)",
                            "&:hover": {
                              backgroundColor: "rgba(211, 47, 47, 0.04)",
                            },
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
                    style={{
                      backgroundColor: "var(--color-background-green-tint)",
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
                        },
                      }}
                    >
                      <AddIcon sx={{ color: "var(--color-primary)" }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{/* Empty table body - just headers shown */}</TableBody>
            </Table>
          )}
        </TableContainer>
      </Box>

      {/* Assign Driver Popup */}
      <Dialog open={popupMode === "Driver"} onClose={resetSelections} maxWidth="xs" fullWidth>
        <DialogTitle>Assign Driver</DialogTitle>
        <DialogContent>
          <AssignDriverPopup
            assignDriver={assignDriver}
            setPopupMode={setPopupMode}
            onDriversUpdated={triggerDriverRefresh}
          />
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
              <Button
                variant="contained"
                color="primary"
                onClick={() => setExportOption("Routes")}
                startIcon={<FileDownloadIcon />}
              >
                Routes
              </Button>
              <Button
                variant="outlined"
                color="primary"
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
                variant="contained"
                color="primary"
                onClick={() => {
                  handleEmailOrDownload("Email");
                  resetSelections();
                }}
              >
                Email
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => {
                  handleEmailOrDownload("Download");
                  resetSelections();
                }}
              >
                Download
              </Button>
              <Button variant="outlined" color="primary" onClick={() => setExportOption(null)}>
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
    </Box>
  );
};

export default DeliverySpreadsheet;
