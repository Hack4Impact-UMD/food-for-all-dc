import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import * as fastCsv from "fast-csv";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";


admin.initializeApp();

export const createAndSendCsvs = functions.https.onRequest(async (req, res) => {
    try {
        const { deliveryDate } = req.body;

        if (!deliveryDate) {
            res.status(400).send("Missing deliveryDate.");
            return;
        }

        // Step 1: Query Firestore for events with the specified deliveryDate
        const eventsSnapshot = await admin
            .firestore()
            .collection("events")
            .where("deliveryDate", "==", deliveryDate)
            .get();

        if (eventsSnapshot.empty) {
            res.status(404).send("No events found for the specified deliveryDate.");
            return;
        }

        // Step 2: Group events by cluster
        const groupedByCluster: Record<number, any[]> = {};
        eventsSnapshot.forEach((doc) => {
            const data = doc.data();
            const cluster = data.cluster || 0; // Default to 0 if cluster is missing
            if (!groupedByCluster[cluster]) {
                groupedByCluster[cluster] = [];
            }
            groupedByCluster[cluster].push(data);
        });

        // Step 3: Process each cluster
        const emailPromises = Object.keys(groupedByCluster).map(async (cluster) => {
            const clusterNumber = parseInt(cluster, 10);

            // Query the clusters collection to get the driver
            const clusterDoc = await admin
                .firestore()
                .collection("clusters")
                .doc(clusterNumber.toString())
                .get();

            if (!clusterDoc.exists) {
                console.warn(`Cluster ${clusterNumber} not found.`);
                return;
            }

            const driverId = clusterDoc.data()?.driver;
            if (!driverId) {
                console.warn(`Driver not found for cluster ${clusterNumber}.`);
                return;
            }

            // Query the Drivers collection to get the email
            const driverDoc = await admin
                .firestore()
                .collection("Drivers")
                .doc(driverId)
                .get();

            if (!driverDoc.exists) {
                console.warn(`Driver ${driverId} not found.`);
                return;
            }

            const driverEmail = driverDoc.data()?.email;
            if (!driverEmail) {
                console.warn(`Email not found for driver ${driverId}.`);
                return;
            }

            // Generate CSV for the cluster
            const tempFilePath = path.join(
                os.tmpdir(),
                `deliveries-${deliveryDate}-cluster-${clusterNumber}.csv`
            );
            const csvStream = fastCsv.format({ headers: true });
            const writeStream = fs.createWriteStream(tempFilePath);

            csvStream.pipe(writeStream);
            groupedByCluster[clusterNumber].forEach((event) => {
                csvStream.write({
                    DeliveryDate: event.deliveryDate,
                    Address: event.address,
                    CustomerName: event.customerName,
                    // Add other fields as needed
                });
            });
            csvStream.end();

            // Wait for the file to finish writing
            await new Promise((resolve, reject) => {
                writeStream.on("finish", resolve);
                writeStream.on("error", reject);
            });

            // Send the CSV via email
            const transporter = nodemailer.createTransport({
                service: "gmail", // Use your email provider
                auth: {
                    user: "your-email@gmail.com",
                    pass: "your-email-password",
                },
            });

            const mailOptions = {
                from: "your-email@gmail.com",
                to: driverEmail,
                subject: `Deliveries for ${deliveryDate} (Cluster ${clusterNumber})`,
                text: `Please find attached the deliveries for ${deliveryDate} (Cluster ${clusterNumber}).`,
                attachments: [
                    {
                        filename: `deliveries-${deliveryDate}-cluster-${clusterNumber}.csv`,
                        path: tempFilePath,
                    },
                ],
            };

            await transporter.sendMail(mailOptions);

            // Clean up the temporary file
            fs.unlinkSync(tempFilePath);

            console.log(`Email sent to ${driverEmail} for cluster ${clusterNumber}.`);
        });

        // Wait for all emails to be sent
        await Promise.all(emailPromises);

        res.status(200).send("CSV files created and emails sent successfully.");
    } catch (error) {
        console.error("Error creating and sending CSVs:", error);
        res.status(500).send("An error occurred while creating and sending the CSVs.");
    }
});



export const testGenerateCsv = async (deliveryDate: string) => {
    try {
        if (!deliveryDate) {
            console.error("Missing deliveryDate.");
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
            const tempFilePath = path.join(
                os.tmpdir(),
                `test-deliveries-${deliveryDate}-cluster-${clusterNumber}.csv`
            );
            const csvStream = fastCsv.format({ headers: true });
            const writeStream = fs.createWriteStream(tempFilePath);

            csvStream.pipe(writeStream);
            groupedByCluster[clusterNumber].forEach((event) => {
                csvStream.write(event);
            });
            csvStream.end();

            // Wait for the file to finish writing
            await new Promise((resolve, reject) => {
                writeStream.on("finish", resolve);
                writeStream.on("error", reject);
            });

            console.log(`CSV for cluster ${clusterNumber} created at: ${tempFilePath}`);
        }
    } catch (error) {
        console.error("Error generating test CSVs:", error);
    }
};

// Example usage
testGenerateCsv("2025-03-30");