import React from "react";
import { Box, Typography, LinearProgress } from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
interface DeliveryCountHeaderProps {
    events: any[];
    limit?: number;
}
export default function DeliveryCountHeader({events, limit}: DeliveryCountHeaderProps) {
    return (
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
            </Box>
            <Box sx={{ flex: 1 }}>
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
                    {events.length}{limit ? ` / ${limit}` : ''}
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
                        marginBottom: limit ? 0.5 : 0,
                    }}
                >
                    {events.length === 1 ? "Delivery" : "Deliveries"} Today
                </Typography>
                {limit && (
                    <Box sx={{ width: '100%', mt: 0.5 }}>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min((events.length / limit) * 100, 100)}
                            sx={{
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: '#e0e0e0',
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: events.length > limit ? '#ff4444' : '#257E68',
                                    borderRadius: 3,
                                },
                            }}
                        />
                    </Box>
                )}
            </Box>
        </Box>
    )
}
