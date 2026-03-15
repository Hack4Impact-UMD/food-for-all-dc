import { HouseholdSnapshot } from "../types/delivery-types";

type HouseholdSnapshotSource = {
  adults?: unknown;
  children?: unknown;
  seniors?: unknown;
  total?: unknown;
};

const normalizeCount = (value: unknown): number => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.trunc(numericValue));
};

export const buildHouseholdSnapshot = (
  source: HouseholdSnapshotSource | null | undefined
): HouseholdSnapshot => {
  const adults = normalizeCount(source?.adults);
  const children = normalizeCount(source?.children);
  const seniors = normalizeCount(source?.seniors);

  return {
    adults,
    children,
    seniors,
    total: adults + children + seniors,
  };
};

export const normalizeHouseholdSnapshot = (
  snapshot: Partial<HouseholdSnapshot> | null | undefined
): HouseholdSnapshot | null => {
  if (!snapshot) {
    return null;
  }

  return buildHouseholdSnapshot(snapshot);
};
