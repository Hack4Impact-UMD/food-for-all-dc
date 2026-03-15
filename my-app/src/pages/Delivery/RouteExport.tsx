import { saveAs } from "file-saver";
import Papa from "papaparse";
import { Cluster } from "./DeliverySpreadsheet";
import { RowData } from "./types/deliveryTypes";
import { getExportConfig } from "../../config/exportConfig";
import { normalizeCsvRows, sanitizeFilename } from "../../utils/csvExport";
import {
  ClientOverride,
  normalizeAssignmentValue,
  normalizeDriverAssignmentValue,
  resolveAssignmentValue,
} from "./utils/assignmentOverrides";

export interface ExportFeedback {
  status: "success" | "error" | "warning" | "info";
  message: string;
  generatedFileCount: number;
}

interface ExportGroup {
  driverLabel: string;
  timeValue: string;
  timeLabel: string;
  routeId: string;
  fileName: string;
  rows: RowData[];
}

interface RouteDietaryColumns {
  dietaryRestrictions: string;
  dietaryPreferences: string;
}

const ROUTE_DIETARY_LABELS: Array<[string, string]> = [
  ["halal", "halal"],
  ["kidneyFriendly", "kidney friendly"],
  ["lowSodium", "low sodium"],
  ["lowSugar", "low sugar"],
  ["microwaveOnly", "microwave only"],
  ["noCookingEquipment", "no cooking equipment"],
  ["softFood", "soft food"],
  ["vegan", "vegan"],
  ["vegetarian", "vegetarian"],
  ["heartFriendly", "heart friendly"],
];

const getClusterForRow = (clusters: Cluster[], rowId: string) =>
  clusters.find((cluster) => cluster.deliveries?.includes(rowId));

const getClientOverrideForRow = (clientOverrides: ClientOverride[], rowId: string) =>
  clientOverrides.find((override) => override.clientId === rowId);

const getRouteId = (row: RowData, clusters: Cluster[]) => {
  const cluster = getClusterForRow(clusters, row.id);
  const routeId = cluster?.id ?? row.clusterId;

  if (routeId === undefined || routeId === null) {
    return "";
  }

  return String(routeId).trim();
};

const getEffectiveDriver = (
  row: RowData,
  clusters: Cluster[],
  clientOverrides: ClientOverride[]
): string => {
  const cluster = getClusterForRow(clusters, row.id);
  const override = getClientOverrideForRow(clientOverrides, row.id);

  return (
    resolveAssignmentValue(override?.driver, normalizeDriverAssignmentValue(cluster?.driver)) || ""
  );
};

const getEffectiveTime = (
  row: RowData,
  clusters: Cluster[],
  clientOverrides: ClientOverride[]
): string => {
  const cluster = getClusterForRow(clusters, row.id);
  const override = getClientOverrideForRow(clientOverrides, row.id);

  return resolveAssignmentValue(override?.time, normalizeAssignmentValue(cluster?.time)) || "";
};

const compareText = (left: string, right: string) =>
  left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });

const compareTimes = (left: string, right: string) => {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  const [leftHours, leftMinutes] = left.split(":").map((value) => parseInt(value, 10));
  const [rightHours, rightMinutes] = right.split(":").map((value) => parseInt(value, 10));

  return leftHours * 60 + leftMinutes - (rightHours * 60 + rightMinutes);
};

const compareRouteIds = (left: string, right: string) => {
  const leftNumber = parseInt(left, 10);
  const rightNumber = parseInt(right, 10);

  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return compareText(left, right);
};

const sortRowsForExport = (rows: RowData[]) =>
  [...rows].sort((left, right) => {
    const lastNameComparison = compareText(left.lastName || "", right.lastName || "");
    if (lastNameComparison !== 0) {
      return lastNameComparison;
    }

    const firstNameComparison = compareText(left.firstName || "", right.firstName || "");
    if (firstNameComparison !== 0) {
      return firstNameComparison;
    }

    return compareText(left.address || "", right.address || "");
  });

