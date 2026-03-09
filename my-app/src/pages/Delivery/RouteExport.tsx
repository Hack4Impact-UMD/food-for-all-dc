import { saveAs } from "file-saver";
import Papa from "papaparse";
import { Cluster } from "./DeliverySpreadsheet";
import { RowData } from "./types/deliveryTypes";
import { getExportConfig } from "../../config/exportConfig";
import { normalizeCsvRows, sanitizeFilename } from "../../utils/csvExport";
import { formatDietaryRestrictionsForExport } from "../../utils/exportFormatters";
import {
  ClientOverride,
  normalizeAssignmentValue,
  normalizeDriverAssignmentValue,
  resolveAssignmentValue,
} from "./utils/assignmentOverrides";

export interface ExportFeedback {
  status: "success" | "error" | "warning" | "info";
  message: string;
}

const getClusterForRow = (clusters: Cluster[], rowId: string) =>
  clusters.find((cluster) => cluster.deliveries?.includes(rowId));

const getClientOverrideForRow = (clientOverrides: ClientOverride[], rowId: string) =>
  clientOverrides.find((override) => override.clientId === rowId);

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

const formatAssignedTime = (time?: string): string => {
  const normalizedTime = normalizeAssignmentValue(time);
  if (!normalizedTime) {
    return "No time assigned";
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

const buildFeedbackMessage = (baseMessage: string, skippedReasonCounts: Map<string, number>) => {
  const skippedCount = Array.from(skippedReasonCounts.values()).reduce(
    (total, count) => total + count,
    0
  );

  if (skippedCount === 0 || skippedReasonCounts.size === 0) {
    return baseMessage;
  }

  const skippedReasons = Array.from(skippedReasonCounts.entries())
    .map(([reason, count]) => `${reason} (${count})`)
    .join("; ");

  return `${baseMessage} Skipped ${skippedCount} deliveries: ${skippedReasons}.`;
};

const buildRouteCsvRow = (
  row: RowData,
  deliveryDate: string,
  clusters: Cluster[],
  clientOverrides: ClientOverride[]
) => {
  const cluster = getClusterForRow(clusters, row.id);
  const rowData = row as RowData & {
    quadrant?: string;
    adults?: number;
    children?: number;
    total?: number;
  };

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
    dietaryPreferences: formatDietaryRestrictionsForExport(
      row.deliveryDetails?.dietaryRestrictions
    ),
    tefapFY25: row.tags?.includes("Tefap") ? "Y" : "N",
    deliveryDate,
    cluster: cluster?.id || row.clusterId || "",
    time: formatAssignedTime(getEffectiveTime(row, clusters, clientOverrides)),
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
    label: `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`,
  };
};

const validateDoorDashRows = (
  rowsToExport: RowData[],
  clusters: Cluster[],
  clientOverrides: ClientOverride[],
  defaultCity: string,
  defaultState: string
): string | null => {
  const missingCounts = new Map<string, number>();

  const incrementMissing = (field: string) => {
    missingCounts.set(field, (missingCounts.get(field) || 0) + 1);
  };

  rowsToExport.forEach((row) => {
    const rowData = row as RowData & { city?: string; state?: string };
    const assignedTime = getEffectiveTime(row, clusters, clientOverrides);

    if (!normalizeAssignmentValue(assignedTime)) incrementMissing("assigned time");
    if (!row.firstName?.trim()) incrementMissing("first name");
    if (!row.lastName?.trim()) incrementMissing("last name");
    if (!buildDoorDashStreetAddress(row)) incrementMissing("street address");
    if (!(rowData.city || defaultCity)?.trim()) incrementMissing("city");
    if (!(rowData.state || defaultState)?.trim()) incrementMissing("state");
    if (!row.zipCode?.trim()) incrementMissing("ZIP code");
    if (!row.phone?.trim()) incrementMissing("phone");
  });

  if (missingCounts.size === 0) {
    return null;
  }

  const summary = Array.from(missingCounts.entries())
    .sort(([left], [right]) => compareText(left, right))
    .map(([field, count]) => `${field} (${count})`)
    .join(", ");

  return `Cannot export DoorDash deliveries. Missing required fields: ${summary}.`;
};

const buildDoorDashCsvRow = (row: RowData, deliveryDate: string, time: string) => {
  const config = getExportConfig();
  const rowData = row as RowData & { city?: string; state?: string };
  const city = rowData.city || config.doorDash.defaultCity;
  const state = rowData.state || config.doorDash.defaultState;
  const timeWindow = buildTimeWindow(time, config.doorDash.deliveryWindowHours);

  return {
    "Pickup Location ID*": config.doorDash.pickupLocationId,
    "Order ID*": "",
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
    "Pickup Location Name": config.organization.name,
    "Pickup Phone Number": config.organization.phone,
    "Pickup Instructions": config.organization.pickupInstructions,
    "Order Volume": config.doorDash.orderVolume,
    _timeLabel: timeWindow.label,
  };
};

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
      };
    }

    const unassignedRows = rowsToExport.filter((row) => !getClusterForRow(clusters, row.id));
    if (unassignedRows.length > 0) {
      return {
        status: "warning",
        message: `Cannot export: ${unassignedRows.length} ${
          unassignedRows.length === 1 ? "delivery is" : "deliveries are"
        } still unassigned.`,
      };
    }

    const rowsWithoutDriver = rowsToExport.filter(
      (row) => !getEffectiveDriver(row, clusters, clientOverrides)
    );
    if (rowsWithoutDriver.length > 0) {
      return {
        status: "warning",
        message: `Cannot export: ${rowsWithoutDriver.length} ${
          rowsWithoutDriver.length === 1 ? "delivery does" : "deliveries do"
        } not have an assigned driver.`,
      };
    }

    const groupedByDriver: Record<string, RowData[]> = {};
    rowsToExport.forEach((row) => {
      const driverName = getEffectiveDriver(row, clusters, clientOverrides) || "Unassigned";

      if (!groupedByDriver[driverName]) {
        groupedByDriver[driverName] = [];
      }

      groupedByDriver[driverName].push(row);
    });

    const driverNames = Object.keys(groupedByDriver).filter(
      (driverName) => driverName !== "Unassigned"
    );
    if (driverNames.length === 0) {
      return {
        status: "warning",
        message: "Cannot export: all selected deliveries are currently unassigned.",
      };
    }

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const config = getExportConfig();
    const skippedReasonCounts = new Map<string, number>();
    let filesCreated = 0;

    driverNames.sort(compareText).forEach((driverName) => {
      const csvData: Array<Record<string, unknown>> = [];

      sortRowsForExport(groupedByDriver[driverName]).forEach((row) => {
        try {
          csvData.push(buildRouteCsvRow(row, deliveryDate, clusters, clientOverrides));
        } catch (error) {
          recordSkippedReason(skippedReasonCounts, `invalid row data for ${driverName}`);
        }
      });

      if (csvData.length === 0) {
        return;
      }

      const csv = Papa.unparse(normalizeCsvRows(csvData));
      const fileName = sanitizeFilename(
        `${config.fileNamePrefix} ${deliveryDate} - ${driverName}.csv`
      );
      zip.file(fileName, csv);
      filesCreated += 1;
    });

    if (filesCreated === 0) {
      return {
        status: "warning",
        message: buildFeedbackMessage("No files could be created for export.", skippedReasonCounts),
      };
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, sanitizeFilename(`${config.fileNamePrefix} ${deliveryDate}.zip`));

    return {
      status: skippedReasonCounts.size > 0 ? "warning" : "success",
      message: buildFeedbackMessage(
        `ZIP file generated successfully with ${filesCreated} driver route(s)!`,
        skippedReasonCounts
      ),
    };
  } catch (error) {
    console.error("Error generating route ZIPs:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      status: "error",
      message: `An error occurred while generating route ZIPs: ${errorMessage}`,
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
      };
    }

    const unassignedRows = rowsToExport.filter((row) => !getClusterForRow(clusters, row.id));
    if (unassignedRows.length > 0) {
      return {
        status: "warning",
        message: `Cannot export: ${unassignedRows.length} ${
          unassignedRows.length === 1 ? "delivery is" : "deliveries are"
        } still unassigned.`,
      };
    }

    const doordashRows = rowsToExport.filter(
      (row) => getEffectiveDriver(row, clusters, clientOverrides) === "DoorDash"
    );

    if (doordashRows.length === 0) {
      return {
        status: "info",
        message: "No DoorDash deliveries found for the selected date.",
      };
    }

    const validationMessage = validateDoorDashRows(
      doordashRows,
      clusters,
      clientOverrides,
      config.doorDash.defaultCity,
      config.doorDash.defaultState
    );

    if (validationMessage) {
      return {
        status: "warning",
        message: validationMessage,
      };
    }

    const groupedByTime: Record<string, RowData[]> = {};
    doordashRows.forEach((row) => {
      const time = getEffectiveTime(row, clusters, clientOverrides);

      if (!groupedByTime[time]) {
        groupedByTime[time] = [];
      }

      groupedByTime[time].push(row);
    });

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    let filesCreated = 0;
    let orderIdCounter = 1;

    Object.keys(groupedByTime)
      .sort(compareTimes)
      .forEach((time) => {
        const csvData = sortRowsForExport(groupedByTime[time]).map((row) => ({
          ...buildDoorDashCsvRow(row, deliveryDate, time),
          "Order ID*": (orderIdCounter++).toString(),
        }));

        if (csvData.length === 0) {
          return;
        }

        const csvRows = csvData.map(({ _timeLabel, ...row }) => row);
        const csv = Papa.unparse(normalizeCsvRows(csvRows));
        const timeLabel =
          buildTimeWindow(time, config.doorDash.deliveryWindowHours).label || "Unscheduled";
        const fileName = sanitizeFilename(
          `${config.fileNamePrefix} ${deliveryDate} - DoorDash - ${timeLabel}.csv`
        );
        zip.file(fileName, csv);
        filesCreated += 1;
      });

    if (filesCreated === 0) {
      return {
        status: "warning",
        message: "No files could be created for DoorDash export.",
      };
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, sanitizeFilename(`${config.fileNamePrefix} ${deliveryDate} - DoorDash.zip`));

    return {
      status: "success",
      message: `DoorDash ZIP file generated successfully with ${filesCreated} time slot(s)!`,
    };
  } catch (error) {
    console.error("Error generating DoorDash ZIPs:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      status: "error",
      message: `An error occurred while generating DoorDash ZIPs: ${errorMessage}`,
    };
  }
};
