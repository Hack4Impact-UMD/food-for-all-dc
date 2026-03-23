import { Button, Alert } from "@mui/material";
import DateRangePicker from "./DateRangePicker";

interface ReportHeaderProps {
  startDate: Date | null;
  endDate: Date | null;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
  maxDate?: Date | null;
  generateReport?: () => any;
  onExport?: () => void;
  exportDisabled?: boolean;
  isGenerating?: boolean;
}

export default function ReportHeader({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  maxDate = null,
  generateReport,
  onExport,
  exportDisabled = true,
  isGenerating = false,
}: ReportHeaderProps) {
  const hasInvalidDateRange = startDate && endDate && startDate > endDate;
  const hasFutureDateSelection =
    !!maxDate &&
    ((!!startDate && startDate > maxDate) || (!!endDate && endDate > maxDate));
  const isGenerateDisabled =
    !startDate || !endDate || !!hasInvalidDateRange || hasFutureDateSelection || isGenerating;

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
            maxDate={maxDate}
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
            disabled={exportDisabled}
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

      {hasFutureDateSelection && (
        <Alert severity="error" sx={{ mt: 1 }}>
          Reports can only be generated through today.
        </Alert>
      )}
    </div>
  );
}