const formatAssignedTime = (time?: string, fallback = "No time assigned"): string => {
  const normalizedTime = normalizeAssignmentValue(time);
  if (!normalizedTime) {
    return fallback;
  }

  const [hours, minutes] = normalizedTime.split(":");
  let hours12 = parseInt(hours, 10);
  const ampm = hours12 >= 12 ? "PM" : "AM";
  hours12 = hours12 % 12;
  hours12 = hours12 ? hours12 : 12;

  return `${hours12}:${minutes} ${ampm}`;
};

const truncateExportText = (value: string | undefined, maxLength: number): string =>
  (value || "").trim().slice(0, maxLength);

const buildDoorDashStreetAddress = (row: RowData): string => (row.address || "").trim();

const recordSkippedReason = (
  skippedReasonCounts: Map<string, number>,
  reason: string,
  count = 1
) => {
  skippedReasonCounts.set(reason, (skippedReasonCounts.get(reason) || 0) + count);
};

const buildFeedbackMessage = (
  baseMessage: string,
  skippedRowCount: number,
  skippedReasonCounts: Map<string, number>
) => {
  if (skippedRowCount === 0 || skippedReasonCounts.size === 0) {
    return baseMessage;
  }

  const skippedReasons = Array.from(skippedReasonCounts.entries())
    .map(([reason, count]) => `${reason} (${count})`)
    .join("; ");

  return `${baseMessage} Skipped ${skippedRowCount} ${
    skippedRowCount === 1 ? "delivery" : "deliveries"
  }: ${skippedReasons}.`;
};

const formatRouteDietaryColumns = (
  dietaryRestrictions:
    | {
        foodAllergens?: string[];
        other?: boolean;
        otherText?: string;
        dietaryPreferences?: string;
        [key: string]: unknown;
      }
    | undefined
): RouteDietaryColumns => {
  if (!dietaryRestrictions) {
    return {
      dietaryRestrictions: "",
      dietaryPreferences: "",
    };
  }

  const restrictionTokens = ROUTE_DIETARY_LABELS.filter(
    ([key]) => dietaryRestrictions[key] === true
  ).map(([, label]) => `[${label}]`);

  const segments = [
    restrictionTokens.join(","),
    (dietaryRestrictions.foodAllergens ?? []).length > 0
      ? `ALLERGIES:${(dietaryRestrictions.foodAllergens ?? []).join(",")}`
      : "",
    typeof dietaryRestrictions.otherText === "string" && dietaryRestrictions.otherText.trim() !== ""
      ? `OTHER:${dietaryRestrictions.otherText.trim()}`
      : "",
  ].filter(Boolean);

  const dietaryPreferences =
    typeof dietaryRestrictions.dietaryPreferences === "string"
      ? dietaryRestrictions.dietaryPreferences.trim()
      : "";

  return {
    dietaryRestrictions: segments.join(" "),
    dietaryPreferences,
  };
};

const buildRouteCsvRow = (
  row: RowData,
  deliveryDate: string,
  routeId: string,
  timeLabel: string
) => {
  const rowData = row as RowData & {
    quadrant?: string;
    adults?: number;
    children?: number;
    total?: number;
  };
  const dietaryColumns = formatRouteDietaryColumns(row.deliveryDetails?.dietaryRestrictions);

  return {
    firstName: row.firstName || "",
    lastName: row.lastName || "",
    address: row.address ? `${row.address}${row.address2 ? ` ${row.address2}` : ""}` : "",
    zip: row.zipCode || "",
    quadrant: rowData.quadrant || "",
    ward: row.ward || "",
    phone: row.phone || "",
    adults: rowData.adults ?? 0,
    children: rowData.children ?? 0,
    total: rowData.total ?? (rowData.adults ?? 0) + (rowData.children ?? 0),
    deliveryInstructions: row.deliveryDetails?.deliveryInstructions || "",
    dietaryRestrictions: dietaryColumns.dietaryRestrictions,
    dietaryPreferences: dietaryColumns.dietaryPreferences,
    tefapFY25: row.tags?.includes("Tefap") ? "Y" : "N",
    deliveryDate,
    cluster: routeId,
    time: timeLabel === "Unscheduled" ? "No time assigned" : timeLabel,
  };
};

