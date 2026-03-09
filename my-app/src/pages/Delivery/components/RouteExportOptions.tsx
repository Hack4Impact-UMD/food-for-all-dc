import { Box, Button, Typography } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

export type RouteExportOption = "Routes" | "Doordash";
export type RouteExportScope = "selected" | "visible" | "all";

interface ScopeCounts {
  selected: number;
  visible: number;
  all: number;
}

interface RouteExportOptionsProps {
  exportOption: RouteExportOption | null;
  exportScope: RouteExportScope;
  scopeCounts: ScopeCounts;
  onSelectOption: (option: RouteExportOption) => void;
  onSelectScope: (scope: RouteExportScope) => void;
  onDownload: () => void;
  onBack: () => void;
}

const SCOPE_LABELS: Record<RouteExportScope, string> = {
  selected: "Selected rows",
  visible: "Visible rows",
  all: "All deliveries",
};

export default function RouteExportOptions({
  exportOption,
  exportScope,
  scopeCounts,
  onSelectOption,
  onSelectScope,
  onDownload,
  onBack,
}: RouteExportOptionsProps) {
  if (!exportOption) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => onSelectOption("Routes")}
          startIcon={<FileDownloadIcon />}
        >
          Routes
        </Button>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => onSelectOption("Doordash")}
          startIcon={<FileDownloadIcon />}
        >
          Doordash
        </Button>
      </Box>
    );
  }

  const availableCount = scopeCounts[exportScope];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <Typography variant="subtitle1">Selected Option: {exportOption}</Typography>
      <Typography variant="body2" color="text.secondary">
        Choose what to export.
      </Typography>
      {(["selected", "visible", "all"] as RouteExportScope[]).map((scope) => (
        <Button
          key={scope}
          variant={exportScope === scope ? "contained" : "outlined"}
          color="primary"
          onClick={() => onSelectScope(scope)}
          disabled={scopeCounts[scope] === 0}
        >
          {SCOPE_LABELS[scope]} ({scopeCounts[scope]})
        </Button>
      ))}
      <Button
        variant="contained"
        color="primary"
        onClick={onDownload}
        disabled={availableCount === 0}
      >
        Download
      </Button>
      <Button variant="outlined" color="primary" onClick={onBack}>
        Back
      </Button>
    </Box>
  );
}
