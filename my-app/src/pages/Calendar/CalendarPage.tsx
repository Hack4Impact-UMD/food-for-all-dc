import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Drawer from "@mui/material/Drawer";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { DayPilot } from "@daypilot/daypilot-lite-react";
import { AppBar, Box, styled, Typography } from "@mui/material";
import { Time, TimeUtils } from "../../utils/timeUtils";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc } from "firebase/firestore";
import { db } from "../../auth/firebaseConfig";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../../auth/firebaseConfig";
import AddDeliveryDialog from "./components/AddDeliveryDialog";
import CalendarHeader from "./components/CalendarHeader";
import CalendarPopper from "./components/CalendarPopper";
import { calculateRecurrenceDates } from "./components/CalendarUtils";
import DayView from "./components/DayView";
import MonthView from "./components/MonthView";
import {
  CalendarConfig,
  CalendarEvent,
  DateLimit,
  DeliveryEvent,
  Driver,
  NewDelivery,
  ViewType,
} from "../../types/calendar-types";
import { ClientProfile } from "../../types/client-types";
import { useLimits } from "./components/useLimits";
import DeliveryService from "../../services/delivery-service";
import { clientService } from "../../services/client-service";
import DriverService from "../../services/driver-service";
import { toJSDate, toDayPilotDateString } from "../../utils/timestamp";
import { DateTime } from "luxon";
import { RecurringDeliveryProvider } from "../../context/RecurringDeliveryContext";
import CalendarSkeleton from "../../components/skeletons/CalendarSkeleton";
import CalendarHeaderSkeleton from "../../components/skeletons/CalendarHeaderSkeleton";
import { deliveryDate } from "../../utils/deliveryDate";
import { useNotifications } from "../../components/NotificationProvider";

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
    "& .calendar_default_main, & [class*='calendar'], & .daypilot_month_main, & [class*='daypilot']":
      {
        borderBottom: "2px solid var(--color-border-medium) !important",
      },
    "& .daypilot_month": {
      borderBottom: "2px solid var(--color-border-medium) !important",
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
    borderBottom: "2px solid var(--color-border-medium)",
  },
}));