const buildTimeWindow = (
  time: string,
  deliveryWindowHours: number
): { start: string; end: string; label: string } => {
  const normalizedTime = normalizeAssignmentValue(time);
  if (!normalizedTime) {
    return { start: "", end: "", label: "" };
  }

  const [hours, minutes] = normalizedTime.split(":");
  const hour = parseInt(hours, 10);
  const minute = parseInt(minutes, 10);

  const toDisplayTime = (nextHour: number, nextMinute: number) => {
    const hour12 = nextHour % 12 || 12;
    const ampm = nextHour >= 12 ? "PM" : "AM";
    return `${hour12}:${nextMinute.toString().padStart(2, "0")}:00 ${ampm}`;
  };

  return {
    start: toDisplayTime(hour, minute),
    end: toDisplayTime(hour + deliveryWindowHours, minute),
    label: formatAssignedTime(normalizedTime),
  };
};

const getDoorDashRowValidationErrors = (
  row: RowData,
  clusters: Cluster[],
  clientOverrides: ClientOverride[],
  defaultCity: string,
  defaultState: string
) => {
  const missingFields: string[] = [];
  const rowData = row as RowData & { city?: string; state?: string };
  const assignedTime = getEffectiveTime(row, clusters, clientOverrides);

  if (!normalizeAssignmentValue(assignedTime)) missingFields.push("assigned time");
  if (!row.firstName?.trim()) missingFields.push("first name");
  if (!row.lastName?.trim()) missingFields.push("last name");
  if (!buildDoorDashStreetAddress(row)) missingFields.push("street address");
  if (!(rowData.city || defaultCity)?.trim()) missingFields.push("city");
  if (!(rowData.state || defaultState)?.trim()) missingFields.push("state");
  if (!row.zipCode?.trim()) missingFields.push("ZIP code");
  if (!row.phone?.trim()) missingFields.push("phone");

  return missingFields;
};

const buildDoorDashCsvRow = (row: RowData, deliveryDate: string, time: string, orderId: string) => {
  const config = getExportConfig();
  const rowData = row as RowData & { city?: string; state?: string };
  const city = rowData.city || config.doorDash.defaultCity;
  const state = rowData.state || config.doorDash.defaultState;
  const timeWindow = buildTimeWindow(time, config.doorDash.deliveryWindowHours);

  return {
    "Pickup Location ID*": config.doorDash.pickupLocationId,
    "Order ID*": orderId,
    "Date of Delivery*": deliveryDate,
    "Pickup Window Start*": timeWindow.start,
    "Pickup Window End*": timeWindow.end,
    "Timezone*": config.doorDash.timezone,
    "Client First Name*": row.firstName || "",
    "Client Last Name*": row.lastName || "",
    "Client Street Address*": buildDoorDashStreetAddress(row),
    "Client Unit ": row.address2 || "",
    "Client City*": city,
    "Client State*": state,
    "Client ZIP*": row.zipCode || "",
    "Client Phone*": row.phone || "",
    "Number of Items*": config.doorDash.numberOfItems,
    "Dropoff Instructions \n(250 character max)": truncateExportText(
      row.deliveryDetails?.deliveryInstructions,
      config.doorDash.maxInstructionLength
    ),
    "Pickup Location Name": config.doorDash.pickupLocationName,
    "Pickup Phone Number": config.organization.phone,
    "Pickup Instructions": config.organization.pickupInstructions,
    "Order Volume": config.doorDash.orderVolume,
  };
};

const buildRouteFileName = (
  deliveryDate: string,
  driverLabel: string,
  timeLabel: string,
  routeId: string
) => {
  const config = getExportConfig();

  return sanitizeFilename(
    `${config.fileNamePrefix} ${deliveryDate} - ${driverLabel} - ${timeLabel} - Route ${routeId}.csv`
  );
};

