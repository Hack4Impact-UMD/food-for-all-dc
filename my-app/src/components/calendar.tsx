import { Calendar, momentLocalizer, View, Views } from "react-big-calendar";
import moment from "moment";
import { useState } from "react";
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
const clients: ClientProfile[] = [
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
    total: 2 + 0, // Total is calculated
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
    total: 1 + 2,
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
        foodAllergens: ["dairy"], // Example allergens
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
];

// Sample volunteers
const volunteers: Volunteer[] = [
  { id: "1", name: "Alice Johnson", phone: "111-222-3333" },
  { id: "2", name: "Bob Smith", phone: "222-333-4444" },
  { id: "3", name: "Charlie Brown", phone: "333-444-5555" },
  { id: "4", name: "Daisy Miller", phone: "444-555-6666" },
];

const generateDeliveryId = (clientId: string) => {
  const randomNum = Math.floor(Math.random() * 10000);
  return `${clientId}-${randomNum}`;
};

let deliveries: Delivery[] = [];

function createDelivery(
  day: Date,
  clientId: string,
  volunteerId: string,
  notes: string,
) {
  const volunteer = volunteers.find((vol) => vol.id === volunteerId);

  if (volunteer) {
    deliveries.push({
      id: generateDeliveryId(clientId),
      day: day,
      clientID: clientId,
      driver: volunteer,
      status: "Not Delivered",
      notes: notes,
    });
  } else {
    console.error(`Volunteer with ID ${volunteerId} not found.`);
  }
}

//Date, ClientId, VolunteerId, Notes
createDelivery(new Date(2024, 9, 3, 10, 50), "1", "1", "yes");
createDelivery(new Date(2024, 9, 7, 15, 0o0), "2", "2", "hellooooo");

const CalendarPage = () => {
  const [view, setView] = useState<View>(Views.MONTH);
  const [open, setOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(
    null,
  );

  const [clientOpen, setClientOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(
    null,
  );
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
    const client = clients.find((c) => c.uid === clientId);
    setSelectedClient(client || null);
    setClientOpen(true);
  };

  const handleDriverClick = (driverId: string) => {
    const driver = volunteers.find((v) => v.id === driverId);
    setSelectedDriver(driver || null);
    setDriverOpen(true);
  };

  const handleClientClose = () => setClientOpen(false);
  const handleDriverClose = () => setDriverOpen(false);

  const events = deliveries.map((delivery) => {
    const client = clients.find((c) => c.uid === delivery.clientID);
    const clientName = client
      ? `${client.firstName} ${client.lastName}`
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
        views={{
          month: true,
          week: true,
          day: true,
          agenda: true,
        }}
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
                  {
                    clients.find((c) => c.uid === selectedDelivery.clientID)
                      ?.firstName
                  }{" "}
                  {
                    clients.find((c) => c.uid === selectedDelivery.clientID)
                      ?.lastName
                  }
                </Link>
              </p>
              <p>
                <strong>Address:</strong>{" "}
                {
                  clients.find((c) => c.uid === selectedDelivery.clientID)
                    ?.address
                }
              </p>
              <p>
                <strong>Delivery Instructions:</strong>{" "}
                {
                  clients.find((c) => c.uid === selectedDelivery.clientID)
                    ?.deliveryDetails.deliveryInstructions
                }
              </p>
              <p>
                <strong>Driver:</strong>
                <Link
                  component="button"
                  onClick={() => handleDriverClick(selectedDelivery.driver.id)}
                >
                  {selectedDelivery.driver.name}
                </Link>
              </p>
              <p>
                <strong>Status:</strong> {selectedDelivery.status}
              </p>
              <p>
                <strong>Notes:</strong> {selectedDelivery.notes}
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
                <strong>Name:</strong> {selectedClient.firstName}{" "}
                {selectedClient.lastName}
              </p>
              <p>
                <strong>Address:</strong> {selectedClient.address}
              </p>
              <p>
                <strong>Phone:</strong> {selectedClient.phone}
              </p>
              <p>
                <strong>Delivery Frequency:</strong>{" "}
                {selectedClient.deliveryFreq}
              </p>
              <p>
                <strong>Dietary Restrictions:</strong>
              </p>
              <ul>
                {Object.entries(
                  selectedClient.deliveryDetails.dietaryRestrictions,
                )
                  .filter(([key, value]) => value === true)
                  .map(([key]) => (
                    <li key={key}>{key.replace(/([A-Z])/g, " $1").trim()}</li>
                  ))}
              </ul>
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
                <strong>Name:</strong> {selectedDriver.name}
              </p>
              <p>
                <strong>Phone:</strong> {selectedDriver.phone}
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
