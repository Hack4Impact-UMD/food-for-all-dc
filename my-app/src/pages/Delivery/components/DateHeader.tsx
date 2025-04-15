import React from 'react';
import { addDays, format } from "date-fns";
import { Box, Typography, IconButton, Button } from "@mui/material";
import DeliveryDatePicker from "../DeliveryDatePicker/DeliveryDatePicker";

interface DateHeaderProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  onGenerateClusters: () => void;
}

const DateHeader: React.FC<DateHeaderProps> = ({ 
  selectedDate, 
  setSelectedDate,
  onGenerateClusters
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          padding: "16px",
          backgroundColor: "#fff",
          zIndex: 10,
          position: "sticky",
          top: 0,
          width: "100%",
        }}
      >
        <Typography variant="h4" sx={{ marginRight: 2, width: "170px", color: "#787777" }}>
          {format(selectedDate, "EEEE")}
        </Typography>

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
            {format(selectedDate, "d")}
          </Typography>
        </Box>

        <IconButton
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
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
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
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

        <DeliveryDatePicker setSelectedDate={setSelectedDate} />

        <Button
          sx={{ width: 50, fontSize: 12, marginLeft: 4 }}
          onClick={() => setSelectedDate(new Date())}
        >
          Today
        </Button>
      </Box>
      <Button
        variant="contained"
        color="secondary"
        className="view-all"
        onClick={onGenerateClusters}
        sx={{
          whiteSpace: "nowrap",
          padding: "0% 2%",
          borderRadius: "5px",
          width: "10%",
          backgroundColor: "#257E68 !important",
        }}
      >
        Generate<br></br>Clusters
      </Button>
    </div>
  );
};

export default DateHeader;