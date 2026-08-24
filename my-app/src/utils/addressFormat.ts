const DIRECTION_TO_ABBREVIATION: Record<string, string> = {
  northeast: "NE",
  northwest: "NW",
  southeast: "SE",
  southwest: "SW",
};

const QUADRANT_TOKEN_REGEX = /\b(NE|NW|SE|SW)\b/i;
const UNIT_MARKER_REGEX =
  /(?:^|[\s,])((?:(?:apt(?:artment)?|unit|suite|ste)\.?(?=\s|#)|#))\s*#?\s*/i;

const normalizeAddressSpacing = (value: string): string =>
  value.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();

const formatUnit = (marker: string, identifier: string): string => {
  const normalizedMarker = marker.toLowerCase().replace(".", "");
  const label = normalizedMarker.startsWith("apt")
    ? "Apt"
    : normalizedMarker === "suite" || normalizedMarker === "ste"
      ? "Suite"
      : "Unit";
  return `${label} ${identifier}`;
};

export const splitAddressUnit = (
  address: unknown,
  address2: unknown = ""
): { address: string; address2: string } => {
  const street = typeof address === "string" ? address : "";
  const existingUnit = typeof address2 === "string" ? normalizeAddressSpacing(address2) : "";
  const markerMatch = UNIT_MARKER_REGEX.exec(street);

  if (!markerMatch || markerMatch.index === undefined) {
    return { address: normalizeAddressSpacing(street), address2: existingUnit };
  }

  const remainderStart = markerMatch.index + markerMatch[0].length;
  const remainder = street.slice(remainderStart);
  const identifierMatch = remainder.match(
    /^(\d+[A-Za-z]?(?:-[A-Za-z0-9]+)?)(?=\s|$|[A-Z][a-z])|^([A-Za-z][A-Za-z0-9-]*)(?=\s|$)/
  );
  const identifier = identifierMatch?.[1] ?? identifierMatch?.[2];

  if (!identifier) {
    return { address: normalizeAddressSpacing(street), address2: existingUnit };
  }

  const beforeUnit = street.slice(0, markerMatch.index);
  const afterUnit = remainder.slice(identifier.length);
  return {
    address: normalizeAddressSpacing(`${beforeUnit} ${afterUnit}`),
    address2: formatUnit(markerMatch[1], identifier),
  };
};

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

export const replaceAddressQuadrant = (address: unknown, quadrant: unknown): string => {
  const baseAddress = typeof address === "string" ? standardizeAddressDirections(address).trim() : "";
  const normalizedQuadrant = normalizeQuadrantToken(quadrant);

  if (!baseAddress || !normalizedQuadrant) {
    return baseAddress;
  }

  if (QUADRANT_TOKEN_REGEX.test(baseAddress)) {
    return baseAddress.replace(QUADRANT_TOKEN_REGEX, normalizedQuadrant);
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
