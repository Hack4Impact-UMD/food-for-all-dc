import React from "react";
import { getFirestore, collection, setDoc, doc } from "firebase/firestore";

const UploadTestData: React.FC = () => {
  const uploadTestData = async () => {
    const db = getFirestore();

    try {
      // Step 1: Add fake drivers
      const drivers = [
        {
          id: "driver1",
          name: "John Driver",
          email: "john.driver@example.com",
          phone: "123-456-7890",
        },
        {
          id: "driver2",
          name: "Jane Driver",
          email: "jane.driver@example.com",
          phone: "987-654-3210",
        },
        {
          id: "driver3",
          name: "Sam Driver",
          email: "sam.driver@example.com",
          phone: "555-555-5555",
        },
      ];

      console.log("Uploading drivers...");
      for (const driver of drivers) {
        const driverRef = doc(db, "Drivers", driver.id); // Use the `id` field as the document ID
        await setDoc(driverRef, driver);
      }

      // Step 2: Add fake clients
      const clients = [
        {
          id: "client1",
          firstName: "John",
          lastName: "Doe",
          address: "123 Main St",
          apt: "Apt 1",
          zip: "12345",
          quadrant: "NW",
          ward: "1",
          phone: "111-111-1111",
          adults: 2,
          children: 1,
          total: 3,
          deliveryInstructions: "Leave at the door",
          dietaryPreferences: "No peanuts",
          tefapFY25: "Yes",
        },
        {
          id: "client2",
          firstName: "Jane",
          lastName: "Smith",
          address: "456 Elm St",
          apt: "",
          zip: "67890",
          quadrant: "NE",
          ward: "2",
          phone: "222-222-2222",
          adults: 1,
          children: 0,
          total: 1,
          deliveryInstructions: "Call upon arrival",
          dietaryPreferences: "No gluten",
          tefapFY25: "No",
        },
        {
          id: "client3",
          firstName: "Alice",
          lastName: "Johnson",
          address: "789 Oak St",
          apt: "Apt 3B",
          zip: "54321",
          quadrant: "SW",
          ward: "3",
          phone: "333-333-3333",
          adults: 3,
          children: 2,
          total: 5,
          deliveryInstructions: "",
          dietaryPreferences: "",
          tefapFY25: "Yes",
        },
      ];

      console.log("Uploading clients...");
      for (const client of clients) {
        const clientRef = doc(db, "clients", client.id); // Use the `id` field as the document ID
        await setDoc(clientRef, client);
      }

      // Step 3: Add fake events
      const events = [
        {
          id: "event1",
          assignedDriverId: "driver1",
          assignedDriverName: "John Driver",
          clientId: "client1",
          clientName: "John Doe",
          deliveryDate: new Date("2025-03-30").toISOString(),
          time: "10:00 AM",
          cluster: 1,
          recurrence: "Weekly",
          repeatsEndDate: new Date("2025-06-30").toISOString(),
        },
        {
          id: "event2",
          assignedDriverId: "driver1",
          assignedDriverName: "John Driver",
          clientId: "client2",
          clientName: "Jane Smith",
          deliveryDate: new Date("2025-03-30").toISOString(),
          time: "11:00 AM",
          cluster: 1,
          recurrence: "None",
          repeatsEndDate: null,
        },
        {
          id: "event3",
          assignedDriverId: "driver2",
          assignedDriverName: "Jane Driver",
          clientId: "client3",
          clientName: "Alice Johnson",
          deliveryDate: new Date("2025-03-31").toISOString(),
          time: "1:00 PM",
          cluster: 2,
          recurrence: "2x-Monthly",
          repeatsEndDate: new Date("2025-12-31").toISOString(),
        },
      ];

      console.log("Uploading events...");
      for (const event of events) {
        const eventRef = doc(db, "events", event.id); // Use the `id` field as the document ID
        await setDoc(eventRef, event);
      }

      console.log("Test data uploaded successfully!");
    } catch (error) {
      console.error("Error uploading test data:", error);
    }
  };

  return (
    <div>
      <h1>Upload Test Data</h1>
      <button onClick={uploadTestData}>Upload Test Data to Firestore</button>
    </div>
  );
};

export default UploadTestData;
