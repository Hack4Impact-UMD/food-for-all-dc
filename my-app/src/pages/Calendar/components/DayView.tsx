import React from "react";
import { Box, Typography } from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { DeliveryEvent } from "../../../types/calendar-types";
import { ClientProfile } from "../../../types/client-types";
import DeliveryCard from "./DeliveryCard";
import EventCountHeader from "../../../components/EventCountHeader";


interface DayViewProps {
  events: DeliveryEvent[];
  clients: ClientProfile[];
  onEventModified: () => void;
  dailyLimit?: number;
}

const DayView: React.FC<DayViewProps> = ({ events, clients, onEventModified, dailyLimit }) => {
  return (
    <Box sx={{ padding: 2, width: "100%", maxWidth: "100%" }}>
      <EventCountHeader events={events} limit={dailyLimit} />

      {events.length === 0 ? (
        <Typography>No deliveries scheduled for this day.</Typography>
      ) : (
        <Box
          sx={{
            maxHeight: "75vh",
            overflowY: "auto",
            width: "100%", // Ensures consistent width
          }}
        >
          {events.map((event) => {
            const client = clients.find((client) => client.uid === event.clientId);
            return (
              <DeliveryCard
                key={event.id}
                event={event}
                client={client}
                onEventModified={onEventModified}
                allEvents={events}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default DayView;