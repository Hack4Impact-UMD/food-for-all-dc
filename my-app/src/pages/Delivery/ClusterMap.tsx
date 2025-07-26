import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.awesome-markers";
import "leaflet.awesome-markers/dist/leaflet.awesome-markers.css";
import { Box, Button, FormControlLabel, Switch, Typography } from "@mui/material";
import DriverService from "../../services/driver-service";
import FFAIcon from '../../assets/tsp-food-for-all-dc-logo.png'

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

interface VisibleRow {
  id: string;
  firstName: string;
  lastName: string;
  address: string;
  coordinates?: [number, number] | { lat: number; lng: number };
  clusterId?: string;
  ward?: string;
}

interface ClusterMapProps {
  visibleRows: VisibleRow[];
  clusters: Cluster[];
  clientOverrides?: ClientOverride[];
  onClusterUpdate: (clientId: string, newClusterId: string, newDriver?: string, newTime?: string) => void;
  refreshDriversTrigger?: number; // Optional prop to trigger driver refresh
}

// DC Ward colors - each ward gets a unique translucent color
const wardColors: { [key: string]: string } = {
  'Ward 1': '#FF0000',  // Red
  'Ward 2': '#00FF00',  // Green
  'Ward 3': '#0000FF',  // Blue
  'Ward 4': '#FFFF00',  // Yellow
  'Ward 5': '#FF00FF',  // Magenta
  'Ward 6': '#00FFFF',  // Cyan
  'Ward 7': '#FFA500',  // Orange
  'Ward 8': '#800080',  // Purple
};

const ffaCoordinates: L.LatLngExpression = [38.914330, -77.036942];

const isValidCoordinate = (coord: any): boolean => {
  if (!coord) return false;

  if (Array.isArray(coord)) {
    return (
      coord.length === 2 &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1]) &&
      Math.abs(coord[0]) <= 90 &&
      Math.abs(coord[1]) <= 180
    );
  }

  return (
    typeof coord === "object" &&
    !isNaN(coord.lat) &&
    !isNaN(coord.lng) &&
    Math.abs(coord.lat) <= 90 &&
    Math.abs(coord.lng) <= 180
  );
};

const normalizeCoordinate = (coord: any): Coordinate => {
  if (Array.isArray(coord)) {
    return { lat: coord[0], lng: coord[1] };
  }
  return coord;
};

// Common time slots array - same as used in delivery page
const TIME_SLOTS = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", 
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", 
  "4:00 PM", "5:00 PM"
];

