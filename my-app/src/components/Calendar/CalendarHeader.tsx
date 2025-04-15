import React from "react";
import { Box, Button, Typography, IconButton, Menu, MenuItem } from "@mui/material";
import { Add, ChevronRight, EditCalendar } from "@mui/icons-material";
import { DayPilot } from "@daypilot/daypilot-lite-react";

interface CalendarHeaderProps {
  viewType: "Day" | "Month";
  currentDate: DayPilot.Date;
  onViewTypeChange: (viewType: "Day" | "Month") => void;
  onNavigatePrev: () => void;
  onNavigateToday: () => void;
  onNavigateNext: () => void;
  onAddDelivery: () => void;
  onEditLimits?: (event: React.MouseEvent<HTMLElement>) => void;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  viewType,
  currentDate,
  onViewTypeChange,
  onNavigatePrev,
  onNavigateToday,
  onNavigateNext,
  onAddDelivery,
  onEditLimits,
}) => {
  const [viewAnchorEl, setViewAnchorEl] = React.useState<null | HTMLElement>(null);
  
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
          {(["Day", "Month"] as const).map((type) => (
            <MenuItem
              key={type}
              onClick={() => {
                onViewTypeChange(type);
                setViewAnchorEl(null);
              }}
            >
              {type}
            </MenuItem>
          ))}
        </Menu>
        <Button
          sx={{ width: 50, fontSize: 12, marginLeft: 4 }}
          onClick={onNavigateToday}
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