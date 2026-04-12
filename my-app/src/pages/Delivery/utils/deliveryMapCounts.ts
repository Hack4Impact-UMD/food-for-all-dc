export type CoordinateLike =
  | [number, number]
  | [number, number, number?]
  | []
  | { lat: number; lng: number }
  | null
  | undefined;

export interface DeliveryMapCountRow {
  id: string;
  coordinates?: CoordinateLike;
}

export interface DeliveryMapCountCluster {
  id: string;
  deliveries?: string[];
}

export type DominantCountSource = "overlay" | "spreadsheet" | "markers";
export type ClusterCountReason =
  | "match"
  | "missing-coordinates"
  | "filtered-out"
  | "missing-coordinates-and-filtered-out";

export interface ClusterCountSnapshot {
  clusterId: string;
  overlayCount: number;
  spreadsheetCount: number;
  markerCount: number;
  missingCoordinateCount: number;
  filteredOutCount: number;
  missingCoordinateClientIds: string[];
  filteredOutClientIds: string[];
  highestCount: number;
  highestCountSources: DominantCountSource[];
  reason: ClusterCountReason;
}

const normalizeClientId = (clientId: unknown): string => String(clientId ?? "").trim();

export const isRenderableCoordinate = (coord: CoordinateLike): boolean => {
  if (!coord) {
    return false;
  }

  if (Array.isArray(coord)) {
    return (
      coord.length === 2 &&
      typeof coord[0] === "number" &&
      typeof coord[1] === "number" &&
      Number.isFinite(coord[0]) &&
      Number.isFinite(coord[1]) &&
      Math.abs(coord[0]) <= 90 &&
      Math.abs(coord[1]) <= 180 &&
      (coord[0] !== 0 || coord[1] !== 0)
    );
  }

  return (
    typeof coord === "object" &&
    typeof coord.lat === "number" &&
    typeof coord.lng === "number" &&
    Number.isFinite(coord.lat) &&
    Number.isFinite(coord.lng) &&
    Math.abs(coord.lat) <= 90 &&
    Math.abs(coord.lng) <= 180 &&
    (coord.lat !== 0 || coord.lng !== 0)
  );
};

export const buildClusterCountSnapshot = <
  TRow extends DeliveryMapCountRow,
  TCluster extends DeliveryMapCountCluster,
>({
  clusterId,
  allRows,
  visibleRows,
  clusters,
}: {
  clusterId: string;
  allRows: TRow[];
  visibleRows: TRow[];
  clusters: TCluster[];
}): ClusterCountSnapshot => {
  const normalizedClusterId = String(clusterId ?? "").trim();
  const cluster = clusters.find(
    (candidate) => String(candidate.id ?? "").trim() === normalizedClusterId
  );

  const clusterClientIds = Array.from(
    new Set((cluster?.deliveries ?? []).map((clientId) => normalizeClientId(clientId)).filter(Boolean))
  );
  const clusterClientIdSet = new Set(clusterClientIds);
  const visibleClientIdSet = new Set(
    visibleRows.map((row) => normalizeClientId(row.id)).filter(Boolean)
  );
  const allClusterRows = allRows.filter((row) => clusterClientIdSet.has(normalizeClientId(row.id)));
  const visibleClusterRows = visibleRows.filter((row) =>
    clusterClientIdSet.has(normalizeClientId(row.id))
  );
  const missingCoordinateRows = visibleClusterRows.filter(
    (row) => !isRenderableCoordinate(row.coordinates)
  );
  const markerRows = visibleClusterRows.filter((row) => isRenderableCoordinate(row.coordinates));
  const filteredOutClientIds = Array.from(
    new Set(
      allClusterRows
        .map((row) => normalizeClientId(row.id))
        .filter((clientId) => !visibleClientIdSet.has(clientId))
    )
  );

  const counts: Record<DominantCountSource, number> = {
    overlay: clusterClientIds.length,
    spreadsheet: visibleClusterRows.length,
    markers: markerRows.length,
  };
  const highestCount = Math.max(...Object.values(counts));
  const highestCountSources = (Object.entries(counts) as Array<[DominantCountSource, number]>)
    .filter(([, count]) => count === highestCount)
    .map(([source]) => source);

  let reason: ClusterCountReason = "match";
  if (missingCoordinateRows.length > 0 && filteredOutClientIds.length > 0) {
    reason = "missing-coordinates-and-filtered-out";
  } else if (missingCoordinateRows.length > 0) {
    reason = "missing-coordinates";
  } else if (filteredOutClientIds.length > 0) {
    reason = "filtered-out";
  }

  return {
    clusterId: normalizedClusterId,
    overlayCount: clusterClientIds.length,
    spreadsheetCount: visibleClusterRows.length,
    markerCount: markerRows.length,
    missingCoordinateCount: missingCoordinateRows.length,
    filteredOutCount: filteredOutClientIds.length,
    missingCoordinateClientIds: missingCoordinateRows.map((row) => normalizeClientId(row.id)),
    filteredOutClientIds,
    highestCount,
    highestCountSources,
    reason,
  };
};