const ClusterMap: React.FC<ClusterMapProps> = ({ visibleRows, clusters, clientOverrides = [], onClusterUpdate, refreshDriversTrigger }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.FeatureGroup | null>(null);
  const wardLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  
  // Initialize showWardOverlays from localStorage
  const [showWardOverlays, setShowWardOverlays] = useState<boolean>(() => {
    const saved = localStorage.getItem('wardOverlaysEnabled');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [wardData, setWardData] = useState<any>(null);
  const [wardDataLoading, setWardDataLoading] = useState<boolean>(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState<boolean>(false);
  
  // Function to fetch DC ward boundaries from ArcGIS REST service
  const fetchWardBoundaries = async () => {
    if (wardData) return wardData; // Return cached data if available
    
    setWardDataLoading(true);
    try {
      const wardServiceURL = `https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Administrative_Other_Boundaries_WebMercator/MapServer/53/query`;
      const params = new URLSearchParams({
        f: 'geojson',
        where: '1=1', // Get all wards
        outFields: 'NAME,WARD',
        returnGeometry: 'true'
      });

      const response = await fetch(`${wardServiceURL}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ward boundaries: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched ward boundaries:', data);
      setWardData(data);
      return data;
    } catch (error) {
      console.error('Error fetching ward boundaries:', error);
      return null;
    } finally {
      setWardDataLoading(false);
    }
  };

  // Create a memoized fetch function for drivers that can be called from multiple places
  const fetchDrivers = useCallback(async () => {
    setLoadingDrivers(true);
    try {
      const driverService = DriverService.getInstance();
      const driversData = await driverService.getAllDrivers();
      setDrivers(driversData);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      setDrivers([]);
    } finally {
      setLoadingDrivers(false);
    }
  }, []);

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
  const addWardOverlays = async () => {
    if (!mapRef.current || !wardLayerGroupRef.current) return;
    
    const boundaries = wardData || await fetchWardBoundaries();
    if (!boundaries || !boundaries.features) return;

    // Clear existing ward layers
    wardLayerGroupRef.current.clearLayers();

    boundaries.features.forEach((feature: any) => {
      const wardName = feature.properties.NAME || `Ward ${feature.properties.WARD}`;
      const wardColor = wardColors[wardName] || '#999999'; // Default color if ward not found
      
      // Create polygon layer with translucent fill
      const polygon = L.geoJSON(feature, {
        style: {
          fillColor: wardColor,
          fillOpacity: 0.2, // Translucent
          color: wardColor,
          weight: 2,
          opacity: 0.8
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
                fillOpacity: 0.4
              });
            },
            mouseout: (e) => {
              const layer = e.target;
              layer.setStyle({
                fillOpacity: 0.2
              });
            }
          });
        }
      });

      if (wardLayerGroupRef.current) {
        polygon.addTo(wardLayerGroupRef.current);
      }
    });
  };

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
    localStorage.setItem('wardOverlaysEnabled', JSON.stringify(checked));
    
    if (checked) {
      addWardOverlays();
    } else {
      removeWardOverlays();
    }
  };

  // Color palette for clusters
  const clusterColors = [
    "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF",
    "#00FFFF", "#FFA500", "#800080", "#008000", "#000080",
    "#FF4500", "#4B0082", "#FF6347", "#32CD32", "#9370DB",
    "#FF69B4", "#40E0D0", "#FF8C00", "#7CFC00", "#8A2BE2",
    "#FF1493", "#1E90FF", "#228B22", "#9400D3", "#DC143C",
    "#20B2AA", "#9932CC", "#FFD700", "#8B0000", "#4169E1"
  ];

  useEffect(() => {
    if (!mapRef.current && visibleRows.length > 0) {
      mapRef.current = L.map("cluster-map").setView(ffaCoordinates, 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapRef.current);
      
      // Create ward layer group (add before markers so wards appear behind markers)
      wardLayerGroupRef.current = L.featureGroup().addTo(mapRef.current);
      
      // Create marker layer group
      markerGroupRef.current = L.featureGroup().addTo(mapRef.current);
    }
  }, []);

  // Restore ward overlays if they were enabled when the map is ready
  useEffect(() => {
    if (mapRef.current && wardLayerGroupRef.current && showWardOverlays) {
      addWardOverlays();
    }
  }, [showWardOverlays, mapRef.current, wardLayerGroupRef.current]);

  useEffect(() => {
    if (!mapRef.current || !markerGroupRef.current || visibleRows.length < 1) return;

    markerGroupRef.current.clearLayers();

    // create a map of client ids for quick lookup
    const clientClusterMap = new Map<string, Cluster>();
    clusters.forEach(cluster => {
      cluster.deliveries.forEach(clientId => {
        clientClusterMap.set(clientId, cluster);
      });
    });

    visibleRows.forEach((client) => {
      if (!client.coordinates || !isValidCoordinate(client.coordinates)) return;

      const coord = normalizeCoordinate(client.coordinates);
      const clientName = `${client.firstName} ${client.lastName}` || "Client: None";
      const address = client.address;

      //find the cluster this client belongs to
      const cluster = clientClusterMap.get(client.id);
      const clusterId = cluster?.id || "";
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
              background-color: ${clusterId ? clusterColors[colorIndex] : "#257E68"};
              border: 1px solid black;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 12px;
              color: white;
              text-shadow: .5px .5px .5px #000, -.5px .5px .5px #000, -.5px -.5px 0px #000, .5px -.5px 0px #000;
              box-sizing: border-box;
              opacity: 0.9;
            ">${clusterId}</div>`,
      iconSize: [0, 0],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
      

      //create marker
      const marker = L.marker([coord.lat, coord.lng], {
        icon: numberIcon,
        opacity: 1,
      });

      //build popup content
      const createEditablePopup = (clientId: string, clientName: string, clusterId: string, cluster: Cluster | undefined, ward: string | undefined, address: string) => {
        // Find individual client overrides
        const clientOverride = clientOverrides.find(override => override.clientId === clientId);
        
        // Get effective driver and time (override takes precedence over cluster default)
        const effectiveDriver = clientOverride?.driver || cluster?.driver;
        const effectiveTime = clientOverride?.time || cluster?.time;
        // Helper function to get cluster color
        const getClusterColor = (clusterIdToCheck: string) => {
          if (!clusterIdToCheck) return "#ffffff";
          const clusterIdStr = String(clusterIdToCheck); // Ensure it's a string
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
        };

        // Helper function to format time in AM/PM format
        const formatTimeForDisplay = (time: string | undefined) => {
          if (!time) return '';
          
          // If time is already in AM/PM format, return as is
          if (time.includes('AM') || time.includes('PM')) {
            return time;
          }
          
          // If time is in military/24-hour format, convert to AM/PM
          const timeRegex = /^(\d{1,2}):(\d{2})$/;
          const match = time.match(timeRegex);
          if (match) {
            const hours = parseInt(match[1], 10);
            const minutes = match[2];
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            return `${displayHours}:${minutes} ${ampm}`;
          }
          
          // If we can't parse it, return as is
          return time;
        };

        // Helper function to convert AM/PM time to 24-hour format
        const convertTo24Hour = (time: string) => {
          if (!time || (!time.includes('AM') && !time.includes('PM'))) {
            return time; // Already in 24-hour format or empty
          }
          
          const [timePart, period] = time.split(' ');
          const [hours, minutes] = timePart.split(':');
          let hours24 = parseInt(hours, 10);
          
          if (period === 'AM' && hours24 === 12) {
            hours24 = 0;
          } else if (period === 'PM' && hours24 !== 12) {
            hours24 += 12;
          }
          
          return `${hours24.toString().padStart(2, '0')}:${minutes}`;
        };

        const popupContainer = document.createElement('div');
        popupContainer.innerHTML = `
          <div style="font-family: Arial, sans-serif; line-height: 1.4; min-width: 250px;">
            <div id="view-mode-${clientId}" style="display: block;">
              <div style="font-weight: bold; margin-bottom: 5px; display: flex; align-items: center; justify-content: space-between;">
                <span>${clientName}</span>
                ${clusterId ? `<span style="cursor: pointer; padding: 2px 4px; border-radius: 3px; margin-left: 10px;" id="edit-btn-${clientId}" title="Edit">✏️</span>` : ''}
              </div>
              ${clusterId ? `
                <div><span style="font-weight: bold;">Cluster:</span> ${clusterId}</div>
                ${effectiveDriver ? `<div><span style="font-weight: bold;">Driver:</span> ${effectiveDriver}</div>` : ''}
                ${effectiveTime ? `<div><span style="font-weight: bold;">Time:</span> ${formatTimeForDisplay(effectiveTime)}</div>` : ''}
              ` : 
              `<div><span style="font-weight: bold;">Cluster:</span> No cluster Assigned</div>`}
              ${ward ? `<div><span style="font-weight: bold;">Ward:</span> ${ward}</div>` : ''}
              <div><span style="font-weight: bold;">Address:</span> ${address}</div>
            </div>
            <div id="edit-mode-${clientId}" style="display: none;">
              <div style="font-weight: bold; margin-bottom: 10px;">${clientName}</div>
              <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                <label style="font-weight: bold; min-width: 60px; font-size: 12px;">Cluster:</label>
                <select id="cluster-select-${clientId}" style="flex: 1; padding: 3px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; background-color: ${clusterId ? getClusterColor(clusterId) : '#ffffff'}; color: ${clusterId ? 'white' : 'black'}; height: 24px !important; min-height: 24px !important; max-height: 24px !important; line-height: 1.1 !important;">
                  <option value="" style="background-color: #ffffff; color: black;">No cluster</option>
                  ${clusters.map(c => `<option value="${c.id}" ${c.id === clusterId ? 'selected' : ''} style="background-color: ${getClusterColor(c.id)}; color: white;">${c.id}</option>`).join('')}
                </select>
              </div>
              <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                <label style="font-weight: bold; min-width: 60px; font-size: 12px;">Driver:</label>
                <select id="driver-select-${clientId}" style="flex: 1; padding: 3px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; height: 24px !important; min-height: 24px !important; max-height: 24px !important; line-height: 1.1 !important;">
                  <option value="">No driver</option>
                  ${drivers.map(d => `<option value="${d.name}" ${d.name === effectiveDriver ? 'selected' : ''}>${d.name}${d.phone ? ` - ${d.phone}` : ''}</option>`).join('')}
                </select>
              </div>
              <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                <label style="font-weight: bold; min-width: 60px; font-size: 12px;">Time:</label>
                <select id="time-select-${clientId}" style="flex: 1; padding: 3px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px; height: 24px !important; min-height: 24px !important; max-height: 24px !important; line-height: 1.1 !important;">
                  <option value="">No time</option>
                  ${TIME_SLOTS.map(t => `<option value="${t}" ${t === formatTimeForDisplay(effectiveTime) ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
              </div>
              <div style="display: flex; gap: 8px;">
                <button id="save-btn-${clientId}" style="flex: 1; padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">Save</button>
                <button id="cancel-btn-${clientId}" style="flex: 1; padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">Cancel</button>
              </div>
              ${ward ? `<div style="margin-top: 8px;"><span style="font-weight: bold;">Ward:</span> ${ward}</div>` : ''}
              <div style="margin-top: 8px;"><span style="font-weight: bold;">Address:</span> ${address}</div>
            </div>
          </div>
        `;

        // Add event listeners
        const editBtn = popupContainer.querySelector(`#edit-btn-${clientId}`);
        const saveBtn = popupContainer.querySelector(`#save-btn-${clientId}`);
        const cancelBtn = popupContainer.querySelector(`#cancel-btn-${clientId}`);
        const clusterSelect = popupContainer.querySelector(`#cluster-select-${clientId}`) as HTMLSelectElement;
        const viewMode = popupContainer.querySelector(`#view-mode-${clientId}`) as HTMLElement;
        const editMode = popupContainer.querySelector(`#edit-mode-${clientId}`) as HTMLElement;

        // Add color change listener to cluster select
        if (clusterSelect) {
          clusterSelect.addEventListener('change', () => {
            const selectedClusterId = clusterSelect.value;
            if (selectedClusterId) {
              const selectedColor = getClusterColor(selectedClusterId);
              clusterSelect.style.backgroundColor = selectedColor;
              clusterSelect.style.color = 'white';
            } else {
              clusterSelect.style.backgroundColor = '#ffffff';
              clusterSelect.style.color = 'black';
            }
          });
        }

        // Store initial values for reset on cancel
        let initialClusterId = clusterSelect ? clusterSelect.value : '';
        const driverSelect = popupContainer.querySelector(`#driver-select-${clientId}`) as HTMLSelectElement;
        const timeSelect = popupContainer.querySelector(`#time-select-${clientId}`) as HTMLSelectElement;
        let initialDriver = driverSelect ? driverSelect.value : '';
        let initialTime = timeSelect ? timeSelect.value : '';

        if (editBtn) {
          editBtn.addEventListener('click', () => {
            // Capture initial values when entering edit mode
            if (clusterSelect) initialClusterId = clusterSelect.value;
            if (driverSelect) initialDriver = driverSelect.value;
            if (timeSelect) initialTime = timeSelect.value;
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
            // Ensure popup stays in view after switching to edit mode
            setTimeout(() => {
              // Find the marker for this popup
              if (markerGroupRef.current && mapRef.current) {
                markerGroupRef.current.eachLayer(function(layer) {
                  // Only proceed if this is a marker
                  if ((layer as L.Marker).getPopup && (layer as L.Marker).getPopup() && (layer as L.Marker).getPopup()!.getContent() === popupContainer) {
                    const marker = layer as L.Marker;
                    const popup = marker.getPopup();
                    if (popup && mapRef.current && marker.getLatLng) {
                      popup.update();
                      mapRef.current.panInside(marker.getLatLng(), { padding: [30, 30] });
                    }
                  }
                });
              }
            }, 0);
          });
        }

        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            // Reset dropdowns to their initial values
            if (clusterSelect) {
              clusterSelect.value = initialClusterId;
              // Update color
              const selectedColor = initialClusterId ? getClusterColor(initialClusterId) : '#ffffff';
              clusterSelect.style.backgroundColor = selectedColor;
              clusterSelect.style.color = initialClusterId ? 'white' : 'black';
            }
            if (driverSelect) driverSelect.value = initialDriver;
            if (timeSelect) timeSelect.value = initialTime;
            viewMode.style.display = 'block';
            editMode.style.display = 'none';
          });
        }

        if (saveBtn && onClusterUpdate) {
          saveBtn.addEventListener('click', () => {
            const clusterSelect = popupContainer.querySelector(`#cluster-select-${clientId}`) as HTMLSelectElement;
            const driverSelect = popupContainer.querySelector(`#driver-select-${clientId}`) as HTMLSelectElement;
            const timeSelect = popupContainer.querySelector(`#time-select-${clientId}`) as HTMLSelectElement;

            const newClusterId = clusterSelect.value;
            const newDriver = driverSelect.value || undefined;
            const newTime = timeSelect.value || undefined;

            // Convert time to 24-hour format for storage
            const newTime24Hour = newTime ? convertTo24Hour(newTime) : undefined;

            // Update the view mode content with new data
            const viewModeContent = popupContainer.querySelector(`#view-mode-${clientId}`);
            if (viewModeContent) {
              viewModeContent.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px; display: flex; align-items: center; justify-content: space-between;">
                  <span>${clientName}</span>
                  ${newClusterId ? `<span style="cursor: pointer; padding: 2px 4px; border-radius: 3px; margin-left: 10px;" id="edit-btn-${clientId}" title="Edit">✏️</span>` : ''}
                </div>
                ${newClusterId ? `
                  <div><span style="font-weight: bold;">Cluster:</span> ${newClusterId}</div>
                  ${newDriver ? `<div><span style="font-weight: bold;">Driver:</span> ${newDriver}</div>` : ''}
                  ${newTime ? `<div><span style="font-weight: bold;">Time:</span> ${newTime}</div>` : ''}
                ` : 
                `<div><span style="font-weight: bold;">Cluster:</span> No cluster Assigned</div>`}
                ${ward ? `<div><span style="font-weight: bold;">Ward:</span> ${ward}</div>` : ''}
                <div><span style="font-weight: bold;">Address:</span> ${address}</div>
              `;
              
              // Re-attach the edit button event listener
              const newEditBtn = viewModeContent.querySelector(`#edit-btn-${clientId}`);
              if (newEditBtn) {
                newEditBtn.addEventListener('click', () => {
                  viewMode.style.display = 'none';
                  editMode.style.display = 'block';
                });
              }
            }

            // Call the update function with 24-hour format time
            onClusterUpdate(clientId, newClusterId, newDriver, newTime24Hour);
            
            // Switch back to view mode
            viewMode.style.display = 'block';
            editMode.style.display = 'none';
          });
        }

        return popupContainer;
      };

      const popupContent = createEditablePopup(client.id, clientName, clusterId, cluster, client.ward, address);

      //add popup and marker to group
      marker
        .bindPopup(popupContent, { autoPan: true, keepInView: true })
        .addTo(markerGroupRef.current!);
    });

    //Add FFA Headquarter Marker
    const ffaIcon = L.divIcon({
      className: "custom-ffa-icon",
      html: `<div style="
        background-color: white;
        border: 2px solid purple;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        justify-content: center;
        align-items: center;
      ">
        <img src="${FFAIcon}" style="width: 100%; height: 100%;" />
      </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });

    const ffaMarker = L.marker(ffaCoordinates, { icon: ffaIcon });
    ffaMarker.addTo(markerGroupRef.current!);

    //fit map to markers if there are any
    if (markerGroupRef.current!.getLayers().length > 0) {
      mapRef.current!.fitBounds(markerGroupRef.current!.getBounds(), {
        padding: [50, 50] 
      });
    }
  }, [visibleRows, clusters, drivers, clientOverrides]);

  const invalidCount = visibleRows.filter(
    (client) => !isValidCoordinate(client.coordinates)
  ).length;

  const centerMap = ()=>{
    mapRef.current?.setView(ffaCoordinates, 11)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div id="cluster-map" style={{ 
        height: "400px", 
        width: "100%", 
        marginBottom: "20px",
        border: "1px solid #ddd",
        borderRadius: "4px"
      }} />
      
      {/* Ward Overlay Toggle */}
      <Box
        sx={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '8px 12px',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1000,
          minWidth: '180px'
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
            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
              {wardDataLoading ? 'Loading wards...' : 'Show Ward Overlays'}
            </Typography>
          }
          sx={{ margin: 0 }}
        />
        {showWardOverlays && (
          <Box sx={{ mt: 1, fontSize: '10px', color: 'text.secondary' }}>
            <Typography variant="caption">
              Translucent colored regions show DC wards
            </Typography>
          </Box>
        )}
      </Box>
      
      {/* Ward Legend */}
      {showWardOverlays && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '80px',
            left: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '12px',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxWidth: '200px'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1, fontSize: '12px' }}>
            DC Wards
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(wardColors).map(([wardName, color]) => (
              <Box key={wardName} sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Box
                  sx={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: color,
                    opacity: 0.7,
                    border: `1px solid ${color}`,
                    borderRadius: '2px',
                    flexShrink: 0
                  }}
                />
                <Typography variant="caption" sx={{ fontSize: '10px' }}>
                  {wardName}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
      
      {/* Center Map Button */}
      <Box
        sx={{
          backgroundColor: "white",
          border: "2px solid purple",
          borderRadius: "50%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: 'absolute',
          top: '10px',
          left: '60px', // Position next to zoom controls (which are typically 40px wide + 10px margin)
          width: 50,
          height: 50,
          zIndex: 1000,
          cursor: 'pointer',
          "&:hover": {
            opacity: "80%"
          }
        }}
        onClick={centerMap}
      >
        <img src={FFAIcon} style={{ width: '100%', height: '100%' }} alt="Center On FFA" />
      </Box>
      {invalidCount > 0 && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'white',
          padding: '5px 10px',
          borderRadius: '3px',
          boxShadow: '0 0 5px rgba(0,0,0,0.2)',
          zIndex: 1000,
          color: 'red',
          fontWeight: 'bold'
        }}>
          {invalidCount} invalid coordinates
        </div>
      )}
    </div>
  );
};

export default ClusterMap;
