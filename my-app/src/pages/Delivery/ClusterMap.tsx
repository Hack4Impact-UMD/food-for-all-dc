import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.awesome-markers";
import "leaflet.awesome-markers/dist/leaflet.awesome-markers.css";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { Box, FormControlLabel, IconButton, Switch, Tooltip, Typography } from "@mui/material";
import DriverService from "../../services/driver-service";
import FFAIcon from "../../assets/tsp-food-for-all-dc-logo.png";
import dataSources from "../../config/dataSources";
import { buildClusterDisplaySnapshots, isRenderableCoordinate } from "./utils/deliveryMapCounts";
import { buildMarkerPlacementMap } from "./utils/markerPlacement";
import { normalizeAssignmentValue, resolveAssignmentValue } from "./utils/assignmentOverrides";
import {
  buildAssignmentSummary,
  buildClusterSummariesFromClusters,
  sortClusterSummaries,
  type ClusterSummarySortMode,
} from "./utils/clusterSummary";
import { TIME_SLOT_LABELS } from "./utils/timeSlots";
import { getClientStatusPresentation } from "../../utils/clientStatus";

interface Driver {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface Coordinate {
  lat: number;
  lng: number;
}

interface Client {
  id: string;
  coordinates: Coordinate | Coordinate[];
  address: string;
  firstName: string;
  lastName: string;
  ward?: string;
}

interface Cluster {
  id: string;
  driver?: string;
  time?: string;
  deliveries: string[];
}

interface ClientOverride {
  clientId: string;
  driver?: string;
  time?: string;
}

interface RouteMapRow {
  id: string;
  firstName: string;
  lastName: string;
  activeStatus?: boolean;
  missedStrikeCount?: number;
  address: string;
  address2?: string;
  zipCode?: string;
  coordinates?: [number, number] | [] | { lat: number; lng: number };
  clusterId?: string;
  ward?: string;
}

interface ClusterMapProps {
  allRows: RouteMapRow[];
  visibleRows: RouteMapRow[];
  clusters: Cluster[];
  clientOverrides?: ClientOverride[];
  onClusterUpdate: (
    clientId: string,
    newClusterId: string,
    newDriver?: string,
    newTime?: string
  ) => Promise<boolean>;
  onRenumberClusters?: () => Promise<boolean>;
  onOpenPopup?: (clientId: string) => void; // Prop to handle table row clicks
  onMarkerClick?: (clientId: string) => void; // Prop to handle marker clicks
  onClearHighlight?: () => void; // Prop to clear row highlighting
  refreshDriversTrigger?: number; // Optional prop to trigger driver refresh
}

// DC Ward colors - each ward gets a unique translucent color
const wardColors: { [key: string]: string } = {
  "Ward 1": "#FF0000", // Red
  "Ward 2": "#00FF00", // Green
  "Ward 3": "#0000FF", // Blue
  "Ward 4": "#FFFF00", // Yellow
  "Ward 5": "#FF00FF", // Magenta
  "Ward 6": "#00FFFF", // Cyan
  "Ward 7": "#FFA500", // Orange
  "Ward 8": "#800080", // Purple
};

const ffaCoordinates: L.LatLngExpression = [38.91433, -77.036942];

const isValidCoordinate = isRenderableCoordinate;

const normalizeCoordinate = (coord: any): Coordinate => {
  if (Array.isArray(coord)) {
    return { lat: coord[0], lng: coord[1] };
  }
  return coord;
};

const normalizeClusterId = (clusterId?: unknown): string => {
  if (typeof clusterId === "number" && Number.isFinite(clusterId)) {
    return String(clusterId);
  }

  return normalizeAssignmentValue(clusterId) || "";
};

const getNextClusterId = (clusterList: Array<Pick<Cluster, "id">>): string => {
  const numericIds = clusterList
    .map((cluster) => parseInt(normalizeClusterId(cluster.id), 10))
    .filter((clusterId) => !Number.isNaN(clusterId));

  const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
  return String(maxId + 1);
};

const formatTimeForSummary = (time: string): string => {
  if (!time) return "No time";

  // Keep already formatted labels (e.g. "8:00 AM") unchanged.
  if (/AM|PM/i.test(time)) {
    return time;
  }

  const [hours, minutes] = time.split(":");
  const parsedHour = Number(hours);
  if (Number.isNaN(parsedHour) || !minutes) {
    return time;
  }

  const hour12 = parsedHour % 12 || 12;
  const ampm = parsedHour >= 12 ? "PM" : "AM";
  return `${hour12}:${minutes} ${ampm}`;
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
  "var(--color-event-indicator)",
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

const ClusterMap: React.FC<ClusterMapProps> = ({
  allRows,
  visibleRows,
  clusters,
  clientOverrides = [],
  onClusterUpdate,
  onRenumberClusters,
  onOpenPopup,
  onMarkerClick,
  onClearHighlight,
  refreshDriversTrigger,
}) => {
  // Fetch drivers from Firebase
  const fetchDrivers = useCallback(async () => {
    setLoadingDrivers(true);
    try {
      const driverService = DriverService.getInstance();
      const driversData = await driverService.getAllDrivers();
      setDrivers(driversData);
    } catch (error) {
      console.error("Failed to fetch drivers:", error);
    } finally {
      setLoadingDrivers(false);
    }
  }, []);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.FeatureGroup | null>(null);
  const wardLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const isMapAliveRef = useRef(false);
  const scheduledTimeoutsRef = useRef<number[]>([]);
  const popupCloseHandlerRef = useRef<L.LeafletEventHandlerFn | null>(null);
  const onClearHighlightRef = useRef(onClearHighlight);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onClusterUpdateRef = useRef(onClusterUpdate);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map()); // Store markers by client ID
  const previousVisibleRowsKeyRef = useRef<string>("");
  const isPopupOpening = useRef<boolean>(false); // Prevent close handler from firing during opening
  const clustersRef = useRef<Cluster[]>(clusters);

  const scheduleClusterMapTimeout = useCallback((callback: () => void, delay = 0) => {
    const timeoutId = window.setTimeout(() => {
      scheduledTimeoutsRef.current = scheduledTimeoutsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delay);

    scheduledTimeoutsRef.current.push(timeoutId);
    return timeoutId;
  }, []);

  const clearScheduledMapWork = useCallback(() => {
    scheduledTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    scheduledTimeoutsRef.current = [];
  }, []);

  const withLiveMap = useCallback((callback: (map: L.Map) => void) => {
    const map = mapRef.current;
    if (!isMapAliveRef.current || !map) {
      return;
    }

    callback(map);
  }, []);

  const destroyMap = useCallback(() => {
    if (!mapRef.current && !markerGroupRef.current && !wardLayerGroupRef.current) {
      isMapAliveRef.current = false;
      clearScheduledMapWork();
      markersMapRef.current.clear();
      previousVisibleRowsKeyRef.current = "";
      return;
    }

    isMapAliveRef.current = false;
    clearScheduledMapWork();
    isPopupOpening.current = false;

    const map = mapRef.current;

    if (map) {
      if (popupCloseHandlerRef.current) {
        map.off("popupclose", popupCloseHandlerRef.current);
      }

      map.stop();
      map.closePopup();
    }

    if (wardLayerGroupRef.current) {
      wardLayerGroupRef.current.clearLayers();
      wardLayerGroupRef.current.remove();
      wardLayerGroupRef.current = null;
    }

    if (markerGroupRef.current) {
      markerGroupRef.current.clearLayers();
      markerGroupRef.current.remove();
      markerGroupRef.current = null;
    }

    markersMapRef.current.clear();
    previousVisibleRowsKeyRef.current = "";

    if (map) {
      map.remove();
      mapRef.current = null;
    }
  }, [clearScheduledMapWork]);

  useEffect(() => {
    onClearHighlightRef.current = onClearHighlight;
  }, [onClearHighlight]);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    onClusterUpdateRef.current = onClusterUpdate;
  }, [onClusterUpdate]);

