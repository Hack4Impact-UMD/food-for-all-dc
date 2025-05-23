import React from "react";
import { Box, Typography, IconButton } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useNavigate } from "react-router-dom";
import EventMenu from "./EventMenu";
import { ClientProfile } from "../../../types/client-types";
import { DeliveryEvent } from "../../../types/calendar-types";
import styles from "./DeliveryCard.module.css";

interface DeliveryCardProps {
  event: DeliveryEvent;
  client?: ClientProfile;
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

  const dietaryRestrictions = [...trueRestrictions, ...(Array.isArray(foodAllergens) ? foodAllergens : []), ...(Array.isArray(other) ? other : [])];

  return (
    <Box className={styles.card}>
      <Box className={styles.clientSection}>
        <Box>
          <Typography variant="h6" className={styles.clientName}>
            {event.clientName}
          </Typography>
          <Box 
            className={styles.detailsLink}
            onClick={() => {
              navigate(`/profile/${client?.uid}`);
            }}
          >
            <Typography variant="subtitle2" className={styles.detailsText}>
              NOTES AND DETAILS
            </Typography>
            <KeyboardArrowDownIcon className={styles.detailsIcon} />
          </Box>
        </Box>
      </Box>

      <Box className={styles.divider}></Box>

      <Box className={styles.infoContainer}>
        {[
          {
            label: "PHONE",
            value: client?.phone ? formatPhoneNumber(client.phone) : "N/A",
          },
          {
            label: "ADDRESS",
            value: client?.address || "N/A",
          },
          {
            label: "DIETARY RESTRICTIONS",
            value: dietaryRestrictions.length ? dietaryRestrictions.join(", ") : "N/A",
          },
          {
            label: "TAGS",
            value: client?.tags?.length ? client.tags.join(", ") : "N/A",
          },
          {
            label: "NOTES",
            value: client?.notes || "N/A",
          },
        ].map(({ label, value }) => (
          <Box key={label} className={styles.infoItem}>
            <Typography variant="subtitle2" className={styles.infoLabel}>
              {label}
            </Typography>
            <Typography variant="body1" className={styles.infoValue}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
        <EventMenu event={event} onEventModified={onEventModified} />
      </Box>
    </Box>
  );
};

export default DeliveryCard;