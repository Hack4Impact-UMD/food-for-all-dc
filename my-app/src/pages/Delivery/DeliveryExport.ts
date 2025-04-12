import { getFirestore, collection, getDocs } from "firebase/firestore";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Papa from "papaparse";

interface Event {
  id?: string;
  assignedDriverId: string;
  assignedDriverName: string;
  clientId: string;
  clientName: string;
  startTime: { seconds: number };
  endTime: { seconds: number };
  notes?: string;
  priority?: string;
  status: boolean;
}

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface ClientProfile {
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
  dietType?: string;
  dietaryPreferences?: string;
  tefapFY25?: string;
}

export const exportDeliveries = async (deliveryDate: string) => {
  const db = getFirestore();

  try {
    // Step 1: Fetch events for the selected delivery date
    const eventsSnapshot = await getDocs(collection(db, "events"));
    const events = eventsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Event)
      .filter((event) => {
        const eventDate = new Date(event.startTime.seconds * 1000)
          .toISOString()
          .split("T")[0];
        return eventDate === deliveryDate;
      });

    if (events.length === 0) {
      alert("No events found for the selected delivery date.");
      return;
    }

    // Step 2: Fetch drivers
    const driversSnapshot = await getDocs(collection(db, "Drivers"));
    const drivers = driversSnapshot.docs.reduce(
      (acc: Record<string, Driver>, doc) => {
        acc[doc.id] = { id: doc.id, ...doc.data() } as Driver;
        return acc;
      },
      {}
    );

    // Step 3: Fetch clients
    const clientsSnapshot = await getDocs(collection(db, "clients"));
    const clients = clientsSnapshot.docs.reduce(
      (acc: Record<string, ClientProfile>, doc) => {
        const clientData = doc.data();
        if (
          clientData.firstName &&
          clientData.lastName &&
          clientData.address &&
          clientData.zip &&
          clientData.phone &&
          clientData.adults !== undefined &&
          clientData.children !== undefined &&
          clientData.total !== undefined
        ) {
          acc[doc.id] = {
            firstName: clientData.firstName,
            lastName: clientData.lastName,
            address: clientData.address,
            apt: clientData.apt || "",
            zip: clientData.zip,
            quadrant: clientData.quadrant || "",
            ward: clientData.ward || "",
            phone: clientData.phone,
            adults: clientData.adults,
            children: clientData.children,
            total: clientData.total,
            deliveryInstructions: clientData.deliveryInstructions || "",
            dietType: clientData.dietType || "",
            dietaryPreferences: clientData.dietaryPreferences || "",
            tefapFY25: clientData.tefapFY25 || "",
          } as ClientProfile;
        } else {
          console.warn(`Invalid client data for document ID: ${doc.id}`);
        }
        return acc;
      },
      {}
    );

    // Step 4: Group events by assigned driver
    const groupedByDriver: Record<string, Event[]> = {};
    events.forEach((event) => {
      const driverId = event.assignedDriverId;
      if (!groupedByDriver[driverId]) {
        groupedByDriver[driverId] = [];
      }
      groupedByDriver[driverId].push(event);
    });

    // Step 5: Create a ZIP file
    const zip = new JSZip();

    for (const driverId in groupedByDriver) {
      const driver = drivers[driverId];
      if (!driver) {
        console.warn(`Driver ${driverId} not found.`);
        continue;
      }

      const driverName = driver.name;

      // Generate CSV content for the driver
      const csvData = groupedByDriver[driverId]
        .map((event) => {
          const client = clients[event.clientId];
          if (!client) {
            console.warn(`Client profile not found for ${event.clientId}`);
            return null;
          }

          return {
            "First Name": client.firstName,
            "Last Name": client.lastName,
            Address: client.address,
            Apt: client.apt || "",
            ZIP: client.zip,
            Quadrant: client.quadrant || "",
            Ward: client.ward || "",
            Phone: client.phone,
            Adults: client.adults,
            Children: client.children,
            Total: client.total,
            "Delivery Instructions": client.deliveryInstructions || "",
            "Diet Type": client.dietType || "",
            "Dietary Preferences": client.dietaryPreferences || "",
            "TEFAP FY25": client.tefapFY25 || "",
            Notes: event.notes || "",
            Priority: event.priority || "",
            Status: event.status ? "Completed" : "Pending",
            "Start Time": new Date(
              event.startTime.seconds * 1000
            ).toLocaleString(),
            "End Time": new Date(event.endTime.seconds * 1000).toLocaleString(),
          };
        })
        .filter(Boolean); // Remove null entries

      const csv = Papa.unparse(csvData);

      // Add the CSV to the ZIP
      const fileName = `FFA ${deliveryDate} - ${driverName}.csv`;
      zip.file(fileName, csv);
    }

    // Step 6: Generate the ZIP file and trigger the download
    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, `FFA ${deliveryDate}.zip`);
    });

    alert("ZIP file generated successfully!");
  } catch (error) {
    console.error("Error generating CSVs:", error);
    alert("An error occurred while generating the ZIP file.");
  }
};
