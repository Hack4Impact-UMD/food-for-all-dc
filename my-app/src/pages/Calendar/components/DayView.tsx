import React from "react";
import { Box, Typography } from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { DeliveryEvent } from "../../../types/calendar-types";
import { ClientProfile } from "../../../types/client-types";
import DeliveryCard from "./DeliveryCard";

interface DayViewProps {
  events: DeliveryEvent[];
  clients: ClientProfile[];
  onEventModified: () => void;
}

const DayView: React.FC<DayViewProps> = ({ events, clients, onEventModified }) => {
  return (
    <Box sx={{ padding: 2, width: "100%", maxWidth: "100%" }}>
      {/* Delivery Count Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          marginBottom: 2.4,
          padding: 1.9,
          backgroundColor: "#f8fffe",
          borderRadius: 2,
          borderLeft: "4px solid #257E68",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            backgroundColor: "#257E68",
            borderRadius: "50%",
            marginRight: 1.6,
          }}
        >
          <LocalShippingIcon sx={{ color: "#fff", fontSize: "1rem" }} />
        </Box>        <Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: "#257E68",
              lineHeight: 1,
              marginBottom: 0.4,
              minWidth: "2ch", // Ensures consistent width for numbers
            }}
          >
            {events.length}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "#666",
              fontWeight: 500,
              textTransform: "uppercase",
              fontSize: "0.75rem",
              letterSpacing: "0.4px",
              whiteSpace: "nowrap", // Prevents text wrapping
            }}
          >
            {events.length === 1 ? "Delivery" : "Deliveries"} Today
          </Typography>
        </Box>
      </Box>

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
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default DayView;