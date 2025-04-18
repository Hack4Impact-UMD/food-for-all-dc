import { DayPilot } from "@daypilot/daypilot-lite-react";
import { AppBar, Box, styled } from "@mui/material";
import { endOfWeek, startOfWeek } from "date-fns";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../auth/firebaseConfig";
import "./CalendarPage.css";
import AddDeliveryDialog from "./AddDeliveryDialog";
import CalendarHeader from "./CalendarHeader";
import CalendarPopper from "./CalendarPopper";
import { calculateRecurrenceDates } from "./CalendarUtils";
import DayView from "./DayView";
import MonthView from "./MonthView";
import { CalendarConfig, CalendarEvent, Client, DateLimit, DeliveryEvent, Driver, NewDelivery, ViewType } from "./types";
import { useLimits } from "./useLimits";
import { DeliveryService, ClientService, DriverService } from "../../services";

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
  const [currentDate, setCurrentDate] = useState<DayPilot.Date>(DayPilot.Date.today());
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
  const [clients, setClients] = useState<Client[]>([]);
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
      setDrivers(driverList as unknown as Driver[]);
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
      });
      
      // Cast the result to Client[] to satisfy type checking
      setClients(clientList as unknown as Client[]);
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
          const gridStart = startOfWeek(monthStart.toDate(), { weekStartsOn: 0 });
          const gridEnd = endOfWeek(monthEnd.toDate(), { weekStartsOn: 0 });

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

      setEvents(fetchedEvents);

      // Update calendar configuration with new events
      const calendarEvents: CalendarEvent[] = fetchedEvents.map((event) => ({
        id: event.id,
        text: `Client: ${event.clientName} (Driver: ${event.assignedDriverName})`,
        start: new DayPilot.Date(event.deliveryDate),
        end: new DayPilot.Date(event.deliveryDate),
        backColor: "#257E68",
      }));

      setCalendarConfig((prev) => ({
        ...prev,
        events: calendarEvents,
        durationBarVisible: false,
      }));

      return fetchedEvents;
    } catch (error) {
      console.error("Error fetching events:", error);
      return [];
    }
  };

  const handleAddDelivery = async (newDelivery: NewDelivery) => {
    try {
      const deliveryDate = new Date(newDelivery.deliveryDate);
      const eventsToAdd = [];

      // Calculate recurrence dates based on the recurrence type
      const recurrenceDates =
        newDelivery.recurrence === "None" ? [deliveryDate] : calculateRecurrenceDates(newDelivery);

      // Use DeliveryService to create events
      const deliveryService = DeliveryService.getInstance();
      const createPromises = recurrenceDates.map(date => {
        // Only include optional fields if they are defined
        const eventToAdd: Partial<DeliveryEvent> = {
          assignedDriverId: newDelivery.assignedDriverId,
          assignedDriverName: newDelivery.assignedDriverName,
          clientId: newDelivery.clientId,
          clientName: newDelivery.clientName,
          deliveryDate: date,
          recurrence: newDelivery.recurrence,
          time: "",
          cluster: 0,
        };

        if (newDelivery.repeatsEndDate) {
          eventToAdd.repeatsEndDate = newDelivery.repeatsEndDate;
        }

        return deliveryService.createEvent(eventToAdd);
      });

      await Promise.all(createPromises);

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

  const handleNavigateToday = () => {
    setCurrentDate(DayPilot.Date.today());
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

  // Initial data fetch
  useEffect(() => {
    fetchLimits();
  }, []);

  const renderCalendarView = () => {
    if (viewType === "Day") {
      return (
        <DayView events={events} clients={clients} onEventModified={fetchEvents} />
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
            setCurrentDate(args.start);
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
        <CalendarHeader 
          viewType={viewType}
          currentDate={currentDate}
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
          drivers={drivers}
        />
      </Box>
    </Box>
  );
};

export default CalendarPage;
