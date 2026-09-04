import React, { useEffect, useMemo, useRef, useState } from "react";
import { isRenderableCoordinate } from "../utils/deliveryMapCounts";
import { getClusterColor, getClusterTextColor } from "../utils/clusterColors";
import { buildMarkerPlacementMap } from "../utils/markerPlacement";
import { RouteReportDelivery } from "../utils/routeReportData";
import dataSources from "../../../config/dataSources";

interface RouteOverviewMapProps {
  routeId: string;
  deliveries: RouteReportDelivery[];
  /** Maps delivery id to its route id, for maps that combine multiple routes. */
  deliveryRouteIds?: Map<string, string>;
  /** Whether to render the small DC-location inset map in the corner. Defaults to true. */
  showInset?: boolean;
  /** Whether to draw the DC ward boundaries, colored the same as the routes map. Defaults to false. */
  showWardOverlays?: boolean;
  /** Zoom/center so DC's full boundary fills the box top-to-bottom, instead of fitting to the deliveries. Defaults to false. */
  fitToDcBounds?: boolean;
}

interface PixelPoint {
  x: number;
  y: number;
}

interface MapTile extends PixelPoint {
  key: string;
  src: string;
  size: number;
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
// Approximate bounding box of the Washington, DC "diamond" boundary.
const DC_BOUNDS = { north: 38.9958, south: 38.7916, east: -76.9094, west: -77.1198 };
const DC_FIT_PADDING = 0;
const DC_FIT_ZOOM_BOOST = 0;

// Same palette used for the ward overlays on the routes map.
const WARD_COLORS: { [key: string]: string } = {
  "1": "#FF0000",
  "2": "#00FF00",
  "3": "#0000FF",
  "4": "#FFFF00",
  "5": "#FF00FF",
  "6": "#00FFFF",
  "7": "#FFA500",
  "8": "#800080",
};

interface WardGeoJson {
  features: Array<{
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: unknown };
  }>;
}

// Module-level cache so every map on the page shares one fetch of the ward boundaries.
let wardBoundariesPromise: Promise<WardGeoJson | null> | null = null;

const fetchWardBoundaries = (): Promise<WardGeoJson | null> => {
  if (!wardBoundariesPromise) {
    const params = new URLSearchParams({
      f: "geojson",
      where: "1=1",
      outFields: "NAME,WARD",
      returnGeometry: "true",
    });

    wardBoundariesPromise = fetch(
      `${dataSources.externalApi.dcGisWardServiceUrl}?${params.toString()}`
    )
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }

  return wardBoundariesPromise;
};

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

const chooseDcFitZoom = (): number => {
  for (let zoom = MAX_ZOOM; zoom >= 1; zoom -= 1) {
    const north = projectCoordinate(DC_BOUNDS.north, DC_CENTER.lng, zoom);
    const south = projectCoordinate(DC_BOUNDS.south, DC_CENTER.lng, zoom);
    const spanY = Math.abs(south.y - north.y);

    if (spanY <= MAP_HEIGHT - DC_FIT_PADDING * 2) return Math.min(zoom + DC_FIT_ZOOM_BOOST, 18);
  }

  return 1;
};

export const buildStaticMapLayout = (
  deliveries: RouteReportDelivery[],
  width: number,
  options?: { fitToDcBounds?: boolean }
): {
  tiles: MapTile[];
  markers: MapMarker[];
  zoom: number;
  origin: PixelPoint;
  scale: number;
} => {
  const placements = buildMarkerPlacementMap(deliveries);
  const points = deliveries
    .map((delivery) => {
      const point = placements.get(delivery.id);
      return point ? { id: delivery.id, ...point } : null;
    })
    .filter(
      (point): point is { id: string; lat: number; lng: number } => point !== null
    );
  const zoom = options?.fitToDcBounds ? chooseDcFitZoom() : chooseZoom(points, width);
  const projected = points.map((point) => ({
    ...point,
    ...projectCoordinate(point.lat, point.lng, zoom),
  }));
  const fallbackCenter = projectCoordinate(DC_CENTER.lat, DC_CENTER.lng, zoom);
  const center = options?.fitToDcBounds
    ? projectCoordinate(
        (DC_BOUNDS.north + DC_BOUNDS.south) / 2,
        (DC_BOUNDS.east + DC_BOUNDS.west) / 2,
        zoom
      )
    : projected.length
      ? {
          x: (Math.min(...projected.map(({ x }) => x)) + Math.max(...projected.map(({ x }) => x))) / 2,
          y: (Math.min(...projected.map(({ y }) => y)) + Math.max(...projected.map(({ y }) => y))) / 2,
        }
      : fallbackCenter;

  // Tile zoom levels are discrete, so the best-fit zoom usually leaves a
  // small gap. Stretch the rendered layout by `scale` to close that gap and
  // make the DC boundary flush with the box edges.
  let scale = 1;
  if (options?.fitToDcBounds) {
    const north = projectCoordinate(DC_BOUNDS.north, DC_CENTER.lng, zoom);
    const south = projectCoordinate(DC_BOUNDS.south, DC_CENTER.lng, zoom);
    const actualSpanY = Math.abs(south.y - north.y);
    scale = actualSpanY > 0 ? MAP_HEIGHT / actualSpanY : 1;
  }

  const nativeVisibleWidth = width / scale;
  const nativeVisibleHeight = MAP_HEIGHT / scale;
  const origin = {
    x: center.x - nativeVisibleWidth / 2,
    y: center.y - nativeVisibleHeight / 2,
  };
  const toRender = (nativeX: number, nativeY: number): PixelPoint => ({
    x: (nativeX - origin.x) * scale,
    y: (nativeY - origin.y) * scale,
  });

  const tileCount = 2 ** zoom;
  const tiles: MapTile[] = [];
  const startTileX = Math.floor(origin.x / TILE_SIZE) - TILE_OVERSCAN;
  const endTileX = Math.floor((origin.x + nativeVisibleWidth) / TILE_SIZE) + TILE_OVERSCAN;
  const startTileY = Math.max(0, Math.floor(origin.y / TILE_SIZE) - TILE_OVERSCAN);
  const endTileY = Math.min(
    tileCount - 1,
    Math.floor((origin.y + nativeVisibleHeight) / TILE_SIZE) + TILE_OVERSCAN
  );

  for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
    for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
      const wrappedTileX = ((tileX % tileCount) + tileCount) % tileCount;
      const rendered = toRender(tileX * TILE_SIZE, tileY * TILE_SIZE);
      tiles.push({
        key: `${zoom}-${wrappedTileX}-${tileY}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrappedTileX}/${tileY}.png`,
        x: rendered.x,
        y: rendered.y,
        size: TILE_SIZE * scale,
      });
    }
  }

  return {
    tiles,
    markers: projected.map(({ id, x, y }) => ({ id, ...toRender(x, y) })),
    zoom,
    origin,
    scale,
  };
};

