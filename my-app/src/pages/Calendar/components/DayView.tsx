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
    <Box sx={{ padding: 1, width: "100%", maxWidth: "100%", display: "flex", flexDirection: "column", height: "97%", minHeight: "300px", overflow: "hidden" }}>
      <EventCountHeader events={events} limit={dailyLimit} />

      {events.length === 0 ? (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 2 }}>
          <Typography variant="body1" sx={{ textAlign: "center", color: "text.secondary" }}>
            No deliveries scheduled for this day.
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            width: "100%", // Ensures consistent width
            minHeight: 0, // Allow flex item to shrink
            maxHeight: "calc(100vh - 280px)", // More conservative height calculation
            overflow: "hidden auto", // Explicit scroll behavior
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
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default DayView;