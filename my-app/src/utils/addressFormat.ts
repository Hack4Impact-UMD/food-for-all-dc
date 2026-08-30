const DIRECTION_TO_ABBREVIATION: Record<string, string> = {
  northeast: "NE",
  northwest: "NW",
  southeast: "SE",
  southwest: "SW",
};

const QUADRANT_TOKEN_REGEX = /\b(NE|NW|SE|SW)\b/i;
const UNIT_TOKEN_REGEX = /(?:\b(?:apartment|apt|unit|suite|ste|room|floor|fl)\b|#)\s*(?:no|number)?\s*#?\s*([a-z0-9-]+)/i;

const STREET_SUFFIX_ABBREVIATIONS: Record<string, string> = {
  avenue: "ave",
  boulevard: "blvd",
  circle: "cir",
  court: "ct",
  drive: "dr",
  highway: "hwy",
  lane: "ln",
  parkway: "pkwy",
  place: "pl",
  road: "rd",
  street: "st",
  terrace: "ter",
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

const normalizeAddressWords = (value: unknown): string => {
  if (typeof value !== "string") return "";

  return standardizeAddressDirections(value)
    .toLowerCase()
    .replace(/\b(avenue|boulevard|circle|court|drive|highway|lane|parkway|place|road|street|terrace)\b/g,
      (suffix) => STREET_SUFFIX_ABBREVIATIONS[suffix] ?? suffix
    )
    .replace(/[^a-z0-9#-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
};

const extractUnit = (value: unknown): string => {
  const normalized = normalizeAddressWords(value);
  if (!normalized) return "";
  const match = normalized.match(UNIT_TOKEN_REGEX);
  return match?.[1]?.replace(/[^a-z0-9]/g, "") ?? "";
};

export interface DuplicateAddressIdentity {
  street: string;
  unit: string;
}

export const normalizeDuplicateAddress = ({
  address,
  address2,
  quadrant,
}: {
  address: unknown;
  address2: unknown;
  quadrant: unknown;
}): DuplicateAddressIdentity => {
  const addressWithQuadrant = formatAddressWithQuadrant(address, quadrant);
  const normalizedAddress = normalizeAddressWords(addressWithQuadrant);
  const addressUnit = extractUnit(normalizedAddress);
  const address2Unit = extractUnit(address2);
  const normalizedAddress2 = normalizeAddressWords(address2);
  const unit = address2Unit || (normalizedAddress2 ? normalizedAddress2.replace(/[^a-z0-9]/g, "") : "") || addressUnit;
  const street = normalizedAddress.replace(UNIT_TOKEN_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    street,
    unit,
  };
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
