const DIRECTION_TO_ABBREVIATION: Record<string, string> = {
  northeast: "NE",
  northwest: "NW",
  southeast: "SE",
  southwest: "SW",
};

const QUADRANT_TOKEN_REGEX = /\b(NE|NW|SE|SW)\b/i;

export const standardizeAddressDirections = (value: string): string =>
  value.replace(/\b(northwest|northeast|southwest|southeast)\b/gi, (match) =>
    DIRECTION_TO_ABBREVIATION[match.toLowerCase()] ?? match
  );

export const normalizeQuadrantToken = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  const standardized = standardizeAddressDirections(value).trim();
  const match = standardized.match(QUADRANT_TOKEN_REGEX);
  return match?.[1]?.toUpperCase() ?? "";
};

export const resolveAddressQuadrant = (address: unknown, quadrant: unknown): string =>
  normalizeQuadrantToken(address) || normalizeQuadrantToken(quadrant);

export const isStreetStyleAddress = (address: unknown): boolean =>
  typeof address === "string" && /\d/.test(address.trim());

export const formatAddressWithQuadrant = (address: unknown, quadrant: unknown): string => {
  const baseAddress = typeof address === "string" ? standardizeAddressDirections(address).trim() : "";
  const normalizedQuadrant = resolveAddressQuadrant(baseAddress, quadrant);

  if (!baseAddress) {
    return "";
  }

  if (
    !isStreetStyleAddress(baseAddress) ||
    !normalizedQuadrant ||
    normalizeQuadrantToken(baseAddress)
  ) {
    return baseAddress;
  }

  return `${baseAddress} ${normalizedQuadrant}`.trim();
};

export const formatAddressWithQuadrantAndUnit = (
  address: unknown,
  quadrant: unknown,
  address2: unknown
): string => {
  const street = formatAddressWithQuadrant(address, quadrant);
  const unit = typeof address2 === "string" ? address2.trim() : "";

  if (!street) {
    return unit;
  }

  if (!unit) {
    return street;
  }

  return `${street} ${unit}`.trim();
};

export const buildGeocodingAddress = ({
  address,
  quadrant,
  city,
  state,
  zipCode,
}: {
  address: unknown;
  quadrant: unknown;
  city: unknown;
  state: unknown;
  zipCode: unknown;
}): string => {
  const street = formatAddressWithQuadrant(address, quadrant);
  if (!isStreetStyleAddress(street)) {
    return "";
  }

  const resolvedQuadrant = resolveAddressQuadrant(address, quadrant);
  const normalizedCity = typeof city === "string" ? city.trim() : "";
  const normalizedState = typeof state === "string" ? state.trim() : "";

  return [
    street,
    normalizedCity || (resolvedQuadrant ? "Washington" : ""),
    normalizedState || (resolvedQuadrant ? "DC" : ""),
    typeof zipCode === "string" ? zipCode.trim() : "",
  ]
    .filter(Boolean)
    .join(", ");
};

type ClientLocation = Parameters<typeof buildGeocodingAddress>[0] & {
  address2?: unknown;
  coordinates?: unknown;
  ward?: unknown;
};

export const shouldGeocodeClientLocation = (
  current: ClientLocation,
  previous?: ClientLocation | null
): boolean => {
  const coordinates = current.coordinates;
  const hasValidCoordinates =
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every((value) => typeof value === "number" && Number.isFinite(value)) &&
    coordinates[0] !== 0 &&
    coordinates[1] !== 0;
  const hasValidWard =
    typeof current.ward === "string" && /^[1-8]$/.test(current.ward.trim());
  const addressChanged =
    !previous || buildGeocodingAddress(current) !== buildGeocodingAddress(previous);

  return addressChanged || !hasValidCoordinates || !hasValidWard;
};
