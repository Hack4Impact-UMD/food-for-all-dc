import React, { useState, useEffect } from "react";
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
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { ChevronRight, Add, EditCalendar } from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import {
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
import { useNavigate } from "react-router-dom";
import "./CalendarPage.css";
import { auth } from "../../auth/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import CalendarPopper from "./CalendarPopper";
import { set } from "date-fns";

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
  deliveryDetails: DeliveryDetails;
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
  startTime: Date;
  endTime: Date;
  notes: string;
  priority: string;
}

interface NewDelivery {
  assignedDriverId: string;
  assignedDriverName: string;
  priority: string;
  clientId: string;
  clientName: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  notes: string;
}

type ViewType = "Day" | "Week" | "Month";
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
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState<DayPilot.Date>(
    DayPilot.Date.today()
  );

  const [viewType, setViewType] = useState<ViewType>("Day");
  const [viewAnchorEl, setViewAnchorEl] = useState<null | HTMLElement>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig>({
    viewType: "Week",
    startDate: DayPilot.Date.today(),
    events: [],
  });
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

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
  const [dailyLimits, setDailyLimits] = useState<DateLimit[]>([]);

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
    const clientList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Client[];
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
    const { date, startTime, endTime } = getInitialFormDates();
    return {
      assignedDriverId: "",
      priority: "",
      assignedDriverName: "",
      clientId: "",
      clientName: "",
      startDate: date,
      startTime,
      endDate: date,
      endTime,
      notes: "",
    };
  });

  const fetchEvents = async () => {
    try {
      let start = new DayPilot.Date(currentDate);
      let endDate;

      switch (viewType) {
        case "Month":
          start = currentDate.firstDayOfMonth();
          endDate = start.lastDayOfMonth();
          break;
        case "Week":
          start = currentDate.firstDayOfWeek("en-us");
          endDate = start.addDays(6);
          break;
        case "Day":
          endDate = start.addDays(1);
          break;
        default:
          endDate = start.addDays(7);
      }

      const eventsRef = collection(db, "events");
      const q = query(
        eventsRef,
        where("startTime", ">=", Timestamp.fromDate(start.toDate())),
        where("startTime", "<=", Timestamp.fromDate(endDate.toDate()))
      );

      const querySnapshot = await getDocs(q);
      const fetchedEvents: DeliveryEvent[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime.toDate(),
        endTime: doc.data().endTime.toDate(),
      })) as DeliveryEvent[];

      setEvents(fetchedEvents);

      // Update calendar configuration with new events
      const calendarEvents: CalendarEvent[] = fetchedEvents.map((event) => ({
        id: event.id,
        text: `Client: ${event.clientName} (Driver: ${event.assignedDriverName})`,
        start: new DayPilot.Date(event.startTime, true),
        end: new DayPilot.Date(event.endTime, true),
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

  const handleAddDelivery = async () => {
    try {
      const startDateTime = new Date(
        `${newDelivery.startDate}T${newDelivery.startTime}`
      );
      const endDateTime = new Date(
        `${newDelivery.endDate}T${newDelivery.endTime}`
      );

      const eventData = {
        assignedDriverId: newDelivery.assignedDriverId,
        assignedDriverName: newDelivery.assignedDriverName,
        priority: newDelivery.priority,
        clientId: newDelivery.clientId,
        clientName: newDelivery.clientName,
        startTime: Timestamp.fromDate(startDateTime),
        endTime: Timestamp.fromDate(endDateTime),
        notes: newDelivery.notes,
      };

      await addDoc(collection(db, "events"), eventData);

      // Reset the form
      const { date, startTime, endTime } = getInitialFormDates();
      setNewDelivery({
        assignedDriverId: "",
        assignedDriverName: "",
        clientId: "",
        priority: "",
        clientName: "",
        startDate: date,
        startTime,
        endDate: date,
        endTime,
        notes: "",
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
        : viewType === "Week"
          ? currentDate.addDays(-7)
          : currentDate.addDays(-1);
    setCurrentDate(newDate);
  };

  const handleNavigateNext = () => {
    const newDate =
      viewType === "Month"
        ? currentDate.addMonths(1)
        : viewType === "Week"
          ? currentDate.addDays(7)
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
                          }}
                          onClick={() => {
                            navigate("/spreadsheet");
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: "600",
                              color: "#257E68",
                              marginTop: 0.25,
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
                          label: "ROUTE",
                          value: "Washington Ave",
                          color: "#787777",
                        },
                        {
                          label: "PRIORITY",
                          value: event.priority,
                          color: "#787777",
                        },
                        {
                          label: "ADDRESS",
                          value: client?.address || "N/A",
                          color: "#787777",
                        },
                        {
                          label: "RESTRICTIONS",
                          value: dietaryRestrictions,
                          color: "#787777",
                          isScrollable: true,
                        },
                        {
                          label: "LANGUAGE",
                          value: client?.language || "N/A",
                          color: "#787777",
                        },
                      ].map(({ label, value, color, isScrollable }) => (
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

                          {Array.isArray(value) ? (
                            value.length > 0 ? (
                              <Box
                                sx={{
                                  fontWeight: "bold",
                                  color: color,
                                  maxHeight: isScrollable ? "100px" : "none",
                                  overflowY: isScrollable ? "auto" : "visible",
                                  padding: isScrollable ? "4px" : "0",
                                  border: isScrollable
                                    ? "1px solid #ccc"
                                    : "none",
                                  borderRadius: "4px",
                                }}
                              >
                                {value.map((restriction, index) => (
                                  <Typography variant="body1" key={index}>
                                    {restriction &&
                                    typeof restriction === "string"
                                      ? "- " + restriction
                                      : ""}
                                  </Typography>
                                ))}
                              </Box>
                            ) : (
                              <Typography
                                variant="body1"
                                sx={{ fontWeight: "bold", color: color }}
                              >
                                N/A
                              </Typography>
                            )
                          ) : (
                            <Typography
                              variant="body1"
                              sx={{ fontWeight: "bold", color: color }}
                            >
                              {value}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
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
          const limit = dailyLimit ? dailyLimit.limit : 60;

          const eventCount = calendarConfig.events.filter((event) => {
            const eventDateString = event.start.toString("yyyy-MM-dd");
            return eventDateString === dateKey;
          }).length;

          args.cell.properties.html = `
            <div style='position: absolute; 
                        bottom: 0; 
                        left: 0; 
                        right: 0; 
                        text-align: center; 
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
      };

      return <DayPilotMonth {...customCalendarConfig} />;
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
              {(["Day", "Week", "Month"] as ViewType[]).map((type) => (
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
            <CalendarPopper
              anchorEl={anchorEl}
              viewType={viewType}
              calendarConfig={calendarConfig}
              dailyLimits={dailyLimits}
              setDailyLimits={setDailyLimits}
              fetchDailyLimits={fetchLimits}
            />
          </Box>
        </Box>

        <StyledCalendarContainer>
          <CalendarContent>{renderCalendarView()}</CalendarContent>
        </StyledCalendarContainer>

        <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <DialogTitle>Add Delivery</DialogTitle>
          <DialogContent>
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

            {/*
            <TextField
              label="Start Time"
              type="time"
              value={newDelivery.startTime}
              onChange={(e) =>
                setNewDelivery({ ...newDelivery, startTime: e.target.value })
              }
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
            /> */}
            <FormControl fullWidth style={{ width: "100%" }}>
              <InputLabel id="priority-select-label">Priority</InputLabel>
              <Select
                labelId="priority-select-label"
                id="priority-select"
                value={newDelivery.priority}
                onChange={(e) =>
                  setNewDelivery({ ...newDelivery, priority: e.target.value })
                }
              >
                <MenuItem value={"Low"}>Low</MenuItem>
                <MenuItem value={"Medium"}>Medium</MenuItem>
                <MenuItem value={"High"}>High</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Date"
              type="date"
              value={newDelivery.endDate}
              onChange={(e) =>
                setNewDelivery({ ...newDelivery, endDate: e.target.value })
              }
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            {/*
            <TextField
              label="End Time"
              type="time"
              value={newDelivery.endTime}
              onChange={(e) =>
                setNewDelivery({ ...newDelivery, endTime: e.target.value })
              }
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            */}
            <TextField
              label="Notes"
              value={newDelivery.notes}
              onChange={(e) =>
                setNewDelivery({ ...newDelivery, notes: e.target.value })
              }
              fullWidth
              margin="normal"
              multiline
              rows={4}
            />
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
