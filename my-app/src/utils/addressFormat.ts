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

export const formatAddressWithQuadrant = (address: unknown, quadrant: unknown): string => {
  const baseAddress = typeof address === "string" ? standardizeAddressDirections(address).trim() : "";
  const normalizedQuadrant = normalizeQuadrantToken(quadrant);

  if (!baseAddress) {
    return "";
  }

  if (!normalizedQuadrant || QUADRANT_TOKEN_REGEX.test(baseAddress)) {
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
