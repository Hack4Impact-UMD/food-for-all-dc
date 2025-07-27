import { getFirestore, collection, getDocs } from "firebase/firestore";
// ...existing code...
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { Cluster } from "./DeliverySpreadsheet"; // Import Cluster type
import { RowData } from "./types/deliveryTypes"; // Import the correct type
import { getExportConfig } from "../../config/exportConfig"; // Import configuration

// Helper function to format time consistently
const formatTime = (time: string): string => {
  if (!time) return "No time assigned";

  // Convert 24-hour format to 12-hour AM/PM format
  const [hours, minutes] = time.split(":");
  let hours12 = parseInt(hours, 10);
  const ampm = hours12 >= 12 ? "PM" : "AM";
  hours12 = hours12 % 12;
  hours12 = hours12 ? hours12 : 12; // Convert 0 to 12 for 12 AM

  return `${hours12}:${minutes} ${ampm}`;
};

interface SpreadsheetClientProfile {
  uid: string;
  firstName: string;
  lastName: string;
  address: string;
  apt?: string;
  zip: string;
  quadrant?: string;
  ward?: string;
  phone: string;
  adults: number;
  children: number;
  total: number;
  deliveryInstructions?: string;
  dietaryPreferences?: string;
  tefapFY25?: string;
}

