import React, { useState } from "react";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import JSZip from "jszip";

const TestCsvPage: React.FC = () => {
  const [deliveryDate, setDeliveryDate] = useState("");

  const handleGenerateCsv = async () => {
    if (!deliveryDate) {
      alert("Please select a delivery date.");
      return;
    }

    // Fake data for testing
    const fakeEvents = [
      {
        deliveryDate: "2025-03-30",
        cluster: 1,
        address: "123 Main St",
        customerName: "John Doe",
      },
      {
        deliveryDate: "2025-03-30",
        cluster: 1,
        address: "456 Elm St",
        customerName: "Jane Smith",
      },
      {
        deliveryDate: "2025-03-31",
        cluster: 2,
        address: "789 Oak St",
        customerName: "Alice Johnson",
      },
      {
        deliveryDate: "2025-03-31",
        cluster: 2,
        address: "101 Pine St",
        customerName: "Bob Brown",
      },
      {
        deliveryDate: "2025-03-30",
        cluster: 3,
        address: "202 Maple St",
        customerName: "Charlie Davis",
      },
    ];

    // Filter events by the selected delivery date
    const filteredEvents = fakeEvents.filter(
      (event) => event.deliveryDate === deliveryDate
    );

    if (filteredEvents.length === 0) {
      alert("No events found for the selected delivery date.");
      return;
    }

    // Fake clusters collection
    const fakeClusters: Record<number, { driver: string }> = {
      1: { driver: "driver1" },
      2: { driver: "driver2" },
      3: { driver: "driver3" },
    };

    // Fake drivers collection
    const fakeDrivers: Record<string, { email: string; name: string }> = {
      driver1: { email: "driver1@example.com", name: "Driver One" },
      driver2: { email: "driver2@example.com", name: "Driver Two" },
      driver3: { email: "driver3@example.com", name: "Driver Three" },
    };

    // Group events by cluster
    const groupedByCluster: Record<number, typeof filteredEvents> = {};
    filteredEvents.forEach((event) => {
      const cluster = event.cluster;
      if (!groupedByCluster[cluster]) {
        groupedByCluster[cluster] = [];
      }
      groupedByCluster[cluster].push(event);
    });

    // Create a new ZIP file
    const zip = new JSZip();

    // Generate CSVs for each cluster and add them to the ZIP
    for (const cluster in groupedByCluster) {
      const clusterNumber = parseInt(cluster, 10);

      // Get the driver for the cluster
      const clusterData = fakeClusters[clusterNumber];
      if (!clusterData) {
        console.warn(`Cluster ${clusterNumber} not found.`);
        continue;
      }

      const driverId = clusterData.driver;
      const driverData = fakeDrivers[driverId];
      if (!driverData) {
        console.warn(`Driver ${driverId} not found.`);
        continue;
      }

      const driverName = driverData.name;

      // Generate the CSV content
      const csv = Papa.unparse(groupedByCluster[clusterNumber]);

      // Add the CSV to the ZIP
      const fileName = `FFA ${deliveryDate} - ${driverName}.csv`;
      zip.file(fileName, csv);
    }

    // Generate the ZIP file and trigger the download
    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, `FFA ${deliveryDate}.zip`);
    });

    alert("ZIP file generated successfully!");
  };

  return (
    <div>
      <h1>Test CSV Generation</h1>
      <div>
        <label htmlFor="deliveryDate">Delivery Date:</label>
        <input
          type="date"
          id="deliveryDate"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
        />
      </div>
      <button onClick={handleGenerateCsv}>Generate ZIP</button>
    </div>
  );
};

export default TestCsvPage;
