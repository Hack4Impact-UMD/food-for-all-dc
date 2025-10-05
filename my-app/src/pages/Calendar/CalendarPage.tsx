
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { DayPilot } from "@daypilot/daypilot-lite-react";
import { AppBar, Box, styled, Typography } from "@mui/material";
import { Time, TimeUtils } from "../../utils/timeUtils";
import { onAuthStateChanged } from "firebase/auth";

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
import { clientService } from "../../services/client-service";
import DriverService from "../../services/driver-service";
import { toJSDate, toDayPilotDateString } from '../../utils/timestamp';
import { DateTime } from 'luxon';
import { RecurringDeliveryProvider } from "../../context/RecurringDeliveryContext";
import CalendarSkeleton from '../../components/skeletons/CalendarSkeleton';
import CalendarHeaderSkeleton from '../../components/skeletons/CalendarHeaderSkeleton';

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

const CalendarPage: React.FC = React.memo(() => {
  // Use a ref to track render count without causing re-renders
  const renderCount = useRef(0);
  renderCount.current += 1;
  
  console.log(`🏗️ [CALENDAR] Component render #${renderCount.current} started at:`, new Date().toISOString());
  
  // Detect if we're in React.StrictMode (development only)
  if (renderCount.current === 1) {
    console.log('🔧 [CALENDAR] First render - checking for React.StrictMode double renders...');
  }
  
  // ...state declarations...
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
  const updateCurrentDate = useCallback((newDate: DayPilot.Date) => {
    console.log('📅 [CALENDAR] Updating current date to:', newDate.toString());
    setCurrentDate(newDate);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('date', newDate.toString("yyyy-MM-dd"));
      return newParams;
    });
  }, [setSearchParams]);
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
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start as loading
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const limits = useLimits();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Track what causes re-renders - useRef to store previous values
  const prevValues = useRef({
    currentDate: currentDate.toString(),
    viewType,
    clientsLength: clients.length,
    eventsLength: events.length,
    isLoading,
    searchParams: searchParams.toString()
  });

  // Debug re-render causes
  useEffect(() => {
    const prev = prevValues.current;
    const current = {
      currentDate: currentDate.toString(),
      viewType,
      clientsLength: clients.length,
      eventsLength: events.length,
      isLoading,
      searchParams: searchParams.toString()
    };

    const changes = [];
    if (prev.currentDate !== current.currentDate) changes.push(`currentDate: ${prev.currentDate} → ${current.currentDate}`);
    if (prev.viewType !== current.viewType) changes.push(`viewType: ${prev.viewType} → ${current.viewType}`);
    if (prev.clientsLength !== current.clientsLength) changes.push(`clients: ${prev.clientsLength} → ${current.clientsLength}`);
    if (prev.eventsLength !== current.eventsLength) changes.push(`events: ${prev.eventsLength} → ${current.eventsLength}`);
    if (prev.isLoading !== current.isLoading) changes.push(`isLoading: ${prev.isLoading} → ${current.isLoading}`);
    if (prev.searchParams !== current.searchParams) changes.push(`searchParams: ${prev.searchParams} → ${current.searchParams}`);

    if (changes.length > 0) {
      console.log(`🔄 [CALENDAR] Render #${renderCount.current} caused by:`, changes);
    } else if (renderCount.current > 1) {
      console.log(`🔄 [CALENDAR] Render #${renderCount.current} - no prop changes detected (possible parent re-render or strict mode)`);
    }

    prevValues.current = current;
  });

  // Memoized client lookup map for O(1) performance instead of O(n) array.find
  const clientLookupMap = useMemo(() => {
    const map = new Map<string, ClientProfile>();
    clients.forEach(client => {
      if (client.uid) {
        map.set(client.uid, client);
      }
    });
    return map;
  }, [clients]);

  // Memoized events with client names to prevent repeated calculations
  const eventsWithClientNames = useMemo(() => {
    return events.map(event => {
      const client = clientLookupMap.get(event.clientId);
      if (client && !event.clientName) {
        const fullName = `${client.firstName} ${client.lastName}`.trim();
        return {
          ...event,
          clientName: fullName
        };
      }
      return event;
    });
  }, [events, clientLookupMap]);


  // Route Protection
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      if (!user) {
        navigate("/");
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
    const startTime = performance.now();
    console.log('🚗 [DRIVERS] Starting fetch at:', new Date().toISOString());
    try {
      // Use DriverService instead of direct Firebase calls
      const driverService = DriverService.getInstance();
      const driverList = await driverService.getAllDrivers();
      const endTime = performance.now();
      console.log('🚗 [DRIVERS] Fetch completed in:', Math.round(endTime - startTime), 'ms');
      console.log('🚗 [DRIVERS] Data:', JSON.stringify(driverList, null, 2));
      // Cast to appropriate type to avoid type mismatch
      setDrivers(driverList);
    } catch (error) {
      console.error("❌ [DRIVERS] Error fetching drivers:", error);
    }
  };

  // Cache for client data to avoid repeated fetches
  const clientCache = useMemo(() => new Map<string, ClientProfile>(), []);

  const fetchClientsLazy = useCallback(async (clientIds: string[]) => {
    const startTime = performance.now();
    console.log('👥 [CLIENTS] Starting lazy fetch for', clientIds.length, 'clients at:', new Date().toISOString());
    
    // Filter out clients we already have cached
    const uncachedIds = clientIds.filter(id => !clientCache.has(id));
    console.log('👥 [CLIENTS] Cache hit rate:', ((clientIds.length - uncachedIds.length) / clientIds.length * 100).toFixed(1) + '%');
    
    if (uncachedIds.length === 0) {
      console.log('👥 [CLIENTS] All clients found in cache');
      return Array.from(clientCache.values()).filter(client => clientIds.includes(client.uid || ''));
    }

    try {
      console.log('👥 [CLIENTS] Fetching', uncachedIds.length, 'uncached clients');
      // Fetch only the specific clients we need
      const clientsData = await clientService.getClientsByIds(uncachedIds);
      const endTime = performance.now();
      
      console.log('👥 [CLIENTS] Lazy fetch completed in:', Math.round(endTime - startTime), 'ms');
      console.log('👥 [CLIENTS] Fetched count:', clientsData.length);
      
      // Add to cache
      clientsData.forEach(client => {
        if (client.uid) {
          clientCache.set(client.uid, client);
        }
      });
      
      // Return all requested clients (cached + newly fetched)
      const allRequestedClients = clientIds.map(id => clientCache.get(id)).filter(Boolean) as ClientProfile[];
      setClients(allRequestedClients);
      return allRequestedClients;
    } catch (error) {
      console.error("❌ [CLIENTS] Error fetching clients:", error);
      return [];
    }
  }, [clientCache]);

  const fetchClients = async () => {
    const startTime = performance.now();
    console.log('👥 [CLIENTS] Starting full fetch at:', new Date().toISOString());
    try {
      const clientsData = await clientService.getAllClients();
      const endTime = performance.now();
      console.log('👥 [CLIENTS] Full fetch completed in:', Math.round(endTime - startTime), 'ms');
      console.log('👥 [CLIENTS] Count:', clientsData.clients.length);
      
      // Update cache with all clients
      clientsData.clients.forEach(client => {
        if (client.uid) {
          clientCache.set(client.uid, client);
        }
      });
      
      setClients(clientsData.clients as ClientProfile[]);
    } catch (error) {
      console.error("❌ [CLIENTS] Error fetching clients:", error);
    }
  };

  const fetchLimits = async () => {
    const startTime = performance.now();
    console.log('📊 [LIMITS] Starting fetch at:', new Date().toISOString());
    try {
      // Use DeliveryService instead of direct Firebase calls
      const deliveryService = DeliveryService.getInstance();
      const limitsData = await deliveryService.getDailyLimits();
      const endTime = performance.now();
      console.log('📊 [LIMITS] Fetch completed in:', Math.round(endTime - startTime), 'ms');
      console.log('📊 [LIMITS] Data:', JSON.stringify(limitsData, null, 2));
      setDailyLimits(limitsData);
    } catch (error) {
      console.error("❌ [LIMITS] Error fetching limits:", error);
    }
  };

  const fetchEvents = useCallback(async () => {
    const startTime = performance.now();
    console.log('📅 [EVENTS] Starting fetch at:', new Date().toISOString());
    console.log('📅 [EVENTS] Current date:', currentDate.toString());
    console.log('📅 [EVENTS] View type:', viewType);

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

      console.log('📅 [EVENTS] Date range calculated:', {
        start: start.toString(),
        end: endDate.toString(),
        viewType
      });

      // Use DeliveryService to fetch events by date range
      const deliveryService = DeliveryService.getInstance();
      const queryStartTime = performance.now();
      const fetchedEvents = await deliveryService.getEventsByDateRange(
        start.toDate(),
        endDate.toDate()
      );
      const queryEndTime = performance.now();
      console.log('📅 [EVENTS] Database query completed in:', Math.round(queryEndTime - queryStartTime), 'ms');
      console.log('📅 [EVENTS] Raw events count:', fetchedEvents.length);
      console.log('📅 [EVENTS] Raw events sample (first 3):', JSON.stringify(fetchedEvents.slice(0, 3), null, 2));



        const processingStartTime = performance.now();
        
        // Get unique client IDs from events
        const uniqueClientIds = [...new Set(fetchedEvents.map(event => event.clientId))];
        console.log('📅 [EVENTS] Unique client IDs needed:', uniqueClientIds.length);
        
        // Lazy load only the clients we need for these events
        const neededClients = await fetchClientsLazy(uniqueClientIds);
        
        // Create efficient lookup map from the clients we just fetched
        const eventClientLookupMap = new Map();
        neededClients.forEach(client => {
          if (client.uid) {
            eventClientLookupMap.set(client.uid, client);
          }
        });
        
        // Update client names in events using efficient Map lookup
        const updatedEvents = fetchedEvents.map(event => {
          const client = eventClientLookupMap.get(event.clientId);
          if (client) {
            const fullName = `${client.firstName} ${client.lastName}`.trim();
            return {
              ...event,
              clientName: fullName
            };
          }
          return event;
        });
        const processingEndTime = performance.now();
        console.log('📅 [EVENTS] Client name processing completed in:', Math.round(processingEndTime - processingStartTime), 'ms');
        console.log('📅 [EVENTS] Final events count:', updatedEvents.length);
        console.log('📅 [EVENTS] Final events sample (first 3):', JSON.stringify(updatedEvents.slice(0, 3), null, 2));

        // Use all events for display and counting
        setEvents(updatedEvents);

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

        const totalEndTime = performance.now();
        console.log('📅 [EVENTS] ✅ TOTAL FETCH COMPLETED in:', Math.round(totalEndTime - startTime), 'ms');
        console.log('📅 [EVENTS] ================================');
        return updatedEvents;
    } catch (error) {
      console.error("❌ [EVENTS] Error fetching events:", error);
      return [];
    }
  }, [currentDate, viewType, fetchClientsLazy]);  // Removed clientLookupMap and clients.length as they're no longer needed

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

  const handleNavigatePrev = useCallback(() => {
    const newDate = viewType === "Month" ? currentDate.addMonths(-1) : currentDate.addDays(-1);
    updateCurrentDate(newDate);
  }, [viewType, currentDate, updateCurrentDate]);

  const handleNavigateNext = useCallback(() => {
    const newDate = viewType === "Month" ? currentDate.addMonths(1) : currentDate.addDays(1);
    updateCurrentDate(newDate);
  }, [viewType, currentDate, updateCurrentDate]);

  const handleNavigateToday = useCallback(() => {
    updateCurrentDate(DayPilot.Date.today());
  }, [updateCurrentDate]);

  // Clear events immediately when view type changes to prevent flickering
  useEffect(() => {
    console.log('🔄 [CALENDAR] View type changed to:', viewType, '- clearing events');
    setEvents([]);
  }, [viewType]);

  // Track when events are updated
  useEffect(() => {
    console.log('📅 [CALENDAR] Events state updated - count:', events.length);
    if (events.length > 0) {
      console.log('📅 [CALENDAR] Events ready for display at:', new Date().toISOString());
      console.log('📅 [CALENDAR] Sample events:', JSON.stringify(events.slice(0, 2), null, 2));
    }
  }, [events]);

  // Update calendar when view type or date changes
  useEffect(() => {
    console.log('🔄 [CALENDAR] Triggering fetchEvents');
    console.log('🔄 [CALENDAR] Current date:', currentDate.toString(), 'viewType:', viewType);
    fetchEvents();
  }, [fetchEvents, currentDate, viewType]);  // Clients are now fetched lazily within fetchEvents

  // Handle URL parameter changes (e.g., browser back/forward, direct URL access)
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      try {
        const urlDate = new DayPilot.Date(dateParam);
        // Only update if different from current date to avoid infinite loops
        if (urlDate.toString("yyyy-MM-dd") !== currentDate.toString("yyyy-MM-dd")) {
          console.log('🔄 [CALENDAR] URL date param changed, updating current date to:', dateParam);
          setCurrentDate(urlDate);
        }
      } catch {
        // If date param is invalid, don't update
        console.log('⚠️ [CALENDAR] Invalid date param in URL:', dateParam);
      }
    }
  }, [searchParams, currentDate]);  // Fixed: use stable dependencies

  // Initial data fetch - combined for better performance
  useEffect(() => {
    const fetchAllData = async () => {
      const overallStartTime = performance.now();
      console.log('🚀 [CALENDAR] =================================');
      console.log('🚀 [CALENDAR] Starting initial data fetch at:', new Date().toISOString());
      try {
        setIsLoading(true);
        const parallelStartTime = performance.now();
        // Fetch all data in parallel for better performance
        await Promise.all([
          fetchLimits(),
          fetchDrivers()
          // Removed fetchClients() - we now fetch clients lazily when events are loaded
        ]);
        const parallelEndTime = performance.now();
        console.log('🚀 [CALENDAR] All parallel fetches completed in:', Math.round(parallelEndTime - parallelStartTime), 'ms');
        const overallEndTime = performance.now();
        console.log('🚀 [CALENDAR] ✅ INITIAL DATA LOAD COMPLETED in:', Math.round(overallEndTime - overallStartTime), 'ms');
        console.log('🚀 [CALENDAR] =================================');
      } catch (error) {
        console.error("❌ [CALENDAR] Error fetching initial data:", error);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };
    
    fetchAllData();
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
    console.log('🎨 [CALENDAR] renderCalendarView called - isLoading:', isLoading, 'events count:', events.length);
    
    if (isLoading) {
      console.log('⌛ [CALENDAR] Showing skeleton loading state');
      return <CalendarSkeleton viewType={viewType} />;
    }

    if (viewType === "Day") {
      // Calculate the daily limit for the current day
      const currentDayOfWeek = currentDate.dayOfWeek(); // 0 = Sunday, 1 = Monday, etc.
      const dailyLimit = limits[currentDayOfWeek];
      
      return (
        <DayView 
          events={eventsWithClientNames} 
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
    <RecurringDeliveryProvider>
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
      {isLoading ? (
        <CalendarHeaderSkeleton />
      ) : (
        <AppBar position="static" color="default" elevation={1}></AppBar>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: "hidden",
          width: "100%",
        }}
      >
        {!isLoading && (
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
        )}

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

        {!isLoading && (
          <>
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
          </>
        )}
      </Box>
    </Box>
    </RecurringDeliveryProvider>
  );
});

// Add display name for debugging
CalendarPage.displayName = 'CalendarPage';

export default CalendarPage;
