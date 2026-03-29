import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import { validateDateInput } from "../../../utils/dates";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { DateLimit, DeliveryEvent, NewDelivery } from "../../../types/calendar-types";
import { calculateRecurrenceDates } from "./CalendarUtils";
import { toJSDate } from "../../../utils/timestamp";
import { deliveryDate } from "../../../utils/deliveryDate";
import { clientService } from "../../../services/client-service";
import { DeliveryService } from "../../../services";
import {
  buildDailyLimitsMap,
  buildProjectedCapacityWarnings,
  CapacityWarningEntry,
} from "./capacityStatus";
import CapacityWarningPanel from "./CapacityWarningPanel";

interface EventMenuProps {
  event: DeliveryEvent;
  onEventModified: () => void;
  weeklyLimits: number[];
  dailyLimits: DateLimit[];
}

const EventMenu: React.FC<EventMenuProps> = ({
  event,
  onEventModified,
  weeklyLimits,
  dailyLimits,
}) => {
  const deliveryService = useMemo(() => DeliveryService.getInstance(), []);
  const supportsFutureDelete = event.recurrence !== "None" && Boolean(event.recurrenceId);
  const supportsFutureEdit = supportsFutureDelete && event.recurrence !== "Custom";
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditHydrating, setIsEditHydrating] = useState(false);
  const [hasHydratedEditData, setHasHydratedEditData] = useState(false);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>("");
  const [editError, setEditError] = useState<string>("");
  const [capacityWarnings, setCapacityWarnings] = useState<CapacityWarningEntry[]>([]);
  const [capacityWarningError, setCapacityWarningError] = useState<string>("");
  const [capacityWarningAcknowledged, setCapacityWarningAcknowledged] = useState<boolean>(false);
  const [deleteOption, setDeleteOption] = useState("This event");
  const [editOption, setEditOption] = useState<"This event" | "This and following events">(
    "This event"
  );

  const [editDeliveryDate, setEditDeliveryDate] = useState<string>(() => {
    return toJSDate(event.deliveryDate).toISOString().split("T")[0];
  });

  const [editDateError, setEditDateError] = useState<string | null>(null);
  const [clientStartDateISO, setClientStartDateISO] = useState<string | null>(null);
  const [clientEndDateISO, setClientEndDateISO] = useState<string | null>(null);
  const [editSeriesEndDateError, setEditSeriesEndDateError] = useState<string | null>(null);
  const normalizeToDateInput = (dateVal: unknown) => {
    if (!dateVal) return "";
    if (dateVal instanceof Date) {
      return dateVal.toISOString().split("T")[0];
    }
    if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      return dateVal;
    }
    if (
      typeof dateVal === "object" &&
      dateVal !== null &&
      "seconds" in dateVal &&
      "nanoseconds" in dateVal &&
      typeof (dateVal as { seconds?: unknown }).seconds === "number"
    ) {
      const d = new Date((dateVal as { seconds: number }).seconds * 1000);
      return d.toISOString().split("T")[0];
    }
    const parsed = new Date(String(dateVal));
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toISOString().split("T")[0];
  };
  const [editRecurrence, setEditRecurrence] = useState<Partial<NewDelivery>>({
    assignedDriverId: event.assignedDriverId,
    assignedDriverName: event.assignedDriverName,
    clientId: event.clientId,
    clientName: event.clientName,
    deliveryDate: toJSDate(event.deliveryDate).toISOString().split("T")[0],
    recurrence: event.recurrence,
    repeatsEndDate: normalizeToDateInput(event.repeatsEndDate),
  });
  const dailyLimitsMap = useMemo(() => buildDailyLimitsMap(dailyLimits), [dailyLimits]);

  const hydrateEditDialogData = useCallback(async () => {
    setIsEditHydrating(true);
    setHasHydratedEditData(false);
    setClientStartDateISO(null);
    setClientEndDateISO(null);

    const [seriesResult, clientResult] = await Promise.allSettled([
      deliveryService.getSeriesSummaryForEvent(event.id),
      event.clientId ? clientService.getClientById(event.clientId) : Promise.resolve(null),
    ]);

    const seriesSummary = seriesResult.status === "fulfilled" ? seriesResult.value : null;
    if (seriesSummary?.effectiveEndDate) {
      setEditRecurrence((prev) => ({
        ...prev,
        repeatsEndDate: seriesSummary.effectiveEndDate,
      }));
    } else if (seriesResult.status === "rejected") {
      console.error("Error hydrating edit dialog data from getSeriesSummaryForEvent:", seriesResult.reason);
    }

    if (clientResult.status === "fulfilled") {
      const client = clientResult.value;
      const startISO = client?.startDate ? deliveryDate.tryToISODateString(client.startDate) : null;
      const endISO = client?.endDate ? deliveryDate.tryToISODateString(client.endDate) : null;
      setClientStartDateISO(startISO);
      setClientEndDateISO(endISO);
      setHasHydratedEditData(true);
      setEditError("");
    } else {
      console.error("Error hydrating edit dialog data from getClientById:", clientResult.reason);
      setEditError("Could not load delivery details. Please close the dialog and try again.");
      setHasHydratedEditData(false);
    }

    setIsEditHydrating(false);
  }, [deliveryService, event.clientId, event.id]);

  useEffect(() => {
    setCapacityWarnings([]);
    setCapacityWarningError("");
    setCapacityWarningAcknowledged(false);
    setDeleteError("");
    setEditError("");
  }, [
    editOption,
    editDeliveryDate,
    editRecurrence.recurrence,
    editRecurrence.repeatsEndDate,
    event.id,
  ]);

  useEffect(() => {
    if (!supportsFutureDelete && deleteOption !== "This event") {
      setDeleteOption("This event");
    }
    if (!supportsFutureEdit && editOption !== "This event") {
      setEditOption("This event");
    }
  }, [deleteOption, editOption, supportsFutureDelete, supportsFutureEdit]);

  useEffect(() => {
    if (editOption !== "This and following events" || editRecurrence.recurrence === "None") {
      setEditSeriesEndDateError(null);
      return;
    }

    if (!editRecurrence.repeatsEndDate) {
      setEditSeriesEndDateError("End date is required.");
      return;
    }

    const normalizedRepeatsEndDate = deliveryDate.tryToISODateString(editRecurrence.repeatsEndDate);
    if (!normalizedRepeatsEndDate) {
      setEditSeriesEndDateError("Invalid end date.");
      return;
    }

    if (clientEndDateISO && normalizedRepeatsEndDate > clientEndDateISO) {
      setEditSeriesEndDateError(
        `End date cannot be after client end date (${formatToMMDDYYYY(clientEndDateISO)}).`
      );
      return;
    }

    if (normalizedRepeatsEndDate < editDeliveryDate) {
      setEditSeriesEndDateError("End date cannot be before delivery date.");
      return;
    }

    setEditSeriesEndDateError(null);
  }, [
    clientEndDateISO,
    editDeliveryDate,
    editOption,
    editRecurrence.recurrence,
    editRecurrence.repeatsEndDate,
  ]);

  const formatToMMDDYYYY = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${month}/${day}/${year}`;
  };

  const getErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (error && typeof error === "object" && "message" in error) {
      const message = String((error as { message?: unknown }).message || "").trim();
      if (message) {
        return message;
      }
    }

    return fallbackMessage;
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const resetCapacityWarningState = () => {
    setCapacityWarnings([]);
    setCapacityWarningError("");
    setCapacityWarningAcknowledged(false);
  };
  const shouldPauseForCapacityWarning = useCallback(
    (hasWarning: boolean) => {
      if (hasWarning && !capacityWarningAcknowledged) {
        setCapacityWarningAcknowledged(true);
        return true;
      }
      if (!hasWarning) {
        setCapacityWarningAcknowledged(false);
      }
      return false;
    },
    [capacityWarningAcknowledged]
  );

  const closeEditDialog = () => {
    resetCapacityWarningState();
    setEditError("");
    setClientStartDateISO(null);
    setClientEndDateISO(null);
    setIsEditHydrating(false);
    setHasHydratedEditData(false);
    setIsEditDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    setDeleteError("");
    setIsDeleteSubmitting(true);
    try {
      await deliveryService.deleteEventByScope(
        event.id,
        deleteOption === "This and following events" ? "following" : "single"
      );
      onEventModified();
      setIsDeleteDialogOpen(false);
      handleMenuClose();
    } catch (error) {
      console.error("Error deleting event:", error);
      setDeleteError(getErrorMessage(error, "Failed to delete delivery."));
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  const handleEditConfirm = async () => {
    if (isEditHydrating || !hasHydratedEditData) {
      return;
    }

    setEditError("");
    setIsEditSubmitting(true);
    try {
      setCapacityWarningError("");
      const normalizedEditDate = deliveryDate.tryToISODateString(editDeliveryDate);
      if (clientStartDateISO && normalizedEditDate && normalizedEditDate < clientStartDateISO) {
        setEditDateError(
          `Delivery date cannot be before client start date (${formatToMMDDYYYY(
            clientStartDateISO
          )}).`
        );
        return;
      }
      if (clientEndDateISO && normalizedEditDate && normalizedEditDate > clientEndDateISO) {
        setEditDateError(
          `Delivery date cannot be after client end date (${formatToMMDDYYYY(clientEndDateISO)}).`
        );
        return;
      }
      if (editSeriesEndDateError) {
        return;
      }
      const deltaByDate: Record<string, number> = {};
      let recurrenceDatesForSave: string[] = [];
      let scopedSeriesEvents: DeliveryEvent[] = [];

      if (editOption === "This event") {
        const originalDateKey = deliveryDate.toISODateString(event.deliveryDate);
        const updatedDateKey = deliveryDate.toISODateString(editDeliveryDate);
        if (originalDateKey !== updatedDateKey) {
          deltaByDate[originalDateKey] = -1;
          deltaByDate[updatedDateKey] = 1;
        }
      } else {
        const recurrenceDraft: NewDelivery = {
          clientId: event.clientId,
          clientName: event.clientName,
          deliveryDate: editDeliveryDate,
          recurrence: (editRecurrence.recurrence as NewDelivery["recurrence"]) || event.recurrence,
          repeatsEndDate: editRecurrence.repeatsEndDate || "",
        };
        let nextRecurrenceDates = calculateRecurrenceDates(recurrenceDraft);
        if (!nextRecurrenceDates.length || nextRecurrenceDates[0] !== editDeliveryDate) {
          nextRecurrenceDates = [editDeliveryDate, ...nextRecurrenceDates];
        }

        const endDateStr = editRecurrence.repeatsEndDate
          ? deliveryDate.toISODateString(editRecurrence.repeatsEndDate)
          : null;
        recurrenceDatesForSave = nextRecurrenceDates.filter((date) => {
          if (clientStartDateISO && date < clientStartDateISO) return false;
          if (clientEndDateISO && date > clientEndDateISO) return false;
          if (!endDateStr) return true;
          return date <= endDateStr;
        });

        if (!recurrenceDatesForSave.length) {
          if (clientStartDateISO) {
            setEditDateError(
              `Delivery date cannot be before client start date (${formatToMMDDYYYY(
                clientStartDateISO
              )}).`
            );
          } else if (clientEndDateISO && normalizedEditDate && normalizedEditDate > clientEndDateISO) {
            setEditDateError(
              `Delivery date cannot be after client end date (${formatToMMDDYYYY(
                clientEndDateISO
              )}).`
            );
          }
          return;
        }

        scopedSeriesEvents = await deliveryService.getScopedSeriesEvents(event.id, "following");

        const oldDateCounts = scopedSeriesEvents.reduce(
          (acc, seriesEvent) => {
            const dateKey = deliveryDate.toISODateString(seriesEvent.deliveryDate);
            acc[dateKey] = (acc[dateKey] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
        const newDateCounts = recurrenceDatesForSave.reduce(
          (acc, dateKey) => {
            acc[dateKey] = (acc[dateKey] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const impactedDateSet = new Set([
          ...Object.keys(oldDateCounts),
          ...Object.keys(newDateCounts),
        ]);
        impactedDateSet.forEach((dateKey) => {
          const delta = (newDateCounts[dateKey] || 0) - (oldDateCounts[dateKey] || 0);
          if (delta !== 0) {
            deltaByDate[dateKey] = delta;
          }
        });
      }

      let warningEntries: CapacityWarningEntry[] = [];
      const impactedDateKeys = Object.keys(deltaByDate);
      if (impactedDateKeys.length) {
        try {
          const existingCounts = await deliveryService.getEventCountsForDates(impactedDateKeys);
          warningEntries = buildProjectedCapacityWarnings({
            dateAdjustments: deltaByDate,
            existingCounts,
            weeklyLimits,
            dailyLimitsMap,
            clampProjectedCountToZero: true,
          });
        } catch (capacityError) {
          console.error("Error checking projected capacity for edit:", capacityError);
          setCapacityWarnings([]);
          setCapacityWarningError("Could not verify capacity; you can still continue.");
          if (shouldPauseForCapacityWarning(true)) {
            return;
          }
        }
      }

      setCapacityWarnings(warningEntries);
      if (shouldPauseForCapacityWarning(warningEntries.length > 0)) {
        return;
      }
      setCapacityWarningError("");

      await deliveryService.updateEventByScope({
        eventId: event.id,
        scope: editOption === "This and following events" ? "following" : "single",
        deliveryDate: editDeliveryDate,
        recurrence: (editRecurrence.recurrence as NewDelivery["recurrence"]) || event.recurrence,
        repeatsEndDate:
          editOption === "This and following events" &&
          editRecurrence.recurrence !== "None"
            ? editRecurrence.repeatsEndDate || undefined
            : undefined,
      });
      onEventModified();
      closeEditDialog();
      handleMenuClose();
    } catch (error) {
      console.error("Error updating event:", error);
      setEditError(getErrorMessage(error, "Failed to update delivery."));
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleEditDeliveryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setEditDeliveryDate(newDate);
    const validation = validateDateInput(
      newDate,
      (validDate) => setEditDateError(null),
      (errorMessage) => setEditDateError(errorMessage)
    );
    if (validation.isValid && clientStartDateISO) {
      const normalizedDate = deliveryDate.tryToISODateString(newDate);
      if (normalizedDate && normalizedDate < clientStartDateISO) {
        setEditDateError(
          `Delivery date cannot be before client start date (${formatToMMDDYYYY(
            clientStartDateISO
          )}).`
        );
      } else if (normalizedDate && clientEndDateISO && normalizedDate > clientEndDateISO) {
        setEditDateError(
          `Delivery date cannot be after client end date (${formatToMMDDYYYY(clientEndDateISO)}).`
        );
      }
    } else if (validation.isValid && clientEndDateISO) {
      const normalizedDate = deliveryDate.tryToISODateString(newDate);
      if (normalizedDate && normalizedDate > clientEndDateISO) {
        setEditDateError(
          `Delivery date cannot be after client end date (${formatToMMDDYYYY(clientEndDateISO)}).`
        );
      }
    }
  };

  return (
    <>
      <IconButton
        onClick={handleMenuOpen}
        size="small"
        sx={{
          backgroundColor: "var(--color-white)",
          borderRadius: "50%",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          color: "var(--color-primary)",
          transition: "all 0.2s ease-in-out",
          width: "32px",
          height: "32px",
          padding: "4px",
          "&:hover": {
            backgroundColor: "var(--color-background-body)",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
          },
        }}
      >
        <MoreHorizIcon />
      </IconButton>

      <Menu
        id="event-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <MenuItem
          onClick={() => {
            resetCapacityWarningState();
            setEditError("");
            setHasHydratedEditData(false);
            setIsEditDialogOpen(true);
            void hydrateEditDialogData();
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteError("");
            setIsDeleteDialogOpen(true);
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      <Dialog
        open={isEditDialogOpen}
        onClose={closeEditDialog}
        onClick={(e) => e.stopPropagation()}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Event</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {isEditHydrating && (
            <Typography sx={{ mb: 1.5, color: "var(--color-text-medium-alt)" }}>
              Loading delivery details...
            </Typography>
          )}
          <RadioGroup
            value={editOption}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              e.stopPropagation();
              setEditOption(e.target.value as "This event" | "This and following events");
            }}
          >
            <FormControlLabel value="This event" control={<Radio />} label="This event" />
            {supportsFutureEdit && (
              <FormControlLabel
                value="This and following events"
                control={<Radio />}
                label="This and following events"
              />
            )}
          </RadioGroup>

          <TextField
            label="New Delivery Date"
            type="date"
            value={editDeliveryDate}
            onChange={handleEditDeliveryDateChange}
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }}
            error={Boolean(editDateError)}
            helperText={editDateError}
            inputProps={{
              ...(clientStartDateISO ? { min: clientStartDateISO } : {}),
              ...(clientEndDateISO ? { max: clientEndDateISO } : {}),
            }}
          />

          {editOption === "This and following events" && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel id="recurrence-label">Recurrence</InputLabel>
                <Select
                  labelId="recurrence-label"
                  value={editRecurrence.recurrence}
                  onChange={(e) => {
                    setEditRecurrence({
                      ...editRecurrence,
                      recurrence: e.target.value as "None" | "Weekly" | "2x-Monthly" | "Monthly",
                    });
                  }}
                >
                  <MenuItem value="None">None</MenuItem>
                  <MenuItem value="Weekly">Weekly</MenuItem>
                  <MenuItem value="2x-Monthly">2x-Monthly</MenuItem>
                  <MenuItem value="Monthly">Monthly (Every 4 Weeks)</MenuItem>
                </Select>
              </FormControl>

              {editRecurrence.recurrence !== "None" && (
                <TextField
                  label="End Date"
                  type="date"
                  value={editRecurrence.repeatsEndDate || ""}
                  onChange={(e) => {
                    setEditRecurrence({
                      ...editRecurrence,
                      repeatsEndDate: e.target.value,
                    });
                  }}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                  error={Boolean(editSeriesEndDateError)}
                  helperText={editSeriesEndDateError}
                  inputProps={{
                    min: editDeliveryDate,
                    ...(clientEndDateISO ? { max: clientEndDateISO } : {}),
                  }}
                />
              )}
            </>
          )}

          <CapacityWarningPanel
            warnings={capacityWarnings}
            warningError={capacityWarningError}
            formatDate={formatToMMDDYYYY}
            marginTop={1.5}
          />
          {editError && (
            <Typography color="error" sx={{ mt: 1 }}>
              {editError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog} disabled={isEditSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleEditConfirm}
            variant="contained"
            color="primary"
            sx={{ minWidth: 112 }}
            disabled={
              isEditHydrating ||
              isEditSubmitting ||
              !hasHydratedEditData ||
              !editDeliveryDate ||
              (editOption === "This and following events" &&
                editRecurrence.recurrence !== "None" &&
                !editRecurrence.repeatsEndDate) ||
              Boolean(editDateError) ||
              Boolean(editSeriesEndDateError)
            }
          >
            {isEditSubmitting
              ? "Saving..."
              : isEditHydrating
              ? "Loading..."
              : capacityWarningAcknowledged && (capacityWarnings.length > 0 || capacityWarningError)
              ? "Continue anyway"
              : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onClick={(e) => e.stopPropagation()}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "16px",
            border: "1px solid var(--color-border-lighter)",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.12)",
          },
        }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "12px",
                display: "grid",
                placeItems: "center",
                backgroundColor: "var(--color-error-background)",
              }}
            >
              <WarningAmberRoundedIcon sx={{ color: "var(--color-error-text)", fontSize: 22 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "var(--color-text-heading)" }}>
              Delete Event
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ mb: 1.25, color: "var(--color-text-medium-alt)", lineHeight: 1.55 }}>
            Choose whether to remove only this delivery or this delivery and future ones in the
            series.
          </Typography>
          <RadioGroup value={deleteOption} onChange={(e) => setDeleteOption(e.target.value)}>
            <FormControlLabel value="This event" control={<Radio />} label="This event" />
            {supportsFutureDelete && (
              <FormControlLabel
                value="This and following events"
                control={<Radio />}
                label="This and future events"
              />
            )}
          </RadioGroup>
          {deleteError && (
            <Typography color="error" sx={{ mt: 1 }}>
              {deleteError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            pt: 1,
            gap: 1,
            borderTop: "1px solid var(--color-border-lighter)",
          }}
        >
          <Button
            onClick={() => setIsDeleteDialogOpen(false)}
            disabled={isDeleteSubmitting}
            sx={{
              borderRadius: "10px",
              px: 2.5,
              textTransform: "none",
              fontWeight: 600,
              color: "var(--color-text-medium-alt)",
              border: "1px solid var(--color-border-medium)",
              backgroundColor: "var(--color-white)",
              "&:hover": {
                backgroundColor: "var(--color-background-lighter)",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            disabled={isDeleteSubmitting}
            variant="contained"
            sx={{
              borderRadius: "10px",
              px: 2.5,
              textTransform: "none",
              fontWeight: 700,
              backgroundColor: "var(--color-error-text)",
              boxShadow: "none",
              "&:hover": {
                boxShadow: "none",
                backgroundColor: "var(--color-error-text-alt)",
              },
            }}
          >
            {isDeleteSubmitting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EventMenu;
