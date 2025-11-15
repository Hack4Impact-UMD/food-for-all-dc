import React from "react";
import { Box, Typography } from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
interface DeliveryCountHeaderProps {
    events: any[]
    limit?: number
}
const DeliveryCountHeader = React.memo(function DeliveryCountHeader({events, limit}: DeliveryCountHeaderProps) {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                marginBottom: 2.4,
                padding: 0.8075,
                backgroundColor: "var(--color-background-green-cyan)",
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
                        backgroundColor: "var(--color-primary)",
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
                            color: "var(--color-primary)",
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
                            color: "var(--color-text-medium-alt)",
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
                        backgroundColor: "var(--color-border-medium)",
                        borderRadius: 2,
                        marginTop: 0.8,
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            width: `${Math.min((events.length / limit) * 100, 100)}%`,
                            height: "100%",
                            backgroundColor: "var(--color-primary)",
                            borderRadius: 2,
                            transition: "width 0.3s ease",
                        }}
                    />
                </Box>
            )}
        </Box>
    )
});

export default DeliveryCountHeader;