  // Initialize showWardOverlays from localStorage
  const [showWardOverlays, setShowWardOverlays] = useState<boolean>(() => {
    const saved = localStorage.getItem("wardOverlaysEnabled");
    return saved ? JSON.parse(saved) : false;
  });

  // Initialize showClusterSummary from localStorage
  const [showClusterSummary, setShowClusterSummary] = useState<boolean>(() => {
    const saved = localStorage.getItem("clusterSummaryEnabled");
    return saved ? JSON.parse(saved) : true; // Default to true
  });
  const [clusterSummarySortMode, setClusterSummarySortMode] = useState<ClusterSummarySortMode>(
    () => {
      const saved = localStorage.getItem("clusterSummarySortMode");
      if (saved === "count-asc") {
        return "count-asc";
      }
      if (saved === "count-desc" || saved === "count") {
        return "count-desc";
      }
      return "cluster";
    }
  );
  const [isReorderingClusters, setIsReorderingClusters] = useState<boolean>(false);

  const [wardData, setWardData] = useState<any>(null);
  const [wardDataLoading, setWardDataLoading] = useState<boolean>(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState<boolean>(false);

  const clusterByClientId = React.useMemo(() => {
    const map = new Map<string, Cluster>();

    clusters.forEach((cluster) => {
      cluster.deliveries?.forEach((clientId) => {
        map.set(clientId, cluster);
      });
    });

    return map;
  }, [clusters]);

  const clientOverrideByClientId = React.useMemo(() => {
    const map = new Map<string, ClientOverride>();

    clientOverrides.forEach((override) => {
      map.set(override.clientId, {
        clientId: override.clientId,
        driver: normalizeAssignmentValue(override.driver),
        time: normalizeAssignmentValue(override.time),
      });
    });

    return map;
  }, [clientOverrides]);

  const assignmentSummary = React.useMemo(() => {
    return buildAssignmentSummary(allRows, clusterByClientId, clientOverrideByClientId);
  }, [allRows, clusterByClientId, clientOverrideByClientId]);

  const clusterDisplaySnapshots = React.useMemo(
    () =>
      buildClusterDisplaySnapshots({
        allRows,
        visibleRows,
        clusters,
      }),
    [allRows, visibleRows, clusters]
  );
  const clusterDisplaySnapshotById = React.useMemo(
    () => new Map(clusterDisplaySnapshots.map((snapshot) => [snapshot.clusterId, snapshot])),
    [clusterDisplaySnapshots]
  );
  const hasStaleRouteAssignments = React.useMemo(
    () => clusterDisplaySnapshots.some((snapshot) => snapshot.staleAssignedCount > 0),
    [clusterDisplaySnapshots]
  );

  // Calculate deliveries + assignment details per cluster for the map summary overlay.
  const clusterSummaries = React.useMemo(() => {
    const summaries = buildClusterSummariesFromClusters(
      clusters,
      clientOverrideByClientId,
      formatTimeForSummary
    );

    const summariesWithDisplayCounts = summaries.map((summary) => ({
      ...summary,
      count: clusterDisplaySnapshotById.get(summary.clusterId)?.filteredCount ?? summary.count,
    }));

    return sortClusterSummaries(
      summariesWithDisplayCounts.filter((summary) => summary.count > 0),
      clusterSummarySortMode
    );
  }, [
    clusters,
    clientOverrideByClientId,
    clusterDisplaySnapshotById,
    clusterSummarySortMode,
  ]);

  const usedClusterCount = React.useMemo(
    () => clusterSummaries.filter((summary) => summary.count > 0).length,
    [clusterSummaries]
  );
  const hasUnassignedClusterSlots = React.useMemo(() => {
    const normalizedClusters = clusters
      .map((cluster) => {
        const clusterId = String(cluster.id ?? "").trim();
        const deliveryCount = Array.from(
          new Set(
            (cluster.deliveries ?? [])
              .map((deliveryId) => normalizeAssignmentValue(deliveryId))
              .filter((deliveryId): deliveryId is string => Boolean(deliveryId))
          )
        ).length;

        return { clusterId, deliveryCount };
      })
      .filter((cluster) => Boolean(cluster.clusterId));

    if (!normalizedClusters.length) {
      return false;
    }

    if (normalizedClusters.some((cluster) => cluster.deliveryCount === 0)) {
      return true;
    }

    const usedClusterNumbers = normalizedClusters
      .filter((cluster) => cluster.deliveryCount > 0)
      .map((cluster) => {
        const match = cluster.clusterId.match(/\d+/);
        return match ? Number(match[0]) : Number.NaN;
      });

    if (
      !usedClusterNumbers.length ||
      usedClusterNumbers.some((clusterNumber) => !Number.isFinite(clusterNumber))
    ) {
      return false;
    }

    const sortedUsedClusterNumbers = [...usedClusterNumbers].sort((left, right) => left - right);

    return sortedUsedClusterNumbers.some(
      (clusterNumber, index) => clusterNumber !== index + 1
    );
  }, [clusters]);
  const canRenumberClusters = Boolean(onRenumberClusters) && !isReorderingClusters;

  // Toggle cluster summary visibility
  const handleClusterSummaryToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setShowClusterSummary(checked);
    localStorage.setItem("clusterSummaryEnabled", JSON.stringify(checked));
  };

  const handleClusterSummarySortToggle = () => {
    setClusterSummarySortMode((previousMode) => {
      const nextMode =
        previousMode === "cluster"
          ? "count-desc"
          : previousMode === "count-desc"
            ? "count-asc"
            : "cluster";
      localStorage.setItem("clusterSummarySortMode", nextMode);
      return nextMode;
    });
  };

  const handleClusterReorder = async () => {
    if (!canRenumberClusters || !onRenumberClusters) {
      return;
    }

    try {
      setIsReorderingClusters(true);
      await onRenumberClusters();
    } finally {
      setIsReorderingClusters(false);
    }
  };

