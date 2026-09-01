import { RowData } from "../types/deliveryTypes";
import { normalizeDuplicateAddress } from "../../../utils/addressFormat";
import {
  ClientOverride,
  normalizeAssignmentValue,
  normalizeDriverAssignmentValue,
  resolveAssignmentValue,
} from "./assignmentOverrides";

export interface RouteReportCluster {
  id: string | number;
  driver?: unknown;
  time?: string;
  deliveries: string[];
}

export type RouteReportDelivery = RowData;

export interface DriverRouteReport {
  key: string;
  routeId: string;
  driverName: string;
  assignedTime: string;
  deliveryDate: string;
  deliveries: RouteReportDelivery[];
}

export type RouteReportIssueReason = "missing-route" | "missing-driver";

export interface RouteReportIssue {
  delivery: RowData;
  routeId: string;
  reason: RouteReportIssueReason;
}

export interface RouteReportData {
  reports: DriverRouteReport[];
  issues: RouteReportIssue[];
}

export type RouteReportType = "Routes" | "DoorDash";

const normalizeRouteId = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return normalizeAssignmentValue(value) || "";
};

const compareRouteIds = (left: string, right: string): number => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
};

const groupDeliveriesByStreet = (
  deliveries: RouteReportDelivery[]
): RouteReportDelivery[] => {
  const streetGroups = new Map<string, RouteReportDelivery[]>();

  deliveries.forEach((delivery) => {
    const { street } = normalizeDuplicateAddress({
      address: delivery.address,
      address2: delivery.address2,
      quadrant: delivery.quadrant,
    });
    const groupKey = street || `delivery:${delivery.id}`;
    const group = streetGroups.get(groupKey);

    if (group) {
      group.push(delivery);
    } else {
      streetGroups.set(groupKey, [delivery]);
    }
  });

  return Array.from(streetGroups.values()).flat();
};

export const prepareRouteReportData = (
  deliveryDate: string,
  rows: RowData[],
  clusters: RouteReportCluster[],
  clientOverrides: ClientOverride[] = []
): RouteReportData => {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const overridesByClientId = new Map(
    clientOverrides.map((override) => [override.clientId, override])
  );
  const reportsByKey = new Map<string, DriverRouteReport>();
  const issues: RouteReportIssue[] = [];
  const handledDeliveryIds = new Set<string>();

  clusters.forEach((cluster) => {
    const routeId = normalizeRouteId(cluster.id);
    if (!routeId) {
      return;
    }

    cluster.deliveries?.forEach((clientId) => {
      const delivery = rowsById.get(clientId);
      if (!delivery || handledDeliveryIds.has(clientId)) {
        return;
      }

      handledDeliveryIds.add(clientId);
      const override = overridesByClientId.get(clientId);
      const driverName =
        resolveAssignmentValue(
          override?.driver,
          normalizeDriverAssignmentValue(cluster.driver)
        ) || "";
      const assignedTime =
        resolveAssignmentValue(override?.time, normalizeAssignmentValue(cluster.time)) || "";

      if (!driverName) {
        issues.push({ delivery, routeId, reason: "missing-driver" });
        return;
      }

      const key = [routeId, driverName.toLocaleLowerCase(), assignedTime].join("::");
      const report = reportsByKey.get(key);

      if (report) {
        report.deliveries.push(delivery);
        return;
      }

      reportsByKey.set(key, {
        key,
        routeId,
        driverName,
        assignedTime,
        deliveryDate,
        deliveries: [delivery],
      });
    });
  });

  rows.forEach((delivery) => {
    if (!handledDeliveryIds.has(delivery.id)) {
      issues.push({ delivery, routeId: "", reason: "missing-route" });
    }
  });

  const reports = Array.from(reportsByKey.values()).map((report) => ({
    ...report,
    deliveries: groupDeliveriesByStreet(report.deliveries),
  })).sort((left, right) => {
    const routeComparison = compareRouteIds(left.routeId, right.routeId);
    if (routeComparison !== 0) {
      return routeComparison;
    }

    const driverComparison = left.driverName.localeCompare(right.driverName, undefined, {
      sensitivity: "base",
    });
    if (driverComparison !== 0) {
      return driverComparison;
    }

    return left.assignedTime.localeCompare(right.assignedTime);
  });

  return { reports, issues };
};

export const filterRowsForRouteReport = (
  rows: RowData[],
  clusters: RouteReportCluster[],
  clientOverrides: ClientOverride[],
  reportType: RouteReportType
): RowData[] => {
  const clustersByDeliveryId = new Map<string, RouteReportCluster>();
  clusters.forEach((cluster) => {
    cluster.deliveries?.forEach((clientId) => {
      if (!clustersByDeliveryId.has(clientId)) {
        clustersByDeliveryId.set(clientId, cluster);
      }
    });
  });
  const overridesByClientId = new Map(
    clientOverrides.map((override) => [override.clientId, override])
  );

  return rows.filter((row) => {
    const cluster = clustersByDeliveryId.get(row.id);
    const override = overridesByClientId.get(row.id);
    const driverName =
      resolveAssignmentValue(
        override?.driver,
        normalizeDriverAssignmentValue(cluster?.driver)
      ) || "";
    const isDoorDash = driverName.toLocaleLowerCase() === "doordash";

    return reportType === "DoorDash" ? isDoorDash : !isDoorDash;
  });
};