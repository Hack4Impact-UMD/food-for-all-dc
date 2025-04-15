import { DayPilot, DayPilotCalendar, DayPilotMonth } from "@daypilot/daypilot-lite-react";
import { Add, ChevronRight, EditCalendar } from "@mui/icons-material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
  AppBar,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { endOfWeek, set, startOfWeek } from "date-fns";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../auth/firebaseConfig";
import "./CalendarPage.css";
import CalendarPopper from "./CalendarPopper";
import { getDefaultLimit } from "./CalendarUtils";
import { useLimits } from "./useLimits";

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  justifyContent: "space-between",
  padding: theme.spacing(0, 2),
}));

const StyledCalendarContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  padding: theme.spacing(2),
  height: "calc(100vh - 64px)",
  "& .calendar_default_main": {
    fontFamily: theme.typography.fontFamily,
  },
}));

const NavigatorContainer = styled(Box)(({ theme }) => ({
  width: "200px",
  marginRight: theme.spacing(2),
}));

const CalendarContent = styled(Box)({
  flexGrow: 1,
  position: "relative",
});

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
}

interface Client {
  uid: string;
  firstName: string;
  lastName: string;
  streetName: string;
  zipCode: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  quadrant: string;
  dob: string;
  phone: string;
  alternativePhone: string;
  adults: number;
  children: number;
  total: number;
  gender: "Male" | "Female" | "Other";
  ethnicity: string;
  deliveryDetails: DeliveryDetails;
  lifeChallenges: string;
  notes: string;
  notesTimestamp?: {
    notes: string;
    timestamp: Date;
  } | null;
  lifestyleGoals: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
  startDate: string;
  endDate: string;
  recurrence: string;
  tags: string[];
  ward: string;
  seniors: number;
  headOfHousehold: "Senior" | "Adult";
}

interface DateLimit {
  id: string;
  date: string;
  limit: number;
}

interface DateLimit {
  id: string;
  date: string;
  limit: number;
}

interface DeliveryDetails {
  deliveryInstructions: string;
  dietaryRestrictions: DietaryRestrictions;
}

interface DietaryRestrictions {
  foodAllergens: Array<boolean>;
  other: Array<boolean>;
  halal: boolean;
  kidneyFriendly: boolean;
  lowSodium: boolean;
  lowSugar: boolean;
  microwaveOnly: boolean;
  noCookingEquipment: boolean;
  softFood: boolean;
  vegan: boolean;
  vegeterian: boolean;
}
interface DeliveryEvent {
  id: string;
  assignedDriverId: string;
  assignedDriverName: string;
  clientId: string;
  clientName: string;
  deliveryDate: Date; // The date of the delivery
  time: string; // The time of the delivery;
  cluster: number;
  recurrence: "None" | "Weekly" | "2x-Monthly" | "Monthly"; // Updated recurrence options
  repeatsEndDate?: string; // Optional, end date for recurrence
}

interface NewDelivery {
  assignedDriverId: string;
  assignedDriverName: string;
  clientId: string;
  clientName: string;
  deliveryDate: string; // ISO string for the delivery date
  recurrence: "None" | "Weekly" | "2x-Monthly" | "Monthly"; // Updated recurrence options
  repeatsEndDate?: string; // Optional, end date for recurrence
}

type ViewType = "Day" | "Month";
type DayPilotViewType = "Day" | "Days" | "WorkWeek" | "Resources";

// Add interface for calendar events
interface CalendarEvent {
  id: string;
  text: string;
  start: DayPilot.Date;
  end: DayPilot.Date;
  backColor: string;
}

