import React, { useState } from "react";
import * as fastCsv from "fast-csv";
import { saveAs } from "file-saver";

const TestCsvPage: React.FC = () => {
    const [deliveryDate, setDeliveryDate] = useState("");

    const handleGenerateCsv = async () => {
        if (!deliveryDate) {
            alert("Please select a delivery date.");
            return;
        }

        // Fake data for testing
        const fakeEvents = [
            { deliveryDate, cluster: 1, address: "123 Main St", customerName: "John Doe" },
            { deliveryDate, cluster: 1, address: "456 Elm St", customerName: "Jane Smith" },
            { deliveryDate, cluster: 2, address: "789 Oak St", customerName: "Alice Johnson" },
        ];

        // Group events by cluster
        const groupedByCluster: Record<number, any[]> = {};
        fakeEvents.forEach((event) => {
            const cluster = event.cluster;
            if (!groupedByCluster[cluster]) {
                groupedByCluster[cluster] = [];
            }
            groupedByCluster[cluster].push(event);
        });

        // Generate CSVs for each cluster
        for (const cluster in groupedByCluster) {
            const clusterNumber = parseInt(cluster, 10);
            const csvData: string[] = [];

            // Generate CSV content
            const csvStream = fastCsv.format({ headers: true });
            csvStream.on("data", (chunk) => csvData.push(chunk.toString()));
            csvStream.on("end", () => {
                const blob = new Blob(csvData, { type: "text/csv;charset=utf-8;" });
                const fileName = `test-deliveries-${deliveryDate}-cluster-${clusterNumber}.csv`;
                saveAs(blob, fileName);
            });

            groupedByCluster[clusterNumber].forEach((event) => {
                csvStream.write(event);
            });
            csvStream.end();
        }

        alert("CSV files generated successfully!");
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
            <button onClick={handleGenerateCsv}>Generate CSVs</button>
        </div>
    );
};

export default TestCsvPage;