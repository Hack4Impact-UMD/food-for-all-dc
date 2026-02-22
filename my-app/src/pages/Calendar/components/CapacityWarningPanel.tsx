import React from "react";
import { Box, Typography } from "@mui/material";
import { CapacityWarningEntry, getCapacityWarningText } from "./capacityStatus";

interface CapacityWarningPanelProps {
  warnings: CapacityWarningEntry[];
  warningError?: string;
  formatDate: (dateKey: string) => string;
  marginTop?: number;
  marginBottom?: number;
}

const CapacityWarningPanel: React.FC<CapacityWarningPanelProps> = ({
  warnings,
  warningError = "",
  formatDate,
  marginTop,
  marginBottom,
}) => {
  if (!warnings.length && !warningError) {
    return null;
  }

  return (
    <Box
      sx={{
        p: 1.5,
        border: "1px solid var(--color-warning-text)",
        backgroundColor: "var(--color-warning-background)",
        borderRadius: 1,
        color: "var(--color-warning-text)",
        ...(typeof marginTop === "number" ? { mt: marginTop } : {}),
        ...(typeof marginBottom === "number" ? { mb: marginBottom } : {}),
      }}
    >
      <Typography sx={{ color: "var(--color-warning-text)", fontWeight: 700, mb: 0.5 }}>
        Capacity warning
      </Typography>
      <Typography sx={{ color: "var(--color-warning-text)", fontSize: "0.85rem", mb: 1 }}>
        This warning is informational only. Scheduling will not be blocked.
      </Typography>
      {warningError && (
        <Typography sx={{ color: "var(--color-warning-text)", fontSize: "0.9rem" }}>
          {warningError}
        </Typography>
      )}
      {warnings.map((warning) => (
        <Typography key={warning.dateKey} sx={{ color: "var(--color-warning-text)", fontSize: "0.9rem" }}>
          {formatDate(warning.dateKey)}: {warning.projectedCount}/{warning.limit} •{" "}
          {getCapacityWarningText(warning.status)}
        </Typography>
      ))}
    </Box>
  );
};

export default CapacityWarningPanel;
