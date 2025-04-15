import React, { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ClusterMapProps {
  addresses: string[];
  coordinates: Array<[number, number] | { lat: number; lng: number }>;
  clusters: { [key: string]: number[] };
  clientNames: string[];
}

const isValidCoordinate = (
  coord: any
): coord is [number, number] | { lat: number; lng: number } => {
  if (!coord) return false;

  if (Array.isArray(coord)) {
    return (
      coord.length === 2 &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1]) &&
      Math.abs(coord[0]) <= 90 &&
      Math.abs(coord[1]) <= 180 &&
      !(coord[0] === 0 && coord[1] === 0)
    );
  }

  return (
    typeof coord === "object" &&
    !isNaN(coord.lat) &&
    !isNaN(coord.lng) &&
    Math.abs(coord.lat) <= 90 &&
    Math.abs(coord.lng) <= 180 &&
    !(coord.lat === 0 && coord.lng === 0)
  );
};

const normalizeCoordinate = (coord: any): { lat: number; lng: number } => {
  if (Array.isArray(coord)) {
    return { lat: coord[0], lng: coord[1] };
  }
  return coord;
};

const ClusterMap: React.FC<ClusterMapProps> = ({
  addresses,
  coordinates,
  clusters,
  clientNames,
}) => {
  useEffect(() => {
    // dont render map if no valid coordinates
    if (coordinates.length === 0 || addresses.length === 0 || clientNames.length === 0) {
      return;
    }

    // DC coords
    const dcCenter: [number, number] = [38.9072, -77.0369];

    // set the map centered on DC by default
    const map = L.map("cluster-map").setView(dcCenter, 11);

    // title layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    // Create a feature group to store all markers
    const markerGroup = L.featureGroup().addTo(map);

    if (coordinates.length > 0) {
      const validEntries = coordinates
        .map((coord, index) => ({ coord, index }))
        .filter(({ coord }) => isValidCoordinate(coord));

      // Color palette for clusters
      const clusterColors = [
        "#FF0000", // Red
        "#00FF00", // Green
        "#0000FF", // Blue
        "#FFFF00", // Yellow
        "#FF00FF", // Magenta
        "#00FFFF", // Cyan
        "#FFA500", // Orange
        "#800080", // Purple
        "#008000", // Dark Green
        "#000080", // Navy
        "#FF4500", // OrangeRed
        "#4B0082", // Indigo
        "#FF6347", // Tomato
        "#32CD32", // LimeGreen
        "#9370DB", // MediumPurple
        "#FF69B4", // HotPink
        "#40E0D0", // Turquoise
        "#FF8C00", // DarkOrange
        "#7CFC00", // LawnGreen
        "#8A2BE2", // BlueViolet
        "#FF1493", // DeepPink
        "#1E90FF", // DodgerBlue
        "#228B22", // ForestGreen
        "#9400D3", // DarkViolet
        "#DC143C", // Crimson
        "#20B2AA", // LightSeaGreen
        "#9932CC", // DarkOrchid
        "#FFD700", // Gold
        "#8B0000", // DarkRed
        "#4169E1", // RoyalBlue
      ];

      // add markers for valid coordinates
      validEntries.forEach(({ coord, index }) => {
        const { lat, lng } = normalizeCoordinate(coord);
        const address = addresses[index];
        const clientName = clientNames[index] || "Client: None";

        let clusterId = "";
        let colorIndex = 0;

        // only show clusters if they exist
        if (clusters && Object.keys(clusters).length > 0) {
          Object.entries(clusters).forEach(([id, indices]) => {
            if (indices.includes(index)) {
              clusterId = id;
              const clusterNumber = parseInt(id.split("-")[1]) || 0;
              colorIndex = clusterNumber % clusterColors.length;
            }
          });
        }

        L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: clusterId ? clusterColors[colorIndex] : "#257E68", // default color if no cluster
          color: "#000",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8,
        })
          .bindPopup(
            `
          <div style="font-family: Arial, sans-serif; line-height: 1.4;">
            <div style="font-weight: bold; margin-bottom: 5px;">${clientName}</div>
            ${clusterId ? `<div><span style="font-weight: bold;">Cluster:</span> ${clusterId.replace("cluster-", "")}</div>` : ""}
            <div><span style="font-weight: bold;">Address:</span> ${address}</div>
          </div>
        `
          )
          .addTo(markerGroup);
      });
    }

    return () => {
      map.remove();
    };
  }, [addresses, coordinates, clusters, clientNames]);

  useEffect(() => {
    coordinates.forEach((coord, index) => {
      if (!isValidCoordinate(coord)) {
        console.warn(`Invalid coordinate at index ${index}:`, coord);
      }
    });
  }, [coordinates]);

  return (
    <div style={{ position: "relative" }}>
      <div
        id="cluster-map"
        style={{
          height: "400px",
          width: "100%",
          marginBottom: "20px",
          border: "1px solid #ddd",
          borderRadius: "4px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          backgroundColor: "white",
          padding: "5px",
          borderRadius: "3px",
          boxShadow: "0 0 5px rgba(0,0,0,0.2)",
          zIndex: 1000,
        }}
      >
        {coordinates.filter((coord) => !isValidCoordinate(coord)).length} invalid coordinates
      </div>
    </div>
  );
};

export default ClusterMap;