export const exportDeliveries = async (
  deliveryDate: string,
  rowsToExport: RowData[],
  clusters: Cluster[]
) => {
  try {
    if (rowsToExport.length === 0) {
      alert("No deliveries selected or available for export on the selected date.");
      return;
    }
    console.log("Rows to Export:", rowsToExport);

    const groupedByDriver: Record<string, RowData[]> = {};
    rowsToExport.forEach((row) => {
      const cluster = clusters.find(c => c.deliveries?.includes(row.id));
      const driverName = cluster?.driver || "Unassigned";

      if (!groupedByDriver[driverName]) {
        groupedByDriver[driverName] = [];
      }
      groupedByDriver[driverName].push(row);
    });

    console.log("Grouped by Driver Name:", groupedByDriver);

    // Check if the only group is "Unassigned"
    const driverNames = Object.keys(groupedByDriver);
    if (driverNames.length === 1 && driverNames[0] === "Unassigned" && groupedByDriver["Unassigned"].length > 0) {
      alert("Cannot export: All selected deliveries are currently unassigned. Please assign drivers to clusters before exporting.");
      return; // Stop the export
    }

    const JSZipDeliveries = (await import('jszip')).default;
    const zip = new JSZipDeliveries();
    let filesCreated = 0;

    for (const driverName in groupedByDriver) {
      // Skip unassigned drivers
      if (driverName === "Unassigned") {
          console.log("Skipping export for unassigned deliveries group.");
          continue;
      }

      console.log(`Processing export for driver: ${driverName}`, groupedByDriver[driverName]);

      const csvData = groupedByDriver[driverName]
        .map((row) => {
          try {
            const dietaryPreferences = row.deliveryDetails?.dietaryRestrictions
              ? Object.entries(row.deliveryDetails.dietaryRestrictions || {})
                  .filter(([key, value]) => value === true)
                  .map(([key]) => key)
                  .join(", ")
              : "";

            // Find the cluster for this row to get the cluster ID and time
            const cluster = clusters.find(c => c.deliveries?.includes(row.id));
            const clusterNumber = cluster?.id || "";
            const assignedTime = formatTime(cluster?.time || "");

            // Handle apt field - it might not exist in RowData, so use dynamic access
            const rowData = row as any;

            return {
              firstName: row.firstName || "",
              lastName: row.lastName || "",
              address: row.address || "",
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
              cluster: clusterNumber, // Use the cluster ID from the cluster lookup
              time: assignedTime, // Add the formatted time column
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
      alert("No files could be created for export. Please check that drivers are assigned and data is valid.");
      return;
    }

    try {
      const config = getExportConfig();
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${config.fileNamePrefix} ${deliveryDate}.zip`);
      alert(`ZIP file generated successfully with ${filesCreated} driver route(s)!`);
    } catch (error) {
      console.error("Error generating ZIP file:", error);
      alert("Error generating ZIP file. Please try again.");
    }

  } catch (error) {
    console.error("Error generating ZIPs:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    alert(`An error occurred while generating ZIPs: ${errorMessage}`);
  }
};

export const exportDoordashDeliveries = async (
  deliveryDate: string,
  rowsToExport: RowData[],
  clusters: Cluster[]
) => {
  try {
    // Get configuration
    const config = getExportConfig();
    
    if (rowsToExport.length === 0) {
      alert("No deliveries selected or available for export on the selected date.");
      return;
    }
    // Filter for only DoorDash deliveries
    const doordashRows = rowsToExport.filter((row) => {
      const cluster = clusters.find(c => c.deliveries?.includes(row.id));
      return cluster?.driver === "DoorDash";
    });

    if (doordashRows.length === 0) {
      alert("No DoorDash deliveries found for the selected date.");
      return;
    }

    // Check that all DoorDash deliveries have assigned times
    const unscheduledRows = doordashRows.filter((row) => {
      const cluster = clusters.find(c => c.deliveries?.includes(row.id));
      return !cluster?.time || cluster.time === "";
    });

    if (unscheduledRows.length > 0) {
      alert(`Cannot export: ${unscheduledRows.length} DoorDash deliveries do not have assigned times. Please assign times to all DoorDash deliveries before exporting.`);
      return;
    }



    // Helper function to format time window (configurable duration)
    const formatTimeWindow = (time: string): { start: string; end: string } => {
      if (!time) return { start: "", end: "" };
      
      const [hours, minutes] = time.split(":");
      const hour = parseInt(hours, 10);
      const minute = parseInt(minutes, 10);
      
      // Format as 12-hour with AM/PM
      const formatTime = (h: number, m: number) => {
        const hour12 = h % 12 || 12;
        const ampm = h >= 12 ? "PM" : "AM";
        return `${hour12}:${m.toString().padStart(2, '0')}:00 ${ampm}`;
      };
      
      const startTime = formatTime(hour, minute);
      const endTime = formatTime(hour + config.doorDash.deliveryWindowHours, minute);
      
      return { start: startTime, end: endTime };
    };



    // Group by time instead of driver
    const groupedByTime: Record<string, RowData[]> = {};
    doordashRows.forEach((row) => {
      const cluster = clusters.find(c => c.deliveries?.includes(row.id));
      const time = cluster?.time || "";

      if (!groupedByTime[time]) {
        groupedByTime[time] = [];
      }
      groupedByTime[time].push(row);
    });

    const JSZipDoordash = (await import('jszip')).default;
    const zip = new JSZipDoordash();
    let filesCreated = 0;
    let orderIdCounter = 1; // Global order ID counter across all time slots

    for (const time in groupedByTime) {
      const timeWindow = formatTimeWindow(time);

      const csvData = groupedByTime[time]
        .map((row) => {
          try {
            // Use database fields directly when available, with fallbacks
            const rowData = row as any; // Allow dynamic access for additional fields
            const city = rowData.city || config.doorDash.defaultCity;
            const state = rowData.state || config.doorDash.defaultState;
            const unit = rowData.address2 || ""; // Use address2 field for unit
            const streetAddress = row.address || "";

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
              "Dropoff Instructions \n(250 character max)": row.deliveryDetails?.deliveryInstructions || "",
              "Pickup Location Name": config.organization.name,
              "Pickup Phone Number": config.organization.phone,
              "Pickup Instructions": config.organization.pickupInstructions,
              "Order Volume": config.doorDash.orderVolume
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
      alert("No files could be created for export. Please check that times are assigned and data is valid.");
      return;
    }

    try {
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${config.fileNamePrefix} ${deliveryDate} - DoorDash.zip`);
      alert(`DoorDash ZIP file generated successfully with ${filesCreated} time slot(s)!`);
    } catch (error) {
      console.error("Error generating ZIP file:", error);
      alert("Error generating ZIP file. Please try again.");
    }

  } catch (error) {
    console.error("Error generating DoorDash ZIPs:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    alert(`An error occurred while generating DoorDash ZIPs: ${errorMessage}`);
  }
};
