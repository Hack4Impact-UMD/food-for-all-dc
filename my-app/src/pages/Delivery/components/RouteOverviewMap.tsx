import React, { useEffect, useMemo, useRef, useState } from "react";
import { isRenderableCoordinate } from "../utils/deliveryMapCounts";
import { getClusterColor, getClusterTextColor } from "../utils/clusterColors";
import { buildMarkerPlacementMap } from "../utils/markerPlacement";
import { RouteReportDelivery } from "../utils/routeReportData";

interface RouteOverviewMapProps {
  routeId: string;
  deliveries: RouteReportDelivery[];
}

interface PixelPoint {
  x: number;
  y: number;
}

interface MapTile extends PixelPoint {
  key: string;
  src: string;
}

interface MapMarker extends PixelPoint {
  id: string;
}

const TILE_SIZE = 256;
const TILE_OVERSCAN = 2;
const MAP_HEIGHT = 245;
const DEFAULT_MAP_WIDTH = 720;
const DC_INSET_SIZE = 132;
const DC_INSET_ZOOM = 9;
const MAP_PADDING = 20;
const MAX_ZOOM = 14;
const DC_CENTER = { lat: 38.895, lng: -77.036942 };

export const getRouteMarkerColors = (routeId: string) => {
  const backgroundColor = getClusterColor(routeId);

  return {
    backgroundColor,
    textColor: getClusterTextColor(backgroundColor),
  };
};

const projectCoordinate = (lat: number, lng: number, zoom: number): PixelPoint => {
  const scale = TILE_SIZE * 2 ** zoom;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sine = Math.sin((latitude * Math.PI) / 180);

  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale,
  };
};

const chooseZoom = (points: Array<{ lat: number; lng: number }>, width: number): number => {
  if (points.length <= 1) return points.length === 1 ? MAX_ZOOM : 11;

  for (let zoom = MAX_ZOOM; zoom >= 1; zoom -= 1) {
    const projected = points.map((point) => projectCoordinate(point.lat, point.lng, zoom));
    const xValues = projected.map(({ x }) => x);
    const yValues = projected.map(({ y }) => y);
    const spanX = Math.max(...xValues) - Math.min(...xValues);
    const spanY = Math.max(...yValues) - Math.min(...yValues);

    if (spanX <= width - MAP_PADDING * 2 && spanY <= MAP_HEIGHT - MAP_PADDING * 2) return zoom;
  }

  return 1;
};

