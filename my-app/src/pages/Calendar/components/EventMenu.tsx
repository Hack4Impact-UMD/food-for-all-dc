import React, { useState, useEffect } from "react";
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
import { getLastDeliveryDateForClient } from "../../../utils/lastDeliveryDate";
import { deleteDeliveriesAfterEndDate } from "../../../utils/deliveryCleanup";
import { deliveryEventEmitter } from "../../../utils/deliveryEventEmitter";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, where, orderBy, updateDoc, Timestamp} from "firebase/firestore";
import { db } from "../../../auth/firebaseConfig";
import dataSources from '../../../config/dataSources';
import { DeliveryEvent, NewDelivery } from "../../../types/calendar-types";
import { calculateRecurrenceDates, getNextMonthlyDate } from "./CalendarUtils";
import { UserType } from "../../../types";
import { useAuth } from "../../../auth/AuthProvider";
import { toJSDate } from '../../../utils/timestamp';

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
  
  const [editDeliveryDate, setEditDeliveryDate] = useState<string>(() => {
    return toJSDate(event.deliveryDate).toISOString().split("T")[0];
  });
  
  const [editDateError, setEditDateError] = useState<string | null>(null);
  const [endDateError, setEndDateError] = useState<string | null>(null);
  const [currentLastDeliveryDate, setCurrentLastDeliveryDate] = useState<string>("");
  const normalizeToDateInput = (dateVal: any) => {
    if (!dateVal) return "";
    // Firestore Timestamp
    if (dateVal instanceof Date) {
      return dateVal.toISOString().split("T")[0];
    }
    if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      return dateVal;
    }
    // Try to handle Firestore Timestamp object
    if (dateVal.seconds && dateVal.nanoseconds) {
      const d = new Date(dateVal.seconds * 1000);
      return d.toISOString().split("T")[0];
    }
    // Try parsing as ISO string
    try {
      return new Date(dateVal).toISOString().split("T")[0];
    } catch {
      return "";
    }
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

  // Fetch current last delivery date when component mounts
  useEffect(() => {
    const fetchCurrentLastDeliveryDate = async () => {
      if (event.clientId) {
        try {
          const mostRecentSeriesEndDate = await getLastDeliveryDateForClient(event.clientId);

          if (mostRecentSeriesEndDate) {
            setCurrentLastDeliveryDate(mostRecentSeriesEndDate);
            
            // Update the editRecurrence state with the current end date
            setEditRecurrence(prev => ({
              ...prev,
              repeatsEndDate: mostRecentSeriesEndDate as string
            }));
          }
        } catch (error) {
          console.error("Error fetching current last delivery date:", error);
        }
      }
    };

    fetchCurrentLastDeliveryDate();
  }, [event.clientId, event.id]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const checkPastEvent = () => {
    const eventDate = toJSDate(event.deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate < today;
  };

  const handleEdit = () => {
    if (checkPastEvent()) {
      console.warn("Cannot edit past events.");
      return;
    }
    setIsEditDialogOpen(true);
  };

  const handleDelete = () => {
    if (checkPastEvent()) {
      console.warn("Cannot delete past events.");
      return;
    }
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
  const eventsRef = collection(db, dataSources.firebase.calendarCollection);

      if (deleteOption === "This event") {
        await deleteDoc(doc(eventsRef, event.id));
      } else if (deleteOption === "This and following events") {
        await deleteDoc(doc(eventsRef, event.id));

        const currentDate = toJSDate(event.deliveryDate);
        const q = query(
          eventsRef,
          where("recurrenceId", "==", event.recurrenceId),
          where("deliveryDate", ">", currentDate)
        );

        const querySnapshot = await getDocs(q);
        const batch = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(batch);
      } else if (deleteOption === "All events for this recurrence") {
        const q = query(
          eventsRef,
          where("recurrenceId", "==", event.recurrenceId)
        );

        const querySnapshot = await getDocs(q);
        const batch = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(batch);
      }

      deliveryEventEmitter.emit();
      onEventModified();
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  const handleEditConfirm = async () => {
    try {
  const eventsRef = collection(db, dataSources.firebase.calendarCollection);

      if (editOption === "This event") {
        // Only update the deliveryDate for the single event, set time to noon
        const newDate = new Date(editDeliveryDate + 'T12:00:00');
        await updateDoc(doc(eventsRef, event.id), {
          deliveryDate: newDate
        });
      } else if (editOption === "This and following events") {
        // Changing recurrence type: delete all future events in the series, then create new events for the new recurrence type and dates
        console.log('[DEBUG] Edit Event: modal values', {
          editRecurrence,
          editDeliveryDate,
          event,
        });
        const originalEventDoc = await getDoc(doc(eventsRef, event.id));
        const originalEvent = originalEventDoc.data();
        if (!originalEvent) {
          console.error("Original event not found.");
          return;
        }
        const originalDeliveryDate = toJSDate(originalEvent.deliveryDate);
        // Find all future events in the series
        const q = query(
          eventsRef,
          where("recurrenceId", "==", event.recurrenceId),
          where("clientId", "==", event.clientId),
          where("deliveryDate", ">=", originalDeliveryDate)
        );
  const querySnapshot = await getDocs(q);
  // Delete all future events in the series
  const deleteResults = await Promise.all(querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref)));
  console.log('[DEBUG] Deleted future events count:', querySnapshot.docs.length);

        // Calculate new recurrence dates for the new recurrence type
        console.log('[DEBUG] Calculating recurrence dates with:', {
          deliveryDate: editDeliveryDate,
          recurrence: editRecurrence.recurrence,
          repeatsEndDate: editRecurrence.repeatsEndDate
        });
        let newRecurrenceDates = calculateRecurrenceDates({
          ...originalEvent,
          ...editRecurrence,
          deliveryDate: editDeliveryDate, // Ensure recurrence starts from new date
        } as any);
        console.log('[DEBUG] New recurrence dates:', newRecurrenceDates);
        // Ensure the first recurrence date is always the new start date
        if (!newRecurrenceDates.length || newRecurrenceDates[0] !== editDeliveryDate) {
          newRecurrenceDates = [editDeliveryDate, ...newRecurrenceDates];
        }
        console.log('[DEBUG] New recurrence dates:', newRecurrenceDates);
        const endDate = editRecurrence.repeatsEndDate ? new Date(editRecurrence.repeatsEndDate) : null;
        const filteredRecurrenceDates = newRecurrenceDates.filter(date => {
          if (!endDate) return true;
          const dateStr = date;
          const endDateStr = endDate.toISOString().split('T')[0];
          return dateStr <= endDateStr;
        });
        // Add new events for each recurrence date
        for (let i = 0; i < filteredRecurrenceDates.length; i++) {
          const recurrenceDateStr = filteredRecurrenceDates[i];
          console.log('[DEBUG] Creating event for recurrence date:', recurrenceDateStr);
          const newDate = new Date(recurrenceDateStr + 'T12:00:00');
          const docRef = await addDoc(eventsRef, {
            clientId: event.clientId,
            clientName: event.clientName,
            cluster: event.cluster,
            deliveryDate: newDate,
            recurrence: editRecurrence.recurrence || event.recurrence || "None",
            recurrenceId: event.recurrenceId,
            repeatsEndDate: editRecurrence.repeatsEndDate || "",
            time: event.time || ""
          });
          console.log('[DEBUG] Created event doc ID:', docRef.id);
        }
      }

      deliveryEventEmitter.emit();
      onEventModified();
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating event:", error);
    }
  };

  const handleEditDeliveryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setEditDeliveryDate(newDate);
    
    // Handle date validation with proper callback functions
    validateDateInput(
      newDate,
      (validDate) => setEditDateError(null),
      (errorMessage) => setEditDateError(errorMessage)
    );
  };

  // Only disable for events that are from previous days (not today)
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of today
  const eventDate = toJSDate(event.deliveryDate);
  eventDate.setHours(0, 0, 0, 0); // Set to start of event day
  const isPastEvent = eventDate < today;

  return (
    <>
      <IconButton 
        onClick={handleMenuOpen}
        size="small"
        sx={{ 
          backgroundColor: 'white',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          color: '#257E68',
          transition: 'all 0.2s ease-in-out',
          width: '32px',
          height: '32px',
          padding: '4px',
          '&:hover': {
            backgroundColor: '#f5f5f5',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          }
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
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem 
          onClick={() => {
            setIsEditDialogOpen(true);
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setIsDeleteDialogOpen(true);
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      {/* Edit Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onClick={(e) => e.stopPropagation()}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Event</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <RadioGroup
            value={editOption}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              e.stopPropagation();
              setEditOption(e.target.value as "This event" | "This and following events");
            }}
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

          {/* New Delivery Date */}
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
                      recurrence: e.target.value as "None" | "Weekly" | "2x-Monthly" | "Monthly"
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
                      repeatsEndDate: e.target.value
                    });
                  }}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                  error={Boolean(endDateError)}
                  helperText={endDateError}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleEditConfirm}
            variant="contained"
            color="primary"
            disabled={
              !editDeliveryDate ||
              (editOption === "This and following events" && editRecurrence.recurrence !== "None" && !editRecurrence.repeatsEndDate) ||
              Boolean(editDateError) ||
              (editOption === "This and following events" && editRecurrence.recurrence !== "None" && Boolean(endDateError))
            }
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onClick={(e) => e.stopPropagation()}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Event</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <RadioGroup 
            value={deleteOption} 
            onChange={(e) => setDeleteOption(e.target.value)}
          >
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EventMenu;