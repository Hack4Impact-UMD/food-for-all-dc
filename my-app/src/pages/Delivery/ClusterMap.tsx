import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

interface ClusterMapProps {
  clusters: Cluster[];
  visibleRows: Client[];
}

const isValidCoordinate = (coord: any): boolean => {
  if (!coord) return false;
  
  if (Array.isArray(coord)) {
    return (
      coord.length === 2 &&
      !isNaN(coord[0]) && !isNaN(coord[1]) &&
      Math.abs(coord[0]) <= 90 &&
      Math.abs(coord[1]) <= 180
    );
  }
  
  return (
    typeof coord === 'object' &&
    !isNaN(coord.lat) && !isNaN(coord.lng) &&
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

const ClusterMap: React.FC<ClusterMapProps> = ({ visibleRows, clusters }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.FeatureGroup | null>(null);
  
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
      const dcCenter: L.LatLngExpression = [38.9072, -77.0369];
      mapRef.current = L.map("cluster-map").setView(dcCenter, 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapRef.current);
      markerGroupRef.current = L.featureGroup().addTo(mapRef.current);
    }
  }, []);

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
        const clusterNumber = parseInt(clusterId) || 0;
        colorIndex = clusterNumber % clusterColors.length;
      }

      //create marker
      const marker = L.circleMarker([coord.lat, coord.lng], {
        radius: 8,
        fillColor: clusterId ? clusterColors[colorIndex] : "#257E68",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      });

      //build popup content
      const popupContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.4;">
          <div style="font-weight: bold; margin-bottom: 5px;">${clientName}</div>
          ${clusterId ? `
            <div><span style="font-weight: bold;">Cluster:</span> ${clusterId}</div>
            ${cluster?.driver ? `<div><span style="font-weight: bold;">Driver:</span> ${cluster.driver}</div>` : ''}
          ` :
          `<div><span style="font-weight: bold;">Cluster:</span> No cluster Assigned</div>`}
          ${client.ward ? `<div><span style="font-weight: bold;">Ward:</span> ${client.ward}</div>` : ''}
          <div><span style="font-weight: bold;">Address:</span> ${address}</div>
        </div>
      `;

      //add popup and marker to group
      marker
        .bindPopup(popupContent)
        .addTo(markerGroupRef.current!);
    });

    //fit map to markers if there are any
    if (markerGroupRef.current!.getLayers().length > 0) {
      mapRef.current!.fitBounds(markerGroupRef.current!.getBounds(), {
        padding: [50, 50]
      });
    }
  }, [visibleRows, clusters]);

  const invalidCount = visibleRows.filter(
    (client) => !isValidCoordinate(client.coordinates)
  ).length;

  return (
    <div style={{ position: 'relative' }}>
      <div id="cluster-map" style={{ 
        height: "400px", 
        width: "100%", 
        marginBottom: "20px",
        border: "1px solid #ddd",
        borderRadius: "4px"
      }} />
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