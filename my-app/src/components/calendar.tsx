import { Calendar, momentLocalizer, View, Views } from "react-big-calendar";
import moment from "moment";
import { useEffect, useState } from "react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Link,
} from "@mui/material";
import {
  ClientProfile,
  DietaryRestrictions,
  Volunteer,
  Delivery,
} from "../types/types";

const localizer = momentLocalizer(moment);

// Sample dietary restrictions
const dietaryRestrictionsExample: DietaryRestrictions = {
  lowSugar: true,
  kidneyFriendly: false,
  vegan: false,
  vegetarian: true,
  halal: true,
  microwaveOnly: false,
  softFood: false,
  lowSodium: true,
  noCookingEquipment: false,
  foodAllergens: ["nuts"], // Example allergens
  other: ["No red meat"], // Example other restrictions
};

// Sample clients
const clients = new Map<string, ClientProfile>([
  [
    "1",
    {
      uid: "1",
      firstName: "Krishnan",
      lastName: "Tholkappian",
      address: "7660 Regents Drive",
      dob: new Date("2005-03-18"),
      deliveryFreq: "Weekly",
      phone: "7326664367",
      alternativePhone: "1234567890",
      adults: 2,
      children: 0,
      total: 2,
      gender: "Male",
      ethnicity: "Asian",
      deliveryDetails: {
        deliveryInstructions: "Leave at the front door",
        dietaryRestrictions: dietaryRestrictionsExample,
      },
      lifeChallenges: "N/A",
      notes: "N/A",
      lifestyleGoals: "Healthy eating",
      language: "English",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  [
    "2",
    {
      uid: "2",
      firstName: "Jane",
      lastName: "Doe",
      address: "1234 Main St",
      dob: new Date("1985-05-15"),
      deliveryFreq: "Bi-weekly",
      phone: "9876543210",
      alternativePhone: "5555555555",
      adults: 1,
      children: 2,
      total: 3,
      gender: "Female",
      ethnicity: "Hispanic",
      deliveryDetails: {
        deliveryInstructions: "Call before delivery",
        dietaryRestrictions: {
          lowSugar: false,
          kidneyFriendly: true,
          vegan: false,
          vegetarian: false,
          halal: false,
          microwaveOnly: false,
          softFood: false,
          lowSodium: false,
          noCookingEquipment: true,
          foodAllergens: ["dairy"],
          other: [],
        },
      },
      lifeChallenges: "Single parent",
      notes: "N/A",
      lifestyleGoals: "Manage weight",
      language: "Spanish",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
]);


const volunteers = new Map<string, Volunteer>([
  ["1", { id: "1", name: "Alice Johnson", phone: "111-222-3333" }],
  ["2", { id: "2", name: "Bob Smith", phone: "222-333-4444" }],
  ["3", { id: "3", name: "Charlie Brown", phone: "333-444-5555" }],
  ["4", { id: "4", name: "Daisy Miller", phone: "444-555-6666" }],
]);

const generateDeliveryId = (clientId: string) => {
  const randomNum = Math.floor(Math.random() * 10000);
  return `${clientId}-${randomNum}`;
};

const CalendarPage = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [view, setView] = useState<View>(Views.MONTH);
  const [open, setOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  const [clientOpen, setClientOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Volunteer | null>(null);

  const handleEventClick = (event: any) => {
    setSelectedDelivery(event.resource);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedDelivery(null);
  };

  const handleClientClick = (clientId: string) => {
    const client = clients.get(clientId);
    setSelectedClient(client || null);
    setClientOpen(true);
  };

  const handleDriverClick = (driverId: string) => {
    const driver = volunteers.get(driverId);
    setSelectedDriver(driver || null);
    setDriverOpen(true);
  };

  const handleClientClose = () => setClientOpen(false);
  const handleDriverClose = () => setDriverOpen(false);

  const createDelivery = (day: Date, clientId: string, volunteerId: string, notes: string) => {
    const existingDelivery = deliveries.find(delivery => delivery.id === generateDeliveryId(clientId));

    if (!existingDelivery) {
      const volunteer = volunteers.get(volunteerId);
      if (volunteer) {
        const newDelivery: Delivery = {
          id: generateDeliveryId(clientId),
          day: day,
          clientID: clientId,
          driver: volunteer,
          status: "Not Delivered",
          notes: notes,
        };

        setDeliveries((prevDeliveries) => [...prevDeliveries, newDelivery]);
      } else {
        console.error(`Volunteer with ID ${volunteerId} not found.`);
      }
    } else {
      console.log(`Delivery for client ${clientId} already exists.`);
    }
  };

  useEffect(() => {
    createDelivery(new Date(2024, 9, 3, 10, 50), "1", "1", "yes");
    createDelivery(new Date(2024, 9, 7, 15, 0), "2", "2", "hellooooo");
  }, [])

  const events = deliveries.map((delivery) => {
    const client = clients.get(delivery.clientID);
    const clientName = client
      ? `${client?.firstName || "Unknown"} ${client?.lastName || "Client"}`
      : "Unknown Client";

    return {
      id: delivery.id,
      title: `Delivery for ${clientName}`,
      start: delivery.day,
      end: delivery.day,
      resource: delivery,
    };
  });

  return (
    <div style={{ padding: "20px" }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 500 }}
        view={view}
        views={{ month: true, week: true, day: true, agenda: true }}
        onView={(newView) => setView(newView)}
        defaultDate={new Date()}
        onSelectEvent={handleEventClick}
      />

      {/* Delivery Details Dialog */}
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Delivery Details</DialogTitle>
        <DialogContent>
          {selectedDelivery && (
            <>
              <p>
                <strong>Client Name:</strong>
                <Link
                  component="button"
                  onClick={() => handleClientClick(selectedDelivery.clientID)}
                >
                  {clients.get(selectedDelivery.clientID)?.firstName || "Unknown"}{" "}
                  {clients.get(selectedDelivery.clientID)?.lastName || "Client"}
                </Link>
              </p>
              <p>
                <strong>Address:</strong> {clients.get(selectedDelivery.clientID)?.address || "N/A"}
              </p>
              <p>
                <strong>Delivery Instructions:</strong> {clients.get(selectedDelivery.clientID)?.deliveryDetails.deliveryInstructions || "N/A"}
              </p>
              <p>
                <strong>Driver:</strong>
                <Link
                  component="button"
                  onClick={() => handleDriverClick(selectedDelivery.driver.id)}
                >
                  {selectedDelivery.driver.name || "Unknown Driver"}
                </Link>
              </p>
              <p>
                <strong>Status:</strong> {selectedDelivery.status || "Unknown"}
              </p>
              <p>
                <strong>Notes:</strong> {selectedDelivery.notes || "No notes available"}
              </p>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Client Details Dialog */}
      <Dialog open={clientOpen} onClose={handleClientClose}>
        <DialogTitle>Client Details</DialogTitle>
        <DialogContent>
          {selectedClient && (
            <>
              <p>
                <strong>Name:</strong> {selectedClient?.firstName || "Unknown"}{" "}
                {selectedClient?.lastName || "Client"}
              </p>
              <p>
                <strong>Address:</strong> {selectedClient?.address || "N/A"}
              </p>
              <p>
                <strong>Phone:</strong> {selectedClient?.phone || "N/A"}
              </p>
              <p>
                <strong>Delivery Frequency:</strong>{" "}
                {selectedClient?.deliveryFreq || "N/A"}
              </p>
              <p>
                <strong>Dietary Restrictions:</strong>{" "}
                {selectedClient?.deliveryDetails.dietaryRestrictions
                  ? Object.entries(selectedClient.deliveryDetails.dietaryRestrictions)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(", ")
                  : "None"}
              </p>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClientClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Driver Details Dialog */}
      <Dialog open={driverOpen} onClose={handleDriverClose}>
        <DialogTitle>Driver Details</DialogTitle>
        <DialogContent>
          {selectedDriver && (
            <>
              <p>
                <strong>Name:</strong> {selectedDriver?.name || "Unknown"}
              </p>
              <p>
                <strong>Phone:</strong> {selectedDriver?.phone || "N/A"}
              </p>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDriverClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
