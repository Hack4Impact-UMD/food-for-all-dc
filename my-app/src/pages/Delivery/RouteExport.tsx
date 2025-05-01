import { getFirestore, collection, getDocs } from "firebase/firestore";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { RowData as DeliveryRowData } from "./types/deliveryTypes"; // Import the type used in DeliverySpreadsheet
import { Cluster } from "./DeliverySpreadsheet"; // Import Cluster type

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
  rowsToExport: DeliveryRowData[],
  clusters: Cluster[]
) => {
  try {
    if (rowsToExport.length === 0) {
      alert("No deliveries selected or available for export on the selected date.");
      return;
    }
    console.log("Rows to Export:", rowsToExport);

    const db = getFirestore();
    const volunteersSnapshot = await getDocs(collection(db, "Drivers"));
    const volunteers = volunteersSnapshot.docs.reduce((acc: Record<string, { id: string; name: string }>, doc) => {
       const data = doc.data();
       acc[data.name] = { id: doc.id, name: data.name };
      return acc;
    }, {});
     console.log("Fetched Volunteers (indexed by name):", volunteers);

    const groupedByDriver: Record<string, DeliveryRowData[]> = {};
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

    for (const driverName in groupedByDriver) {
      // Restore the check to skip unassigned drivers
      if (driverName === "Unassigned") {
          // Optionally log that unassigned are being skipped if needed for debugging
          // console.log("Skipping export for unassigned deliveries group.");
          continue; // Skip creating a file for the "Unassigned" group
      }

      // Log the driver group being processed (this is still useful)
      console.log(`Processing export for driver: ${driverName}`, groupedByDriver[driverName]);

      const csvData = groupedByDriver[driverName]
        .map((row) => {
          const dietaryPreferences = row.deliveryDetails?.dietaryRestrictions
            ? Object.entries(row.deliveryDetails.dietaryRestrictions || {})
                .filter(([key, value]) => value === true)
                .map(([key]) => key)
                .join(", ")
            : "";

          return {
            firstName: row.firstName,
            lastName: row.lastName,
            address: row.address,
            apt: row.apt || "",
            zip: row.zipCode,
            quadrant: row.quadrant || "",
            ward: row.ward || "",
            phone: row.phone,
            adults: row.adults,
            children: row.children,
            total: row.total,
            deliveryInstructions: row.deliveryDetails?.deliveryInstructions || "",
            dietaryPreferences: dietaryPreferences,
            tefapFY25: row.tags?.includes("Tefap") ? "Y" : "N",
            deliveryDate: deliveryDate,
            cluster: row.clusterId || "",
          };
        })
        .filter(Boolean);

      const csv = Papa.unparse(csvData);

      const fileName = `FFA ${deliveryDate} - ${driverName}.csv`;
      zip.file(fileName, csv);
    }

    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, `FFA ${deliveryDate}.zip`);
    });

    alert("ZIP file generated successfully!");
  } catch (error) {
    console.error("Error generating ZIPs:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    alert(`An error occurred while generating ZIPs: ${errorMessage}`);
  }
};
