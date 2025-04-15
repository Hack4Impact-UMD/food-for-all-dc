import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as fastCsv from "fast-csv";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import archiver from "archiver";

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

    // Step 3: Create a ZIP file
    const zipFilePath = path.join(os.tmpdir(), `deliveries-${deliveryDate}.zip`);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`ZIP file created: ${zipFilePath}`);
    });

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(output);

    // Step 4: Generate CSVs for each cluster and add them to the ZIP
    for (const cluster in groupedByCluster) {
      const clusterNumber = parseInt(cluster, 10);

      // Fetch client profiles for the events in this cluster
      const clientProfiles: Record<string, any> = {};
      for (const event of groupedByCluster[clusterNumber]) {
        const clientSnapshot = await admin
          .firestore()
          .collection("clients")
          .doc(event.clientName)
          .get();

        if (clientSnapshot.exists) {
          clientProfiles[event.clientName] = clientSnapshot.data();
        } else {
          console.warn(`Client profile not found for ${event.clientName}`);
        }
      }

      // Generate CSV content
      const tempFilePath = path.join(
        os.tmpdir(),
        `deliveries-${deliveryDate}-cluster-${clusterNumber}.csv`
      );
      const csvStream = fastCsv.format({ headers: true });
      const writeStream = fs.createWriteStream(tempFilePath);

      csvStream.pipe(writeStream);
      groupedByCluster[clusterNumber].forEach((event) => {
        const client = clientProfiles[event.clientName];
        if (!client) {
          console.warn(`Skipping event for ${event.clientName} due to missing profile.`);
          return;
        }

        csvStream.write({
          "First Name": client.firstName,
          "Last Name": client.lastName,
          Address: client.address,
          Apt: client.apt || "",
          ZIP: client.zip,
          Quadrant: client.quadrant,
          Ward: client.ward,
          Phone: client.phone,
          Adults: client.adults,
          Children: client.children,
          Total: client.total,
          "Delivery Instructions": client.deliveryInstructions || "",
          "Diet Type": client.dietType || "",
          "Dietary Preferences": client.dietaryPreferences || "",
          "TEFAP FY25": client.tefapFY25 || "",
        });
      });
      csvStream.end();

      // Wait for the file to finish writing
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      // Add the CSV to the ZIP
      archive.file(tempFilePath, {
        name: `deliveries-cluster-${clusterNumber}.csv`,
      });

      // Clean up the temporary CSV file
      fs.unlinkSync(tempFilePath);
    }

    // Finalize the ZIP file
    await archive.finalize();

    // Step 5: Send the ZIP file as a response
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="deliveries-${deliveryDate}.zip"`);
    res.sendFile(zipFilePath, (err) => {
      if (err) {
        console.error("Error sending ZIP file:", err);
        res.status(500).send("Error sending ZIP file.");
      } else {
        // Clean up the temporary ZIP file
        fs.unlinkSync(zipFilePath);
      }
    });
  } catch (error) {
    console.error("Error creating and sending ZIP file:", error);
    res.status(500).send("An error occurred while creating the ZIP file.");
  }
});