// Add interface for calendar configuration
interface CalendarConfig {
  viewType: DayPilotViewType | ViewType;
  startDate: DayPilot.Date;
  events: CalendarEvent[];
}

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState<DayPilot.Date>(DayPilot.Date.today());

  const [viewType, setViewType] = useState<ViewType>("Day");
  const [viewAnchorEl, setViewAnchorEl] = useState<null | HTMLElement>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig>({
    viewType: "Day",
    startDate: DayPilot.Date.today(),
    events: [],
  });
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [dailyLimits, setDailyLimits] = useState<DateLimit[]>([]);

  const limits = useLimits();

  //Route Protection
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      if (!user) {
        console.log("No user is signed in, redirecting to /");
        navigate("/");
      } else {
        console.log("welcome, " + auth.currentUser?.email);
      }
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, [navigate]);

  const fetchDrivers = async () => {
    const driversRef = collection(db, "drivers");
    const snapshot = await getDocs(driversRef);
    const driverList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Driver[];
    setDrivers(driverList);
  };

  const fetchClients = async () => {
    const clientsRef = collection(db, "clients");
    const snapshot = await getDocs(clientsRef);
    const clientList = snapshot.docs.map((doc) => {
      const data = doc.data() as Partial<Client>;
      return {
        id: doc.id,
        uid: data.uid || "",
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        streetName: data.streetName || "",
        zipCode: data.zipCode || "",
        address: data.address || "",
        address2: data.address2 || "",
        city: data.city || "",
        state: data.state || "",
        quadrant: data.quadrant || "",
        dob: data.dob || "",
        phone: data.phone || "",
        alternativePhone: data.alternativePhone || "",
        adults: data.adults || 0,
        children: data.children || 0,
        total: data.total || 0,
        gender: data.gender || "Other",
        ethnicity: data.ethnicity || "",
        deliveryDetails: data.deliveryDetails || {
          deliveryInstructions: "",
          dietaryRestrictions: {},
        },
        lifeChallenges: data.lifeChallenges || "",
        notes: data.notes || "",
        notesTimestamp: data.notesTimestamp || null,
        lifestyleGoals: data.lifestyleGoals || "",
        language: data.language || "",
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
        startDate: data.startDate || "",
        endDate: data.endDate || "",
        recurrence: data.recurrence || "None",
        tags: data.tags || [],
        ward: data.ward || "",
        seniors: data.seniors || 0,
        headOfHousehold: data.headOfHousehold || "Adult",
      };
    }) as Client[];
    setClients(clientList);
  };

  const fetchLimits = async () => {
    const snapshot = await getDocs(collection(db, "dailyLimits"));
    const dailyLimits = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DateLimit[];
    setDailyLimits(dailyLimits);
  };

  useEffect(() => {
    fetchLimits();
  }, []);

  const getInitialFormDates = () => {
    const today = new Date();
    return {
      date: today.toISOString().split("T")[0],
      startTime: "09:00",
      endTime: "10:00",
    };
  };

  const [newDelivery, setNewDelivery] = useState<NewDelivery>(() => {
    const today = new Date().toISOString().split("T")[0];
    return {
      assignedDriverId: "",
      assignedDriverName: "",
      clientId: "",
      clientName: "",
      deliveryDate: today, // Default to today's date
      recurrence: "None", // Default to no recurrence
      repeatsEndDate: "", // No end date by default
    };
  });

  interface EventMenuProps {
    event: DeliveryEvent;
  }

  const EventMenu: React.FC<EventMenuProps> = ({ event }) => {
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
    const [editRecurrence, setEditRecurrence] = useState<NewDelivery>({
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

        // Refresh events after deletion
        fetchEvents();
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
          await updateDoc(doc(eventsRef, event.id), {
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
          console.log(querySnapshot);
          const batchDelete = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
          await Promise.all(batchDelete);

          // Add new recurrence events starting from the new delivery date
          const newRecurrenceDates = calculateRecurrenceDates({
            ...editRecurrence,
            deliveryDate: editDeliveryDate, // Use the new delivery date
          });

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

        // Refresh events after editing
        fetchEvents();
      } catch (error) {
        console.error("Error editing event:", error);
      }

      setIsEditDialogOpen(false);
    };

    const calculateRecurrenceDates = (recurrence: NewDelivery): Date[] => {
      const recurrenceDates: Date[] = [];
      const originalDate = new Date(recurrence.deliveryDate);
      let currentDate = originalDate;

      recurrenceDates.push(new Date(originalDate)); // Always include the original date

      if (recurrence.recurrence === "Weekly") {
        const interval = 7; // Weekly interval
        addRecurrenceDates(interval);
      } else if (recurrence.recurrence === "2x-Monthly") {
        const interval = 14; // 2x-Monthly interval
        addRecurrenceDates(interval);
      } else if (recurrence.recurrence === "Monthly") {
        if (recurrence.repeatsEndDate) {
          const endDate = new Date(recurrence.repeatsEndDate);
          while (currentDate <= endDate) {
            currentDate = getNextMonthlyDate(originalDate, currentDate);
            if (currentDate <= endDate) {
              recurrenceDates.push(new Date(currentDate));
            }
          }
        }
      }

      return recurrenceDates;

      function addRecurrenceDates(interval: number) {
        if (recurrence.repeatsEndDate) {
          const endDate = new Date(recurrence.repeatsEndDate);
          while (currentDate <= endDate) {
            currentDate.setDate(currentDate.getDate() + interval);
            if (currentDate <= endDate) {
              recurrenceDates.push(new Date(currentDate));
            }
          }
        }
      }
    };

    return (
      <>
        <IconButton onClick={handleMenuOpen}>
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
                      value={newDelivery.repeatsEndDate}
                      onChange={(e) =>
                        setNewDelivery({
                          ...newDelivery,
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

  const getRecurrencePattern = (date: string): string => {
    const targetDate = new Date(date);

    // Adjust for local timezone offset
    const localDate = new Date(targetDate.getTime() + targetDate.getTimezoneOffset() * 60000);

    const dayOfWeek = localDate.getDay(); // Get the day of the week (0 = Sunday, 1 = Monday, etc.)
    const weekOfMonth = Math.ceil(localDate.getDate() / 7); // Calculate the week of the month
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return `${weekOfMonth}${getOrdinalSuffix(weekOfMonth)} ${daysOfWeek[dayOfWeek]}`;
  };

  const getOrdinalSuffix = (num: number): string => {
    if (num === 1 || num === 21 || num === 31) return "st";
    if (num === 2 || num === 22) return "nd";
    if (num === 3 || num === 23) return "rd";
    return "th";
  };

  const fetchEvents = async () => {
    try {
      let start = new DayPilot.Date(currentDate);
      let endDate;

      // Determine the date range based on the view type
      switch (viewType) {
        // expand the date range of the query to cover the entire calendar grid for the month.
        case "Month":
          // start and end dates of the current month
          const monthStart = currentDate.firstDayOfMonth();
          const monthEnd = currentDate.lastDayOfMonth();

          // convert from DayPilot to JS date obj & calc the grid's start and end dates
          const gridStart = startOfWeek(monthStart.toDate(), { weekStartsOn: 0 });
          const gridEnd = endOfWeek(monthEnd.toDate(), { weekStartsOn: 0 });

          // convert back to DayPilot date obj.
          start = new DayPilot.Date(gridStart);
          endDate = new DayPilot.Date(gridEnd);
          break;
        case "Day":
          endDate = start.addDays(1); // Include only the current day
          break;
        default:
          endDate = start.addDays(1);
      }

      const eventsRef = collection(db, "events");

      // Adjust query logic based on the view type
      const q =
        viewType === "Month"
          ? query(
              eventsRef,
              where("deliveryDate", ">=", Timestamp.fromDate(start.toDate())),
              where("deliveryDate", "<=", Timestamp.fromDate(endDate.toDate())) // Use <= for Month View
            )
          : query(
              eventsRef,
              where("deliveryDate", ">=", Timestamp.fromDate(start.toDate())),
              where("deliveryDate", "<", Timestamp.fromDate(endDate.toDate())) // Use < for Day View
            );

      const querySnapshot = await getDocs(q);
      const fetchedEvents: DeliveryEvent[] = querySnapshot.docs.map((doc) => {
        const deliveryDateUTC = doc.data().deliveryDate.toDate(); // Get UTC date
        const deliveryDateLocal = new Date(
          deliveryDateUTC.getTime() + deliveryDateUTC.getTimezoneOffset() * 60000
        ); // Convert to local time

        return {
          id: doc.id,
          ...doc.data(),
          deliveryDate: deliveryDateLocal, // Use the normalized local date
        };
      }) as DeliveryEvent[];

      setEvents(fetchedEvents);

      // Update calendar configuration with new events
      const calendarEvents: CalendarEvent[] = fetchedEvents.map((event) => ({
        id: event.id,
        text: `Client: ${event.clientName} (Driver: ${event.assignedDriverName})`,
        start: new DayPilot.Date(event.deliveryDate, true),
        end: new DayPilot.Date(event.deliveryDate, true),
        backColor: "#257E68",
      }));

      setCalendarConfig((prev) => ({
        ...prev,
        events: calendarEvents,
        durationBarVisible: false,
      }));

      console.log(calendarEvents);
      return fetchedEvents;
    } catch (error) {
      console.error("Error fetching events:", error);
      return [];
    }
  };

  const getNextMonthlyDate = (originalDate: Date, currentDate: Date, targetDay?: number): Date => {
    const nextMonth = new Date(currentDate);
    nextMonth.setDate(1); // Start at the first day of the month
    nextMonth.setMonth(nextMonth.getMonth() + 1); // Move to the next month
    console.log(nextMonth);
    const daysInMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const originalWeek = Math.ceil(originalDate.getDate() / 7); // Week of the original delivery
    const targetWeek = originalWeek > 4 ? -1 : originalWeek; // If it's the 5th week, use -1 for the last occurrence
    const targetWeekday = targetDay ?? originalDate.getDay(); // Day of the week (0 = Sunday, 1 = Monday, etc.)

    console.log(targetWeekday);

    const targetDate = new Date(nextMonth);

    if (targetWeek === -1) {
      // Handle the last occurrence of the target weekday
      targetDate.setDate(daysInMonth); // Start at the last day of the month
      while (targetDate.getDay() !== targetWeekday) {
        targetDate.setDate(targetDate.getDate() - 1); // Move backward to find the last occurrence
      }
    } else {
      // Handle specific week occurrences (1st, 2nd, 3rd, 4th)
      targetDate.setDate((targetWeek - 1) * 7 + 1); // Start at the first day of the target week
      while (targetDate.getDay() !== targetWeekday) {
        targetDate.setDate(targetDate.getDate() + 1); // Move forward to find the correct weekday
      }
    }

    targetDate.setDate(targetDate.getDate() - 1);

    console.log(targetDate);
    return targetDate;
  };

  const handleAddDelivery = async () => {
    try {
      console.log(newDelivery);
      const deliveryDate = new Date(newDelivery.deliveryDate);
      const eventsToAdd = [];

      // Helper function to calculate recurrence dates
      const calculateRecurrenceDates = () => {
        const recurrenceDates = [];
        const originalDate = new Date(newDelivery.deliveryDate);
        let currentDate = originalDate;

        recurrenceDates.push(new Date(originalDate)); // Always include the original date

        if (newDelivery.recurrence === "Weekly") {
          const interval = 7; // Weekly interval
          addRecurrenceDates(interval);
        } else if (newDelivery.recurrence === "2x-Monthly") {
          const interval = 14; // 2x-Monthly interval
          addRecurrenceDates(interval);
        } else if (newDelivery.recurrence === "Monthly") {
          if (newDelivery.repeatsEndDate) {
            const endDate = new Date(newDelivery.repeatsEndDate);
            if (originalDate.getDate() <= 30) {
              originalDate.setDate(originalDate.getDate() + 1);
            }
            console.log(originalDate.getDate());
            //if 31st it goes to next month so it will skip a month
            while (currentDate <= endDate) {
              currentDate = getNextMonthlyDate(originalDate, currentDate);
              if (currentDate <= endDate) {
                recurrenceDates.push(new Date(currentDate));
              }
            }
          }
        }

        return recurrenceDates;

        function addRecurrenceDates(interval: number) {
          if (newDelivery.repeatsEndDate) {
            const endDate = new Date(newDelivery.repeatsEndDate);
            while (currentDate <= endDate) {
              currentDate.setDate(currentDate.getDate() + interval);
              if (currentDate <= endDate) {
                recurrenceDates.push(new Date(currentDate));
              }
            }
          }
        }
      };

      // Calculate recurrence dates based on the recurrence type
      const recurrenceDates =
        newDelivery.recurrence === "None" ? [deliveryDate] : calculateRecurrenceDates();

      for (const date of recurrenceDates) {
        const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); // Normalize to UTC

        // Only include optional fields if they are defined
        const eventToAdd: Partial<DeliveryEvent> = {
          assignedDriverId: newDelivery.assignedDriverId,
          assignedDriverName: newDelivery.assignedDriverName,
          clientId: newDelivery.clientId,
          clientName: newDelivery.clientName,
          deliveryDate: date, // Store as UTC
          recurrence: newDelivery.recurrence,
          time: "",
          cluster: 0,
        };

        if (newDelivery.repeatsEndDate) {
          eventToAdd.repeatsEndDate = newDelivery.repeatsEndDate;
        }

        eventsToAdd.push(eventToAdd);
      }

      // Add all events to the database
      const batch = eventsToAdd.map((event) => addDoc(collection(db, "events"), event));
      await Promise.all(batch);

      // Reset the form
      const today = new Date().toISOString().split("T")[0];
      setNewDelivery({
        assignedDriverId: "",
        assignedDriverName: "",
        clientId: "",
        clientName: "",
        deliveryDate: today,
        recurrence: "None",
        repeatsEndDate: "",
      });

      setIsModalOpen(false);

      // Refresh events after adding
      fetchEvents();
    } catch (error) {
      console.error("Error adding delivery:", error);
    }
  };

  const handleNavigatePrev = () => {
    const newDate = viewType === "Month" ? currentDate.addMonths(-1) : currentDate.addDays(-1);
    setCurrentDate(newDate);
  };

  const handleNavigateNext = () => {
    const newDate = viewType === "Month" ? currentDate.addMonths(1) : currentDate.addDays(1);
    setCurrentDate(newDate);
  };

  // Update calendar when view type or date changes
  useEffect(() => {
    setCalendarConfig((prev) => ({
      ...prev,
      viewType: viewType === "Month" ? "Month" : viewType,
      startDate: currentDate,
    }));
    fetchEvents();
    fetchDrivers();
    fetchClients();
  }, [viewType, currentDate, fetchEvents]);

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = ("" + phone).replace(/\D/g, ""); // Remove non-numeric characters
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/); // Match the phone number pattern
    if (match) {
      return `(${match[1]})-${match[2]}-${match[3]}`; // Format as (xxx)-xxx-xxxx
    }
    return phone; // Return the original phone if it doesn't match the pattern
  };

  const renderCalendarView = () => {
    if (viewType === "Day") {
      return (
        <Box sx={{ padding: 2 }}>
          {events.length === 0 ? (
            <Typography>No deliveries scheduled for this day.</Typography>
          ) : (
            <Box
              sx={{
                maxHeight: "75vh",
                overflowY: "auto",
              }}
            >
              {events.map((event) => {
                const client = clients.find((client) => client.uid === event.clientId);

                const trueRestrictions = Object.entries(
                  client?.deliveryDetails?.dietaryRestrictions || {}
                )
                  .filter(([key, value]) => value === true)
                  .map(([key]) =>
                    key
                      .replace(/([a-z])([A-Z])/g, "$1 $2")
                      .replace(/^./, (str) => str.toUpperCase())
                  );

                const { foodAllergens = [], other = [] } =
                  client?.deliveryDetails?.dietaryRestrictions || {};

                const dietaryRestrictions = [...trueRestrictions, ...foodAllergens, ...other];

                return (
                  <Box
                    key={event.id}
                    sx={{
                      display: "flex",
                      flexDirection: "row",
                      padding: 3,
                      marginBottom: 1,
                      border: "1px solid #fff",
                      borderRadius: "10px",
                      backgroundColor: "#F3F3F3",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginRight: 5,
                      }}
                    >
                      <Box>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: "bold",
                            color: "#787777",
                          }}
                        >
                          {event.clientName}
                        </Typography>
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "row",
                            cursor: "pointer",
                            alignItems: "center", // Ensure the icon aligns properly with the text
                          }}
                          onClick={() => {
                            navigate(`/profile/${client?.uid}`);
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: "600",
                              color: "#257E68",
                              marginTop: 0.25,
                              whiteSpace: "nowrap", // Prevent text from wrapping to the next line
                            }}
                          >
                            NOTES AND DETAILS
                          </Typography>
                          <KeyboardArrowDownIcon
                            sx={{
                              fontSize: 25,
                              color: "#257E68",
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        backgroundColor: "#D9D9D9",
                        width: 2,
                        height: 120,
                        marginRight: 5,
                      }}
                    ></Box>

                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        width: "100%",
                        gap: "30px",
                      }}
                    >
                      {[
                        {
                          label: "PHONE",
                          value: client?.phone ? formatPhoneNumber(client.phone) : "N/A", // Format the phone number
                          color: "#787777",
                        },
                        {
                          label: "ADDRESS",
                          value: client?.address || "N/A",
                          color: "#787777",
                        },
                        {
                          label: "DIETARY RESTRICTIONS",
                          value: dietaryRestrictions.length
                            ? dietaryRestrictions.join(", ")
                            : "N/A", // Join dietary restrictions with commas
                          color: "#787777",
                        },
                        {
                          label: "TAGS",
                          value: client?.tags?.length ? client.tags.join(", ") : "N/A", // Join tags with commas
                          color: "#787777",
                        },
                        {
                          label: "NOTES",
                          value: client?.notes || "N/A",
                          color: "#787777",
                        },
                      ].map(({ label, value, color }) => (
                        <Box
                          key={label}
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            marginLeft: 2,
                            flex: "1 1 120px",
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: "600",
                              color: "#BDBDBD",
                              marginBottom: "4px",
                            }}
                          >
                            {label}
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: "bold", color: color }}>
                            {value}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                    {/* Three-dot menu button */}
                    <EventMenu event={event} />
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      );
    }
    // For Week and Month views
    if (viewType === "Month") {
      const customCalendarConfig = {
        ...calendarConfig,
        onBeforeCellRender: (args: any) => {
          const dateKey = args.cell.start.toString("yyyy-MM-dd");
          const dailyLimit = dailyLimits.find((dl) => dl.date === dateKey);
          const defaultLimit = getDefaultLimit(args.cell.start, limits);
          const limit = dailyLimit ? dailyLimit.limit : defaultLimit;

          const eventCount = calendarConfig.events.filter((event) => {
            const eventDateString = event.start.toString("yyyy-MM-dd");
            return eventDateString === dateKey;
          }).length;

          args.cell.properties.html = `
            <div style='position: absolute; 
                        top: 50%; 
                        left: 50%; 
                        transform: translate(-50%, -50%);
                        text-align: center; 
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        color: ${eventCount > limit && "#ff6e6b"};'>
                ${eventCount}/${limit}
                <div>DELIVERIES</div>
            </div>
        `;
        },
        onTimeRangeSelected: (args: any) => {
          setCurrentDate(args.start);
          setViewType("Day");
        },
        events: [], // Remove events from month view
      };

      return <DayPilotMonth {...customCalendarConfig} />;
    }

    return <DayPilotCalendar {...calendarConfig} viewType={viewType as DayPilotViewType} />;
  };

  // For the calendar popper so it goes away when clicking away from it.
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      // Check if the click target is contained within the container ref.
      if (containerRef.current && containerRef.current.contains(event.target as Node)) {
        return; // Click is inside, so do nothing.
      }
      // Otherwise, close the popper.
      setAnchorEl(null);
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [setAnchorEl]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        minWidth: "100vw",
      }}
    >
      <AppBar position="static" color="default" elevation={1}></AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: "hidden",
          marginTop: 10,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",

            width: "100%",
            marginTop: 5,
          }}
        >
          <Box
            sx={{
              marginLeft: 4,
            }}
          >
            <Button
              sx={{ width: 100 }}
              onClick={(e) => setViewAnchorEl(e.currentTarget)}
              endIcon={<ChevronRight />}
              variant="outlined"
            >
              {viewType}
            </Button>
            <Menu
              anchorEl={viewAnchorEl}
              open={Boolean(viewAnchorEl)}
              onClose={() => setViewAnchorEl(null)}
            >
              {(["Day", "Month"] as ViewType[]).map((type) => (
                <MenuItem
                  key={type}
                  onClick={() => {
                    setViewType(type);
                    setViewAnchorEl(null);
                  }}
                >
                  {type}
                </MenuItem>
              ))}
            </Menu>
            <Button
              sx={{ width: 50, fontSize: 12, marginLeft: 4 }}
              onClick={(e) => setCurrentDate(DayPilot.Date.today())}
            >
              Today
            </Button>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <Typography variant="h4" sx={{ marginRight: 2, color: "#787777" }}>
              {viewType === "Day" && daysOfWeek[currentDate.getDayOfWeek()]}
              {viewType === "Month" && currentDate.toString("MMMM")}
            </Typography>
            {viewType === "Day" && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: "40px",
                  height: "40px",
                  backgroundColor: "#257E68",
                  borderRadius: "90%",
                  marginRight: 2,
                }}
              >
                <Typography variant="h5" sx={{ color: "#fff" }}>
                  {currentDate.toString("d")}
                </Typography>
              </Box>
            )}
            <IconButton onClick={handleNavigatePrev} size="large" sx={{ color: "#257E68" }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderLeft: "2px solid #257E68",
                  borderBottom: "2px solid #257E68",
                  transform: "rotate(45deg)",
                }}
              />
            </IconButton>
            <IconButton onClick={handleNavigateNext} size="large" sx={{ color: "#257E68" }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderLeft: "2px solid #257E68",
                  borderBottom: "2px solid #257E68",
                  transform: "rotate(-135deg)",
                }}
              />
            </IconButton>
          </Box>

          <Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setIsModalOpen(true)}
              sx={{
                marginRight: 4,
                width: 166,
                color: "#fff",
                backgroundColor: "#257E68",
              }}
            >
              Add Delivery
            </Button>

            <span ref={containerRef}>
              {viewType === "Month" && (
                <Button
                  variant="contained"
                  endIcon={<EditCalendar />}
                  onClick={(event: React.MouseEvent<HTMLElement>) =>
                    setAnchorEl(anchorEl ? null : event.currentTarget)
                  }
                  sx={{
                    marginRight: 4,
                    width: 166,
                    color: "#fff",
                    backgroundColor: "#257E68",
                  }}
                >
                  Edit Limits
                </Button>
              )}
              <CalendarPopper
                anchorEl={anchorEl}
                viewType={viewType}
                calendarConfig={calendarConfig}
                dailyLimits={dailyLimits}
                setDailyLimits={setDailyLimits}
                fetchDailyLimits={fetchLimits}
              />
            </span>
          </Box>
        </Box>

        <StyledCalendarContainer>
          <CalendarContent>{renderCalendarView()}</CalendarContent>
        </StyledCalendarContainer>

        <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <DialogTitle>Add Delivery</DialogTitle>
          <DialogContent>
            {/* Client Selection */}
            <Autocomplete
              options={clients}
              getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
              value={
                newDelivery.clientId
                  ? clients.find((client) => client.uid === newDelivery.clientId) || null
                  : null
              }
              onChange={(event, newValue) => {
                if (newValue) {
                  // Autofill logic based on the selected client
                  const clientProfile = clients.find((client) => client.uid === newValue.uid);
                  if (clientProfile) {
                    setNewDelivery({
                      ...newDelivery,
                      clientId: clientProfile.uid,
                      clientName: `${clientProfile.firstName} ${clientProfile.lastName}`,
                      deliveryDate:
                        clientProfile.startDate || new Date().toISOString().split("T")[0], // Autofill deliveryDate
                      recurrence: ["None", "Weekly", "2x-Monthly", "Monthly"].includes(
                        clientProfile.recurrence
                      )
                        ? (clientProfile.recurrence as "None" | "Weekly" | "2x-Monthly" | "Monthly")
                        : "None", // Default to "None" if the value is invalid
                      repeatsEndDate: clientProfile.endDate || "", // Autofill end date
                    });
                  }
                } else {
                  // Reset fields if no client is selected
                  setNewDelivery({
                    ...newDelivery,
                    clientId: "",
                    clientName: "",
                    deliveryDate: new Date().toISOString().split("T")[0],
                    recurrence: "None",
                    repeatsEndDate: "",
                  });
                }
              }}
              renderOption={(props, option) => (
                <li {...props} key={option.uid}>
                  {`${option.firstName} ${option.lastName}`}
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Client Name" margin="normal" fullWidth />
              )}
            />

            {/* Delivery Date */}
            <TextField
              label="Delivery Date"
              type="date"
              value={newDelivery.deliveryDate}
              onChange={(e) => setNewDelivery({ ...newDelivery, deliveryDate: e.target.value })}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />

            {/* Recurrence Dropdown */}
            <FormControl fullWidth variant="outlined" margin="normal">
              <InputLabel id="recurrence-label">Recurrence</InputLabel>
              <Select
                label="Recurrence"
                labelId="recurrence-label"
                value={newDelivery.recurrence}
                onChange={(e) =>
                  setNewDelivery({
                    ...newDelivery,
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

            {/* Ends Section */}
            {newDelivery.recurrence !== "None" && (
              <Box>
                <Typography variant="subtitle1">End Date</Typography>
                <TextField
                  label="End Date"
                  type="date"
                  value={newDelivery.repeatsEndDate}
                  onChange={(e) =>
                    setNewDelivery({
                      ...newDelivery,
                      repeatsEndDate: e.target.value,
                    })
                  }
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDelivery} variant="contained">
              Add
            </Button>
          </DialogActions>
        </Dialog>
        <Box sx={{ position: "fixed", bottom: 24, right: 24 }}></Box>
      </Box>
    </Box>
  );
};

export default CalendarPage;
