import { hasAssignmentValue, resolveAssignmentValue } from "./assignmentOverrides";

interface AssignmentCluster {
  id: string;
  driver?: string;
  time?: string;
}

interface AssignmentClusterWithDeliveries extends AssignmentCluster {
  deliveries?: string[];
}

interface AssignmentOverride {
  clientId: string;
  driver?: string;
  time?: string;
}

export interface AssignmentSummary {
  total: number;
  assigned: number;
  remaining: number;
  done: boolean;
}

export interface ClusterSummary {
  clusterId: string;
  count: number;
  driverLabel: string;
  timeLabel: string;
}

export type ClusterSummarySortMode = "cluster" | "count-desc" | "count-asc";
export type ClusterSummarySortDirection = "asc" | "desc";

const sortClusterIds = (left: string, right: string): number => {
  const leftNumber = parseInt(left.match(/\d+/)?.[0] || "0", 10);
  const rightNumber = parseInt(right.match(/\d+/)?.[0] || "0", 10);

  return leftNumber - rightNumber || left.localeCompare(right);
};

export const sortClusterSummaries = (
  summaries: ClusterSummary[],
  sortMode: ClusterSummarySortMode = "cluster",
  sortDirection?: ClusterSummarySortDirection
): ClusterSummary[] => {
  const isCountSort = sortMode === "count-desc" || sortMode === "count-asc";
  const resolvedSortDirection = sortDirection ?? (sortMode === "count-asc" ? "asc" : "desc");
  const directionMultiplier = resolvedSortDirection === "asc" ? 1 : -1;

  return [...summaries].sort((left, right) => {
    if (isCountSort) {
      const countDiff = (left.count - right.count) * directionMultiplier;
      if (countDiff !== 0) {
        return countDiff;
      }
    } else {
      const clusterDiff = sortClusterIds(left.clusterId, right.clusterId) * directionMultiplier;
      if (clusterDiff !== 0) {
        return clusterDiff;
      }
    }

    return sortClusterIds(left.clusterId, right.clusterId);
  });
};

export const buildAssignmentSummary = <
  TRow extends { id: string },
  TCluster extends AssignmentCluster,
  TOverride extends AssignmentOverride,
>(
  rows: TRow[],
  clusterByClientId: Map<string, TCluster>,
  clientOverrideByClientId: Map<string, TOverride>
): AssignmentSummary => {
  let assigned = 0;

  rows.forEach((row) => {
    const override = clientOverrideByClientId.get(row.id);
    const cluster = clusterByClientId.get(row.id);
    const effectiveDriver = resolveAssignmentValue(override?.driver, cluster?.driver);
    const effectiveTime = resolveAssignmentValue(override?.time, cluster?.time);

    if (hasAssignmentValue(effectiveDriver) && hasAssignmentValue(effectiveTime)) {
      assigned += 1;
    }
  });

  const total = rows.length;
  const remaining = Math.max(total - assigned, 0);

  return {
    total,
    assigned,
    remaining,
    done: total > 0 && remaining === 0,
  };
};

export const buildClusterSummaries = <
  TRow extends { id: string },
  TCluster extends AssignmentCluster,
  TOverride extends AssignmentOverride,
>(
  rows: TRow[],
  clusterByClientId: Map<string, TCluster>,
  clientOverrideByClientId: Map<string, TOverride>,
  formatTimeLabel: (time: string) => string
): ClusterSummary[] => {
  const summaryMap = new Map<string, { count: number; drivers: Set<string>; times: Set<string> }>();

  rows.forEach((row) => {
    const cluster = clusterByClientId.get(row.id);
    const clusterId = cluster?.id;

    if (!clusterId) {
      return;
    }

    const override = clientOverrideByClientId.get(row.id);
    const effectiveDriver = resolveAssignmentValue(override?.driver, cluster?.driver);
    const effectiveTime = resolveAssignmentValue(override?.time, cluster?.time);

    const current = summaryMap.get(clusterId) || {
      count: 0,
      drivers: new Set<string>(),
      times: new Set<string>(),
    };

    current.count += 1;

    if (hasAssignmentValue(effectiveDriver)) {
      current.drivers.add(effectiveDriver!);
    }

    if (hasAssignmentValue(effectiveTime)) {
      current.times.add(effectiveTime!);
    }

    summaryMap.set(clusterId, current);
  });

  return sortClusterSummaries(
    Array.from(summaryMap.entries()).map(([clusterId, values]) => ({
      clusterId,
      count: values.count,
      driverLabel:
        values.drivers.size === 0
          ? "No driver"
          : values.drivers.size === 1
            ? Array.from(values.drivers)[0]
            : "Mixed drivers",
      timeLabel:
        values.times.size === 0
          ? "No time"
          : values.times.size === 1
            ? formatTimeLabel(Array.from(values.times)[0])
            : "Mixed times",
    })),
    "cluster",
    "asc"
  );
};

export const buildClusterSummariesFromClusters = <
  TCluster extends AssignmentClusterWithDeliveries,
  TOverride extends AssignmentOverride,
>(
  clusters: TCluster[],
  clientOverrideByClientId: Map<string, TOverride>,
  formatTimeLabel: (time: string) => string
): ClusterSummary[] => {
  return sortClusterSummaries(
    clusters
      .map((cluster) => {
        const clusterId = String(cluster.id ?? "").trim();
        const clientIds = Array.from(
          new Set(
            (cluster.deliveries ?? [])
              .map((clientId) => String(clientId ?? "").trim())
              .filter(Boolean)
          )
        );

        if (!clusterId || clientIds.length === 0) {
          return null;
        }

        const drivers = new Set<string>();
        const times = new Set<string>();

        clientIds.forEach((clientId) => {
          const override = clientOverrideByClientId.get(clientId);
          const effectiveDriver = resolveAssignmentValue(override?.driver, cluster.driver);
          const effectiveTime = resolveAssignmentValue(override?.time, cluster.time);

          if (hasAssignmentValue(effectiveDriver)) {
            drivers.add(effectiveDriver!);
          }

          if (hasAssignmentValue(effectiveTime)) {
            times.add(effectiveTime!);
          }
        });

        return {
          clusterId,
          count: clientIds.length,
          driverLabel:
            drivers.size === 0
              ? "No driver"
              : drivers.size === 1
                ? Array.from(drivers)[0]
                : "Mixed drivers",
          timeLabel:
            times.size === 0
              ? "No time"
              : times.size === 1
                ? formatTimeLabel(Array.from(times)[0])
                : "Mixed times",
        };
      })
      .filter((summary): summary is ClusterSummary => summary !== null),
    "cluster",
    "asc"
  );
};
