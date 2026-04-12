import { isRenderableCoordinate, type CoordinateLike } from "./deliveryMapCounts";

export interface MarkerPlacementRow {
  id: string;
  coordinates?: CoordinateLike;
}

export interface MarkerPoint {
  lat: number;
  lng: number;
}

const OVERLAP_RADIUS_DEGREES = 0.00018;
const COORDINATE_PRECISION = 6;

export const normalizeMarkerPoint = (coord: CoordinateLike): MarkerPoint | null => {
  if (!isRenderableCoordinate(coord)) {
    return null;
  }

  if (Array.isArray(coord)) {
    return { lat: coord[0] as number, lng: coord[1] as number };
  }

  return { lat: (coord as { lat: number; lng: number }).lat, lng: (coord as { lat: number; lng: number }).lng };
};

const getCoordinateKey = (point: MarkerPoint): string =>
  `${point.lat.toFixed(COORDINATE_PRECISION)},${point.lng.toFixed(COORDINATE_PRECISION)}`;

const getOffsetMarkerPoint = (
  point: MarkerPoint,
  occurrenceIndex: number,
  occurrenceCount: number
): MarkerPoint => {
  if (occurrenceCount <= 1) {
    return point;
  }

  const angle = (2 * Math.PI * occurrenceIndex) / occurrenceCount;
  const radius = OVERLAP_RADIUS_DEGREES;

  return {
    lat: point.lat + Math.sin(angle) * radius,
    lng: point.lng + Math.cos(angle) * radius,
  };
};

export const buildMarkerPlacementMap = <TRow extends MarkerPlacementRow>(
  rows: TRow[]
): Map<string, MarkerPoint> => {
  const validPoints = rows
    .map((row) => {
      const point = normalizeMarkerPoint(row.coordinates);
      return point ? { id: row.id, point } : null;
    })
    .filter((entry): entry is { id: string; point: MarkerPoint } => entry !== null);

  const coordinateCounts = new Map<string, number>();
  validPoints.forEach(({ point }) => {
    const key = getCoordinateKey(point);
    coordinateCounts.set(key, (coordinateCounts.get(key) ?? 0) + 1);
  });

  const coordinateOccurrences = new Map<string, number>();
  const placements = new Map<string, MarkerPoint>();

  validPoints.forEach(({ id, point }) => {
    const key = getCoordinateKey(point);
    const occurrenceIndex = coordinateOccurrences.get(key) ?? 0;
    const occurrenceCount = coordinateCounts.get(key) ?? 1;

    placements.set(id, getOffsetMarkerPoint(point, occurrenceIndex, occurrenceCount));
    coordinateOccurrences.set(key, occurrenceIndex + 1);
  });

  return placements;
};