const addRowToGroup = (
  groups: Map<string, ExportGroup>,
  deliveryDate: string,
  driverLabel: string,
  timeValue: string,
  timeLabel: string,
  routeId: string,
  row: RowData
) => {
  const key = [driverLabel, normalizeAssignmentValue(timeValue) || "", routeId].join("::");
  const existingGroup = groups.get(key);

  if (existingGroup) {
    existingGroup.rows.push(row);
    return;
  }

  groups.set(key, {
    driverLabel,
    timeValue: normalizeAssignmentValue(timeValue) || "",
    timeLabel,
    routeId,
    fileName: buildRouteFileName(deliveryDate, driverLabel, timeLabel, routeId),
    rows: [row],
  });
};

const sortExportGroups = (groups: ExportGroup[]) =>
  [...groups].sort((left, right) => {
    const driverComparison = compareText(left.driverLabel, right.driverLabel);
    if (driverComparison !== 0) {
      return driverComparison;
    }

    const timeComparison = compareTimes(left.timeValue, right.timeValue);
    if (timeComparison !== 0) {
      return timeComparison;
    }

    return compareRouteIds(left.routeId, right.routeId);
  });

export const exportDeliveries = async (
  deliveryDate: string,
  rowsToExport: RowData[],
  clusters: Cluster[],
  clientOverrides: ClientOverride[] = []
): Promise<ExportFeedback> => {
  try {
    if (rowsToExport.length === 0) {
      return {
        status: "info",
        message: "No deliveries selected or available for export on the selected date.",
        generatedFileCount: 0,
      };
    }

    const groups = new Map<string, ExportGroup>();
    const skippedReasonCounts = new Map<string, number>();
    let skippedRowCount = 0;

    rowsToExport.forEach((row) => {
      const routeId = getRouteId(row, clusters);
      if (!routeId) {
        skippedRowCount += 1;
        recordSkippedReason(skippedReasonCounts, "not assigned to a route");
        return;
      }

      const driverLabel = getEffectiveDriver(row, clusters, clientOverrides);
      if (!driverLabel) {
        skippedRowCount += 1;
        recordSkippedReason(skippedReasonCounts, "missing assigned driver");
        return;
      }

      const timeValue = getEffectiveTime(row, clusters, clientOverrides);
      const timeLabel = formatAssignedTime(timeValue, "Unscheduled");

      addRowToGroup(groups, deliveryDate, driverLabel, timeValue, timeLabel, routeId, row);
    });

    if (groups.size === 0) {
      return {
        status: "warning",
        message: buildFeedbackMessage(
          "No route files could be created for export.",
          skippedRowCount,
          skippedReasonCounts
        ),
        generatedFileCount: 0,
      };
    }

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    let filesCreated = 0;

    sortExportGroups(Array.from(groups.values())).forEach((group) => {
      const csvData: Array<Record<string, unknown>> = [];

      sortRowsForExport(group.rows).forEach((row) => {
        try {
          csvData.push(buildRouteCsvRow(row, deliveryDate, group.routeId, group.timeLabel));
        } catch (error) {
          skippedRowCount += 1;
          recordSkippedReason(skippedReasonCounts, `invalid row data for route ${group.routeId}`);
        }
      });

      if (csvData.length === 0) {
        return;
      }

      const csv = Papa.unparse(normalizeCsvRows(csvData));
      zip.file(group.fileName, csv);
      filesCreated += 1;
    });

    if (filesCreated === 0) {
      return {
        status: "warning",
        message: buildFeedbackMessage(
          "No route files could be created for export.",
          skippedRowCount,
          skippedReasonCounts
        ),
        generatedFileCount: 0,
      };
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, sanitizeFilename(`${getExportConfig().fileNamePrefix} ${deliveryDate}.zip`));

    return {
      status: skippedReasonCounts.size > 0 ? "warning" : "success",
      message: buildFeedbackMessage(
        `ZIP file generated successfully with ${filesCreated} route file(s)!`,
        skippedRowCount,
        skippedReasonCounts
      ),
      generatedFileCount: filesCreated,
    };
  } catch (error) {
    console.error("Error generating route ZIPs:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return {
      status: "error",
      message: `An error occurred while generating route ZIPs: ${errorMessage}`,
      generatedFileCount: 0,
    };
  }
};

