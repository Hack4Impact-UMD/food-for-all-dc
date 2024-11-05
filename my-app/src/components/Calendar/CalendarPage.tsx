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
  Avatar,
  Box,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  FilterList,
  Settings,
  Add,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { collection, getDocs, addDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../auth/firebaseConfig';
import { DayPilot, DayPilotCalendar, DayPilotMonth, DayPilotNavigator } from "@daypilot/daypilot-lite-react";

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  justifyContent: 'space-between',
  padding: theme.spacing(0, 2),
}));

const StyledCalendarContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  padding: theme.spacing(2),
  height: 'calc(100vh - 64px)',
  '& .calendar_default_main': {
    fontFamily: theme.typography.fontFamily,
  },
}));

const NavigatorContainer = styled(Box)(({ theme }) => ({
  width: '200px',
  marginRight: theme.spacing(2),
}));

const CalendarContent = styled(Box)({
  flexGrow: 1,
  position: 'relative',
});

interface DeliveryEvent {
  id: string;
  assignedDriver: string;
  clientName: string;
  startTime: Date;
  endTime: Date;
  notes: string;
}

interface NewDelivery {
  assignedDriver: string;
  clientName: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  notes: string;
}

type ViewType = 'Day' | 'Week' | 'Month';
type DayPilotViewType = "Day" | "Week" | "Days" | "WorkWeek" | "Resources";


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
  const [currentDate, setCurrentDate] = useState<DayPilot.Date>(DayPilot.Date.today());
  const [viewType, setViewType] = useState<ViewType>('Week');
  const [viewAnchorEl, setViewAnchorEl] = useState<null | HTMLElement>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig>({
    viewType: 'Week',
    startDate: DayPilot.Date.today(),
    events: []
  });

  const getInitialFormDates = () => {
    const today = new Date();
    return {
      date: today.toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:00'
    };
  };

  const [newDelivery, setNewDelivery] = useState<NewDelivery>(() => {
    const { date, startTime, endTime } = getInitialFormDates();
    return {
      assignedDriver: '',
      clientName: '',
      startDate: date,
      startTime,
      endDate: date,
      endTime,
      notes: ''
    };
  });

  const fetchEvents = async () => {
    try {
      let start = new DayPilot.Date(currentDate);
      let endDate;

      switch (viewType) {
        case 'Month':
          start = currentDate.firstDayOfMonth();
          endDate = start.lastDayOfMonth();
          break;
        case 'Week':
          start = currentDate.firstDayOfWeek('en-us');
          endDate = start.addDays(6);
          break;
        case 'Day':
          endDate = start.addDays(1);
          break;
        default:
          endDate = start.addDays(7);
      }

      const eventsRef = collection(db, 'events');
      const q = query(
        eventsRef,
        where('startTime', '>=', Timestamp.fromDate(start.toDate())),
        where('startTime', '<=', Timestamp.fromDate(endDate.toDate()))
      );

      const querySnapshot = await getDocs(q);
      const fetchedEvents: DeliveryEvent[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime.toDate(),
        endTime: doc.data().endTime.toDate()
      })) as DeliveryEvent[];

      setEvents(fetchedEvents);
      
      // Update calendar configuration with new events
      const calendarEvents: CalendarEvent[] = fetchedEvents.map(event => ({
        id: event.id,
        text: "Client " + `${event.clientName} (Driver: ${event.assignedDriver})`,
        start: new DayPilot.Date(event.startTime, true),
        end: new DayPilot.Date(event.endTime, true),
        backColor: "#1976d2"
      }));

      setCalendarConfig(prev => ({
        ...prev,
        events: calendarEvents
      }));
      console.log(calendarEvents);
      return fetchedEvents;
    } catch (error) {
      console.error("Error fetching events:", error);
      return [];
    }
  };


  const handleAddDelivery = async () => {
    try {
      const startDateTime = new Date(`${newDelivery.startDate}T${newDelivery.startTime}`);
      const endDateTime = new Date(`${newDelivery.endDate}T${newDelivery.endTime}`);

      const eventData = {
        assignedDriver: newDelivery.assignedDriver,
        clientName: newDelivery.clientName,
        startTime: Timestamp.fromDate(startDateTime),
        endTime: Timestamp.fromDate(endDateTime),
        notes: newDelivery.notes
      };

      await addDoc(collection(db, 'events'), eventData);
      
      const { date, startTime, endTime } = getInitialFormDates();
      setNewDelivery({
        assignedDriver: '',
        clientName: '',
        startDate: date,
        startTime,
        endDate: date,
        endTime,
        notes: ''
      });
      setIsModalOpen(false);
      
      // Refresh events after adding
      fetchEvents();
    } catch (error) {
      console.error("Error adding delivery:", error);
    }
  };

  const handleNavigatePrev = () => {
    const newDate = viewType === 'Month' ? currentDate.addMonths(-1) :
                   viewType === 'Week' ? currentDate.addDays(-7) :
                   currentDate.addDays(-1);
    setCurrentDate(newDate);
  };

  const handleNavigateNext = () => {
    const newDate = viewType === 'Month' ? currentDate.addMonths(1) :
                   viewType === 'Week' ? currentDate.addDays(7) :
                   currentDate.addDays(1);
    setCurrentDate(newDate);
  };

  const getHeaderDateText = (): string => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      month: 'long',
      year: 'numeric',
      day: viewType === 'Day' ? 'numeric' : undefined
    };
    console.log(currentDate.toDateLocal().toLocaleDateString(undefined, options));
    return currentDate.toDateLocal().toLocaleDateString(undefined, options);
  };

  // Update calendar when view type or date changes
  useEffect(() => {
    setCalendarConfig(prev => ({
      ...prev,
      viewType: viewType === 'Month' ? 'Month' : viewType,
      startDate: currentDate
    }));
    fetchEvents();
  }, [viewType, currentDate]);

  const renderCalendarView = () => {
    if (viewType === 'Month') {
      return (
        <DayPilotMonth
          {...calendarConfig}
        />
      );
    }
    
    // For Day and Week views, ensure viewType is compatible with DayPilotCalendar
    const calendarProps = {
      ...calendarConfig,
      viewType: viewType as DayPilotViewType
    };
    
    return (
      <DayPilotCalendar
        {...calendarProps}
      />
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="default" elevation={1}>
        <StyledToolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton edge="start" color="inherit">
              <MenuIcon />
            </IconButton>
            
            <Button
              sx={{ width: 150 }}
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
              {(['Day', 'Week', 'Month'] as ViewType[]).map((type) => (
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

            <Box sx={{ display: 'flex', alignItems: 'center', width: 300 }}>
              <IconButton onClick={handleNavigatePrev} size="small">
                <ChevronLeft />
              </IconButton>
              <Typography variant="h6">{getHeaderDateText()}</Typography>
              <IconButton onClick={handleNavigateNext} size="small">
                <ChevronRight />
              </IconButton>
            </Box>
          </Box>

          <Typography variant="h6">Deliveries</Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button variant="outlined" endIcon={<ChevronRight />}>
              Calendar
            </Button>
            <IconButton>
              <Search />
            </IconButton>
            <IconButton>
              <FilterList />
            </IconButton>
            <IconButton>
              <Settings />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography>Admin</Typography>
              <Avatar sx={{ width: 32, height: 32 }} />
            </Box>
          </Box>
        </StyledToolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <StyledCalendarContainer>
          <NavigatorContainer>
            <DayPilotNavigator
              selectMode={viewType}
              showMonths={2}
              skipMonths={1}
              onTimeRangeSelected={args => setCurrentDate(args.day)}
            />
          </NavigatorContainer>
          
          <CalendarContent>
            {renderCalendarView()}
          </CalendarContent>
        </StyledCalendarContainer>

        <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <DialogTitle>Add Delivery</DialogTitle>
          <DialogContent>
            <TextField
              label="Client Name"
              value={newDelivery.clientName}
              onChange={(e) => setNewDelivery({ ...newDelivery, clientName: e.target.value })}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Assigned Driver"
              value={newDelivery.assignedDriver}
              onChange={(e) => setNewDelivery({ ...newDelivery, assignedDriver: e.target.value })}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Start Date"
              type="date"
              value={newDelivery.startDate}
              onChange={(e) => setNewDelivery({ ...newDelivery, startDate: e.target.value })}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Start Time"
              type="time"
              value={newDelivery.startTime}
              onChange={(e) => setNewDelivery({ ...newDelivery, startTime: e.target.value })}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              value={newDelivery.endDate}
              onChange={(e) => setNewDelivery({ ...newDelivery, endDate: e.target.value })}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Time"
              type="time"
              value={newDelivery.endTime}
              onChange={(e) => setNewDelivery({ ...newDelivery, endTime: e.target.value })}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Notes"
              value={newDelivery.notes}
              onChange={(e) => setNewDelivery({ ...newDelivery, notes: e.target.value })}
              fullWidth
              margin="normal"
              multiline
              rows={4}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDelivery} variant="contained">Add</Button>
          </DialogActions>
        </Dialog>

        <Box sx={{ position: 'fixed', bottom: 24, right: 24 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setIsModalOpen(true)}
          >
            Add Delivery
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default CalendarPage;