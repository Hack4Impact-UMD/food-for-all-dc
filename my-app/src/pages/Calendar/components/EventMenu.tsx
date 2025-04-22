import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import React, { useState } from "react";
import { db } from "../../../auth/firebaseConfig";
import { DeliveryEvent, NewDelivery } from "../../../types/calendar-types";
import { calculateRecurrenceDates, getNextMonthlyDate } from "./CalendarUtils";

interface EventMenuProps {
  event: DeliveryEvent;
  onEventModified: () => void;
}

const EventMenu: React.FC<EventMenuProps> = ({ event, onEventModified }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteOption, setDeleteOption] = useState("This event");
  const [editOption, setEditOption] = useState<"This event" | "This and following events">(
    "This event"
  );
  const [editDeliveryDate, setEditDeliveryDate] = useState<string>(
    event.deliveryDate.toISOString().split("T")[0]
  );
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
    setIsDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleEditClick = () => {
    setIsEditDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    try {
      const eventsRef = collection(db, "events");

      if (deleteOption === "This event") {
        // Delete only this event
        await deleteDoc(doc(eventsRef, event.id));
      } else if (deleteOption === "This and following events") {
        // Delete this event and all future events for the same recurrence
        await deleteDoc(doc(eventsRef, event.id));

        const q = query(
          eventsRef,
          where("recurrence", "==", event.recurrence),
          where("clientId", "==", event.clientId),
          where("deliveryDate", ">", event.deliveryDate) // Include current and future events
        );

        const querySnapshot = await getDocs(q);
        const batch = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(batch);
      } else if (deleteOption === "All events for this recurrence") {
        // Delete all events (past, present, and future) for the same recurrence
        const q = query(
          eventsRef,
          where("recurrence", "==", event.recurrence),
          where("clientId", "==", event.clientId) // Match all events for this client and recurrence
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

  return (
    <>
      <IconButton
        sx={{
          width: 40,
          height: 40,
          borderRadius: "50%",
        }}
        onClick={handleMenuOpen}
      >
        <MoreVertIcon />
      </IconButton>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleEditClick}>Edit</MenuItem>
        <MenuItem onClick={handleDeleteClick}>Delete</MenuItem>
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
          </RadioGroup>

          {/* New Delivery Date Picker */}
          <TextField
            label="New Delivery Date"
            type="date"
            value={editDeliveryDate}
            onChange={(e) => setEditDeliveryDate(e.target.value)}
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }}
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

              {editRecurrence.recurrence !== "None" && (
                <Box>
                  <Typography variant="subtitle1">End Date</Typography>
                  <TextField
                    label="End Date"
                    type="date"
                    value={editRecurrence.repeatsEndDate}
                    onChange={(e) =>
                      setEditRecurrence({
                        ...editRecurrence,
                        repeatsEndDate: e.target.value,
                      })
                    }
                    fullWidth
                    margin="normal"
                    InputLabelProps={{ shrink: true }}
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