export const exportDoordashDeliveries = async (
  deliveryDate: string,
  rowsToExport: RowData[],
  clusters: Cluster[],
  clientOverrides: ClientOverride[] = []
): Promise<ExportFeedback> => {
  try {
    const config = getExportConfig();

    if (rowsToExport.length === 0) {
      return {
        status: "info",
        message: "No deliveries selected or available for export on the selected date.",
        generatedFileCount: 0,
      };
    }

    const groups = new Map<string, ExportGroup>();
    const skippedReasonCounts = new Map<string, number>();
    let skippedRowCount = 0;

    rowsToExport.forEach((row) => {
      const driverLabel = getEffectiveDriver(row, clusters, clientOverrides);
      if (driverLabel !== "DoorDash") {
        skippedRowCount += 1;
        recordSkippedReason(skippedReasonCounts, "not assigned to DoorDash");
        return;
      }

      const routeId = getRouteId(row, clusters);
      if (!routeId) {
        skippedRowCount += 1;
        recordSkippedReason(skippedReasonCounts, "not assigned to a route");
        return;
      }

      const timeValue = getEffectiveTime(row, clusters, clientOverrides);
      const missingFields = getDoorDashRowValidationErrors(
        row,
        clusters,
        clientOverrides,
        config.doorDash.defaultCity,
        config.doorDash.defaultState
      );

      if (missingFields.length > 0) {
        skippedRowCount += 1;
        missingFields.forEach((field) => {
          recordSkippedReason(skippedReasonCounts, `missing ${field}`);
        });
        return;
      }

      addRowToGroup(
        groups,
        deliveryDate,
        "DoorDash",
        timeValue,
        buildTimeWindow(timeValue, config.doorDash.deliveryWindowHours).label,
        routeId,
        row
      );
    });

    if (groups.size === 0) {
      return {
        status: "warning",
        message: buildFeedbackMessage(
          "No DoorDash route files could be created for export.",
          skippedRowCount,
          skippedReasonCounts
        ),
        generatedFileCount: 0,
      };
    }

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    let filesCreated = 0;
    let orderIdCounter = 1;

    sortExportGroups(Array.from(groups.values())).forEach((group) => {
      const csvData = sortRowsForExport(group.rows).map((row) =>
        buildDoorDashCsvRow(row, deliveryDate, group.timeValue, String(orderIdCounter++))
      );

      if (csvData.length === 0) {
        return;
      }

      const csv = Papa.unparse(normalizeCsvRows(csvData));
      zip.file(group.fileName, csv);
      filesCreated += 1;
    });

    if (filesCreated === 0) {
      return {
        status: "warning",
        message: buildFeedbackMessage(
          "No DoorDash route files could be created for export.",
          skippedRowCount,
          skippedReasonCounts
        ),
        generatedFileCount: 0,
      };
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, sanitizeFilename(`${config.fileNamePrefix} ${deliveryDate} - DoorDash.zip`));

    return {
      status: skippedReasonCounts.size > 0 ? "warning" : "success",
      message: buildFeedbackMessage(
        `DoorDash ZIP file generated successfully with ${filesCreated} route file(s)!`,
        skippedRowCount,
        skippedReasonCounts
      ),
      generatedFileCount: filesCreated,
    };
  } catch (error) {
    console.error("Error generating DoorDash ZIPs:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return {
      status: "error",
      message: `An error occurred while generating DoorDash ZIPs: ${errorMessage}`,
      generatedFileCount: 0,
    };
  }
};
