import React, { useState } from "react";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import JSZip from "jszip";
import UploadTestData from "./UploadTestData";
import { Upload } from "@mui/icons-material";

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
        clientName: "John Doe",
      },
      {
        deliveryDate: "2025-03-30",
        cluster: 1,
        address: "456 Elm St",
        clientName: "Jane Smith",
      },
      {
        deliveryDate: "2025-03-31",
        cluster: 2,
        address: "789 Oak St",
        clientName: "Alice Johnson",
      },
      {
        deliveryDate: "2025-03-31",
        cluster: 2,
        address: "101 Pine St",
        clientName: "Bob Brown",
      },
      {
        deliveryDate: "2025-03-30",
        cluster: 3,
        address: "202 Maple St",
        clientName: "Charlie Davis",
      },
    ];

    // Fake clients collection
    const fakeClients: Record<string, any> = {
      "John Doe": {
        firstName: "John",
        lastName: "Doe",
        address: "123 Main St",
        apt: "1A",
        zip: "20001",
        quadrant: "NW",
        ward: "2",
        phone: "555-1234",
        adults: 2,
        children: 1,
        total: 3,
        deliveryInstructions: "Leave at the front door.",
        dietType: "Vegetarian",
        dietaryPreferences: "No peanuts",
        tefapFY25: "Yes",
      },
      "Jane Smith": {
        firstName: "Jane",
        lastName: "Smith",
        address: "456 Elm St",
        apt: "2B",
        zip: "20002",
        quadrant: "NE",
        ward: "5",
        phone: "555-5678",
        adults: 1,
        children: 2,
        total: 3,
        deliveryInstructions: "Ring the bell.",
        dietType: "Vegan",
        dietaryPreferences: "No gluten",
        tefapFY25: "No",
      },
      "Alice Johnson": {
        firstName: "Alice",
        lastName: "Johnson",
        address: "789 Oak St",
        apt: "3C",
        zip: "20003",
        quadrant: "SE",
        ward: "8",
        phone: "555-8765",
        adults: 3,
        children: 0,
        total: 3,
        deliveryInstructions: "Call upon arrival.",
        dietType: "None",
        dietaryPreferences: "None",
        tefapFY25: "Yes",
      },
      "Bob Brown": {
        firstName: "Bob",
        lastName: "Brown",
        address: "101 Pine St",
        apt: "4D",
        zip: "20004",
        quadrant: "SW",
        ward: "6",
        phone: "555-4321",
        adults: 2,
        children: 2,
        total: 4,
        deliveryInstructions: "Leave at the back door.",
        dietType: "Kosher",
        dietaryPreferences: "No shellfish",
        tefapFY25: "No",
      },
      "Charlie Davis": {
        firstName: "Charlie",
        lastName: "Davis",
        address: "202 Maple St",
        apt: "5E",
        zip: "20005",
        quadrant: "NW",
        ward: "1",
        phone: "555-9876",
        adults: 1,
        children: 0,
        total: 1,
        deliveryInstructions: "Knock twice.",
        dietType: "Halal",
        dietaryPreferences: "No pork",
        tefapFY25: "Yes",
      },
    };

    // Filter events by the selected delivery date
    const filteredEvents = fakeEvents.filter((event) => event.deliveryDate === deliveryDate);

    if (filteredEvents.length === 0) {
      alert("No events found for the selected delivery date.");
      return;
    }

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

      // Generate the CSV content
      const csvData = groupedByCluster[clusterNumber]
        .map((event) => {
          const client = fakeClients[event.clientName];
          if (!client) {
            console.warn(`Client profile not found for ${event.clientName}`);
            return null;
          }

          return {
            "First Name": client.firstName,
            "Last Name": client.lastName,
            Address: client.address,
            Apt: client.apt,
            ZIP: client.zip,
            Quadrant: client.quadrant,
            Ward: client.ward,
            Phone: client.phone,
            Adults: client.adults,
            Children: client.children,
            Total: client.total,
            "Delivery Instructions": client.deliveryInstructions,
            "Diet Type": client.dietType,
            "Dietary Preferences": client.dietaryPreferences,
            "TEFAP FY25": client.tefapFY25,
          };
        })
        .filter(Boolean); // Remove null entries

      const csv = Papa.unparse(csvData);

      // Add the CSV to the ZIP
      const fileName = `FFA ${deliveryDate} - Cluster ${clusterNumber}.csv`;
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
      <UploadTestData />
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
