import { Box, Button, Typography } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

export type RouteExportOption = "Routes" | "DoorDash";
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
  visible: "Current table",
  all: "All deliveries for date",
};

const SCOPE_HELPER_TEXT: Record<RouteExportScope, string> = {
  selected: "Only the rows you have selected.",
  visible: "The rows currently shown after search, filter, and sort.",
  all: "Every delivery loaded for the selected date.",
};

const OPTION_LABELS: Record<RouteExportOption, string> = {
  Routes: "Driver routes",
  DoorDash: "DoorDash",
};

const OPTION_HELPER_TEXT: Record<RouteExportOption, string> = {
  Routes: "One CSV per route, including DoorDash-assigned routes.",
  DoorDash: "DoorDash vendor CSVs for DoorDash-assigned routes only.",
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
          sx={{ justifyContent: "flex-start", textAlign: "left", py: 1.5 }}
        >
          <Box>
            <Typography variant="subtitle2">Driver routes</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, textTransform: "none" }}>
              One CSV per route, including DoorDash-assigned routes.
            </Typography>
          </Box>
        </Button>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => onSelectOption("DoorDash")}
          startIcon={<FileDownloadIcon />}
          sx={{ justifyContent: "flex-start", textAlign: "left", py: 1.5 }}
        >
          <Box>
            <Typography variant="subtitle2">DoorDash</Typography>
            <Typography variant="body2" sx={{ textTransform: "none" }}>
              DoorDash vendor CSVs for DoorDash-assigned routes only.
            </Typography>
          </Box>
        </Button>
      </Box>
    );
  }

  const availableCount = scopeCounts[exportScope];
  const exportScopeLabel = SCOPE_LABELS[exportScope];
  const summary =
    exportOption === "Routes"
      ? `Download route files for ${availableCount} row${availableCount === 1 ? "" : "s"} from ${exportScopeLabel.toLowerCase()}. Invalid rows will be skipped.`
      : `Download DoorDash route files from ${exportScopeLabel.toLowerCase()}. Only DoorDash-assigned rows with required fields will be included.`;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <Typography variant="subtitle1">Export type: {OPTION_LABELS[exportOption]}</Typography>
      <Typography variant="body2" color="text.secondary">
        {OPTION_HELPER_TEXT[exportOption]}
      </Typography>
      {(["selected", "visible", "all"] as RouteExportScope[]).map((scope) => (
        <Button
          key={scope}
          variant={exportScope === scope ? "contained" : "outlined"}
          color="primary"
          onClick={() => onSelectScope(scope)}
          disabled={scopeCounts[scope] === 0}
          sx={{ justifyContent: "flex-start", textAlign: "left", py: 1.5 }}
        >
          <Box>
            <Typography variant="subtitle2">
              {SCOPE_LABELS[scope]} ({scopeCounts[scope]})
            </Typography>
            <Typography variant="body2" sx={{ textTransform: "none" }}>
              {SCOPE_HELPER_TEXT[scope]}
            </Typography>
          </Box>
        </Button>
      ))}
      <Typography variant="body2" color="text.secondary">
        {summary}
      </Typography>
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
