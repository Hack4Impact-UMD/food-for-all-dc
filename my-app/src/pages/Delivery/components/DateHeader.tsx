import { Box, Button, IconButton, Typography } from "@mui/material";
import { TimeUtils } from "../../../utils/timeUtils";
import React from "react";
import PageDatePicker from "../../../components/PageDatePicker/PageDatePicker";

interface DateHeaderProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  onGenerateClusters: () => void;
}

const DateHeader: React.FC<DateHeaderProps> = ({
  selectedDate,
  setSelectedDate,
  onGenerateClusters,
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
          backgroundColor: "var(--color-background-main)",
          zIndex: 10,
          position: "sticky",
          top: 0,
          width: "100%",
        }}
      >
        <Typography variant="h4" sx={{ marginRight: 2, width: "170px", color: "var(--color-text-secondary)" }}>
          {TimeUtils.fromJSDate(selectedDate).toFormat('cccc')}
        </Typography>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "40px",
            height: "40px",
            backgroundColor: "var(--color-primary)",
            borderRadius: "90%",
            marginRight: 2,
          }}
        >
          <Typography variant="h5" sx={{ color: "var(--color-background-main)" }}>
            {TimeUtils.fromJSDate(selectedDate).toFormat('d')}
          </Typography>
        </Box>

        <IconButton
          onClick={() => setSelectedDate(TimeUtils.fromJSDate(selectedDate).minus({ days: 1 }).toJSDate())}
          size="large"
          sx={{ color: "var(--color-primary)" }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderLeft: "2px solid var(--color-primary)",
              borderBottom: "2px solid var(--color-primary)",
              transform: "rotate(45deg)",
            }}
          />
        </IconButton>

        <IconButton
          onClick={() => setSelectedDate(TimeUtils.fromJSDate(selectedDate).plus({ days: 1 }).toJSDate())}
          size="large"
          sx={{ color: "var(--color-primary)" }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderLeft: "2px solid var(--color-primary)",
              borderBottom: "2px solid var(--color-primary)",
              transform: "rotate(-135deg)",
            }}
          />
        </IconButton>

        <PageDatePicker setSelectedDate={setSelectedDate} />

        <Button
          sx={{ width: 50, fontSize: 12, marginLeft: 4 }}
          onClick={() => setSelectedDate(TimeUtils.now().toJSDate())}
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
          backgroundColor: "var(--color-primary) !important",
        }}
      >
        Generate<br></br>Clusters
      </Button>
    </div>
  );
};

export default DateHeader;
