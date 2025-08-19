import { Button } from "@mui/material";
import DateRangePicker from "./DateRangePicker";
import { useState } from "react";

interface ReportHeaderProps {
  startDate: Date | null;
  endDate: Date | null;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
  generateReport?: () => any
}

export default function ReportHeader({startDate, endDate, setStartDate, setEndDate, generateReport}: ReportHeaderProps) {
    return (
        <div
            style={{
            flexShrink: 0,
            padding: "12px 16px",
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "0%"
            }}
        >

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <DateRangePicker startDate={startDate} endDate = {endDate} setStartDate = {setStartDate} setEndDate = {setEndDate}></DateRangePicker>
        </div>
        
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant="contained"
            sx={{ backgroundColor: "var(--color-primary)" }}
            onClick = {generateReport}
          >
            Generate
          </Button>
          <Button
            variant="contained"
            sx={{ backgroundColor: "var(--color-primary)" }}
          >
            Export
          </Button>
        </div>
        
      </div>
    )
}