const CalendarPage: React.FC = React.memo(() => {
  const { showSuccess, showError } = useNotifications();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerWidth = 240;
  const renderCount = useRef(0);
  renderCount.current += 1;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Initialize currentDate from URL params or default to today
  const getInitialDate = () => {
    const dateParam = searchParams.get("date");
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
  const updateCurrentDate = useCallback(
    (newDate: DayPilot.Date) => {
      setCurrentDate(newDate);
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set("date", newDate.toString("yyyy-MM-dd"));
        return newParams;
      });
    },
    [setSearchParams]
  );
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
  const [clientsLoaded, setClientsLoaded] = useState<boolean>(false);
  // Preload all clients from client-profile2 when Add Delivery is triggered
  const preloadAllClients = useCallback(async () => {
    if (!clientsLoaded) {
      try {
        const { clients: allClients } = await clientService.getAllClients(3000);
        setClients(allClients);
        setClientsLoaded(true);
      } catch (error) {
        console.error("Error preloading clients:", error);
      }
    }
  }, [clientsLoaded]);
  const [dailyLimits, setDailyLimits] = useState<DateLimit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start as loading
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const limits = useLimits();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Memoized client lookup map for O(1) performance instead of O(n) array.find
  const clientLookupMap = useMemo(() => {
    const map = new Map<string, ClientProfile>();
    clients.forEach((client) => {
      if (client.uid) {
        map.set(client.uid, client);
      }
    });
    return map;
  }, [clients]);

  // Memoized events with client names to prevent repeated calculations
  const eventsWithClientNames = useMemo(() => {
    return events.map((event) => {
      const client = clientLookupMap.get(event.clientId);
      if (client) {
        const fullName = `${client.firstName} ${client.lastName}`.trim();
        return {
          ...event,
          clientName: fullName,
          phone: client.phone,
          address: client.address,
          deliveryDetails: client.deliveryDetails,
          tags: client.tags,
          notes: client.notes,
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
    try {
      const driverService = DriverService.getInstance();
      const driverList = await driverService.getAllDrivers();
      setDrivers(driverList);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  };

  const clientCacheRef = useRef(new Map<string, ClientProfile>());

  const fetchClientsLazy = useCallback(async (clientIds: string[]) => {
    const uncachedIds = clientIds.filter((id) => !clientCacheRef.current.has(id));
    if (uncachedIds.length > 0) {
      try {
        const clientsData = await clientService.getClientsByIds(uncachedIds);
        clientsData.forEach((client) => {
          if (client.uid) {
            clientCacheRef.current.set(client.uid, client);
          }
        });
      } catch (error) {
        console.error("Error fetching clients:", error);
        return [];
      }
    }
    const requestedClients = clientIds.map((id) => clientCacheRef.current.get(id)).filter(Boolean);
    setClients((prev) => {
      const isClient = (c: unknown): c is ClientProfile =>
        !!c && typeof c === "object" && "uid" in c;
      const prevMap = new Map(prev.filter(isClient).map((c) => [c.uid, c]));
      requestedClients.filter(isClient).forEach((c) => prevMap.set(c.uid, c));
      return Array.from(prevMap.values());
    });
    return requestedClients;
  }, []);

  const fetchLimits = async () => {
    try {
      const deliveryService = DeliveryService.getInstance();
      const limitsData = await deliveryService.getDailyLimits();
      setDailyLimits(limitsData);
    } catch (error) {
      console.error("Error fetching daily limits:", error);
    }
  };

  const fetchEvents = useCallback(async () => {
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
          const gridStart = monthStartLuxon.startOf("week").toJSDate();
          const gridEnd = monthEndLuxon.endOf("week").toJSDate();

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
          const easternZone = "America/New_York";
          const selectedDateStr = currentDate.toString("yyyy-MM-dd");
          const selectedLuxon = DateTime.fromISO(selectedDateStr, { zone: easternZone }).startOf(
            "day"
          );
          const nextDayLuxon = selectedLuxon.plus({ days: 1 });
          start = new DayPilot.Date(selectedLuxon.toJSDate());
          endDate = new DayPilot.Date(nextDayLuxon.toJSDate());
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

      // Get unique client IDs from events
      const uniqueClientIds = [...new Set(fetchedEvents.map((event) => event.clientId))];

      // Lazy load only the clients we need for these events
      const neededClients = await fetchClientsLazy(uniqueClientIds);

      // Create efficient lookup map from the clients we just fetched
      const eventClientLookupMap = new Map();
      neededClients.forEach((client) => {
        if (client && client.uid) {
          eventClientLookupMap.set(client.uid, client);
        }
      });

      // Update client names in events using efficient Map lookup
      const updatedEvents = fetchedEvents.map((event) => {
        const client = eventClientLookupMap.get(event.clientId);
        if (client) {
          const fullName = `${client.firstName} ${client.lastName}`.trim();
          return {
            ...event,
            clientName: fullName,
          };
        }
        return event;
      });

      // Use all events for display and counting
      setEvents(updatedEvents);

      // Update calendar configuration with new events
      const formattedEvents = updatedEvents.map((event) => ({
        id: event.id,
        // Removed date from display text
        text: `Client: ${event.clientName} (Driver: ${event.assignedDriverName})`,
        start: new DayPilot.Date(toJSDate(event.deliveryDate)),
        end: new DayPilot.Date(toJSDate(event.deliveryDate)),
        backColor: "var(--color-primary)",
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
  }, [currentDate, viewType, fetchClientsLazy]); // Removed clientLookupMap and clients.length as they're no longer needed

  const handleAddDelivery = async (newDelivery: NewDelivery) => {
    try {
      let recurrenceDates: string[] = [];
      const recurrenceId = crypto.randomUUID();
      // Find the selected client profile
      const selectedClient = clients.find((c) => c.uid === newDelivery.clientId);
      const clientName = selectedClient
        ? `${selectedClient.firstName} ${selectedClient.lastName}`.trim()
        : newDelivery.clientName || "";

      if (newDelivery.recurrence === "Custom") {
        recurrenceDates = (newDelivery.customDates || [])
          .map((date) => {
            if (typeof date === "object" && date !== null && "getTime" in date) {
              // It's a Date object
              const iso = DateTime.fromJSDate(date as Date).toISODate();
              return iso ? iso : "";
            }
            return "";
          })
          .filter((d): d is string => !!d);
        newDelivery.repeatsEndDate = undefined;
      } else {
        const normalizedDate = TimeUtils.fromAny(newDelivery.deliveryDate).toISODate() || "";
        if (newDelivery.recurrence === "None") {
          recurrenceDates = [normalizedDate];
        } else {
          recurrenceDates = calculateRecurrenceDates(newDelivery);
        }
      }

      // Filter out dates that already have a delivery for the same client
      const existingEventDates = new Set(
        events
          .filter((event) => event.clientId === newDelivery.clientId)
          .map((event) => {
            const jsDate = toJSDate(event.deliveryDate);
            return new DayPilot.Date(jsDate).toString("yyyy-MM-dd");
          })
      );

      const uniqueRecurrenceDates = recurrenceDates.filter((date) => !existingEventDates.has(date));

      const deliveryService = DeliveryService.getInstance();
      const seriesStartDate = newDelivery.deliveryDate;

      const createPromises = uniqueRecurrenceDates.map((dateStr) => {
        const normalizedDeliveryDate = deliveryDate.toJSDate(dateStr);
        const eventToAdd: Partial<DeliveryEvent> = {
          clientId: newDelivery.clientId,
          clientName,
          deliveryDate: normalizedDeliveryDate,
          recurrence: newDelivery.recurrence,
          seriesStartDate,
          time: "",
          cluster: 0,
          recurrenceId,
        };
        if (newDelivery.recurrence === "Custom") {
          eventToAdd.customDates = newDelivery.customDates;
        } else if (newDelivery.repeatsEndDate) {
          eventToAdd.repeatsEndDate = newDelivery.repeatsEndDate;
        }
        return deliveryService.createEvent(eventToAdd);
      });
      await Promise.all(createPromises);

      await fetchEvents();
      setIsModalOpen(false);

      const deliveryCount = uniqueRecurrenceDates.length;
      const deliveryText =
        deliveryCount === 1
          ? `Delivery added for ${clientName}`
          : `${deliveryCount} deliveries added for ${clientName}`;
      showSuccess(deliveryText);
    } catch (error) {
      console.error("Error adding delivery:", error);
      showError("Failed to add delivery. Please try again.");
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
    setEvents([]);
  }, [viewType]);

  // Update calendar when view type or date changes
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents, currentDate, viewType]); // Clients are now fetched lazily within fetchEvents

  // Handle URL parameter changes (e.g., browser back/forward, direct URL access)
  useEffect(() => {
    const dateParam = searchParams.get("date");
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
  }, [searchParams, currentDate]); // Fixed: use stable dependencies

  // Initial data fetch - combined for better performance
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        // Fetch all data in parallel for better performance
        await Promise.all([
          fetchLimits(),
          fetchDrivers(),
          // Removed fetchClients() - we now fetch clients lazily when events are loaded
        ]);
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
    const totalDays =
      Math.ceil((endOfMonth.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.ceil(totalDays / 7);
  };

  const monthHasSixOrMoreRows = viewType === "Month" && getMonthRowCount() >= 6;

  const renderCalendarView = () => {
    if (isLoading) {
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
          limits={DAYS.reduce(
            (acc, day, index) => {
              acc[day.charAt(0).toUpperCase() + day.slice(1)] = limits[index];
              return acc;
            },
            {} as Record<string, number>
          )}
          onTimeRangeSelected={(args: any) => {
            // DayPilotMonth passes a DayPilot.Date as args.start
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
      <Box sx={{ display: "flex", height: "100vh", width: "100vw" }}>
        {drawerOpen && (
          <Drawer
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              "& .MuiDrawer-paper": {
                width: drawerWidth,
                boxSizing: "border-box",
              },
            }}
            variant="persistent"
            anchor="left"
            open={drawerOpen}
          >
            <Toolbar>
              <IconButton onClick={() => setDrawerOpen(false)}>
                <MenuRoundedIcon />
              </IconButton>
              {/* Add drawer content here if needed */}
              <Box
                sx={{
                  width: "100%",
                  mt: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <a
                  href="https://docs.google.com/document/d/1TxjMO2LFxPGz0FR0v0cUirRjtcTkcrH1T-RbGGwCDxw/edit?usp=drivesdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none", width: "100%" }}
                >
                  <Box
                    sx={{
                      width: "90%",
                      bgcolor: "var(--color-primary)",
                      color: "var(--color-white)",
                      borderRadius: 2,
                      p: 1.5,
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: "1rem",
                      boxShadow: 1,
                      cursor: "pointer",
                      mt: 1,
                      "&:hover": { bgcolor: "#1a5c4a" },
                    }}
                  >
                    Documentation
                  </Box>
                </a>
              </Box>
            </Toolbar>
          </Drawer>
        )}
        <Box
          sx={{
            flexGrow: 1,
            transition: "margin 0.3s",
            marginLeft: drawerOpen ? `${drawerWidth}px` : 0,
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            overflow: "hidden",
            alignItems: "center",
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
              width: "95vw",
              maxWidth: "95vw",
              marginLeft: drawerOpen ? `${drawerWidth}px` : "2.5vw",
              marginRight: drawerOpen ? "0" : "2.5vw",
              boxSizing: "border-box",
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
                onAddDelivery={() => {
                  setIsModalOpen(true);
                  preloadAllClients();
                }}
                onEditLimits={
                  viewType === "Month"
                    ? (event) => setAnchorEl(anchorEl ? null : event.currentTarget)
                    : undefined
                }
              />
            )}
            <StyledCalendarContainer
              data-view={viewType}
              sx={{
                paddingBottom: viewType === "Month" ? 8 : 1,
                transform: monthHasSixOrMoreRows ? "scale(0.95)" : "scale(1)",
                transformOrigin: "top center",
              }}
            >
              <CalendarContent>{renderCalendarView()}</CalendarContent>
            </StyledCalendarContainer>
            {!isLoading && (
              <>
                <span ref={containerRef} style={{ zIndex: 1100, position: "relative" }}>
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
                  clientsLoaded={clientsLoaded}
                  startDate={currentDate}
                />
              </>
            )}
          </Box>
        </Box>
      </Box>
    </RecurringDeliveryProvider>
  );
});

// Add display name for debugging
CalendarPage.displayName = "CalendarPage";

export default CalendarPage;
