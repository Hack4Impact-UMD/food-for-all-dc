import React from "react";
import { Box, Typography, Chip, Stack } from "@mui/material";
import { DeliveryEvent } from "../../../types";

interface DeliveryLogProps {
    pastDeliveries: DeliveryEvent[],
    futureDeliveries: DeliveryEvent[],
    fieldLabelStyles: any;
}

const DeliveryLogForm: React.FC<DeliveryLogProps> = ({
    pastDeliveries,
    futureDeliveries,
    fieldLabelStyles,
}) => {

    const formatDate = (date: Date): string => {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    };

    return (
        <>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, 1fr)",
                        md: "repeat(3, 1fr)",
                    },
                    alignItems: "center",
                }}
                className="info-grid"
            >
                <Box sx={{ gridColumn: "-1/1" }}>
                    {/* Upcoming Deliveries */}
                    <Typography className="field-descriptor" sx={fieldLabelStyles}>
                        UPCOMING
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
                        {futureDeliveries.length > 0 ? (
                            futureDeliveries.map((delivery, index) => (
                                <Chip
                                    key={index}
                                    label={formatDate(new Date(delivery.deliveryDate))}
                                    variant="outlined"
                                    color="primary"
                                />
                            ))
                        ) : (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                No upcoming deliveries
                            </Typography>
                        )}
                    </Stack>

                    {/* Previous Deliveries */}
                    <Typography className="field-descriptor" sx={fieldLabelStyles}>
                        PREVIOUS
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        {pastDeliveries.length > 0 ? (
                            pastDeliveries.map((delivery, index) => (
                                <Chip
                                    key={index}
                                    label={formatDate(new Date(delivery.deliveryDate))}
                                    variant="outlined"
                                    color="secondary"
                                />
                            ))
                        ) : (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                No previous deliveries
                            </Typography>
                        )}
                    </Stack>
                </Box>
            </Box>
        </>
    );
};

export default DeliveryLogForm;