export const buildStaticMapLayout = (
  deliveries: RouteReportDelivery[],
  width: number
): { tiles: MapTile[]; markers: MapMarker[] } => {
  const placements = buildMarkerPlacementMap(deliveries);
  const points = deliveries
    .map((delivery) => {
      const point = placements.get(delivery.id);
      return point ? { id: delivery.id, ...point } : null;
    })
    .filter(
      (point): point is { id: string; lat: number; lng: number } => point !== null
    );
  const zoom = chooseZoom(points, width);
  const projected = points.map((point) => ({
    ...point,
    ...projectCoordinate(point.lat, point.lng, zoom),
  }));
  const fallbackCenter = projectCoordinate(DC_CENTER.lat, DC_CENTER.lng, zoom);
  const center = projected.length
    ? {
        x: (Math.min(...projected.map(({ x }) => x)) + Math.max(...projected.map(({ x }) => x))) / 2,
        y: (Math.min(...projected.map(({ y }) => y)) + Math.max(...projected.map(({ y }) => y))) / 2,
      }
    : fallbackCenter;
  const origin = { x: center.x - width / 2, y: center.y - MAP_HEIGHT / 2 };
  const tileCount = 2 ** zoom;
  const tiles: MapTile[] = [];
  const startTileX = Math.floor(origin.x / TILE_SIZE) - TILE_OVERSCAN;
  const endTileX = Math.floor((origin.x + width) / TILE_SIZE) + TILE_OVERSCAN;
  const startTileY = Math.max(0, Math.floor(origin.y / TILE_SIZE) - TILE_OVERSCAN);
  const endTileY = Math.min(
    tileCount - 1,
    Math.floor((origin.y + MAP_HEIGHT) / TILE_SIZE) + TILE_OVERSCAN
  );

  for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
    for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
      const wrappedTileX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${wrappedTileX}-${tileY}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrappedTileX}/${tileY}.png`,
        x: tileX * TILE_SIZE - origin.x,
        y: tileY * TILE_SIZE - origin.y,
      });
    }
  }

  return {
    tiles,
    markers: projected.map(({ id, x, y }) => ({
      id,
      x: x - origin.x,
      y: y - origin.y,
    })),
  };
};

export const buildDcInsetMapLayout = (
  deliveries: RouteReportDelivery[]
): { tiles: MapTile[]; markers: MapMarker[] } => {
  const placements = buildMarkerPlacementMap(deliveries);
  const zoom = DC_INSET_ZOOM;
  const center = projectCoordinate(DC_CENTER.lat, DC_CENTER.lng, zoom);
  const origin = {
    x: center.x - DC_INSET_SIZE / 2,
    y: center.y - DC_INSET_SIZE / 2,
  };
  const tileCount = 2 ** zoom;
  const tiles: MapTile[] = [];
  const startTileX = Math.floor(origin.x / TILE_SIZE) - TILE_OVERSCAN;
  const endTileX = Math.floor((origin.x + DC_INSET_SIZE) / TILE_SIZE) + TILE_OVERSCAN;
  const startTileY = Math.max(0, Math.floor(origin.y / TILE_SIZE) - TILE_OVERSCAN);
  const endTileY = Math.min(
    tileCount - 1,
    Math.floor((origin.y + DC_INSET_SIZE) / TILE_SIZE) + TILE_OVERSCAN
  );

  for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
    for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
      const wrappedTileX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `inset-${zoom}-${wrappedTileX}-${tileY}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrappedTileX}/${tileY}.png`,
        x: tileX * TILE_SIZE - origin.x,
        y: tileY * TILE_SIZE - origin.y,
      });
    }
  }

  const markers = deliveries.flatMap((delivery) => {
    const point = placements.get(delivery.id);
    if (!point) return [];

    const projected = projectCoordinate(point.lat, point.lng, zoom);
    return [{ id: delivery.id, x: projected.x - origin.x, y: projected.y - origin.y }];
  });

  return { tiles, markers };
};

export default function RouteOverviewMap({ routeId, deliveries }: RouteOverviewMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapWidth, setMapWidth] = useState(DEFAULT_MAP_WIDTH);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      if (container.clientWidth > 0) setMapWidth(container.clientWidth);
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { backgroundColor, textColor } = getRouteMarkerColors(routeId);
  const layout = useMemo(
    () => buildStaticMapLayout(deliveries, mapWidth),
    [deliveries, mapWidth]
  );
  const insetLayout = useMemo(() => buildDcInsetMapLayout(deliveries), [deliveries]);

  const mappedDeliveryCount = deliveries.filter((delivery) =>
    isRenderableCoordinate(delivery.coordinates)
  ).length;

  return (
    <section className="route-report-map-section" aria-label={`Route ${routeId} overview map`}>
      <div ref={containerRef} className="route-report-map">
        {layout.tiles.map((tile) => (
          <img
            key={tile.key}
            className="route-report-map-tile"
            src={tile.src}
            alt=""
            draggable={false}
            style={{ left: tile.x, top: tile.y }}
          />
        ))}
        {layout.markers.map((marker) => (
          <span
            key={marker.id}
            className="route-report-map-marker-container"
            style={{ left: marker.x, top: marker.y }}
          >
            <span
              className="route-report-map-marker"
              style={
                {
                  "--route-marker-color": backgroundColor,
                  "--route-marker-text-color": textColor,
                } as React.CSSProperties
              }
            >
              {routeId}
            </span>
          </span>
        ))}
        <aside className="route-report-map-inset" aria-label="Route location within Washington, DC">
          <div className="route-report-map-inset-viewport">
            {insetLayout.tiles.map((tile) => (
              <img
                key={tile.key}
                className="route-report-map-tile"
                src={tile.src}
                alt=""
                draggable={false}
                style={{ left: tile.x, top: tile.y }}
              />
            ))}
            {insetLayout.markers.map((marker) => (
              <span
                key={marker.id}
                className="route-report-map-inset-marker"
                style={
                  {
                    left: marker.x,
                    top: marker.y,
                    "--route-marker-color": backgroundColor,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </aside>
        <span className="route-report-map-attribution">© OpenStreetMap contributors</span>
      </div>
      {mappedDeliveryCount < deliveries.length ? (
        <p className="route-report-map-note">
          {deliveries.length - mappedDeliveryCount} delivery
          {deliveries.length - mappedDeliveryCount === 1 ? " is" : "ies are"} not shown because
          location coordinates are unavailable.
        </p>
      ) : null}
    </section>
  );
}