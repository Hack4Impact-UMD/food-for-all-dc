import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Autocomplete,
  Select,
  InputLabel,
  FormControl,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  FormLabel,
  Radio,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import {
  ChevronRight,
  Add,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import {
  deleteDoc, doc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../auth/firebaseConfig";
import {
  DayPilot,
  DayPilotCalendar,
  DayPilotMonth,
} from "@daypilot/daypilot-lite-react";
import { useNavigate } from 'react-router-dom';
import "./CalendarPage.css";
import { auth } from "../../auth/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

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
  id: string;
  firstName: string;
  lastName: string;
  address: string;
  language: string;
  phone: string; // Added phone property
  deliveryDetails: DeliveryDetails;
  tags: String[];
  notes: string;
  uid: string;
}

interface DeliveryDetails {
  deliveryInstructions: string;
  dietaryRestrictions: DietaryRestrictions;
}

interface DietaryRestrictions {
  foodAllergens: Array<Boolean>;
  other: Array<Boolean>;
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
  recurrence: "None" | "Weekly" | "2x-Monthly" | "Monthly"; // Updated recurrence options
  repeatsEndOption?: "On" | "After"; // Optional, only applicable if recurrence is not "None"
  repeatsEndDate?: string; // Optional, end date for recurrence
  repeatsAfterOccurrences?: number; // Optional, number of occurrences for recurrence
}

interface NewDelivery {
  assignedDriverId: string;
  assignedDriverName: string;
  clientId: string;
  clientName: string;
  deliveryDate: string; // ISO string for the delivery date
  recurrence: "None" | "Weekly" | "2x-Monthly" | "Monthly"; // Updated recurrence options
  repeatsEndOption?: "On" | "After"; // Optional, only applicable if recurrence is not "None"
  repeatsEndDate?: string; // Optional, end date for recurrence
  repeatsAfterOccurrences?: number; // Optional, number of occurrences for recurrence
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
  const [currentDate, setCurrentDate] = useState<DayPilot.Date>(
    DayPilot.Date.today()
  );

  const [viewType, setViewType] = useState<ViewType>("Day");
  const [viewAnchorEl, setViewAnchorEl] = useState<null | HTMLElement>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig>({
    viewType: "Day",
    startDate: DayPilot.Date.today(),
    events: [],
  });
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  //Route Protection
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user:any) => {
      if (!user) {
        console.log("No user is signed in, redirecting to /");
        navigate("/");
      } 
      else{
        console.log("welcome, " + auth.currentUser?.email)
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
    const clientList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Client[];
    setClients(clientList);
  };

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
      repeatsEndOption: undefined, // No default end option
      repeatsEndDate: "", // No end date by default
      repeatsAfterOccurrences: undefined, // No occurrences by default
    };
  });


interface EventMenuProps {
  event: DeliveryEvent;
}

