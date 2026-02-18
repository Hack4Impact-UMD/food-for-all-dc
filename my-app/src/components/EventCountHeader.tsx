import React from "react";
import { Box, Typography } from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";

interface DeliveryCountHeaderProps {
  events: readonly unknown[];
  limit?: number;
}

const DeliveryCountHeader = React.memo(function DeliveryCountHeader({
  events,
  limit,
}: DeliveryCountHeaderProps) {
  const eventCount = events.length;
  const numericLimit = typeof limit === "number" ? limit : null;
  const isOverLimit = numericLimit !== null && eventCount > numericLimit;
  const overBy = isOverLimit ? eventCount - numericLimit : 0;
  const progressWidth =
    numericLimit === null
      ? 0
      : numericLimit <= 0
        ? eventCount > 0
          ? 100
          : 0
        : Math.min((eventCount / numericLimit) * 100, 100);

  const accentColor = isOverLimit ? "var(--color-error-text)" : "var(--color-primary)";
  const backgroundColor = isOverLimit
    ? "var(--color-error-background)"
    : "var(--color-background-green-cyan)";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        marginBottom: 2.4,
        padding: 0.8075,
        backgroundColor,
        borderRadius: 2,
        borderLeft: `4px solid ${accentColor}`,
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
            backgroundColor: accentColor,
            borderRadius: "50%",
            marginRight: 1.6,
          }}
        >
          <LocalShippingIcon sx={{ color: "var(--color-background-main)", fontSize: "1rem" }} />
        </Box>
        <Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: accentColor,
              lineHeight: 1,
              marginBottom: 0.4,
              minWidth: "2ch",
            }}
          >
            {numericLimit !== null ? `${eventCount} / ${numericLimit}` : eventCount}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: isOverLimit ? "var(--color-error-text)" : "var(--color-text-medium-alt)",
              fontWeight: 500,
              textTransform: "uppercase",
              fontSize: "0.75rem",
              letterSpacing: "0.4px",
              whiteSpace: "nowrap",
            }}
          >
            {eventCount === 1 ? "Delivery" : "Deliveries"} Today
          </Typography>
          {isOverLimit && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "var(--color-error-text)",
                fontWeight: 700,
                mt: 0.25,
              }}
            >
              Over daily limit by {overBy}
            </Typography>
          )}
        </Box>
      </Box>
      {numericLimit !== null && (
        <Box
          sx={{
            width: "100%",
            height: 4,
            backgroundColor: "var(--color-border-medium)",
            borderRadius: 2,
            marginTop: 0.8,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: `${progressWidth}%`,
              height: "100%",
              backgroundColor: accentColor,
              borderRadius: 2,
              transition: "width 0.3s ease",
            }}
          />
        </Box>
      )}
    </Box>
  );
});

export default DeliveryCountHeader;
