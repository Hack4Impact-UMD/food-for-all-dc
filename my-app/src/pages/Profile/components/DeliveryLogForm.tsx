import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Chip,
  Stack,
  Alert,
} from "@mui/material";
import ConfirmationModal from "../../../components/ConfirmationModal";
import { DeliveryEvent } from "../../../types";
import DeliveryService from "../../../services/delivery-service";
import { deliveryDate } from "../../../utils/deliveryDate";

interface DeliveryEventWithHidden extends DeliveryEvent {
  hidden?: boolean;
}

export interface DeliveryLogProps {
  clientId: string;
  pastDeliveries: DeliveryEvent[];
  futureDeliveries: DeliveryEventWithHidden[];
  fieldLabelStyles: any;
  onDeleteDelivery: (delivery: DeliveryEvent) => Promise<void>;
  onMarkDeliveryMissed: (delivery: DeliveryEvent) => Promise<void>;
  onRestoreMissedDelivery: (delivery: DeliveryEvent) => Promise<void>;
}

const DeliveryLogForm: React.FC<DeliveryLogProps> = ({
  clientId,
  pastDeliveries,
  futureDeliveries,
  fieldLabelStyles,
  onDeleteDelivery,
  onMarkDeliveryMissed,
  onRestoreMissedDelivery,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryEvent | null>(null);
  const [futureDeliveriesState, setFutureDeliveries] =
    useState<DeliveryEventWithHidden[]>(futureDeliveries);
  const [missedDeliveries, setMissedDeliveries] = useState<DeliveryEvent[]>([]);
  const [draggedDelivery, setDraggedDelivery] = useState<DeliveryEvent | null>(null);
  const [draggedSource, setDraggedSource] = useState<"past" | "future" | "missed" | null>(
    null
  );
  const [dropError, setDropError] = useState<string>("");
  const [confirmThirdStrike, setConfirmThirdStrike] = useState(false);
  const [pendingMissedDrop, setPendingMissedDrop] = useState<{
    delivery: DeliveryEvent;
    source: "past" | "future";
  } | null>(null);

  const deliveryService = DeliveryService.getInstance();

  const formatDate = (date: DeliveryEvent["deliveryDate"] | Date | string): string => {
    const normalized = deliveryDate.tryToDateTime(date);
    return normalized ? normalized.toFormat("MM/dd/yyyy") : "Invalid date";
  };

  const sortDeliveryDates = (deliveries: DeliveryEvent[]) => {
    return [...deliveries].sort((a, b) => deliveryDate.compare(a.deliveryDate, b.deliveryDate));
  };

  const isMissed = (delivery: DeliveryEvent) => delivery.deliveryStatus === "Missed";

  const isToday = (date: DeliveryEvent["deliveryDate"]) =>
    deliveryDate.isSameDay(date, deliveryDate.today());

  const isDragging = draggedDelivery !== null;
  const canDropToUpcoming = isDragging && draggedSource === "missed" && draggedDelivery !== null && isToday(draggedDelivery.deliveryDate);
  const canDropToMissed = isDragging && (draggedSource === "past" || draggedSource === "future");
  const canDropToPrevious = isDragging && draggedSource === "missed" && draggedDelivery !== null && !isToday(draggedDelivery.deliveryDate);

  const canDragFromUpcoming = (delivery: DeliveryEvent) => isToday(delivery.deliveryDate);

  const loadMissedDeliveries = useCallback(async () => {
    if (!clientId) {
      setMissedDeliveries([]);
      return;
    }

    try {
      const events = await deliveryService.getEventsByClientId(clientId);
      const missed = sortDeliveryDates(events.filter((event) => isMissed(event)));
      setMissedDeliveries(missed);
    } catch (error) {
      console.error("Error fetching missed deliveries:", error);
    }
  }, [clientId, deliveryService]);

  const handleDragStart = (delivery: DeliveryEvent, source: "past" | "future" | "missed", event: React.DragEvent) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify({ id: delivery.id, source }));

    // Create a chip-like drag ghost so it looks like you're holding the chip
    const ghost = document.createElement("div");
    ghost.textContent = formatDate(delivery.deliveryDate);
    ghost.style.cssText = `
      position: fixed; top: -9999px; left: -9999px;
      padding: 4px 12px;
      border: 1px solid currentColor;
      border-radius: 16px;
      font-size: 0.8125rem;
      font-family: inherit;
      font-weight: 400;
      line-height: 1.43;
      white-space: nowrap;
      opacity: 0.9;
      pointer-events: none;
      background: var(--color-background-main, #fff);
      color: ${source === "missed" ? "#d32f2f" : source === "future" ? "#1976d2" : "#7b1fa2"};
      border-color: ${source === "missed" ? "#d32f2f" : source === "future" ? "#1976d2" : "#7b1fa2"};
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
    setTimeout(() => document.body.removeChild(ghost), 0);

    // Defer state update so drag can initiate first
    setTimeout(() => {
      setDraggedDelivery(delivery);
      setDraggedSource(source);
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggedDelivery(null);
    setDraggedSource(null);
  };

  const applyDropToMissed = useCallback(
    async (deliveryToMove: DeliveryEvent, source: "past" | "future") => {
      // Optimistically update UI so the chip moves immediately on drop.
      if (source === "future") {
        setFutureDeliveries((prev) => prev.filter((delivery) => delivery.id !== deliveryToMove.id));
      }
      setMissedDeliveries((prev) => {
        if (prev.some((delivery) => delivery.id === deliveryToMove.id)) {
          return prev;
        }
        return sortDeliveryDates([
          ...prev,
          {
            ...deliveryToMove,
            deliveryStatus: "Missed",
          } as DeliveryEvent,
        ]);
      });

      try {
        await onMarkDeliveryMissed(deliveryToMove);
        await loadMissedDeliveries();
      } catch (error) {
        console.error("Error marking delivery as missed:", error);
        setDropError("Unable to mark delivery as missed. Please try again.");

        // Roll back optimistic state on failure.
        setMissedDeliveries((prev) => prev.filter((delivery) => delivery.id !== deliveryToMove.id));
        if (source === "future") {
          setFutureDeliveries((prev) =>
            sortDeliveryDates([
              ...prev,
              {
                ...deliveryToMove,
                hidden: false,
              } as DeliveryEventWithHidden,
            ]) as DeliveryEventWithHidden[]
          );
        }
      }
    },
    [loadMissedDeliveries, onMarkDeliveryMissed]
  );

  const queueDropToMissed = useCallback(
    async (deliveryToMove: DeliveryEvent, source: "past" | "future") => {
      const willBeThirdStrike = missedDeliveries.length === 2;
      if (willBeThirdStrike) {
        setDropError("");
        setPendingMissedDrop({ delivery: deliveryToMove, source });
        setConfirmThirdStrike(true);
        return;
      }

      await applyDropToMissed(deliveryToMove, source);
    },
    [applyDropToMissed, missedDeliveries.length]
  );

  const restoreMissedToUpcoming = useCallback(
    async (deliveryToMove: DeliveryEvent) => {
      // Optimistically update UI so the chip moves immediately on drop.
      setMissedDeliveries((prev) => prev.filter((delivery) => delivery.id !== deliveryToMove.id));
      setFutureDeliveries((prev) => {
        if (prev.some((delivery) => delivery.id === deliveryToMove.id)) {
          return prev;
        }

        const { deliveryStatus: _deliveryStatus, ...restoredDelivery } = deliveryToMove as DeliveryEvent & {
          deliveryStatus?: string;
        };

        return sortDeliveryDates([
          ...prev,
          {
            ...restoredDelivery,
            hidden: false,
          } as DeliveryEventWithHidden,
        ]) as DeliveryEventWithHidden[];
      });

      if (!isToday(deliveryToMove.deliveryDate)) {
        setDropError("Only today's missed delivery can be moved back to upcoming.");

        setFutureDeliveries((prev) => prev.filter((delivery) => delivery.id !== deliveryToMove.id));
        setMissedDeliveries((prev) =>
          sortDeliveryDates([
            ...prev,
            {
              ...deliveryToMove,
              deliveryStatus: "Missed",
            } as DeliveryEvent,
          ])
        );
        return;
      }

      try {
        await onRestoreMissedDelivery(deliveryToMove);
        await loadMissedDeliveries();
        setDropError("");
      } catch (error) {
        console.error("Error restoring missed delivery:", error);
        setDropError("Unable to move delivery back to upcoming. Please try again.");

        setFutureDeliveries((prev) => prev.filter((delivery) => delivery.id !== deliveryToMove.id));
        setMissedDeliveries((prev) =>
          sortDeliveryDates([
            ...prev,
            {
              ...deliveryToMove,
              deliveryStatus: "Missed",
            } as DeliveryEvent,
          ])
        );
      }
    },
    [loadMissedDeliveries, onRestoreMissedDelivery]
  );

  const restoreMissedToPrevious = useCallback(
    async (deliveryToMove: DeliveryEvent) => {
      if (isToday(deliveryToMove.deliveryDate)) {
        setDropError("Today's missed delivery can only be moved back to upcoming.");
        return;
      }

      setMissedDeliveries((prev) => prev.filter((delivery) => delivery.id !== deliveryToMove.id));

      try {
        await onRestoreMissedDelivery(deliveryToMove);
        await loadMissedDeliveries();
        setDropError("");
      } catch (error) {
        console.error("Error restoring missed delivery to previous:", error);
        setDropError("Unable to move delivery back to previous. Please try again.");
        await loadMissedDeliveries();
      }
    },
    [loadMissedDeliveries, onRestoreMissedDelivery]
  );

  const handleDropToMissed = async () => {
    if (!draggedDelivery || draggedSource === "missed") {
      return;
    }

    const deliveryToMove = draggedDelivery;
    const source = draggedSource;
    setDraggedDelivery(null);
    setDraggedSource(null);

    if (source !== "past" && source !== "future") {
      return;
    }

    await queueDropToMissed(deliveryToMove, source);
  };

  const handleConfirmThirdStrike = async () => {
    if (!pendingMissedDrop) {
      setConfirmThirdStrike(false);
      return;
    }

    setConfirmThirdStrike(false);
    const { delivery, source } = pendingMissedDrop;
    setPendingMissedDrop(null);
    await applyDropToMissed(delivery, source);
  };

  const handleCancelThirdStrike = () => {
    setConfirmThirdStrike(false);
    setPendingMissedDrop(null);
  };

  const handleDropToUpcoming = async () => {
    if (!draggedDelivery || draggedSource !== "missed") {
      return;
    }

    const deliveryToMove = draggedDelivery;

    setDraggedDelivery(null);
    setDraggedSource(null);
    await restoreMissedToUpcoming(deliveryToMove);
  };

  const handleDropToPrevious = async (event: React.DragEvent) => {
    event.preventDefault();
    setDraggedDelivery(null);
    setDraggedSource(null);
    
    try {
      const data = JSON.parse(event.dataTransfer.getData("application/json"));
      
      if (data.source !== "missed") {
        return;
      }
      
      const deliveryToMove = missedDeliveries.find((d) => d.id === data.id);
      if (!deliveryToMove) {
        return;
      }

      await restoreMissedToPrevious(deliveryToMove);
    } catch (error) {
      console.error("Error restoring missed delivery to previous:", error);
      setDropError("Unable to move delivery back to previous. Please try again.");
      await loadMissedDeliveries();
    }
  };

  const sortedFutureDeliveries = sortDeliveryDates(
    futureDeliveriesState.filter((delivery) => !isMissed(delivery))
  );
  const sortedPastDeliveries = sortDeliveryDates(
    pastDeliveries.filter((delivery) => !isMissed(delivery))
  );

  const handleDeleteClick = (delivery: DeliveryEvent) => {
    setSelectedDelivery(delivery);
    setConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedDelivery) {
      setTimeout(async () => {
        try {
          if (!selectedDelivery || !selectedDelivery.id) {
            console.error("Invalid selectedDelivery or missing ID:", selectedDelivery);
            return;
          }

          const currentIds = futureDeliveriesState.map((delivery) => delivery.id);

          await deliveryService.deleteEvent(selectedDelivery.id);

          try {
            await onDeleteDelivery(selectedDelivery);
          } catch (parentError) {
            console.error("Error notifying parent of delivery deletion:", parentError);
          }

          const allEvents = await deliveryService.getEventsByClientId(selectedDelivery.clientId);
          const futureDeliveries = sortDeliveryDates(
            allEvents.filter((event) => deliveryDate.compare(event.deliveryDate, deliveryDate.today()) >= 0)
          );

          const currentIdsWithoutDeleted = currentIds.filter((id) => id !== selectedDelivery.id);
          const newDeliveries = futureDeliveries.filter(
            (delivery) => !currentIdsWithoutDeleted.includes(delivery.id)
          );

          setFutureDeliveries(
            futureDeliveries.map((delivery) => ({
              ...delivery,
              hidden: newDeliveries.some((newDel) => newDel.id === delivery.id),
            }))
          );

          if (newDeliveries.length > 0) {
            setTimeout(() => {
              newDeliveries.forEach((delivery) => {
                setFutureDeliveries((prev) =>
                  prev.map((d) => (d.id === delivery.id ? { ...d, hidden: false } : d))
                );
              });
            }, 100);
          }
        } catch (error) {
          console.error("Error deleting delivery:", error);
        }
      }, 300);
    }
    setConfirmDelete(false);
    setSelectedDelivery(null);
  };

  const handleCancelDelete = () => {
    setConfirmDelete(false);
    setSelectedDelivery(null);
  };

  useEffect(() => {
    setFutureDeliveries(futureDeliveries);
  }, [futureDeliveries]);

  useEffect(() => {
    loadMissedDeliveries();
  }, [loadMissedDeliveries, pastDeliveries, futureDeliveries]);

  return (
    <>
      <ConfirmationModal
        open={confirmDelete}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Delivery"
        message="Are you sure you want to delete this delivery? This action cannot be undone."
        confirmText="Delete"
        confirmColor="error"
      />

      <ConfirmationModal
        open={confirmThirdStrike}
        onClose={handleCancelThirdStrike}
        onConfirm={handleConfirmThirdStrike}
        title="Confirm Third Missed Delivery"
        message={
          <>
            This will be the client&apos;s 3rd missed delivery. They will be declared inactive and
            all deliveries will be deleted and their end date set to today. If you wish to
            reactivate them you will need to set a new end date and assign new deliveries.{" "}
            <strong>Are you sure you want to continue?</strong>
          </>
        }
        confirmText="Yes, Continue"
        cancelText="No"
        confirmColor="error"
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          },
          alignItems: "center",
          overflow: "hidden",
          minWidth: 0,
        }}
        className="info-grid"
      >
        <Box sx={{ gridColumn: "-1/1", minWidth: 0 }}>
          {dropError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {dropError}
            </Alert>
          )}

          {/* Upcoming Deliveries */}
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            UPCOMING
          </Typography>
          <Box
            onDragOver={(event) => event.preventDefault()}
            onDrop={async (event) => {
              event.preventDefault();
              await handleDropToUpcoming();
            }}
            sx={{
              mb: 2,
              overflow: "hidden",
              border: canDropToUpcoming
                ? "1px dashed var(--color-text-secondary)"
                : "1px solid transparent",
              borderRadius: 1,
              p: canDropToUpcoming ? 1 : 0,
              minHeight: canDropToUpcoming ? 52 : "auto",
              width: "100%",
              backgroundColor: canDropToUpcoming ? "var(--color-background-main)" : "transparent",
              transition: "border-color 0.2s ease, background-color 0.2s ease, padding 0.2s ease",
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", maxHeight: 32, overflow: "hidden" }}
            >
              {sortedFutureDeliveries.length > 0 ? (
                sortedFutureDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    draggable={canDragFromUpcoming(delivery)}
                    onDragStart={(e) =>
                      canDragFromUpcoming(delivery) && handleDragStart(delivery, "future", e)
                    }
                    onDragEnd={handleDragEnd}
                    style={{
                      cursor: canDragFromUpcoming(delivery) ? "grab" : "default",
                      userSelect: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      opacity:
                        draggedDelivery?.id === delivery.id ? 0.5 : delivery.hidden ? 0.5 : 1,
                      transition: "opacity 0.15s ease",
                    }}
                  >
                    <Chip
                      label={formatDate(delivery.deliveryDate)}
                      variant="outlined"
                      color="primary"
                      onDelete={() => handleDeleteClick(delivery)}
                    />
                  </div>
                ))
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No upcoming deliveries
                </Typography>
              )}
            </Stack>
          </Box>

          {/* Previous Deliveries */}
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            PREVIOUS
          </Typography>
          <Box
            onDragOver={(event) => event.preventDefault()}
            onDrop={async (event) => {
              await handleDropToPrevious(event);
            }}
            sx={{
              border: canDropToPrevious
                ? "1px dashed var(--color-text-secondary)"
                : "1px solid transparent",
              borderRadius: 1,
              p: canDropToPrevious ? 1 : 0,
              minHeight: canDropToPrevious ? 52 : "auto",
              width: "100%",
              mb: 2,
              backgroundColor: canDropToPrevious ? "var(--color-background-main)" : "transparent",
              transition: "border-color 0.2s ease, background-color 0.2s ease, padding 0.2s ease",
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", maxHeight: 32, overflow: "hidden" }}
            >
              {sortedPastDeliveries.length > 0 ? (
                sortedPastDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    draggable
                    onDragStart={(e) => handleDragStart(delivery, "past", e)}
                    onDragEnd={handleDragEnd}
                    style={{
                      cursor: "grab",
                      userSelect: "none",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <Chip
                      label={formatDate(delivery.deliveryDate)}
                      variant="outlined"
                      color="secondary"
                    />
                  </div>
                ))
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No previous deliveries
                </Typography>
              )}
            </Stack>
          </Box>

          {/* Missed Deliveries */}
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            MISSED
          </Typography>
          <Box
            onDragOver={(event) => event.preventDefault()}
            onDrop={async (event) => {
              event.preventDefault();
              await handleDropToMissed();
            }}
            sx={{
              border: canDropToMissed
                ? "1px dashed var(--color-text-secondary)"
                : "1px solid transparent",
              borderRadius: 1,
              p: canDropToMissed ? 1 : 0,
              minHeight: canDropToMissed ? 52 : "auto",
              width: "100%",
              mb: 1,
              backgroundColor: canDropToMissed ? "var(--color-background-main)" : "transparent",
              transition: "border-color 0.2s ease, background-color 0.2s ease, padding 0.2s ease",
            }}
          >
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {missedDeliveries.length > 0 ? (
                missedDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    draggable
                    onDragStart={(e) => handleDragStart(delivery, "missed", e)}
                    onDragEnd={handleDragEnd}
                    style={{
                      cursor: "grab",
                      userSelect: "none",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <Chip
                      label={formatDate(delivery.deliveryDate)}
                      variant="outlined"
                      color="error"
                      sx={{
                        opacity: draggedDelivery?.id === delivery.id ? 0.5 : 1,
                        transition: "opacity 0.15s ease",
                      }}
                    />
                  </div>
                ))
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Drag previous deliveries or today&apos;s upcoming delivery here
                </Typography>
              )}
            </Stack>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default DeliveryLogForm;