const EventMenu: React.FC<EventMenuProps> = ({ event }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteOption, setDeleteOption] = useState("This event");

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

  return (
    <>
      <IconButton onClick={handleMenuOpen}>
        <MoreVertIcon />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleDeleteClick}>Delete</MenuItem>
      </Menu>

      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Event</DialogTitle>
        <DialogContent>
          {event.recurrence !== "None" ? (
            <RadioGroup
              value={deleteOption}
              onChange={(e) => setDeleteOption(e.target.value)}
            >
              <FormControlLabel
                value="This event"
                control={<Radio />}
                label="This event"
              />
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
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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
      case "Month":
        start = currentDate.firstDayOfMonth();
        endDate = start.lastDayOfMonth(); // Do not add 1 day here
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

const getNextMonthlyDate = (originalDate: Date, currentDate: Date, targetDay?: number) => {
  const nextMonth = new Date(currentDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1); // Move to the next month
  nextMonth.setDate(1); // Start at the first day of the month

  const originalWeek = Math.ceil(originalDate.getDate() / 7); // Week of the original delivery
  const daysInMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();

  // Calculate the target date in the next month
  let targetDate = new Date(nextMonth);
  targetDate.setDate((originalWeek - 1) * 7 + 1); // Start at the first day of the target week

  while (targetDate.getDay() !== (targetDay ?? originalDate.getDay())) {
    targetDate.setDate(targetDate.getDate() + 1); // Move to the correct day of the week
  }

  // Ensure the target date is within the month
  if (targetDate.getDate() > daysInMonth) {
    targetDate.setDate(daysInMonth);
  }

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
        if (newDelivery.repeatsEndOption === "On" && newDelivery.repeatsEndDate) {
          const endDate = new Date(newDelivery.repeatsEndDate);
          while (currentDate <= endDate) {
            currentDate = getNextMonthlyDate(originalDate, currentDate);
            if (currentDate <= endDate) {
              recurrenceDates.push(new Date(currentDate));
            }
          }
        } else if (newDelivery.repeatsEndOption === "After" && newDelivery.repeatsAfterOccurrences) {
          let occurrences = 1;
          while (occurrences < newDelivery.repeatsAfterOccurrences) {
            currentDate = getNextMonthlyDate(originalDate, currentDate);
            recurrenceDates.push(new Date(currentDate));
            occurrences++;
          }
        }
      }

      return recurrenceDates;

      function addRecurrenceDates(interval: number) {
        if (newDelivery.repeatsEndOption === "On" && newDelivery.repeatsEndDate) {
          const endDate = new Date(newDelivery.repeatsEndDate);
          while (currentDate <= endDate) {
            currentDate.setDate(currentDate.getDate() + interval);
            if (currentDate <= endDate) {
              recurrenceDates.push(new Date(currentDate));
            }
          }
        } else if (newDelivery.repeatsEndOption === "After" && newDelivery.repeatsAfterOccurrences) {
          let occurrences = 1;
          while (occurrences < newDelivery.repeatsAfterOccurrences) {
            currentDate.setDate(currentDate.getDate() + interval);
            recurrenceDates.push(new Date(currentDate));
            occurrences++;
          }
        }
      }
    };

    // Calculate recurrence dates based on the recurrence type
    const recurrenceDates =
      newDelivery.recurrence === "None"
        ? [deliveryDate]
        : calculateRecurrenceDates();

    for (const date of recurrenceDates) {
      const utcDate = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
      ); // Normalize to UTC
    
      // Only include optional fields if they are defined
      const eventToAdd: Partial<DeliveryEvent> = {
        assignedDriverId: newDelivery.assignedDriverId,
        assignedDriverName: newDelivery.assignedDriverName,
        clientId: newDelivery.clientId,
        clientName: newDelivery.clientName,
        deliveryDate: date, // Store as UTC
        recurrence: newDelivery.recurrence,
      };
    
      if (newDelivery.repeatsEndOption) {
        eventToAdd.repeatsEndOption = newDelivery.repeatsEndOption;
      }
    
      if (newDelivery.repeatsEndDate) {
        eventToAdd.repeatsEndDate = newDelivery.repeatsEndDate;
      }
    
      if (newDelivery.repeatsAfterOccurrences !== undefined) {
        eventToAdd.repeatsAfterOccurrences = newDelivery.repeatsAfterOccurrences;
      }
    
      eventsToAdd.push(eventToAdd);
    }
    
    // Add all events to the database
    const batch = eventsToAdd.map((event) =>
      addDoc(collection(db, "events"), event)
    );
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
      repeatsEndOption: undefined,
      repeatsEndDate: "",
      repeatsAfterOccurrences: undefined,
    });

    setIsModalOpen(false);

    // Refresh events after adding
    fetchEvents();
  } catch (error) {
    console.error("Error adding delivery:", error);
  }
};

  const handleNavigatePrev = () => {
    const newDate =
      viewType === "Month"
        ? currentDate.addMonths(-1)
        : currentDate.addDays(-1);
    setCurrentDate(newDate);
  };

  const handleNavigateNext = () => {
    const newDate =
      viewType === "Month"
        ? currentDate.addMonths(1)
        : currentDate.addDays(1);
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
  }, [viewType, currentDate]);

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
                const client = clients.find(
                  (client) => client.id === event.clientId
                );
  
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
  
                let dietaryRestrictions = [
                  ...trueRestrictions,
                  ...foodAllergens,
                  ...other,
                ];
  
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
                            navigate(`/profile/${client?.id}`);
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
                          value: client?.phone
                            ? formatPhoneNumber(client.phone)
                            : "N/A", // Format the phone number
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
                          value: client?.tags?.length
                            ? client.tags.join(", ")
                            : "N/A", // Join tags with commas
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
                          <Typography
                            variant="body1"
                            sx={{ fontWeight: "bold", color: color }}
                          >
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
      return <DayPilotMonth {...calendarConfig} />;
    }
  
    return (
      <DayPilotCalendar
        {...calendarConfig}
        viewType={viewType as DayPilotViewType}
      />
    );
  };

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
            <Typography variant="h4" sx={{marginRight: 2, color: "#787777" }}>
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
            <IconButton
              onClick={handleNavigatePrev}
              size="large"
              sx={{ color: "#257E68" }}
            >
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
            <IconButton
              onClick={handleNavigateNext}
              size="large"
              sx={{ color: "#257E68" }}
            >
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
      getOptionLabel={(option) =>
        `${option.firstName} ${option.lastName}`
      }
      value={
        newDelivery.clientId
          ? clients.find(
              (client) => client.id === newDelivery.clientId
            ) || null
          : null
      }
      onChange={(event, newValue) => {
        setNewDelivery({
          ...newDelivery,
          clientId: newValue ? newValue.id : "",
          clientName: newValue
            ? `${newValue.firstName} ${newValue.lastName}`
            : "",
        });
      }}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          {`${option.firstName} ${option.lastName}`}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Client Name"
          margin="normal"
          fullWidth
        />
      )}
    />

    {/* Driver Selection */}
    <Autocomplete
      options={drivers}
      getOptionLabel={(option) =>
        `${option.firstName} ${option.lastName} (${option.id})`
      }
      value={
        newDelivery.assignedDriverId
          ? drivers.find(
              (driver) => driver.id === newDelivery.assignedDriverId
            ) || null
          : null
      }
      onChange={(event, newValue) => {
        setNewDelivery({
          ...newDelivery,
          assignedDriverId: newValue ? newValue.id : "",
          assignedDriverName: newValue
            ? `${newValue.firstName} ${newValue.lastName}`
            : "",
        });
      }}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          {`${option.firstName} ${option.lastName}`}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Assigned Driver"
          margin="normal"
          fullWidth
        />
      )}
    />

    {/* Delivery Date */}
    <TextField
      label="Delivery Date"
      type="date"
      value={newDelivery.deliveryDate}
      onChange={(e) =>
        setNewDelivery({ ...newDelivery, deliveryDate: e.target.value })
      }
      fullWidth
      margin="normal"
      InputLabelProps={{ shrink: true }}
    />

    {/* Recurrence Dropdown */}
    <FormControl fullWidth margin="normal">
  <InputLabel id="recurrence-label">Recurrence</InputLabel>
  <Select
    labelId="recurrence-label"
    value={newDelivery.recurrence}
    onChange={(e) =>
      setNewDelivery({ ...newDelivery, recurrence: e.target.value as "None" | "Weekly" | "2x-Monthly" | "Monthly" })
    }
  >
    <MenuItem value="None">None</MenuItem>
    <MenuItem value="Weekly">Weekly</MenuItem>
    <MenuItem value="2x-Monthly">2x-Monthly</MenuItem>
    <MenuItem value="Monthly">Monthly</MenuItem>
  </Select>
