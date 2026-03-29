import { Box, Button, Typography } from "@mui/material";

interface SnapshotReportHeaderProps {
  snapshotLabel: string;
  onGenerate?: () => void;
  onExport?: () => void;
  exportDisabled?: boolean;
  isGenerating?: boolean;
}

export default function SnapshotReportHeader({
  snapshotLabel,
  onGenerate,
  onExport,
  exportDisabled = true,
  isGenerating = false,
}: SnapshotReportHeaderProps) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        padding: "12px 16px",
        backgroundColor: "var(--color-white)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {snapshotLabel}
      </Typography>

      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          variant="contained"
          sx={{ backgroundColor: "var(--color-primary)" }}
          onClick={onGenerate}
          disabled={isGenerating}
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
      </Box>
    </Box>
  );
}