interface WardPath {
  key: string;
  d: string;
  color: string;
}

const ringToPathCommands = (
  ring: number[][],
  zoom: number,
  origin: PixelPoint,
  scale: number
): string =>
  ring
    .map(([lng, lat], index) => {
      const { x, y } = projectCoordinate(lat, lng, zoom);
      const renderX = (x - origin.x) * scale;
      const renderY = (y - origin.y) * scale;
      return `${index === 0 ? "M" : "L"}${renderX.toFixed(1)},${renderY.toFixed(1)}`;
    })
    .join(" ") + " Z";

export const buildWardOverlayPaths = (
  wardData: WardGeoJson | null,
  zoom: number,
  origin: PixelPoint,
  scale: number
): WardPath[] => {
  if (!wardData?.features) return [];

  return wardData.features.map((feature, index) => {
    const wardName =
      String((feature.properties as any)?.WARD ?? (feature.properties as any)?.NAME ?? "").match(
        /\d+/
      )?.[0] || "";
    const color = WARD_COLORS[wardName] || "#999999";
    const polygons: number[][][][] =
      feature.geometry.type === "MultiPolygon"
        ? (feature.geometry.coordinates as number[][][][])
        : [(feature.geometry.coordinates as number[][][]) || []];

    const d = polygons
      .flatMap((polygon) => polygon.map((ring) => ringToPathCommands(ring, zoom, origin, scale)))
      .join(" ");

    return { key: `ward-${wardName || index}`, d, color };
  });
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
        size: TILE_SIZE,
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

export default function RouteOverviewMap({
  routeId,
  deliveries,
  deliveryRouteIds,
  showInset = true,
  showWardOverlays = false,
  fitToDcBounds = false,
}: RouteOverviewMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapWidth, setMapWidth] = useState(DEFAULT_MAP_WIDTH);
  const [wardData, setWardData] = useState<WardGeoJson | null>(null);

  useEffect(() => {
    if (!showWardOverlays) return;
    let isMounted = true;
    fetchWardBoundaries().then((data) => {
      if (isMounted) setWardData(data);
    });
    return () => {
      isMounted = false;
    };
  }, [showWardOverlays]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      if (container.clientWidth > 0) setMapWidth(container.clientWidth);
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    // Printing can lay out the page at a different width than the screen
    // did, so recheck once the print stylesheet has applied.
    window.addEventListener("beforeprint", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", updateWidth);
    };
  }, []);

  const { backgroundColor, textColor } = getRouteMarkerColors(routeId);
  const layout = useMemo(
    () => buildStaticMapLayout(deliveries, mapWidth, { fitToDcBounds }),
    [deliveries, mapWidth, fitToDcBounds]
  );
  const insetLayout = useMemo(
    () => (showInset ? buildDcInsetMapLayout(deliveries) : { tiles: [], markers: [] }),
    [deliveries, showInset]
  );
  const wardPaths = useMemo(
    () =>
      showWardOverlays
        ? buildWardOverlayPaths(wardData, layout.zoom, layout.origin, layout.scale)
        : [],
    [showWardOverlays, wardData, layout.zoom, layout.origin, layout.scale]
  );

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
            style={{ left: tile.x, top: tile.y, width: tile.size, height: tile.size }}
          />
        ))}
        {wardPaths.length > 0 ? (
          <svg className="route-report-map-wards" width={mapWidth} height={MAP_HEIGHT}>
            {wardPaths.map((ward) => (
              <path
                key={ward.key}
                d={ward.d}
                fill={ward.color}
                fillOpacity={0.2}
                stroke={ward.color}
                strokeWidth={2}
                strokeOpacity={0.8}
              />
            ))}
          </svg>
        ) : null}
        {layout.markers.map((marker) => {
          const markerRouteId = deliveryRouteIds?.get(marker.id) ?? routeId;
          const markerColors = deliveryRouteIds
            ? getRouteMarkerColors(markerRouteId)
            : { backgroundColor, textColor };

          return (
            <span
              key={marker.id}
              className="route-report-map-marker-container"
              style={{ left: marker.x, top: marker.y }}
            >
              <span
                className="route-report-map-marker"
                style={
                  {
                    "--route-marker-color": markerColors.backgroundColor,
                    "--route-marker-text-color": markerColors.textColor,
                  } as React.CSSProperties
                }
              >
                {markerRouteId}
              </span>
            </span>
          );
        })}
        <aside
          className="route-report-map-inset"
          aria-label="Route location within Washington, DC"
          style={showInset ? undefined : { display: "none" }}
        >
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