  const getClusterColor = useCallback((clusterIdToCheck: string): string => {
    if (!clusterIdToCheck) return "#ffffff";
    const clusterIdStr = String(clusterIdToCheck);
    const match = clusterIdStr.match(/\d+/);
    const clusterNumber = match ? parseInt(match[0], 10) : NaN;
    if (!isNaN(clusterNumber) && clusterNumber > 0) {
      return clusterColors[(clusterNumber - 1) % clusterColors.length];
    } else {
      let hash = 0;
      for (let i = 0; i < clusterIdStr.length; i++) {
        hash = clusterIdStr.charCodeAt(i) + ((hash << 5) - hash);
      }
      return clusterColors[Math.abs(hash) % clusterColors.length];
    }
  }, []);

  // Helper function to determine best text color based on background brightness
  const getTextColorForBackground = useCallback((backgroundColor: string): string => {
    // Convert hex to RGB
    const hex = backgroundColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Special cases for problematic colors that need black text regardless of luminance
    const problematicColors = [
      "#00FF00", // Lime green
      "#FFFF00", // Yellow
      "#00FFFF", // Cyan
      "#7CFC00", // Lawn green
      "#32CD32", // Lime green variant
      "#FFD700", // Gold
    ];

    if (problematicColors.includes(backgroundColor.toUpperCase())) {
      return "#000000";
    }

    // Calculate relative luminance using WCAG formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black for light backgrounds, white for dark backgrounds
    // Using threshold of 0.5 for better readability (lowered from 0.6)
    return luminance > 0.5 ? "#000000" : "#ffffff";
  }, []);

  // Update cluster dropdown in popup when clusters change
  React.useEffect(() => {
    // Find all open popups in edit mode
    const popups = document.querySelectorAll('[id^="edit-mode-"]');
    popups.forEach((editMode) => {
      if ((editMode as HTMLElement).style.display !== "block") return;
      const clientId = editMode.id.replace("edit-mode-", "");
      const clusterSelect = editMode.querySelector(
        `#cluster-select-${clientId}`
      ) as HTMLSelectElement | null;
      if (!clusterSelect) return;
      const prevValue = clusterSelect.value;
      // Remove all options except the first (No cluster) and last (+ Add Cluster)
      while (clusterSelect.options.length > 2) {
        clusterSelect.remove(1);
      }
      clusters.forEach((c: Cluster) => {
        const optionClusterId = normalizeClusterId(c.id);
        const opt = document.createElement("option");
        opt.value = optionClusterId;
        opt.text = optionClusterId;
        const clusterColor = getClusterColor(optionClusterId);
        opt.style.backgroundColor = clusterColor;
        opt.style.color = getTextColorForBackground(clusterColor);
        opt.style.fontWeight = "bold";
        clusterSelect.add(opt, clusterSelect.options.length - 1);
      });
      // Set value to the new cluster if it was just added, else restore previous value
      const numericIds = clusters
        .map((c2: Cluster) => parseInt(normalizeClusterId(c2.id), 10))
        .filter((clusterId) => !Number.isNaN(clusterId));
      const hasPrevValue = clusters.some(
        (c: Cluster) => normalizeClusterId(c.id) === normalizeClusterId(prevValue)
      );
      if (hasPrevValue) {
        clusterSelect.value = prevValue;
        clusterSelect.style.backgroundColor = getClusterColor(prevValue);
        clusterSelect.style.color = getTextColorForBackground(getClusterColor(prevValue));
      } else if (numericIds.length > 0) {
        const maxIdStr = String(Math.max(...numericIds));
        clusterSelect.value = maxIdStr;
        clusterSelect.style.backgroundColor = getClusterColor(maxIdStr);
        clusterSelect.style.color = getTextColorForBackground(getClusterColor(maxIdStr));
      } else {
        clusterSelect.value = "";
        clusterSelect.style.backgroundColor = "var(--color-background-main)";
        clusterSelect.style.color = "black";
      }
    });
  }, [clusters, getClusterColor, getTextColorForBackground]);

