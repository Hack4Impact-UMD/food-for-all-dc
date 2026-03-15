import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { Box, Button, ButtonBase, Chip, Stack, Typography } from "@mui/material";

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

interface SelectionCardProps {
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  metaLabel?: string;
  onClick: () => void;
}

const SCOPE_LABELS: Record<RouteExportScope, string> = {
  selected: "Selected rows",
  visible: "Current table",
  all: "All deliveries for date",
};

const SCOPE_HELPER_TEXT: Record<RouteExportScope, string> = {
  selected: "Only rows you already selected.",
  visible: "Rows currently shown after search, filter, and sort.",
  all: "Every delivery loaded for the selected date.",
};

const OPTION_LABELS: Record<RouteExportOption, string> = {
  Routes: "Driver routes",
  DoorDash: "DoorDash",
};

const OPTION_HELPER_TEXT: Record<RouteExportOption, string> = {
  Routes: "One CSV per route, including DoorDash-assigned routes.",
  DoorDash: "Vendor CSVs for DoorDash-assigned routes only.",
};

const SelectionCard = ({
  title,
  description,
  selected,
  disabled = false,
  metaLabel,
  onClick,
}: SelectionCardProps) => {
  const borderColor = selected ? "var(--color-primary)" : "var(--color-border-medium)";
  const backgroundColor = selected
    ? "var(--color-background-green-light)"
    : "var(--color-background-main)";

  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      role="radio"
      aria-checked={selected}
      sx={{
        width: "100%",
        display: "block",
        border: "2px solid",
        borderColor,
        borderRadius: "12px",
        backgroundColor,
        overflow: "hidden",
        opacity: disabled ? 0.62 : 1,
        transition: "border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease",
        "&:hover": disabled
          ? undefined
          : {
              borderColor: "var(--color-primary)",
              backgroundColor: selected
                ? "var(--color-background-green-light)"
                : "var(--color-background-green-tint)",
              boxShadow: "var(--shadow-sm)",
            },
        "&.Mui-focusVisible": {
          boxShadow: "0 0 0 3px rgba(37, 126, 104, 0.22)",
        },
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "auto minmax(0, 1fr)",
            sm: "auto minmax(0, 1fr) auto",
          },
          gap: 2,
          alignItems: "start",
          px: 2,
          py: 1.75,
        }}
      >
        <Box
          sx={{
            pt: 0.25,
            color: selected ? "var(--color-primary)" : "var(--color-text-secondary)",
            display: "flex",
            alignItems: "center",
          }}
        >
          {selected ? (
            <CheckCircleRoundedIcon fontSize="small" />
          ) : (
            <RadioButtonUncheckedRoundedIcon fontSize="small" />
          )}
        </Box>

        <Box sx={{ minWidth: 0, textAlign: "left" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: "var(--color-text-primary)",
                lineHeight: 1.3,
              }}
            >
              {title}
            </Typography>
            {selected && (
              <Chip
                label="Selected"
                size="small"
                sx={{
                  height: 22,
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-white)",
                  fontWeight: 700,
                  "& .MuiChip-label": { px: 1.25 },
                }}
              />
            )}
          </Box>
          <Typography
            variant="body2"
            sx={{
              mt: 0.75,
              color: "var(--color-text-medium-alt)",
              lineHeight: 1.45,
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {description}
          </Typography>
        </Box>

        {metaLabel ? (
          <Chip
            label={metaLabel}
            size="small"
            sx={{
              gridColumn: { xs: "2", sm: "3" },
              justifySelf: "start",
              alignSelf: "start",
              mt: { xs: -0.5, sm: 0 },
              backgroundColor: selected
                ? "rgba(37, 126, 104, 0.12)"
                : "var(--color-background-gray-light)",
              color: "var(--color-text-primary)",
              fontWeight: 600,
              "& .MuiChip-label": { px: 1.25 },
            }}
          />
        ) : null}
      </Box>
    </ButtonBase>
  );
};

const formatRowCount = (count: number) => `${count} row${count === 1 ? "" : "s"}`;

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
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Choose export type
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pick the file format you want to download.
          </Typography>
        </Box>

        <Box role="radiogroup" aria-label="Choose export type">
          <Stack spacing={2}>
            <SelectionCard
              title={OPTION_LABELS.Routes}
              description={OPTION_HELPER_TEXT.Routes}
              selected={false}
              onClick={() => onSelectOption("Routes")}
            />
            <SelectionCard
              title={OPTION_LABELS.DoorDash}
              description={OPTION_HELPER_TEXT.DoorDash}
              selected={false}
              onClick={() => onSelectOption("DoorDash")}
            />
          </Stack>
        </Box>

        <Box>
          <Button variant="outlined" color="primary" onClick={onBack} sx={{ mt: 0, width: "100%" }}>
            Close
          </Button>
        </Box>
      </Stack>
    );
  }

  const availableCount = scopeCounts[exportScope];
  const exportScopeLabel = SCOPE_LABELS[exportScope];
  const summary = `${OPTION_LABELS[exportOption]} • ${exportScopeLabel} • ${formatRowCount(
    availableCount
  )}`;
  const helperSummary =
    exportOption === "Routes"
      ? "Valid route files will download. Invalid rows are skipped."
      : "Only DoorDash-assigned rows with required fields will download.";

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Choose rows to include
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select which deliveries should be used for this export.
        </Typography>
      </Box>

      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderRadius: "12px",
          border: "1px solid var(--color-border-medium)",
          backgroundColor: "var(--color-background-green-tint)",
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: "var(--color-text-medium-alt)", fontWeight: 700 }}
        >
          Selected export type
        </Typography>
        <Typography variant="body1" sx={{ mt: 0.25, fontWeight: 700 }}>
          {OPTION_LABELS[exportOption]}
        </Typography>
      </Box>

      <Box role="radiogroup" aria-label="Choose rows to include">
        <Stack spacing={2}>
          {(["selected", "visible", "all"] as RouteExportScope[]).map((scope) => (
            <SelectionCard
              key={scope}
              title={SCOPE_LABELS[scope]}
              description={SCOPE_HELPER_TEXT[scope]}
              selected={exportScope === scope}
              disabled={scopeCounts[scope] === 0}
              metaLabel={formatRowCount(scopeCounts[scope])}
              onClick={() => onSelectScope(scope)}
            />
          ))}
        </Stack>
      </Box>

      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderRadius: "12px",
          backgroundColor: "var(--color-background-gray-light)",
          border: "1px solid var(--color-border-lighter)",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
          {summary}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.45 }}>
          {helperSummary}
        </Typography>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <Box sx={{ flex: 1 }}>
          <Button variant="outlined" color="primary" onClick={onBack} sx={{ mt: 0, width: "100%" }}>
            Back to export type
          </Button>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={onDownload}
            disabled={availableCount === 0}
            sx={{ mt: 0, width: "100%" }}
          >
            Download
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
}