</FormControl>

{/* Display recurrence pattern for Monthly */}
{newDelivery.recurrence === "Monthly" && (
  <Box sx={{ marginTop: 2 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: "#787777" }}>
      This event will recur on the{" "}
      {getRecurrencePattern(newDelivery.deliveryDate)}
    </Typography>
  </Box>
)}

    {/* Ends Section */}
    {newDelivery.recurrence !== "None" && (
      <Box>
        <Typography variant="subtitle1">Ends</Typography>
        <FormControl component="fieldset" margin="normal">
          <RadioGroup
            value={newDelivery.repeatsEndOption}
            onChange={(e) =>
              setNewDelivery({ ...newDelivery, repeatsEndOption: e.target.value as "On" | "After" })
            }
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <FormControlLabel value="On" control={<Radio />} label="On" />
              {newDelivery.repeatsEndOption === "On" && (
                <TextField
                  label="End Date"
                  type="date"
                  value={newDelivery.repeatsEndDate}
                  onChange={(e) =>
                    setNewDelivery({ ...newDelivery, repeatsEndDate: e.target.value })
                  }
                  InputLabelProps={{ shrink: true }}
                />
              )}
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <FormControlLabel value="After" control={<Radio />} label="After" />
              {newDelivery.repeatsEndOption === "After" && (
                <TextField
                  label="Occurrences"
                  type="number"
                  value={newDelivery.repeatsAfterOccurrences}
                  onChange={(e) =>
                    setNewDelivery({
                      ...newDelivery,
                      repeatsAfterOccurrences: parseInt(e.target.value),
                    })
                  }
                />
              )}
            </Box>
          </RadioGroup>
        </FormControl>
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
