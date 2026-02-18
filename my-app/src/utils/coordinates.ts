export interface NormalizedCoordinate {
  lat: number;
  lng: number;
}

export type CoordinateObject = {
  lat?: unknown;
  lng?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

export type CoordinateValue = ReadonlyArray<unknown> | CoordinateObject | null | undefined;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const isInBounds = (lat: number, lng: number): boolean => {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
};

/**
 * Parse supported coordinate payload shapes into a canonical {lat, lng} object.
 * Returns null when values are missing, malformed, or out of bounds.
 */
export const normalizeCoordinate = (coord: CoordinateValue): NormalizedCoordinate | null => {
  if (!coord) return null;

  if (Array.isArray(coord)) {
    if (coord.length < 2) return null;
    const lat = toFiniteNumber(coord[0]);
    const lng = toFiniteNumber(coord[1]);
    if (lat === null || lng === null || !isInBounds(lat, lng)) return null;
    return { lat, lng };
  }

  const coordinateObject = coord as CoordinateObject;
  const lat = toFiniteNumber(coordinateObject.lat ?? coordinateObject.latitude);
  const lng = toFiniteNumber(coordinateObject.lng ?? coordinateObject.longitude);
  if (lat === null || lng === null || !isInBounds(lat, lng)) return null;

  return { lat, lng };
};

export const isValidCoordinate = (coord: CoordinateValue): boolean => {
  return normalizeCoordinate(coord) !== null;
};
