import { saveAs } from "file-saver";
import Papa from "papaparse";
import { Cluster } from "./DeliverySpreadsheet";
import { RowData } from "./types/deliveryTypes";
import { getExportConfig } from "../../config/exportConfig";
import { resolveAssignmentValue } from "./utils/assignmentOverrides";

const formatTime = (time: string): string => {
  if (!time) return "No time assigned";

  const [hours, minutes] = time.split(":");
  let hours12 = parseInt(hours, 10);
  const ampm = hours12 >= 12 ? "PM" : "AM";
  hours12 = hours12 % 12;
  hours12 = hours12 ? hours12 : 12;

  return `${hours12}:${minutes} ${ampm}`;
};

export interface ExportFeedback {
  status: "success" | "error" | "warning" | "info";
  message: string;
}

interface ClientOverride {
  clientId: string;
  driver?: string;
  time?: string;
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
  return resolveAssignmentValue(override?.driver, cluster?.driver) || "";
};

const getEffectiveTime = (
  row: RowData,
  clusters: Cluster[],
  clientOverrides: ClientOverride[]
): string => {
  const cluster = getClusterForRow(clusters, row.id);
  const override = getClientOverrideForRow(clientOverrides, row.id);
  return resolveAssignmentValue(override?.time, cluster?.time) || "";
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

    const rowsWithoutDriver = rowsToExport.filter((row) => {
      return !getEffectiveDriver(row, clusters, clientOverrides);
    });
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

    const driverNames = Object.keys(groupedByDriver);
    if (
      driverNames.length === 1 &&
      driverNames[0] === "Unassigned" &&
      groupedByDriver["Unassigned"].length > 0
    ) {
      return {
        status: "warning",
        message:
          "Cannot export: All selected deliveries are currently unassigned. Please assign drivers to clusters before exporting.",
      };
    }

    const JSZipDeliveries = (await import("jszip")).default;
    const zip = new JSZipDeliveries();
    let filesCreated = 0;

    for (const driverName in groupedByDriver) {
      if (driverName === "Unassigned") {
        continue;
      }

      const csvData = groupedByDriver[driverName]
        .map((row) => {
          try {
            const dietaryPreferences = row.deliveryDetails?.dietaryRestrictions
              ? Object.entries(row.deliveryDetails.dietaryRestrictions || {})
                  .filter(([key, value]) => value === true)
                  .map(([key]) => key)
                  .join(", ")
              : "";

            const cluster = getClusterForRow(clusters, row.id);
            const clusterNumber = cluster?.id || "";
            const assignedTime = formatTime(getEffectiveTime(row, clusters, clientOverrides));

            const rowData = row as any;

            return {
              firstName: row.firstName || "",
              lastName: row.lastName || "",
              address: row.address ? `${row.address}${row.address2 ? " " + row.address2 : ""}` : "",
              zip: row.zipCode || "",
              quadrant: rowData.quadrant || "",
              ward: row.ward || "",
              phone: row.phone || "",
              adults: rowData.adults || 0,
              children: rowData.children || 0,
              total: rowData.total || (rowData.adults || 0) + (rowData.children || 0),
              deliveryInstructions: row.deliveryDetails?.deliveryInstructions || "",
              dietaryPreferences: dietaryPreferences,
              tefapFY25: row.tags?.includes("Tefap") ? "Y" : "N",
              deliveryDate: deliveryDate,
              cluster: clusterNumber,
              time: assignedTime,
            };
          } catch (error) {
            console.error(`Error processing row ${row.id}:`, error);
            return null;
          }
        })
        .filter(Boolean);

      if (csvData.length === 0) {
        console.warn(`No valid data for driver: ${driverName}`);
        continue;
      }

      try {
        const config = getExportConfig();
        const csv = Papa.unparse(csvData);
        const fileName = `${config.fileNamePrefix} ${deliveryDate} - ${driverName}.csv`;
        zip.file(fileName, csv);
        filesCreated++;
      } catch (error) {
        console.error(`Error creating CSV for driver ${driverName}:`, error);
      }
    }

    if (filesCreated === 0) {
      return {
        status: "warning",
        message:
          "No files could be created for export. Please check that drivers are assigned and data is valid.",
      };
    }

    try {
      const config = getExportConfig();
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${config.fileNamePrefix} ${deliveryDate}.zip`);
      return {
        status: "success",
        message: `ZIP file generated successfully with ${filesCreated} driver route(s)!`,
      };
    } catch (error) {
      console.error("Error generating ZIP file:", error);
      return {
        status: "error",
        message: "Error generating ZIP file. Please try again.",
      };
    }
  } catch (error) {
    console.error("Error generating ZIPs:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      status: "error",
      message: `An error occurred while generating ZIPs: ${errorMessage}`,
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

    const unscheduledRows = doordashRows.filter(
      (row) => getEffectiveTime(row, clusters, clientOverrides).trim() === ""
    );

    if (unscheduledRows.length > 0) {
      return {
        status: "warning",
        message: `Cannot export: ${unscheduledRows.length} DoorDash deliveries do not have assigned times. Please assign times to all DoorDash deliveries before exporting.`,
      };
    }

    const formatTimeWindow = (time: string): { start: string; end: string } => {
      if (!time) return { start: "", end: "" };

      const [hours, minutes] = time.split(":");
      const hour = parseInt(hours, 10);
      const minute = parseInt(minutes, 10);

      const formatTime = (h: number, m: number) => {
        const hour12 = h % 12 || 12;
        const ampm = h >= 12 ? "PM" : "AM";
        return `${hour12}:${m.toString().padStart(2, "0")}:00 ${ampm}`;
      };

      const startTime = formatTime(hour, minute);
      const endTime = formatTime(hour + config.doorDash.deliveryWindowHours, minute);

      return { start: startTime, end: endTime };
    };

    const groupedByTime: Record<string, RowData[]> = {};
    doordashRows.forEach((row) => {
      const time = getEffectiveTime(row, clusters, clientOverrides);

      if (!groupedByTime[time]) {
        groupedByTime[time] = [];
      }
      groupedByTime[time].push(row);
    });

    const JSZipDoordash = (await import("jszip")).default;
    const zip = new JSZipDoordash();
    let filesCreated = 0;
    let orderIdCounter = 1; // Global order ID counter across all time slots

    for (const time in groupedByTime) {
      const timeWindow = formatTimeWindow(time);

      const csvData = groupedByTime[time]
        .map((row) => {
          try {
            const rowData = row as any;
            const city = rowData.city || config.doorDash.defaultCity;
            const state = rowData.state || config.doorDash.defaultState;
            const unit = rowData.address2 || "";
            const streetAddress = row.address
              ? `${row.address}${row.address2 ? " " + row.address2 : ""}`
              : "";

            return {
              "Pickup Location ID*": config.doorDash.pickupLocationId,
              "Order ID*": (orderIdCounter++).toString(),
              "Date of Delivery*": deliveryDate,
              "Pickup Window Start*": timeWindow.start,
              "Pickup Window End*": timeWindow.end,
              "Timezone*": config.doorDash.timezone,
              "Client First Name*": row.firstName || "",
              "Client Last Name*": row.lastName || "",
              "Client Street Address*": streetAddress,
              "Client Unit ": unit,
              "Client City*": city,
              "Client State*": state,
              "Client ZIP*": row.zipCode || "",
              "Client Phone*": row.phone || "",
              "Number of Items*": config.doorDash.numberOfItems,
              "Dropoff Instructions \n(250 character max)":
                row.deliveryDetails?.deliveryInstructions || "",
              "Pickup Location Name": config.organization.name,
              "Pickup Phone Number": config.organization.phone,
              "Pickup Instructions": config.organization.pickupInstructions,
              "Order Volume": config.doorDash.orderVolume,
            };
          } catch (error) {
            console.error(`Error processing row ${row.id}:`, error);
            return null;
          }
        })
        .filter(Boolean);

      if (csvData.length === 0) {
        console.warn(`No valid data for time: ${time}`);
        continue;
      }

      try {
        const csv = Papa.unparse(csvData);
        const [h, m] = time.split(":");
        const hour = parseInt(h, 10);
        const formattedTime = `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
        const fileName = `${config.fileNamePrefix} ${deliveryDate} - DoorDash - ${formattedTime}.csv`;
        zip.file(fileName, csv);
        filesCreated++;
      } catch (error) {
        console.error(`Error creating CSV for time ${time}:`, error);
      }
    }

    if (filesCreated === 0) {
      return {
        status: "warning",
        message:
          "No files could be created for export. Please check that times are assigned and data is valid.",
      };
    }

    try {
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${config.fileNamePrefix} ${deliveryDate} - DoorDash.zip`);
      return {
        status: "success",
        message: `DoorDash ZIP file generated successfully with ${filesCreated} time slot(s)!`,
      };
    } catch (error) {
      console.error("Error generating ZIP file:", error);
      return {
        status: "error",
        message: "Error generating ZIP file. Please try again.",
      };
    }
  } catch (error) {
    console.error("Error generating DoorDash ZIPs:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      status: "error",
      message: `An error occurred while generating DoorDash ZIPs: ${errorMessage}`,
    };
  }
};
