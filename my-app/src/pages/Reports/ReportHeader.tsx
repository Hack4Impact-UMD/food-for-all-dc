import { Button, Alert } from "@mui/material";
import DateRangePicker from "./DateRangePicker";
import { useState } from "react";

interface ReportHeaderProps {
  startDate: Date | null;
  endDate: Date | null;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
  generateReport?: () => any;
  onExport?: () => void;
  hasData?: boolean;
}

export default function ReportHeader({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  generateReport,
  onExport,
  hasData = false,
}: ReportHeaderProps) {
  const hasInvalidDateRange = startDate && endDate && startDate > endDate;
  const isGenerateDisabled = !startDate || !endDate || !!hasInvalidDateRange;

  return (
    <div
      style={{
        flexShrink: 0,
        padding: "12px 16px",
        backgroundColor: "var(--color-white)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        marginTop: "0%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
          ></DateRangePicker>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant="contained"
            sx={{ backgroundColor: "var(--color-primary)" }}
            onClick={generateReport}
            disabled={isGenerateDisabled}
          >
            Generate
          </Button>
          <Button
            variant="contained"
            sx={{ backgroundColor: "var(--color-primary)" }}
            onClick={onExport}
            disabled={!hasData}
          >
            Export
          </Button>
        </div>
      </div>

      {hasInvalidDateRange && (
        <Alert severity="error" sx={{ mt: 1 }}>
          Start date must be before end date
        </Alert>
      )}
    </div>
  );
}
