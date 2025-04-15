import React from "react";
import { Box, Typography, IconButton } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useNavigate } from "react-router-dom";
import EventMenu from "./EventMenu";
import { Client, DeliveryEvent } from "./types";

interface DeliveryCardProps {
  event: DeliveryEvent;
  client?: Client;
  onEventModified: () => void;
}

const DeliveryCard: React.FC<DeliveryCardProps> = ({ event, client, onEventModified }) => {
  const navigate = useNavigate();

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = ("" + phone).replace(/\D/g, ""); // Remove non-numeric characters
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/); // Match the phone number pattern
    if (match) {
      return `(${match[1]})-${match[2]}-${match[3]}`; // Format as (xxx)-xxx-xxxx
    }
    return phone; // Return the original phone if it doesn't match the pattern
  };

  const trueRestrictions = Object.entries(client?.deliveryDetails?.dietaryRestrictions || {})
    .filter(([key, value]) => value === true)
    .map(([key]) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (str) => str.toUpperCase()));

  const { foodAllergens = [], other = [] } = client?.deliveryDetails?.dietaryRestrictions || {};

  const dietaryRestrictions = [...trueRestrictions, ...foodAllergens, ...other];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        padding: 3,
        marginBottom: 1,
        border: "1px solid #fff",
        borderRadius: "10px",
        backgroundColor: "#F3F3F3",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginRight: 5,
        }}
      >
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: "bold",
              color: "#787777",
            }}
          >
            {event.clientName}
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              cursor: "pointer",
              alignItems: "center",
            }}
            onClick={() => {
              navigate(`/profile/${client?.uid}`);
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: "600",
                color: "#257E68",
                marginTop: 0.25,
                whiteSpace: "nowrap",
              }}
            >
              NOTES AND DETAILS
            </Typography>
            <KeyboardArrowDownIcon
              sx={{
                fontSize: 25,
                color: "#257E68",
              }}
            />
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          backgroundColor: "#D9D9D9",
          width: 2,
          height: 120,
          marginRight: 5,
        }}
      ></Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          width: "100%",
          gap: "30px",
        }}
      >
        {[
          {
            label: "PHONE",
            value: client?.phone ? formatPhoneNumber(client.phone) : "N/A",
            color: "#787777",
          },
          {
            label: "ADDRESS",
            value: client?.address || "N/A",
            color: "#787777",
          },
          {
            label: "DIETARY RESTRICTIONS",
            value: dietaryRestrictions.length ? dietaryRestrictions.join(", ") : "N/A",
            color: "#787777",
          },
          {
            label: "TAGS",
            value: client?.tags?.length ? client.tags.join(", ") : "N/A",
            color: "#787777",
          },
          {
            label: "NOTES",
            value: client?.notes || "N/A",
            color: "#787777",
          },
        ].map(({ label, value, color }) => (
          <Box
            key={label}
            sx={{
              display: "flex",
              flexDirection: "column",
              marginLeft: 2,
              flex: "1 1 120px",
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: "600",
                color: "#BDBDBD",
                marginBottom: "4px",
              }}
            >
              {label}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: "bold", color: color }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      {/* Three-dot menu button */}
      <EventMenu event={event} onEventModified={onEventModified} />
    </Box>
  );
};

export default DeliveryCard;