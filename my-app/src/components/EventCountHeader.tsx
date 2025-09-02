import React from "react";
import { Box, Typography } from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
interface DeliveryCountHeaderProps {
  events: any[];
  limit?: number;
}
export default function DeliveryCountHeader({ events, limit }: DeliveryCountHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        marginBottom: 2.4,
        padding: 0.8075,
        backgroundColor: "#f8fffe",
        borderRadius: 2,
        borderLeft: "4px solid #257E68",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        width: "100%",
        boxSizing: "border-box",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          width: "100%",
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
        </Box>
        <Box>
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
            {limit !== undefined ? `${events.length} / ${limit}` : events.length}
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
      {limit !== undefined && (
        <Box
          sx={{
            width: "100%",
            height: 4,
            backgroundColor: "#e0e0e0",
            borderRadius: 2,
            marginTop: 0.8,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: `${Math.min((events.length / limit) * 100, 100)}%`,
              height: "100%",
              backgroundColor: "#257E68",
              borderRadius: 2,
              transition: "width 0.3s ease",
            }}
          />
        </Box>
      )}
    </Box>
  );
}
