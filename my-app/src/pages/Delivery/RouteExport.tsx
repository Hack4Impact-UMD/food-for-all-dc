import { getFirestore, collection, getDocs } from "firebase/firestore";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { Delivery, Volunteer } from "../../types/delivery-types"; // Import Delivery and Volunteer types
import { ClientProfile } from "../../types/client-types"; // Import ClientProfile type

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

export const exportDeliveries = async (deliveryDate: string) => {
  const db = getFirestore();

  try {
    // Step 1: Fetch events for the selected delivery date
    const eventsSnapshot = await getDocs(collection(db, "events"));
    const events = eventsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Delivery)
      .filter((event) => {
        const eventDate =
          event.deliveryDate instanceof Date ? event.deliveryDate : new Date(event.deliveryDate); // Handle string or Firestore Timestamp
        const selectedDate = new Date(deliveryDate);

        // Compare dates (ignoring time)
        return (
          eventDate.getFullYear() === selectedDate.getFullYear() &&
          eventDate.getMonth() === selectedDate.getMonth() &&
          eventDate.getDate() === selectedDate.getDate()
        );
      });

    if (events.length === 0) {
      alert("No events found for the selected delivery date.");
      return;
    }
    console.log("Events:", events);

    // Step 2: Fetch volunteers (replacing drivers)
    const volunteersSnapshot = await getDocs(collection(db, "Drivers"));
    const volunteers = volunteersSnapshot.docs.reduce((acc: Record<string, Volunteer>, doc) => {
      acc[doc.id] = { id: doc.id, ...doc.data() } as Volunteer;
      return acc;
    }, {});

    console.log("Volunteers:", volunteers);

    // Step 3: Fetch clients
    const clientsSnapshot = await getDocs(collection(db, "clients"));
    const clients = clientsSnapshot.docs.reduce(
      (acc: Record<string, SpreadsheetClientProfile>, doc) => {
        const clientData = doc.data() as ClientProfile;
        acc[doc.id] = {
          uid: doc.id, 
          firstName: clientData.firstName,
          lastName: clientData.lastName,
          address: clientData.address,
          zip: clientData.zipCode,
          quadrant: clientData.quadrant || "",
          ward: clientData.ward || "",
          phone: clientData.phone,
          adults: clientData.adults,
          children: clientData.children,
          total: clientData.total,
          deliveryInstructions: clientData.deliveryDetails?.deliveryInstructions || "",
          dietaryPreferences: clientData.deliveryDetails?.dietaryRestrictions
            ? Object.entries(clientData.deliveryDetails.dietaryRestrictions || {})
                .filter(([key, value]) => value === true)
                .map(([key]) => key)
                .join(", ")
            : "",
          tefapFY25: clientData.tags?.includes("Tefap") ? "Y" : "N",
        };
        return acc;
      },
      {}
    );

    console.log("Clients:", clients);

    // Step 4: Group events by assigned volunteer
    const groupedByVolunteer: Record<string, Delivery[]> = {};
    events.forEach((event) => {
      const volunteerId = event.assignedDriverId; // Still using assignedDriverId for consistency
      if (!groupedByVolunteer[volunteerId]) {
        groupedByVolunteer[volunteerId] = [];
      }
      groupedByVolunteer[volunteerId].push(event);
    });

    console.log("Grouped by Volunteer:", groupedByVolunteer);

    // Step 5: Create a ZIP file for download
    const zip = new JSZip();

    for (const volunteerId in groupedByVolunteer) {
      // Find the volunteer by matching the `id` field
      const volunteer = Object.values(volunteers).find((v) => v.id === volunteerId);
      if (!volunteer) {
        console.warn(`Volunteer ${volunteerId} not found.`);
        continue;
      }

      const volunteerName = volunteer.name;

      // Generate CSV content for the volunteer
      const csvData = groupedByVolunteer[volunteerId]
        .map((event) => {
          // Find the client by matching the `id` field
          const client = Object.values(clients).find((c) => c.uid === event.clientId);
          if (!client) {
            console.warn(`Client profile not found for ${event.clientId}`);
            return null; // Skip this event if the client is not found
          }

          return {
            firstName: client.firstName,
            lastName: client.lastName,
            address: client.address,
            apt: client.apt || "",
            zip: client.zip,
            quadrant: client.quadrant || "",
            ward: client.ward || "",
            phone: client.phone,
            adults: client.adults,
            children: client.children,
            total: client.total,
            deliveryInstructions: client.deliveryInstructions || "",
            dietaryPreferences: client.dietaryPreferences || "",
            tefapFY25: client.tefapFY25 || "",
            deliveryDate: new Date(event.deliveryDate).toISOString().split("T")[0],
            cluster: event.cluster || "",
            recurrence: event.recurrence || "",
            repeatsEndDate: event.repeatsEndDate
              ? new Date(event.repeatsEndDate).toISOString().split("T")[0]
              : "",
          };
        })
        .filter(Boolean); // Remove null entries

      const csv = Papa.unparse(csvData);

      // Add the CSV to the ZIP
      const fileName = `FFA ${deliveryDate} - ${volunteerName}.csv`;
      zip.file(fileName, csv);
    }

    // Generate the ZIP file for download
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
