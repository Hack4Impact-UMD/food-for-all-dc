export const normalizeAssignmentValue = (value?: string): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : undefined;
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
