import { DayPilot } from "@daypilot/daypilot-lite-react";
import { Add, EditCalendar } from "@mui/icons-material";
import { Box, Button, IconButton, Typography } from "@mui/material";
import React, { useCallback } from "react";
import PageDatePicker from "../../../components/PageDatePicker/PageDatePicker";
import { useAuth } from "../../../auth/AuthProvider";
import { UserType } from "../../../types";

interface CalendarHeaderProps {
  viewType: "Day" | "Month";
  currentDate: DayPilot.Date;
  setCurrentDate: (date: DayPilot.Date) => void;
  onViewTypeChange: (viewType: "Day" | "Month") => void;
  onNavigatePrev: () => void;
  onNavigateToday: () => void;
  onNavigateNext: () => void;
  onAddDelivery: () => void;
  onEditLimits?: (event: React.MouseEvent<HTMLElement>) => void;
}

function isDayPilotDate(x: any): x is DayPilot.Date {
  return x && typeof x.getDayOfWeek === "function";
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  viewType,
  currentDate,
  setCurrentDate,
  onViewTypeChange,
  onNavigatePrev,
  onNavigateToday,
  onNavigateNext,
  onAddDelivery,
  onEditLimits,
}) => {
  const { userRole } = useAuth();
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const handleDateSelect = useCallback(
    (incoming: Date | DayPilot.Date) => {
      let dpDate: DayPilot.Date;

      if (isDayPilotDate(incoming)) {
        dpDate = incoming;
      } else {
        dpDate = new DayPilot.Date(incoming, true);
      }

      setCurrentDate(dpDate);
    },
    [setCurrentDate]
  );

  const handleViewToggle = () => {
    onViewTypeChange(viewType === "Day" ? "Month" : "Day");
  };

  return (
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
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Button
          onClick={handleViewToggle}
          variant="outlined"
          sx={{
            width: 80,
            backgroundColor: '#257E68',
            color: '#fff',
            border: '1px solid #257E68',
            '&:hover': {
              backgroundColor: '#1e6b57',
              border: '1px solid #1e6b57',
            },
          }}
        >
          {viewType}
        </Button>
        <Button sx={{ width: 50, fontSize: 12, display: "flex", alignItems: "center" }} onClick={onNavigateToday}>
          Today
        </Button>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <PageDatePicker setSelectedDate={handleDateSelect} marginLeft="0rem" />
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
        }}
      >
         <IconButton onClick={onNavigatePrev} size="large" sx={{ color: "#257E68" }}>
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

        <Typography variant="h4" sx={{ marginRight: 2, color: "#787777" }}>
          {viewType === "Day" && currentDate.toString("dddd - MMMM, dd/yyyy")}
          {viewType === "Month" && currentDate.toString("MMMM yyyy")}
        </Typography>
       
       
        <IconButton onClick={onNavigateNext} size="large" sx={{ color: "#257E68" }}>
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
          onClick={onAddDelivery}
          disabled={userRole === UserType.ClientIntake}
          sx={{
            marginRight: 4,
            width: 166,
            color: "#fff",
            backgroundColor: "#257E68",
          }}
        >
          Add Delivery
        </Button>

        {viewType === "Month" && onEditLimits && (
          <Button
            variant="contained"
            endIcon={<EditCalendar />}
            onClick={onEditLimits}
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
      </Box>
    </Box>
  );
};

export default CalendarHeader;
