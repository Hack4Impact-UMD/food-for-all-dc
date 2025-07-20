import { DayPilot } from "@daypilot/daypilot-lite-react";
import { AppBar, Box, styled } from "@mui/material";
import { Time, TimeUtils } from "../../utils/timeUtils";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../../auth/firebaseConfig";
import "./CalendarPage.css";
import AddDeliveryDialog from "./components/AddDeliveryDialog";
import CalendarHeader from "./components/CalendarHeader";
import CalendarPopper from "./components/CalendarPopper";
import { calculateRecurrenceDates } from "./components/CalendarUtils";
import DayView from "./components/DayView";
import MonthView from "./components/MonthView";
import { CalendarConfig, CalendarEvent, DateLimit, DeliveryEvent, Driver, NewDelivery, ViewType } from "../../types/calendar-types";
import { ClientProfile } from "../../types/client-types";
import { useLimits } from "./components/useLimits";
import { DeliveryService, ClientService, DriverService } from "../../services";
import { toJSDate, toDayPilotDateString } from '../../utils/timestamp';

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const StyledCalendarContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  padding: theme.spacing(2),
  height: "calc(100vh - 64px)",
  "& .calendar_default_main": {
    fontFamily: theme.typography.fontFamily,
  },
}));

const CalendarContent = styled(Box)({
  flexGrow: 1,
  position: "relative",
});

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize currentDate from URL params or default to today
  const getInitialDate = () => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      try {
        return new DayPilot.Date(dateParam);
      } catch {
        // If date param is invalid, fall back to today
        return DayPilot.Date.today();
      }
    }
    return DayPilot.Date.today();
  };
  
  const [currentDate, setCurrentDate] = useState<DayPilot.Date>(getInitialDate());
  
  // Custom function to update both state and URL params
  const updateCurrentDate = (newDate: DayPilot.Date) => {
    setCurrentDate(newDate);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('date', newDate.toString("yyyy-MM-dd"));
      return newParams;
    });
  };
  
  const [viewType, setViewType] = useState<ViewType>("Day");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig>({
    viewType: "Day",
    startDate: DayPilot.Date.today(),
    events: [],
  });
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [dailyLimits, setDailyLimits] = useState<DateLimit[]>([]);
  const limits = useLimits();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Route Protection
  useEffect(() => {
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

  const fetchDrivers = async () => {
    try {
      // Use DriverService instead of direct Firebase calls
      const driverService = DriverService.getInstance();
      const driverList = await driverService.getAllDrivers();
      // Cast to appropriate type to avoid type mismatch
      setDrivers(driverList);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  };

  const fetchClients = async () => {
    try {
      // Use ClientService instead of direct Firebase calls
      const clientService = ClientService.getInstance();
      const clientsData = await clientService.getAllClients();
      
      // Map client data to Client type with explicit type casting for compatibility
      const clientList = clientsData.map(data => {
        // Ensure dietaryRestrictions has all required fields
        const dietaryRestrictions = data.deliveryDetails?.dietaryRestrictions || {};
        
        return {
          id: data.uid,
          uid: data.uid,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          streetName: data.streetName || "",
          zipCode: data.zipCode || "",
          address: data.address || "",
          address2: data.address2 || "",
          email: data.email || "",
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
          deliveryDetails: {
            deliveryInstructions: data.deliveryDetails?.deliveryInstructions || "",
            dietaryRestrictions: {
              foodAllergens: dietaryRestrictions.foodAllergens || [],
              halal: dietaryRestrictions.halal || false,
              kidneyFriendly: dietaryRestrictions.kidneyFriendly || false,
              lowSodium: dietaryRestrictions.lowSodium || false,
              lowSugar: dietaryRestrictions.lowSugar || false,
              microwaveOnly: dietaryRestrictions.microwaveOnly || false,
              noCookingEquipment: dietaryRestrictions.noCookingEquipment || false,
              other: dietaryRestrictions.other || [],
              softFood: dietaryRestrictions.softFood || false,
              vegan: dietaryRestrictions.vegan || false,
              vegetarian: dietaryRestrictions.vegetarian || false,
            },
          },
          lifeChallenges: data.lifeChallenges || "",
          notes: data.notes || "",
          notesTimestamp: data.notesTimestamp || null,
          lifestyleGoals: data.lifestyleGoals || "",
          language: data.language || "",
          createdAt: data.createdAt || TimeUtils.now().toJSDate(),
          updatedAt: data.updatedAt || TimeUtils.now().toJSDate(),
          startDate: data.startDate || "",
          endDate: data.endDate || "",
          recurrence: data.recurrence || "None",
          tags: data.tags || [],
          ward: data.ward || "",
          seniors: data.seniors || 0,
          headOfHousehold: data.headOfHousehold || "Adult",
        };
      });
      
      // Cast the result to Client[] to satisfy type checking
      setClients(clientList as unknown as ClientProfile[]);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchLimits = async () => {
    try {
      // Use DeliveryService instead of direct Firebase calls
      const deliveryService = DeliveryService.getInstance();
      const limitsData = await deliveryService.getDailyLimits();
      setDailyLimits(limitsData);
    } catch (error) {
      console.error("Error fetching limits:", error);
    }
  };

  const fetchEvents = async () => {
    try {
      let start = new DayPilot.Date(currentDate);
      let endDate;

      // Determine the date range based on the view type
      switch (viewType) {
        // Expand the date range of the query to cover the entire calendar grid for the month.
        case "Month": {
          // Start and end dates of the current month
          const monthStart = currentDate.firstDayOfMonth();
          const monthEnd = currentDate.lastDayOfMonth();

          // Convert from DayPilot to JS date obj & calc the grid's start and end dates
          const monthStartLuxon = TimeUtils.fromJSDate(monthStart.toDate());
          const monthEndLuxon = TimeUtils.fromJSDate(monthEnd.toDate());
          const gridStart = monthStartLuxon.startOf('week').toJSDate();
          const gridEnd = monthEndLuxon.endOf('week').toJSDate();

          // Convert back to DayPilot date obj.
          start = new DayPilot.Date(gridStart);
          endDate = new DayPilot.Date(gridEnd);
          break;
        }
        case "Day": {
          endDate = start.addDays(1); // Include only the current day
          break;
        }
        default:
          endDate = start.addDays(1);
      }

      // Use DeliveryService to fetch events by date range
      const deliveryService = DeliveryService.getInstance();
      const fetchedEvents = await deliveryService.getEventsByDateRange(
        start.toDate(),
        endDate.toDate()
      );

      // Filter out events associated with deleted clients
      const activeClientIds = new Set(clients.map(client => client.uid));
      const filteredEventsByClient = fetchedEvents.filter(event => activeClientIds.has(event.clientId));

      // Update client names in events with current client data
      const updatedEvents = filteredEventsByClient.map(event => {
        const client = clients.find(client => client.uid === event.clientId);
        if (client) {
          const fullName = `${client.firstName} ${client.lastName}`.trim();
          return {
            ...event,
            clientName: fullName
          };
        }
        return event;
      });

      // Deduplicate events based on clientId and deliveryDate
      const uniqueEventsMap = new Map<string, DeliveryEvent>();
      updatedEvents.forEach(event => {
        const key = `${event.clientId}_${toDayPilotDateString(event.deliveryDate)}`;
        if (!uniqueEventsMap.has(key)) {
          uniqueEventsMap.set(key, event);
        }
      });
      const uniqueFilteredEvents = Array.from(uniqueEventsMap.values());

      setEvents(uniqueFilteredEvents);

      // Update calendar configuration with new events
      const formattedEvents = Array.from(uniqueEventsMap.values()).map(event => ({
        id: event.id,
        text: `Client: ${event.clientName} (Driver: ${event.assignedDriverName})`,
        start: new DayPilot.Date(toDayPilotDateString(event.deliveryDate)),
        end: new DayPilot.Date(toDayPilotDateString(event.deliveryDate)),
        backColor: "#257E68",
      }));

      setCalendarConfig((prev) => ({
        ...prev,
        events: formattedEvents,
        startDate: currentDate,
        durationBarVisible: false,
      }));

      return uniqueFilteredEvents;
    } catch (error) {
      console.error("Error fetching events:", error);
      return [];
    }
  };

  const handleAddDelivery = async (newDelivery: NewDelivery) => {
    try {
      let recurrenceDates: Date[] = [];

      //create unique id for each recurrence group. All events for this recurrence will have the same id
      const recurrenceId = crypto.randomUUID();
      if (newDelivery.recurrence === "Custom") {
        // Use customDates directly if recurrence is Custom
        // Ensure customDates exist and map string dates back to Date objects
        recurrenceDates = newDelivery.customDates?.map(dateStr => {
          // Use TimeUtils for proper timezone handling
          return TimeUtils.fromISO(dateStr).toJSDate();
        }) || [];
        // Clear repeatsEndDate explicitly for custom recurrence in the submitted data
        newDelivery.repeatsEndDate = undefined;
      } else {
        // Calculate recurrence dates for standard recurrence types
        const deliveryDate = TimeUtils.fromISO(newDelivery.deliveryDate).toJSDate();
        recurrenceDates =
          newDelivery.recurrence === "None" ? [deliveryDate] : calculateRecurrenceDates(newDelivery);
      }

      // Filter out dates that already have a delivery for the same client
      const existingEventDates = new Set(
        events
          .filter(event => event.clientId === newDelivery.clientId)
          .map(event => {
            const jsDate = toJSDate(event.deliveryDate);
            return new DayPilot.Date(jsDate).toString("yyyy-MM-dd");
          })
      );

      const uniqueRecurrenceDates = recurrenceDates.filter(date => 
        !existingEventDates.has(new DayPilot.Date(date).toString("yyyy-MM-dd"))
      );

      if (uniqueRecurrenceDates.length < recurrenceDates.length) {
        console.warn("Some duplicate delivery dates were detected and skipped.");
      }

      // Use DeliveryService to create events for unique dates only
      const deliveryService = DeliveryService.getInstance();
      const seriesStartDate = newDelivery.deliveryDate; // Saves the original start date

      const createPromises = uniqueRecurrenceDates.map(date => {
        const eventToAdd: Partial<DeliveryEvent> = {
          clientId: newDelivery.clientId,
          clientName: newDelivery.clientName,
          deliveryDate: date, // Use the calculated/provided recurrence date
          recurrence: newDelivery.recurrence,
          seriesStartDate: seriesStartDate, 
          time: "",
          cluster: 0,
          recurrenceId: recurrenceId,
        };

        // Add customDates array if recurrence is Custom
        if (newDelivery.recurrence === "Custom") {
          eventToAdd.customDates = newDelivery.customDates;
        } else if (newDelivery.repeatsEndDate) {
          eventToAdd.repeatsEndDate = newDelivery.repeatsEndDate;
        }

        return deliveryService.createEvent(eventToAdd);
      });

      await Promise.all(createPromises);

      // Refresh events after adding
      await fetchEvents();
      
      // Close the modal after successful addition
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding delivery:", error);
    }
  };

  const handleNavigatePrev = () => {
    const newDate = viewType === "Month" ? currentDate.addMonths(-1) : currentDate.addDays(-1);
    updateCurrentDate(newDate);
  };

  const handleNavigateNext = () => {
    const newDate = viewType === "Month" ? currentDate.addMonths(1) : currentDate.addDays(1);
    updateCurrentDate(newDate);
  };

  const handleNavigateToday = () => {
    updateCurrentDate(DayPilot.Date.today());
  };

  // Clear events immediately when view type changes to prevent flickering
  useEffect(() => {
    setEvents([]);
  }, [viewType]);

  // Update calendar when view type, date, or clients change
  useEffect(() => {
    // Only fetch events if clients have been loaded
    if (clients.length > 0) {
      fetchEvents();
    }
  }, [viewType, currentDate, clients]);

  // Handle URL parameter changes (e.g., browser back/forward, direct URL access)
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      try {
        const urlDate = new DayPilot.Date(dateParam);
        // Only update if different from current date to avoid infinite loops
        if (urlDate.toString("yyyy-MM-dd") !== currentDate.toString("yyyy-MM-dd")) {
          setCurrentDate(urlDate);
        }
      } catch {
        // If date param is invalid, don't update
      }
    }
  }, [searchParams.get('date')]);

  // Initial data fetch
  useEffect(() => {
    fetchLimits();
    fetchDrivers();
    fetchClients();
  }, []);

  const renderCalendarView = () => {
    if (viewType === "Day") {
      // Calculate the daily limit for the current day
      const currentDayOfWeek = currentDate.dayOfWeek(); // 0 = Sunday, 1 = Monday, etc.
      const dailyLimit = limits[currentDayOfWeek];
      
      return (
        <DayView 
          events={events} 
          clients={clients} 
          onEventModified={fetchEvents} 
          dailyLimit={dailyLimit}
        />
      );
    }
    
    if (viewType === "Month") {
      return (
        <MonthView 
          calendarConfig={calendarConfig}
          dailyLimits={dailyLimits}
          limits={DAYS.reduce((acc, day, index) => {
            acc[day.charAt(0).toUpperCase() + day.slice(1)] = limits[index];
            return acc;
          }, {} as Record<string, number>)}
          onTimeRangeSelected={(args: any) => {
            updateCurrentDate(args.start);
            setViewType("Day");
          }}
        />
      );
    }
    
    return null;
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "90vh",
        minWidth: "95vw",
      }}
    >
      <AppBar position="static" color="default" elevation={1}></AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: "hidden"
        }}
      >
        <CalendarHeader 
          viewType={viewType}
          currentDate={currentDate}
          setCurrentDate={updateCurrentDate}
          onViewTypeChange={setViewType}
          onNavigatePrev={handleNavigatePrev}
          onNavigateToday={handleNavigateToday}
          onNavigateNext={handleNavigateNext}
          onAddDelivery={() => setIsModalOpen(true)}
          onEditLimits={viewType === "Month" ? 
            (event) => setAnchorEl(anchorEl ? null : event.currentTarget) : 
            undefined
          }
        />

        <StyledCalendarContainer>
          <CalendarContent>
            {renderCalendarView()}
          </CalendarContent>
        </StyledCalendarContainer>

        <span ref={containerRef}>
          <CalendarPopper
            anchorEl={anchorEl}
            viewType={viewType}
            calendarConfig={calendarConfig}
            dailyLimits={dailyLimits}
            setDailyLimits={setDailyLimits}
            fetchDailyLimits={fetchLimits}
          />
        </span>

        <AddDeliveryDialog
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddDelivery={handleAddDelivery}
          clients={clients}
          startDate={currentDate}
        />
      </Box>
    </Box>
  );
};

export default CalendarPage;
