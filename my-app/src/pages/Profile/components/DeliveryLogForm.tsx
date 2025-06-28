import React, { useState, useEffect } from "react";
import { Box, Typography, Chip, Stack, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button } from "@mui/material";
import { DeliveryEvent } from "../../../types";
import DeliveryService from "../../../services/delivery-service";

// Ensure DeliveryLogProps is properly defined
interface DeliveryEventWithHidden extends DeliveryEvent {
    hidden?: boolean;
}

export interface DeliveryLogProps {
    pastDeliveries: DeliveryEvent[];
    futureDeliveries: DeliveryEventWithHidden[]; // Update type to include hidden property
    fieldLabelStyles: any;
    onDeleteDelivery: (delivery: DeliveryEvent) => Promise<void>;
}

const DeliveryLogForm: React.FC<DeliveryLogProps> = ({
    pastDeliveries,
    futureDeliveries,
    fieldLabelStyles,
    onDeleteDelivery, // Destructure the restored property
}) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState<DeliveryEvent | null>(null);
    const [deletingChipId, setDeletingChipId] = useState<string | null>(null);
    const [futureDeliveriesState, setFutureDeliveries] = useState<DeliveryEventWithHidden[]>(futureDeliveries); // Local state for future deliveries
    const [zoomingInChipId, setZoomingInChipId] = useState<string | null>(null); // New state for zoom-in transition

    const deliveryService = DeliveryService.getInstance();

    const formatDate = (date: Date | string): string => {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
            return 'Invalid date';
        }
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const year = dateObj.getFullYear();
        return `${month}/${day}/${year}`;
    };

    // Sort the delivery dates before rendering the Chips
    const sortedFutureDeliveries = [...futureDeliveriesState].sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime());
    const sortedPastDeliveries = [...pastDeliveries].sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime());

    const handleDeleteClick = (delivery: DeliveryEvent) => {
        setSelectedDelivery(delivery);
        setConfirmDelete(true);
    };

    const fetchFutureDeliveries = async () => {
        try {
            if (!selectedDelivery?.clientId) {
                return;
            }

            const allEvents = await deliveryService.getEventsByClientId(selectedDelivery.clientId);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            const futureDeliveries = allEvents.filter((event) => event.deliveryDate >= today)
                .sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime())
                .slice(0, 5); // Ensure only the next 5 future deliveries are included

            const currentIds = futureDeliveriesState.map((delivery) => delivery.id);
            const newDeliveries = futureDeliveries.filter((delivery) => !currentIds.includes(delivery.id));

            setFutureDeliveries(futureDeliveries.map((delivery) => ({ ...delivery, hidden: true }))); // Add hidden property to all deliveries

            // Wait for the chips to load on the DOM and animate only the new chip
            setTimeout(() => {
                newDeliveries.forEach((delivery) => {
                    setZoomingInChipId(delivery.id);
                    setFutureDeliveries((prev) => prev.map((d) =>
                        d.id === delivery.id ? { ...d, hidden: false } : d
                    ));

                    setTimeout(() => {
                        setZoomingInChipId(null);
                    }, 1200); // Match zoom-in transition duration
                });
            }, 100); // Initial delay to ensure DOM readiness
        } catch (error) {
            console.error("Error fetching future deliveries:", error);
        }
    };

    const handleConfirmDelete = async () => {
        if (selectedDelivery) {
            setDeletingChipId(selectedDelivery.id); // Trigger zoom-out transition
            setTimeout(async () => {
                try {
                    // Added validation for selectedDelivery and its id
                    if (!selectedDelivery || !selectedDelivery.id) {
                        console.error("Invalid selectedDelivery or missing ID:", selectedDelivery);
                        return;
                    }

                    await deliveryService.deleteEvent(selectedDelivery.id);
                    console.log(`Successfully deleted delivery with ID: ${selectedDelivery.id}`);
                    console.log(`Client ID associated with the deleted delivery: ${selectedDelivery.clientId}`);

                    // Remove the deleted delivery from the local state
                    setFutureDeliveries((prev) => prev.filter((delivery) => delivery.id !== selectedDelivery.id));

                    // Requery the database to ensure consistency
                    const allEvents = await deliveryService.getEventsByClientId(selectedDelivery.clientId);
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                    const futureDeliveries = allEvents.filter((event) => event.deliveryDate >= today)
                        .sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime())
                        .slice(0, 5); // Ensure only the next 5 future deliveries are included

                    const currentIds = futureDeliveriesState.map((delivery) => delivery.id);
                    const newDeliveries = futureDeliveries.filter((delivery) => !currentIds.includes(delivery.id));

                    // Add the new chip with hidden property
                    setFutureDeliveries((prev) => [
                        ...prev,
                        ...newDeliveries.map((delivery) => ({ ...delivery, hidden: true })),
                    ]);

                    // Animate the new chip after the deletion process
                    setTimeout(() => {
                        newDeliveries.forEach((delivery) => {
                            setZoomingInChipId(delivery.id);
                            setFutureDeliveries((prev) => prev.map((d) =>
                                d.id === delivery.id ? { ...d, hidden: false } : d
                            ));

                            setTimeout(() => {
                                setZoomingInChipId(null);
                            }, 1200); // Match zoom-in transition duration
                        });
                    }, 100); // Initial delay to ensure DOM readiness
                } catch (error) {
                    console.error("Error deleting delivery:", error);
                }
                setDeletingChipId(null); // Reset zoom-out state
            }, 300); // Match zoom-out transition duration
        }
        setConfirmDelete(false);
        setSelectedDelivery(null);
    };

    const handleCancelDelete = () => {
        setConfirmDelete(false);
        setSelectedDelivery(null);
    };

    // Apply transition styles to Chips
    const chipStyle = (deliveryId: string, hidden = false) => {
        if (hidden) {
            return {
                opacity: 0,
                transform: "scale(0.8)", // Slightly shrink before disappearing
                transition: "opacity 0.5s ease, transform 0.3s ease", // Smooth transition
            };
        }
        if (deletingChipId === deliveryId) {
            return {
                transform: "scale(0.8)", // Shrink slightly before disappearing
                opacity: 0, // Fade out
                transition: "opacity 0.75s ease, transform 0.5s ease", // Smooth fade-out
            };
        }
        if (zoomingInChipId === deliveryId) {
            return {
                transform: "scale(1)",
                opacity: 1,
                transition: "transform 0.5s ease-in-out, opacity 0.5s ease-in-out", // Smooth zoom-in
            };
        }
        return {
            opacity: 1,
            transform: "scale(1)",
            transition: "opacity 0.3s ease, transform 0.3s ease", // Default smooth transition
        };
    };

    useEffect(() => {
        setFutureDeliveries(futureDeliveries);
    }, [futureDeliveries]);

    return (
        <>
            {/* Confirmation Modal */}
            <Dialog
                open={confirmDelete}
                onClose={handleCancelDelete}
            >
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this delivery?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDelete} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmDelete} color="secondary">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

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
                        {sortedFutureDeliveries.length > 0 ? (
                            sortedFutureDeliveries.map((delivery, index) => (
                                <Chip
                                    key={delivery.id}
                                    label={formatDate(delivery.deliveryDate)}
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => console.log('Chip clicked:', delivery)}
                                    onDelete={() => handleDeleteClick(delivery)}
                                    sx={chipStyle(delivery.id, delivery.hidden)}
                                />
                            ))
                        ) : (
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                No upcoming deliveries
                            </Typography>
                        )}
                    </Stack>

                    {/* Previous Deliveries */}
                    <Typography className="field-descriptor" sx={fieldLabelStyles}>
                        PREVIOUS
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        {sortedPastDeliveries.length > 0 ? (
                            sortedPastDeliveries.map((delivery, index) => (
                                <Chip
                                    key={delivery.id}
                                    label={formatDate(delivery.deliveryDate)}
                                    variant="outlined"
                                    color="secondary"
                                    clickable={false} // Ensure past Chips are not clickable
                                    sx={{ pointerEvents: 'none' }} // Disable pointer events
                                />
                            ))
                        ) : (
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
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