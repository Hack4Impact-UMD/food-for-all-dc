import React, { useState } from "react";
import {
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
  Box,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import { validateDateInput } from "../../../utils/dates";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, where, Timestamp} from "firebase/firestore";
import { db } from "../../../auth/firebaseConfig";
import { DeliveryEvent, NewDelivery } from "../../../types/calendar-types";
import { calculateRecurrenceDates, getNextMonthlyDate } from "./CalendarUtils";
import { UserType } from "../../../types";
import { useAuth } from "../../../auth/AuthProvider";

interface EventMenuProps {
  event: DeliveryEvent;
  onEventModified: () => void;
}

const EventMenu: React.FC<EventMenuProps> = ({ event, onEventModified }) => {
  const { userRole } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteOption, setDeleteOption] = useState("This event");
  const [editOption, setEditOption] = useState<"This event" | "This and following events">("This event");
  const [editDeliveryDate, setEditDeliveryDate] = useState<string>(
    event.deliveryDate.toISOString().split("T")[0]
  );
  const [editDateError, setEditDateError] = useState<string | null>(null);
  const [endDateError, setEndDateError] = useState<string | null>(null);
  const [editRecurrence, setEditRecurrence] = useState<Partial<NewDelivery>>({
    assignedDriverId: event.assignedDriverId,
    assignedDriverName: event.assignedDriverName,
    clientId: event.clientId,
    clientName: event.clientName,
    deliveryDate: event.deliveryDate.toISOString().split("T")[0],
    recurrence: event.recurrence,
    repeatsEndDate: event.repeatsEndDate || "",
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDeleteClick = () => {
    if (new Date(event.deliveryDate) < new Date()) {
      console.warn("Cannot delete past events.");
      return;
    }
    setIsDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleEditClick = () => {
    if (new Date(event.deliveryDate) < new Date()) {
      console.warn("Cannot edit past events.");
      return;
    }
    setIsEditDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    try {
      const eventsRef = collection(db, "events");
      console.log("delete option")
      console.log(deleteOption)
      if (deleteOption === "This event") {
        // Delete only this event
        await deleteDoc(doc(eventsRef, event.id));
      } else if (deleteOption === "This and following events") {
        // Delete this event and all future events for the same recurrence
        await deleteDoc(doc(eventsRef, event.id));

        const q = query(
          eventsRef,
          where("recurrenceId", "==", event.recurrenceId),
          where("deliveryDate", ">", event.deliveryDate) // Include current and future events
        );

        const querySnapshot = await getDocs(q);

        const batch = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(batch);
      } else if (deleteOption === "All events for this recurrence") {
        // Delete all events (past, present, and future) for the same recurrence
        const q = query(
          eventsRef,
          where("recurrenceId", "==", event.recurrenceId)
        );

        const querySnapshot = await getDocs(q);
        const batch = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(batch);
      }

      // Notify parent component that events have changed
      onEventModified();
    } catch (error) {
      console.error("Error deleting event:", error);
    }

    setIsDeleteDialogOpen(false);
  };

  const handleEditConfirm = async () => {
    try {
      const eventsRef = collection(db, "events");

      if (editOption === "This event") {
        // Update only this event with the new delivery date
        await deleteDoc(doc(eventsRef, event.id));
        
        // Add the event with updated delivery date
        await addDoc(eventsRef, {
          ...event,
          deliveryDate: new Date(editDeliveryDate),
        });
      } else if (editOption === "This and following events") {
        // Fetch the original event from the database to get its original delivery date
        const originalEventDoc = await getDoc(doc(eventsRef, event.id));
        const originalEvent = originalEventDoc.data();

        if (!originalEvent) {
          console.error("Original event not found.");
          return;
        }

        const originalDeliveryDate = originalEvent.deliveryDate.toDate(); // Convert Firestore Timestamp to Date

        // Delete all future events for the same recurrence
        const q = query(
          eventsRef,
          where("recurrence", "==", event.recurrence),
          where("clientId", "==", event.clientId),
          where("deliveryDate", ">=", originalDeliveryDate) // Only future events
        );

        const querySnapshot = await getDocs(q);
        const batchDelete = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(batchDelete);

        // Add new recurrence events starting from the new delivery date
        const newRecurrenceDates = calculateRecurrenceDates({
          ...editRecurrence,
          deliveryDate: editDeliveryDate, // Use the new delivery date
        } as any);

        // Add new recurring events starting from the second date
        const batchAdd = newRecurrenceDates.map((date) => {
          const eventToAdd: Partial<DeliveryEvent> = {
            assignedDriverId: editRecurrence.assignedDriverId,
            assignedDriverName: editRecurrence.assignedDriverName,
            clientId: editRecurrence.clientId,
            clientName: editRecurrence.clientName,
            deliveryDate: date,
            time: "",
            cluster: 0,
            recurrence: editRecurrence.recurrence,
            ...(editRecurrence.repeatsEndDate && {
              repeatsEndDate: editRecurrence.repeatsEndDate,
            }),
          };

          return addDoc(eventsRef, eventToAdd);
        });

        await Promise.all(batchAdd);
      }

      // Notify parent component that events have changed
      onEventModified();
    } catch (error) {
      console.error("Error editing event:", error);
    }

    setIsEditDialogOpen(false);
  };

  const isPastEvent = new Date(event.deliveryDate) < new Date();

  return (
    <>
      <IconButton
        onClick={handleMenuOpen}
        disabled={isPastEvent}
        sx={{
          backgroundColor: 'var(--color-background-light)',
          borderRadius: '50%',
          boxShadow: 'var(--shadow-sm)',
          color: 'var(--color-primary)',
          transition: 'background 0.2s, color 0.2s',
          '&:hover': {
            backgroundColor: 'rgba(37, 126, 104, 0.12)',
            color: 'var(--color-primary-dark)',
          },
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
        }}
        aria-label="Open event menu"
      >
        <MoreHorizIcon fontSize="medium" />
      </IconButton>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem disabled={isPastEvent || userRole === UserType.ClientIntake} onClick={handleEditClick}>Edit</MenuItem>
        <MenuItem disabled={isPastEvent || userRole === UserType.ClientIntake} onClick={handleDeleteClick}>Delete</MenuItem>
      </Menu>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)}>
        <DialogTitle>Edit Event</DialogTitle>
        <DialogContent>
          <RadioGroup
            value={editOption}
            onChange={(e) =>
              setEditOption(e.target.value as "This event" | "This and following events")
            }
          >
            <FormControlLabel value="This event" control={<Radio />} label="This event" />
            {event.recurrence !== "None" && (
              <FormControlLabel
                value="This and following events"
                control={<Radio />}
                label="This and following events"
              />
            )}
          </RadioGroup>          {/* New Delivery Date Picker */}          <TextField
            label="New Delivery Date"
            type="date"
            value={editDeliveryDate || ""}
            onChange={(e) => {
              // Clear any previous error
              setEditDateError(null);              validateDateInput(
                e.target.value,
                (dateStr) => setEditDeliveryDate(dateStr),
                null // Don't show error on change
              )
            }}
            onBlur={(e) => {
              if (e.target.value) {
                validateDateInput(
                  e.target.value,
                  (dateStr) => setEditDeliveryDate(dateStr),
                  (errorMsg) => setEditDateError(errorMsg)
                );
              }
            }}
            error={!!editDateError}
            helperText={editDateError || " "}
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }}
            inputProps={{
              min: "1900-01-01",
              max: "2100-12-31"
            }}
          />

          {editOption === "This and following events" && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel id="recurrence-label">Recurrence</InputLabel>
                <Select
                  labelId="recurrence-label"
                  value={editRecurrence.recurrence}
                  onChange={(e) =>
                    setEditRecurrence({
                      ...editRecurrence,
                      recurrence: e.target.value as "None" | "Weekly" | "2x-Monthly" | "Monthly",
                    })
                  }
                >
                  <MenuItem value="None">None</MenuItem>
                  <MenuItem value="Weekly">Weekly</MenuItem>
                  <MenuItem value="2x-Monthly">2x-Monthly</MenuItem>
                  <MenuItem value="Monthly">Monthly</MenuItem>
                </Select>
              </FormControl>

              {editRecurrence.recurrence !== "None" && (                <Box>                  
                  <Typography variant="subtitle1">End Date</Typography>                  <TextField
                    label="End Date"
                    type="date"
                    value={editRecurrence.repeatsEndDate || ""}
                    onChange={(e) => {
                      // Clear any previous error
                      setEndDateError(null);                      validateDateInput(
                        e.target.value,
                        (dateStr) => setEditRecurrence({
                          ...editRecurrence,
                          repeatsEndDate: dateStr,
                        }),
                        null // Don't show error on change
                      )
                    }}
                    onBlur={(e) => {
                      if (e.target.value) {
                        validateDateInput(
                          e.target.value,
                          (dateStr) => setEditRecurrence({
                            ...editRecurrence,
                            repeatsEndDate: dateStr,
                          }),
                          (errorMsg) => setEndDateError(errorMsg)
                        );
                      }
                    }}
                    error={!!endDateError}
                    helperText={endDateError || " "}
                    fullWidth
                    margin="normal"
                    InputLabelProps={{ shrink: true }}
                    inputProps={{
                      min: "1900-01-01",
                      max: "2100-12-31"
                    }}
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditConfirm} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
        <DialogTitle>Delete Event</DialogTitle>
        <DialogContent>
          {event.recurrence !== "None" ? (
            <RadioGroup value={deleteOption} onChange={(e) => setDeleteOption(e.target.value)}>
              <FormControlLabel value="This event" control={<Radio />} label="This event" />
              <FormControlLabel
                value="This and following events"
                control={<Radio />}
                label="This and following events"
              />
              <FormControlLabel
                value="All events for this recurrence"
                control={<Radio />}
                label="All events for this recurrence"
              />
            </RadioGroup>
          ) : (
            <Typography>This event will be deleted.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EventMenu;