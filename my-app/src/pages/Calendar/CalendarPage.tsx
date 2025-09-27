// Helper to set time to 12:00:00 PM
function setToNoon(date: any) {
  let jsDate;
  if (typeof date === 'string') {
    jsDate = new Date(date);
  } else if (date instanceof Date) {
    jsDate = new Date(date.getTime());
  } else if (date && typeof date.toDate === 'function') {
    jsDate = new Date(date.toDate().getTime());
  } else if (date && typeof date.toJSDate === 'function') {
    jsDate = new Date(date.toJSDate().getTime());
  } else {
    jsDate = new Date(date);
  }
  jsDate.setHours(12, 0, 0, 0);
  return jsDate;
}
import { DayPilot } from "@daypilot/daypilot-lite-react";
import { AppBar, Box, styled } from "@mui/material";
import { Time, TimeUtils } from "../../utils/timeUtils";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../../auth/firebaseConfig";
import AddDeliveryDialog from "./components/AddDeliveryDialog";
import CalendarHeader from "./components/CalendarHeader";
import CalendarPopper from "./components/CalendarPopper";
import { calculateRecurrenceDates } from "./components/CalendarUtils";
import DayView from "./components/DayView";
import MonthView from "./components/MonthView";
import { CalendarConfig, CalendarEvent, DateLimit, DeliveryEvent, Driver, NewDelivery, ViewType } from "../../types/calendar-types";
import { ClientProfile } from "../../types/client-types";
import { useLimits } from "./components/useLimits";
import DeliveryService from "../../services/delivery-service";
import ClientService from "../../services/client-service";
import DriverService from "../../services/driver-service";
import { toJSDate, toDayPilotDateString } from '../../utils/timestamp';
import { DateTime } from 'luxon';

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const StyledCalendarContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  padding: theme.spacing(1),
  flexGrow: 1,
  minHeight: 0, // Allow flex item to shrink below content size
  overflow: "hidden",
  "& .calendar_default_main": {
    fontFamily: theme.typography.fontFamily,
  },
  "&[data-view='Month']": {
    "& > div > div": {
      borderBottom: "2px solid #e0e0e0 !important",
    },
    "& .calendar_default_main, & [class*='calendar'], & .daypilot_month_main, & [class*='daypilot']": {
      borderBottom: "2px solid #e0e0e0 !important",
    },
    "& .daypilot_month": {
      borderBottom: "2px solid #e0e0e0 !important",
    },
    "& [class*='daypilot']": {
      borderBottom: "2px solid #e0e0e0 !important",
    },
  },

}));

const CalendarContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  position: "relative",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
  // Add border to calendar content when parent has data-view="Month"
  "[data-view='Month'] &": {
    borderBottom: "2px solid #e0e0e0",
  },
}));

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
    // DEBUG: Clear and print clients after fetch
    try {
      // Use ClientService instead of direct Firebase calls
      const clientService = ClientService.getInstance();
      const clientsData = await clientService.getAllClients();
      // Use the client objects as returned from client-service.ts to ensure uid matches Firestore doc id
      setClients(clientsData.clients as ClientProfile[]);
      const clientUids = clientsData.clients.map((c: any) => c.uid);
      console.log('[CalendarPage][DEBUG] Loaded client uids:', clientUids);
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
    // DEBUG: Print current date range and viewType
    console.log('[CalendarPage] Fetching events for', { viewType, currentDate });
    try {
      let start = new DayPilot.Date(currentDate);
      let endDate;

      // Determine the date range based on the view type
      switch (viewType) {
        case "Month": {
          // Start and end dates of the current month
          const monthStart = currentDate.firstDayOfMonth();
          const monthEnd = currentDate.lastDayOfMonth();

          // Convert from DayPilot to JS date obj & calc the grid's start and end dates
          const monthStartLuxon = TimeUtils.fromJSDate(monthStart.toDate());
          const monthEndLuxon = TimeUtils.fromJSDate(monthEnd.toDate());
          const gridStart = monthStartLuxon.startOf('week').toJSDate();
          const gridEnd = monthEndLuxon.endOf('week').toJSDate();

          // For consistent event counting across month boundaries, we need to fetch
          // events for a wider range that covers all possible dates that could appear
          // in any month view. This ensures that any date (like June 25th, 26th, 29th)
          // always has the same count whether viewed from June or July.
          // 
          // We extend by 2 weeks on each side to handle extreme edge cases:
          // - A month that starts on Sunday and ends on Saturday
          // - A month that starts on Monday and ends on Friday
          // - Any combination in between
          const extendedStart = TimeUtils.fromJSDate(gridStart).minus({ weeks: 2 }).toJSDate();
          const extendedEnd = TimeUtils.fromJSDate(gridEnd).plus({ weeks: 2 }).toJSDate();

          // Convert back to DayPilot date obj.
          start = new DayPilot.Date(extendedStart);
          endDate = new DayPilot.Date(extendedEnd);
          
          console.log('[CalendarPage] Month view - fetching events for extended grid:', {
            gridStart: gridStart.toISOString().split('T')[0],
            gridEnd: gridEnd.toISOString().split('T')[0],
            extendedStart: start.toString("yyyy-MM-dd"),
            extendedEnd: endDate.toString("yyyy-MM-dd"),
            monthStart: monthStart.toString("yyyy-MM-dd"),
            monthEnd: monthEnd.toString("yyyy-MM-dd")
          });
          break;
        }
        case "Day": {
          // Always interpret the selected date as midnight in Eastern Time
          const easternZone = 'America/New_York';
          const selectedDateStr = currentDate.toString("yyyy-MM-dd");
          const selectedLuxon = DateTime.fromISO(selectedDateStr, { zone: easternZone }).startOf('day');
          const nextDayLuxon = selectedLuxon.plus({ days: 1 });
          start = new DayPilot.Date(selectedLuxon.toJSDate());
          endDate = new DayPilot.Date(nextDayLuxon.toJSDate());
          break;
        }
        default:
          endDate = start.addDays(1);
      }

      console.log('[CalendarPage] Fetching events for', { start, endDate });

      // Use DeliveryService to fetch events by date range
      const deliveryService = DeliveryService.getInstance();
      const fetchedEvents = await deliveryService.getEventsByDateRange(
        start.toDate(),
        endDate.toDate()
      );
      console.log('[CalendarPage] Raw fetched events:', fetchedEvents);


      // Debug: Print all event clientIds and all client uids
      const eventClientIds = fetchedEvents.map(event => event.clientId);
      const clientUids = clients.map(client => client.uid);
      const eventClientIdSet = new Set(eventClientIds);
      const clientUidSet = new Set(clientUids);
      const intersection = eventClientIds.filter(id => clientUidSet.has(id));
      const missingInClients = eventClientIds.filter(id => !clientUidSet.has(id));
      const missingInEvents = clientUids.filter(uid => !eventClientIdSet.has(uid));
      console.log('[CalendarPage][DEBUG] All event clientIds:', eventClientIds);
      console.log('[CalendarPage][DEBUG] All client uids:', clientUids);
      console.log('[CalendarPage][DEBUG] Intersection (should display):', intersection);
      console.log('[CalendarPage][DEBUG] Event clientIds missing in clients:', missingInClients);
      console.log('[CalendarPage][DEBUG] Client uids missing in events:', missingInEvents);

        // Update client names in events if client exists, but do not filter out any events
        const updatedEvents = fetchedEvents.map(event => {
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

        // Use all events for display and counting
        setEvents(updatedEvents);
        console.log('[CalendarPage] Final events set (no deduplication):', updatedEvents);

        // Update calendar configuration with new events
        const formattedEvents = updatedEvents.map(event => ({
          id: event.id,
          // Removed date from display text
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

        return updatedEvents;
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
          return setToNoon(TimeUtils.fromISO(dateStr).toJSDate());
        }) || [];
        // Clear repeatsEndDate explicitly for custom recurrence in the submitted data
        newDelivery.repeatsEndDate = undefined;
      } else {
        // Calculate recurrence dates for standard recurrence types
        const deliveryDate = setToNoon(TimeUtils.fromISO(newDelivery.deliveryDate).toJSDate());
        recurrenceDates =
          newDelivery.recurrence === "None" ? [deliveryDate] : calculateRecurrenceDates(newDelivery).map(setToNoon);
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

  // Calculate if current month has 6+ rows
  const getMonthRowCount = () => {
    const startOfMonth = currentDate.firstDayOfMonth();
    const endOfMonth = currentDate.lastDayOfMonth();
    const startOfWeek = startOfMonth.firstDayOfWeek();
    const endOfWeek = endOfMonth.firstDayOfWeek().addDays(6); // Get last day of week containing end of month
    const totalDays = Math.ceil((endOfMonth.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.ceil(totalDays / 7);
  };

  const monthHasSixOrMoreRows = viewType === "Month" && getMonthRowCount() >= 6;

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
        height: "calc(100vh - 30px)",
        width: "100vw",
        overflow: "hidden",
        position: "fixed",
        top: "64px",
        left: 0,
        zIndex: 1000,
      }}
    >
      <AppBar position="static" color="default" elevation={1}></AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: "hidden",
          width: "100%",
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

        <StyledCalendarContainer 
          data-view={viewType}
          sx={{ 
            paddingBottom: viewType === "Month" ? 8 : 1,
            transform: monthHasSixOrMoreRows ? "scale(0.95)" : "scale(1)",
            transformOrigin: "top center"
          }}>
          <CalendarContent>
            {renderCalendarView()}
          </CalendarContent>
        </StyledCalendarContainer>

        <span ref={containerRef} style={{ zIndex: 1100, position: 'relative' }}>
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
