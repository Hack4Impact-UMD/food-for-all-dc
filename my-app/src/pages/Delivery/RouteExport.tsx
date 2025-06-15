import { getFirestore, collection, getDocs } from "firebase/firestore";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { Cluster } from "./DeliverySpreadsheet"; // Import Cluster type
import { RowData } from "./types/deliveryTypes"; // Import the correct type

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

    const zip = new JSZip();
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

            // Find the cluster for this row to get the cluster ID
            const cluster = clusters.find(c => c.deliveries?.includes(row.id));
            const clusterNumber = cluster?.id || "";

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
        const csv = Papa.unparse(csvData);
        const fileName = `FFA ${deliveryDate} - ${driverName}.csv`;
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
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `FFA ${deliveryDate}.zip`);
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
