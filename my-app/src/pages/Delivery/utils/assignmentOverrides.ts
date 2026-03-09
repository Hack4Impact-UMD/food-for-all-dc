export interface ClientOverride {
  clientId: string;
  driver?: string;
  time?: string;
}

export const normalizeAssignmentValue = (value?: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : undefined;
};

export const normalizeDriverAssignmentValue = (value?: unknown): string | undefined => {
  if (typeof value === "string") {
    return normalizeAssignmentValue(value);
  }

  if (value && typeof value === "object" && "name" in value) {
    return normalizeAssignmentValue((value as { name?: unknown }).name);
  }

  return undefined;
};

export const resolveAssignmentValue = (
  overrideValue?: string,
  clusterValue?: string
): string | undefined => {
  return normalizeAssignmentValue(overrideValue) ?? normalizeAssignmentValue(clusterValue);
};

export const hasAssignmentValue = (value?: string): boolean => {
  return normalizeAssignmentValue(value) !== undefined;
};