  // Function to fetch DC ward boundaries from ArcGIS REST service
  const fetchWardBoundaries = useCallback(async () => {
    if (wardData) return wardData; // Return cached data if available

    setWardDataLoading(true);
    try {
      const wardServiceURL = dataSources.externalApi.dcGisWardServiceUrl;
      const params = new URLSearchParams({
        f: "geojson",
        where: "1=1", // Get all wards
        outFields: "NAME,WARD",
        returnGeometry: "true",
      });

      const response = await fetch(`${wardServiceURL}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch ward boundaries: ${response.status}`);
      }

      const data = await response.json();
      setWardData(data);
      return data;
    } catch (error) {
      console.error("Error fetching ward boundaries:", error);
      return null;
    } finally {
      setWardDataLoading(false);
    }
  }, [wardData]);

  // Fetch drivers from Firebase
  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Add effect to handle external driver refresh triggers
  useEffect(() => {
    if (refreshDriversTrigger !== undefined && refreshDriversTrigger > 0) {
      fetchDrivers();
    }
  }, [refreshDriversTrigger, fetchDrivers]);

  // Function to add ward overlays to the map
  const addWardOverlays = useCallback(async () => {
    if (!isMapAliveRef.current || !mapRef.current || !wardLayerGroupRef.current) return;

    const boundaries = wardData || (await fetchWardBoundaries());
    if (
      !isMapAliveRef.current ||
      !wardLayerGroupRef.current ||
      !boundaries ||
      !boundaries.features
    ) {
      return;
    }

    // Clear existing ward layers
    wardLayerGroupRef.current.clearLayers();

    boundaries.features.forEach((feature: any) => {
      const wardName = feature.properties.NAME || `Ward ${feature.properties.WARD}`;
      const wardColor = wardColors[wardName] || "#999999"; // Default color if ward not found

      // Create polygon layer with translucent fill
      const polygon = L.geoJSON(feature, {
        style: {
          fillColor: wardColor,
          fillOpacity: 0.2, // Translucent
          color: wardColor,
          weight: 2,
          opacity: 0.8,
        },
        onEachFeature: (feature, layer) => {
          // Add popup with ward information
          layer.bindPopup(`
            <div style="font-family: Arial, sans-serif; font-weight: bold;">
              ${wardName}
            </div>
          `);

          // Add hover effects
          layer.on({
            mouseover: (e) => {
              const layer = e.target;
              layer.setStyle({
                fillOpacity: 0.4,
              });
            },
            mouseout: (e) => {
              const layer = e.target;
              layer.setStyle({
                fillOpacity: 0.2,
              });
            },
          });
        },
      });

      if (wardLayerGroupRef.current) {
        polygon.addTo(wardLayerGroupRef.current);
      }
    });
  }, [fetchWardBoundaries, wardData]);

  // Refs so the map init effect can restore ward overlays without adding unstable deps
  const showWardOverlaysRef = useRef(showWardOverlays);
  const addWardOverlaysRef = useRef(addWardOverlays);
  useEffect(() => { showWardOverlaysRef.current = showWardOverlays; }, [showWardOverlays]);
  useEffect(() => { addWardOverlaysRef.current = addWardOverlays; }, [addWardOverlays]);

  // Function to remove ward overlays
  const removeWardOverlays = () => {
    if (wardLayerGroupRef.current) {
      wardLayerGroupRef.current.clearLayers();
    }
  };

  // Handle ward overlay toggle
  const handleWardOverlayToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setShowWardOverlays(checked);

    // Save to localStorage
    localStorage.setItem("wardOverlaysEnabled", JSON.stringify(checked));

    if (checked) {
      addWardOverlays();
    } else {
      removeWardOverlays();
    }
  };

  useEffect(() => {
    if (
      !mapRef.current &&
      mapContainerRef.current &&
      allRows.length > 0 &&
      L &&
      typeof L.map === "function"
    ) {
      try {
        mapRef.current = L.map(mapContainerRef.current, {
          closePopupOnClick: false,
        }).setView(ffaCoordinates, 11, {
          animate: false,
        });
        isMapAliveRef.current = true;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapRef.current);
      } catch (error) {
        console.error("Error initializing Leaflet map:", error);
        destroyMap();
        return;
      }

      // Create ward layer group (add before markers so wards appear behind markers)
      wardLayerGroupRef.current = L.featureGroup().addTo(mapRef.current);

      // Create marker layer group
      markerGroupRef.current = L.featureGroup().addTo(mapRef.current);

      if (!popupCloseHandlerRef.current) {
        popupCloseHandlerRef.current = () => {
          if (!isMapAliveRef.current || isPopupOpening.current) {
            return;
          }

          scheduleClusterMapTimeout(() => {
            if (!isMapAliveRef.current || isPopupOpening.current) {
              return;
            }

            onClearHighlightRef.current?.();
          }, 200);
        };
      }

      mapRef.current.on("popupclose", popupCloseHandlerRef.current);

      // Restore ward overlays if they were enabled before the map existed
      if (showWardOverlaysRef.current) {
        scheduleClusterMapTimeout(() => addWardOverlaysRef.current(), 0);
      }
    }
  }, [allRows.length, destroyMap, scheduleClusterMapTimeout]);

  useEffect(() => {
    return () => {
      destroyMap();
    };
  }, [destroyMap]);

  // Handle external popup open requests
  React.useEffect(() => {
    if (onOpenPopup) {
      (window as any).openMapPopup = (clientId: string) => {
        // Suppress popupclose clearing while we open the new popup (same as marker clicks)
        isPopupOpening.current = true;

        const marker = markersMapRef.current.get(clientId);
        if (marker) {
          marker.openPopup();
        }

        // Reset after the open sequence completes so future closes clear the row
        scheduleClusterMapTimeout(() => {
          isPopupOpening.current = false;
        }, 350);
      };

      // Also set up the close popup function
      (window as any).closeMapPopup = () => {
        withLiveMap((map) => {
          map.closePopup();
        });
      };

      // Set up function to clear row highlighting
      (window as any).clearRowHighlight = () => {
        onClearHighlightRef.current?.();
      };
    }
    return () => {
      delete (window as any).openMapPopup;
      delete (window as any).closeMapPopup;
      delete (window as any).clearRowHighlight;
    };
  }, [onOpenPopup, scheduleClusterMapTimeout, withLiveMap]);

  useEffect(() => {
    clustersRef.current = clusters;
  }, [clusters]);

  // Restore ward overlays if they were enabled when the map is ready
  useEffect(() => {
    if (mapRef.current && wardLayerGroupRef.current && showWardOverlays) {
      addWardOverlays();
    }
  }, [showWardOverlays, addWardOverlays]);

  useEffect(() => {
    if (!mapRef.current || !markerGroupRef.current || !isMapAliveRef.current) return;

    withLiveMap((map) => {
      map.stop();
      map.closePopup();
    });

    markerGroupRef.current.clearLayers();

    // Clear markers map when recreating markers
    markersMapRef.current.clear();

    if (visibleRows.length < 1) {
      previousVisibleRowsKeyRef.current = "";
      return;
    }

    // create a map of client ids for quick lookup
    const clientClusterMap = new Map<string, Cluster>();
    clusters.forEach((cluster) => {
      cluster.deliveries.forEach((clientId) => {
        clientClusterMap.set(clientId, cluster);
      });
    });

    const markerPlacements = buildMarkerPlacementMap(visibleRows);

    visibleRows.forEach((client) => {
      if (!client.coordinates || !isValidCoordinate(client.coordinates)) return;

      const coord = markerPlacements.get(client.id) ?? normalizeCoordinate(client.coordinates);
      const clientName = `${client.firstName} ${client.lastName}` || "Client: None";
      const statusPresentation = getClientStatusPresentation(
        client.activeStatus === false ? false : true,
        client.missedStrikeCount
      );
      const statusIconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" style="display:block;fill:${statusPresentation.color};"><path d="${statusPresentation.iconPath}"></path></svg>`;
      const clientNameWithStatus = `
        <span style="display: inline-flex; align-items: center;">
          <span title="${statusPresentation.tooltip}" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; min-width: 18px; margin-right: 4px; line-height: 1;">${statusIconSvg}</span>
          <span>${clientName}</span>
        </span>
      `;
      const address =
        `${client.address || ""}${client.address2 ? " " + client.address2 : ""}`.trim();
      const zipCode = (client.zipCode || "").trim();

      const cluster = clientClusterMap.get(client.id);
      const clusterId = normalizeClusterId(cluster?.id);
      let colorIndex = 0;

      if (clusterId) {
        // Assuming cluster IDs are like "Cluster 1", "Cluster 2", etc.
        // Extract the number part for color assignment.
        // If format is different, adjust parsing logic.
        const clusterIdStr = String(clusterId); // Ensure clusterId is a string
        const match = clusterIdStr.match(/\d+/);
        const clusterNumber = match ? parseInt(match[0], 10) : NaN;
        if (!isNaN(clusterNumber) && clusterNumber > 0) {
          colorIndex = (clusterNumber - 1) % clusterColors.length; // Use number-1 for 0-based index
        } else {
          // Fallback for non-numeric IDs or parsing failures - hash the ID?
          let hash = 0;
          for (let i = 0; i < clusterIdStr.length; i++) {
            hash = clusterIdStr.charCodeAt(i) + ((hash << 5) - hash);
          }
          colorIndex = Math.abs(hash) % clusterColors.length;
        }
      }
      const numberIcon = L.divIcon({
        html: `<div style="
              width: 20px;
              height: 20px;
              background-color: ${clusterId ? clusterColors[colorIndex] : "var(--color-primary)"};
              border: 1px solid black;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 12px;
              color: var(--color-white);
              text-shadow: .5px .5px .5px var(--color-border-black), -.5px .5px .5px var(--color-border-black), -.5px -.5px 0px var(--color-border-black), .5px -.5px 0px var(--color-border-black);
              box-sizing: border-box;
              opacity: 0.9;
              cursor: pointer;
            ">${clusterId}</div>`,
        iconSize: [0, 0],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });

      const marker = L.marker([coord.lat, coord.lng], {
        icon: numberIcon,
        opacity: 1,
      });

      const createEditablePopup = (
        clientId: string,
        clientName: string,
        clusterId: string,
        cluster: Cluster | undefined,
        ward: string | undefined,
        address: string,
        zipCode: string
      ) => {
        const addressWithZip = zipCode ? `${address} ${zipCode}` : address;
        const clientOverride = clientOverrideByClientId.get(clientId);

        // Helper function to format time in AM/PM format
        const formatTimeForDisplay = (time: string | undefined) => {
          if (!time) return "";

          // If time is already in AM/PM format, return as is
          if (time.includes("AM") || time.includes("PM")) {
            return time;
          }

          // If time is in military/24-hour format, convert to AM/PM
          const timeRegex = /^(\d{1,2}):(\d{2})$/;
          const match = time.match(timeRegex);
          if (match) {
            const hours = parseInt(match[1], 10);
            const minutes = match[2];
            const ampm = hours >= 12 ? "PM" : "AM";
            const displayHours = hours % 12 || 12;
            return `${displayHours}:${minutes} ${ampm}`;
          }

          // If we can't parse it, return as is
          return time;
        };

        // Helper function to convert AM/PM time to 24-hour format
        const convertTo24Hour = (time: string) => {
          if (!time || (!time.includes("AM") && !time.includes("PM"))) {
            return time; // Already in 24-hour format or empty
          }

          const [timePart, period] = time.split(" ");
          const [hours, minutes] = timePart.split(":");
          let hours24 = parseInt(hours, 10);

          if (period === "AM" && hours24 === 12) {
            hours24 = 0;
          } else if (period === "PM" && hours24 !== 12) {
            hours24 += 12;
          }

          return `${hours24.toString().padStart(2, "0")}:${minutes}`;
        };

        const overrideDriver = normalizeAssignmentValue(clientOverride?.driver);
        const overrideTime = normalizeAssignmentValue(clientOverride?.time);
        const clusterDriver = normalizeAssignmentValue(cluster?.driver);
        const clusterTime = normalizeAssignmentValue(cluster?.time);
        const effectiveDriver = resolveAssignmentValue(overrideDriver, clusterDriver);
        const effectiveTime = resolveAssignmentValue(overrideTime, clusterTime);
        const selectedDriverValue = effectiveDriver ?? "";
        const selectedTimeValue = effectiveTime ? formatTimeForDisplay(effectiveTime) : "";
        const emptyDriverLabel = "No driver";
        const emptyTimeLabel = "No time";
        const getSubmittedValue = (currentValue: string, initialValue: string) =>
          currentValue === initialValue ? undefined : currentValue;
        const resolveSavedValue = (
          submittedValue: string | undefined,
          fallbackValue: string | undefined
        ) =>
          submittedValue === undefined ? fallbackValue : normalizeAssignmentValue(submittedValue);

        const popupContainer = document.createElement("div");
        popupContainer.setAttribute("data-client-id", clientId);
        popupContainer.innerHTML = `
          <div style="font-family: Arial, sans-serif; line-height: 1.4; min-width: 250px;">
            <div id="view-mode-${clientId}" style="display: block;">
              <div style="font-weight: bold; margin-bottom: 5px; display: flex; align-items: center; justify-content: space-between;">
                <span>${clientNameWithStatus}</span>
                ${clusterId ? `<span style="cursor: pointer; padding: 2px 4px; border-radius: 3px; margin-left: 10px;" id="edit-btn-${clientId}" title="Edit">✏️</span>` : ""}
              </div>
              ${
                clusterId
                  ? `
                <div><span style="font-weight: bold;">Cluster:</span> ${clusterId}</div>
                ${effectiveDriver ? `<div><span style="font-weight: bold;">Driver:</span> ${effectiveDriver}</div>` : ""}
                ${effectiveTime ? `<div><span style="font-weight: bold;">Time:</span> ${formatTimeForDisplay(effectiveTime)}</div>` : ""}
              `
                  : `<div><span style="font-weight: bold;">Cluster:</span> No cluster Assigned</div>`
              }
              ${ward ? `<div><span style="font-weight: bold;">Ward:</span> ${ward}</div>` : ""}
              <div><span style="font-weight: bold;">Address:</span> ${addressWithZip}</div>
            </div>
            <div id="edit-mode-${clientId}" style="display: none;">
              <div style="font-weight: bold; margin-bottom: 10px;">${clientNameWithStatus}</div>
              <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                <label style="font-weight: bold; min-width: 60px; font-size: 12px;">Cluster:</label>
                <select id="cluster-select-${clientId}" style="flex: 1; padding: 3px; border: 1px solid var(--color-border-input); border-radius: 3px; font-size: 11px; background-color: ${clusterId ? getClusterColor(clusterId) : "var(--color-background-main)"}; color: ${clusterId ? getTextColorForBackground(getClusterColor(clusterId)) : "black"}; height: 24px !important; min-height: 24px !important; max-height: 24px !important; line-height: 1.1 !important;">
                  <option value="" style="background-color: var(--color-background-main); color: var(--color-black);">No cluster</option>
                  ${clusters
                    .map((c) => {
                      const optionClusterId = normalizeClusterId(c.id);
                      return `<option value="${optionClusterId}" ${optionClusterId === clusterId ? "selected" : ""} style="background-color: ${getClusterColor(optionClusterId)}; color: ${getTextColorForBackground(getClusterColor(optionClusterId))}; font-weight: bold;">${optionClusterId}</option>`;
                    })
                    .join("")}
                  <option value="__add__" style="background-color: var(--color-border-input); color: var(--color-text-dark); font-weight: bold;">+ Add Cluster</option>
                </select>
              </div>
              <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                <label style="font-weight: bold; min-width: 60px; font-size: 12px;">Driver:</label>
                <select id="driver-select-${clientId}" style="flex: 1; padding: 3px; border: 1px solid var(--color-border-input); border-radius: 3px; font-size: 11px; height: 24px !important; min-height: 24px !important; max-height: 24px !important; line-height: 1.1 !important;">
                  <option value="" ${!selectedDriverValue ? "selected" : ""}>${emptyDriverLabel}</option>
                  ${drivers.map((d) => `<option value="${d.name}" ${d.name === selectedDriverValue ? "selected" : ""}>${d.name}${d.phone ? ` - ${d.phone}` : ""}</option>`).join("")}
                </select>
              </div>
              <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                <label style="font-weight: bold; min-width: 60px; font-size: 12px;">Time:</label>
                <select id="time-select-${clientId}" style="flex: 1; padding: 3px; border: 1px solid var(--color-border-input); border-radius: 3px; font-size: 11px; height: 24px !important; min-height: 24px !important; max-height: 24px !important; line-height: 1.1 !important;">
                  <option value="" ${!selectedTimeValue ? "selected" : ""}>${emptyTimeLabel}</option>
                  ${TIME_SLOT_LABELS.map((t) => `<option value="${t}" ${t === selectedTimeValue ? "selected" : ""}>${t}</option>`).join("")}
                </select>
              </div>
              <div style="display: flex; gap: 8px;">
                <button id="save-btn-${clientId}" style="flex: 1; padding: 6px 12px; background: var(--color-success-button); color: var(--color-white); border: none; border-radius: 3px; cursor: pointer;">Save</button>
                <button id="cancel-btn-${clientId}" style="flex: 1; padding: 6px 12px; background: var(--color-cancel-button); color: var(--color-white); border: none; border-radius: 3px; cursor: pointer;">Cancel</button>
              </div>
              ${ward ? `<div style="margin-top: 8px;"><span style="font-weight: bold;">Ward:</span> ${ward}</div>` : ""}
              <div style="margin-top: 8px;"><span style="font-weight: bold;">Address:</span> ${addressWithZip}</div>
            </div>
          </div>
        `;

        const schedulePopupReposition = (modeElement: HTMLElement) => {
          scheduleClusterMapTimeout(() => {
            if (!modeElement.isConnected || !popupContainer.isConnected) {
              return;
            }

            if (!markerGroupRef.current?.hasLayer(marker)) {
              return;
            }

            withLiveMap((map) => {
              const latlng = marker.getLatLng();
              const popupRect = modeElement.getBoundingClientRect();
              const markerPoint = map.latLngToContainerPoint(latlng);
              const targetPoint = markerPoint.subtract([0, popupRect.height / 2]);
              const targetLatLng = map.containerPointToLatLng(targetPoint);
              map.panTo(targetLatLng, { animate: true });
            });
          }, 100);
        };

        const enterEditMode = () => {
          viewMode.style.display = "none";
          editMode.style.display = "block";
          schedulePopupReposition(editMode);
        };

        // Add event listeners
        const editBtn = popupContainer.querySelector(`#edit-btn-${clientId}`);
        const saveBtn = popupContainer.querySelector(`#save-btn-${clientId}`);
        const cancelBtn = popupContainer.querySelector(`#cancel-btn-${clientId}`);
        const clusterSelect = popupContainer.querySelector(
          `#cluster-select-${clientId}`
        ) as HTMLSelectElement;
        const viewMode = popupContainer.querySelector(`#view-mode-${clientId}`) as HTMLElement;
        const editMode = popupContainer.querySelector(`#edit-mode-${clientId}`) as HTMLElement;

        if (clusterSelect) {
          clusterSelect.addEventListener("change", () => {
            const selectedClusterId = clusterSelect.value;
            if (selectedClusterId === "__add__") {
              const nextClusterId = getNextClusterId(clustersRef.current);
              const opt = document.createElement("option");
              opt.value = nextClusterId;
              opt.text = nextClusterId;
              opt.style.backgroundColor = getClusterColor(nextClusterId);
              opt.style.color = getTextColorForBackground(getClusterColor(nextClusterId));
              clusterSelect.add(opt, clusterSelect.options.length - 1);
              clusterSelect.value = nextClusterId;
              const nextClusterColor = getClusterColor(nextClusterId);
              clusterSelect.style.backgroundColor = nextClusterColor;
              clusterSelect.style.color = getTextColorForBackground(nextClusterColor);
              return;
            }
            if (selectedClusterId) {
              const selectedColor = getClusterColor(selectedClusterId);
              clusterSelect.style.backgroundColor = selectedColor;
              clusterSelect.style.color = getTextColorForBackground(selectedColor);
            } else {
              clusterSelect.style.backgroundColor = "var(--color-background-main)";
              clusterSelect.style.color = "var(--color-black)";
            }
          });
        }

        // Store initial values for reset on cancel
        let initialClusterId = clusterSelect ? normalizeClusterId(clusterSelect.value) : "";
        const driverSelect = popupContainer.querySelector(
          `#driver-select-${clientId}`
        ) as HTMLSelectElement;
        const timeSelect = popupContainer.querySelector(
          `#time-select-${clientId}`
        ) as HTMLSelectElement;
        let initialDriver = driverSelect ? driverSelect.value : "";
        let initialTime = timeSelect ? timeSelect.value : "";

        if (editBtn) {
          editBtn.addEventListener("click", () => {
            // Capture initial values when entering edit mode
            if (clusterSelect) initialClusterId = normalizeClusterId(clusterSelect.value);
            if (driverSelect) initialDriver = driverSelect.value;
            if (timeSelect) initialTime = timeSelect.value;
            enterEditMode();
          });
        }

        if (cancelBtn) {
          cancelBtn.addEventListener("click", () => {
            // Reset dropdowns to their initial values
            if (clusterSelect) {
              clusterSelect.value = initialClusterId;
              // Update color
              const selectedColor = initialClusterId
                ? getClusterColor(initialClusterId)
                : "#ffffff";
              clusterSelect.style.backgroundColor = selectedColor;
              clusterSelect.style.color = initialClusterId
                ? getTextColorForBackground(selectedColor)
                : "black";
            }
            if (driverSelect) driverSelect.value = initialDriver;
            if (timeSelect) timeSelect.value = initialTime;
            viewMode.style.display = "block";
            editMode.style.display = "none";
            schedulePopupReposition(viewMode);
          });
        }

        if (saveBtn && onClusterUpdateRef.current) {
          saveBtn.addEventListener("click", async () => {
            const clusterSelect = popupContainer.querySelector(
              `#cluster-select-${clientId}`
            ) as HTMLSelectElement;
            const driverSelect = popupContainer.querySelector(
              `#driver-select-${clientId}`
            ) as HTMLSelectElement;
            const timeSelect = popupContainer.querySelector(
              `#time-select-${clientId}`
            ) as HTMLSelectElement;

            const submittedClusterId = clusterSelect.value;
            const newClusterId =
              submittedClusterId === "__add__" || submittedClusterId === "__add_new_cluster__"
                ? getNextClusterId(clustersRef.current)
                : normalizeClusterId(submittedClusterId);
            const newDriver = driverSelect.value;
            const newTime = timeSelect.value;
            const clusterChanged = newClusterId !== initialClusterId;
            const submittedDriver = getSubmittedValue(newDriver, initialDriver);
            const submittedTimeLabel = getSubmittedValue(newTime, initialTime);
            const submittedTime =
              submittedTimeLabel === undefined
                ? undefined
                : submittedTimeLabel === ""
                  ? ""
                  : convertTo24Hour(submittedTimeLabel);
            const submittedDriverForSave = newClusterId ? submittedDriver : undefined;
            const submittedTimeForSave = newClusterId ? submittedTime : undefined;

            const nextCluster = clustersRef.current.find(
              (candidate) => normalizeClusterId(candidate.id) === newClusterId
            );
            const clusterDriver = normalizeAssignmentValue(nextCluster?.driver);
            const clusterTime = normalizeAssignmentValue(nextCluster?.time);
            const unchangedDriverFallback = clusterChanged ? clusterDriver : effectiveDriver;
            const unchangedTimeFallback = clusterChanged ? clusterTime : effectiveTime;
            const resolvedDriver = resolveSavedValue(
              submittedDriverForSave,
              unchangedDriverFallback
            );
            const resolvedTime = resolveSavedValue(submittedTimeForSave, unchangedTimeFallback);

            if (!clusterChanged && submittedDriver === undefined && submittedTime === undefined) {
              viewMode.style.display = "block";
              editMode.style.display = "none";
              return;
            }

            const didSave = await onClusterUpdateRef.current(
              clientId,
              newClusterId,
              submittedDriverForSave,
              submittedTimeForSave
            );

            if (!didSave) {
              return;
            }

            // Update the view mode content with new data
            const viewModeContent = popupContainer.querySelector(`#view-mode-${clientId}`);
            if (viewModeContent) {
              viewModeContent.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px; display: flex; align-items: center; justify-content: space-between;">
                  <span>${clientNameWithStatus}</span>
                  ${newClusterId ? `<span style="cursor: pointer; padding: 2px 4px; border-radius: 3px; margin-left: 10px;" id="edit-btn-${clientId}" title="Edit">✏️</span>` : ""}
                </div>
                ${
                  newClusterId
                    ? `
                  <div><span style="font-weight: bold;">Cluster:</span> ${newClusterId}</div>
                  ${resolvedDriver ? `<div><span style="font-weight: bold;">Driver:</span> ${resolvedDriver}</div>` : ""}
                  ${resolvedTime ? `<div><span style="font-weight: bold;">Time:</span> ${formatTimeForDisplay(resolvedTime)}</div>` : ""}
                `
                    : `<div><span style="font-weight: bold;">Cluster:</span> No cluster Assigned</div>`
                }
                ${ward ? `<div><span style="font-weight: bold;">Ward:</span> ${ward}</div>` : ""}
                <div><span style="font-weight: bold;">Address:</span> ${addressWithZip}</div>
              `;
              // Re-attach the edit button event listener
              const newEditBtn = viewModeContent.querySelector(`#edit-btn-${clientId}`);
              if (newEditBtn) {
                newEditBtn.addEventListener("click", () => {
                  enterEditMode();
                });
              }
            }

            const nextDriverValue = resolvedDriver ?? "";
            const nextTimeValue = resolvedTime ? formatTimeForDisplay(resolvedTime) : "";

            driverSelect.value = nextDriverValue;
            timeSelect.value = nextTimeValue;
            initialClusterId = newClusterId;
            initialDriver = nextDriverValue;
            initialTime = nextTimeValue;

            viewMode.style.display = "block";
            editMode.style.display = "none";
          });
        }

        return popupContainer;
      };

      const popupContent = createEditablePopup(
        client.id,
        clientName,
        clusterId,
        cluster,
        client.ward,
        address,
        zipCode
      );

      //add popup and marker to group
      marker
        .bindPopup(popupContent, {
          autoPan: true,
          keepInView: true,
          closeOnClick: false,
          autoClose: false,
        })
        .on("click", () => {
          isPopupOpening.current = true;
          marker.openPopup();

          if (onMarkerClickRef.current) {
            onMarkerClickRef.current(client.id);
          }
        })
        .on("popupopen", () => {
          scheduleClusterMapTimeout(() => {
            isPopupOpening.current = false;
          }, 350);
        })
        .on("popupclose", () => {
          isPopupOpening.current = false;
        })
        .addTo(markerGroupRef.current!);

      // Store client ID in the popup content for later retrieval
      popupContent.setAttribute("data-client-id", client.id);

      // Store marker in the map for external access
      markersMapRef.current.set(client.id, marker);
    });

    const ffaIcon = L.divIcon({
      className: "custom-ffa-icon",
      html: `<div style="
        background-color: var(--color-white);
        border: 2px solid purple;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
      ">
        <img src="${FFAIcon}" style="width: 100%; height: 100%;" />
      </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });

    const ffaMarker = L.marker(ffaCoordinates, { icon: ffaIcon });
    ffaMarker.addTo(markerGroupRef.current!);

    const visibleRowsKey = visibleRows
      .map((row) => row.id)
      .sort()
      .join("|");
    const shouldAutoFit = visibleRowsKey !== previousVisibleRowsKeyRef.current;

    if (markerGroupRef.current!.getLayers().length > 0 && shouldAutoFit) {
      withLiveMap((map) => {
        map.fitBounds(markerGroupRef.current!.getBounds(), {
          padding: [50, 50],
          animate: false,
        });
      });
      previousVisibleRowsKeyRef.current = visibleRowsKey;
    }
  }, [
    visibleRows,
    clusters,
    drivers,
    clientOverrideByClientId,
    getClusterColor,
    getTextColorForBackground,
    scheduleClusterMapTimeout,
    withLiveMap,
  ]);

  const invalidCount = allRows.filter(
    (client) => !isValidCoordinate(client.coordinates)
  ).length;
  const dayTotalDeliveries = allRows.length;
  const showFilteredEmptyState =
    visibleRows.length === 0 && dayTotalDeliveries > 0;

  const centerMap = () => {
    withLiveMap((map) => {
      map.stop();
      map.setView(ffaCoordinates, 11, { animate: false });
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={mapContainerRef}
        style={{
          height: "400px",
          width: "100%",
          marginBottom: "20px",
          border: "1px solid var(--color-border-light)",
          borderRadius: "4px",
        }}
      />

      {showFilteredEmptyState && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 900,
          }}
        >
          <Box
            sx={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid var(--color-border-light)",
              borderRadius: "6px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              px: 3,
              py: 1.5,
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>
              No deliveries match current filter
            </Typography>
          </Box>
        </Box>
      )}

      {/* Ward Overlay Toggle */}
      <Box
        sx={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          padding: "8px 12px",
          borderRadius: "6px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          zIndex: 1000,
          minWidth: "180px",
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={showWardOverlays}
              onChange={handleWardOverlayToggle}
              size="small"
              disabled={wardDataLoading}
            />
          }
          label={
            <Typography variant="body2" sx={{ fontSize: "12px", fontWeight: 500 }}>
              {wardDataLoading ? "Loading wards..." : "Show Ward Overlays"}
            </Typography>
          }
          sx={{ margin: 0 }}
        />
        <Box sx={{ borderTop: "1px solid rgba(0,0,0,0.1)", mt: 1, pt: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={showClusterSummary}
                onChange={handleClusterSummaryToggle}
                size="small"
              />
            }
            label={
              <Typography variant="body2" sx={{ fontSize: "12px", fontWeight: 500 }}>
                Show Cluster Summary
              </Typography>
            }
            sx={{ margin: 0 }}
          />
        </Box>
      </Box>

      {/* Ward Legend */}
      {showWardOverlays && (
        <Box
          sx={{
            position: "absolute",
            top: "74px",
            left: "10px",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            padding: "12px",
            borderRadius: "6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 1000,
            maxWidth: "200px",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1, fontSize: "12px" }}>
            DC Wards
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {Object.entries(wardColors).map(([wardName, color]) => (
              <Box key={wardName} sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Box
                  sx={{
                    width: "16px",
                    height: "16px",
                    backgroundColor: color,
                    opacity: 0.7,
                    border: `1px solid ${color}`,
                    borderRadius: "2px",
                    flexShrink: 0,
                  }}
                />
                <Typography variant="caption" sx={{ fontSize: "10px" }}>
                  {wardName}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Cluster Summary */}
      {showClusterSummary && clusterSummaries.length > 0 && (
        <Box
          sx={{
            position: "absolute",
            top: "10px",
            right: "10px",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            padding: "12px",
            borderRadius: "6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 1000,
            width: "clamp(141px, 12vw, 174px)",
            minWidth: "141px",
            maxWidth: "calc(100% - 20px)",
            maxHeight: "calc(100% - 20px)",
            overflowY: "auto",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              gap: 0.5,
              mb: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: "bold",
                fontSize: "12px",
                lineHeight: 1.25,
              }}
            >
              Cluster Deliveries
            </Typography>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontSize: "10px", color: "text.secondary", lineHeight: 1.2 }}
              >
                Day total: {dayTotalDeliveries}
              </Typography>
            </Box>
            {hasStaleRouteAssignments && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: "10px",
                  color: "warning.main",
                  lineHeight: 1.25,
                }}
              >
                Some saved route assignments are out of date. Counts below reflect today&apos;s
                filtered deliveries.
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              mb: 1,
              pb: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
              gap: 0.25,
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 0.5,
              }}
            >
              <Typography variant="caption" sx={{ fontSize: "11px", color: "text.secondary" }}>
                Assigned: {assignmentSummary.assigned}/{assignmentSummary.total}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontSize: "10px", color: "text.secondary" }}>
                  Sort
                </Typography>
                <Tooltip
                  title={
                    clusterSummarySortMode === "count-desc"
                      ? "Sorting by delivery count (highest first)"
                      : clusterSummarySortMode === "count-asc"
                        ? "Sorting by delivery count (lowest first)"
                        : "Sorting by cluster number"
                  }
                >
                  <IconButton
                    size="small"
                    onClick={handleClusterSummarySortToggle}
                    sx={{
                      p: 0.25,
                      color: "text.secondary",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: "6px",
                    }}
                  >
                    {clusterSummarySortMode === "count-desc" ? (
                      <ArrowDownwardIcon sx={{ fontSize: "14px" }} />
                    ) : clusterSummarySortMode === "count-asc" ? (
                      <ArrowUpwardIcon sx={{ fontSize: "14px" }} />
                    ) : (
                      <FormatListNumberedIcon sx={{ fontSize: "14px" }} />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 0.5,
                mt: 0.25,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: assignmentSummary.done ? "success.main" : "warning.main",
                }}
              >
                {assignmentSummary.done ? "Done" : `${assignmentSummary.remaining} remaining`}
              </Typography>
              {assignmentSummary.done && hasUnassignedClusterSlots && canRenumberClusters && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: "10px", color: "text.secondary" }}>
                    Renumber
                  </Typography>
                  <Tooltip title={`Renumber clusters to 1-${Math.max(usedClusterCount, 1)}`}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={handleClusterReorder}
                        disabled={!canRenumberClusters}
                        sx={{
                          p: 0.25,
                          color: "text.secondary",
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: "6px",
                        }}
                      >
                        <RestartAltIcon sx={{ fontSize: "14px" }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              )}
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {clusterSummaries.map(({ clusterId, count, driverLabel, timeLabel }) => {
              const displaySnapshot = clusterDisplaySnapshotById.get(clusterId);
              const color = getClusterColor(clusterId);
              const textColor = getTextColorForBackground(color);
              const dividerColor =
                textColor.toLowerCase() === "#ffffff"
                  ? "rgba(255, 255, 255, 0.38)"
                  : "rgba(0, 0, 0, 0.28)";
              const cardDetails: string[] = [];
              if (displaySnapshot && displaySnapshot.assignedCount > count) {
                cardDetails.push(`of ${displaySnapshot.assignedCount} assigned`);
              }
              return (
                <Box
                  key={clusterId}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: "4px",
                    padding: "4px 8px",
                    backgroundColor: color,
                    borderRadius: "4px",
                    border: `1px solid ${color}`,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: textColor,
                        textShadow:
                          textColor === "#FFFFFF" ? "0.5px 0.5px 1px rgba(0,0,0,0.5)" : "none",
                      }}
                    >
                      {clusterId}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "11px",
                        fontWeight: "bold",
                        color: textColor,
                        backgroundColor: "rgba(0, 0, 0, 0.1)",
                        padding: "2px 6px",
                        borderRadius: "10px",
                        minWidth: "24px",
                        textAlign: "center",
                      }}
                    >
                      {count}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      borderTop: "1px solid",
                      borderColor: dividerColor,
                    }}
                  />

                  <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "10px",
                        color: textColor,
                        opacity: 0.95,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {driverLabel}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "10px",
                        color: textColor,
                        opacity: 0.95,
                      }}
                    >
                      {timeLabel}
                    </Typography>
                    {cardDetails.length > 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: "9px",
                          color: textColor,
                          opacity: 0.9,
                          lineHeight: 1.2,
                        }}
                      >
                        {cardDetails.join(" · ")}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Center Map Button */}
      <Box
        sx={{
          backgroundColor: "var(--color-white)",
          border: "2px solid purple",
          borderRadius: "50%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "absolute",
          top: "10px",
          left: "60px", // Position next to zoom controls (which are typically 40px wide + 10px margin)
          width: 50,
          height: 50,
          zIndex: 1000,
          cursor: "pointer",
          "&:hover": {
            opacity: "80%",
          },
        }}
        onClick={centerMap}
      >
        <img src={FFAIcon} style={{ width: "100%", height: "100%" }} alt="Center On FFA" />
      </Box>
      {invalidCount > 0 && (
        <div
          style={{
            position: "absolute",
            top: showClusterSummary ? "auto" : "10px",
            bottom: showClusterSummary ? "10px" : "auto",
            right: "10px",
            backgroundColor: "var(--color-white)",
            padding: "5px 10px",
            borderRadius: "3px",
            boxShadow: "0 0 5px rgba(0,0,0,0.2)",
            zIndex: 1000,
            color: "red",
            fontWeight: "bold",
          }}
        >
          {invalidCount} invalid coordinates
        </div>
      )}
    </div>
  );
};

export default ClusterMap;
