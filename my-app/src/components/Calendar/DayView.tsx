import React from "react";
import { Box, Typography } from "@mui/material";
import { Client, DeliveryEvent } from "./types";
import DeliveryCard from "./DeliveryCard";

interface DayViewProps {
  events: DeliveryEvent[];
  clients: Client[];
  onEventModified: () => void;
}

const DayView: React.FC<DayViewProps> = ({ events, clients, onEventModified }) => {
  return (
    <Box sx={{ padding: 2 }}>
      {events.length === 0 ? (
        <Typography>No deliveries scheduled for this day.</Typography>
      ) : (
        <Box
          sx={{
            maxHeight: "75vh",
            overflowY: "auto",
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