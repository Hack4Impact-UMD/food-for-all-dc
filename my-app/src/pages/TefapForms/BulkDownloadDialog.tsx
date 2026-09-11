import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { saveAs } from "file-saver";
import type { TefapForm, TefapSubmission } from "../../types/tefap-types";
import { tefapFormService } from "../../services/tefap-form-service";
import { tefapSubmissionService } from "../../services/tefap-submission-service";
import { useNotifications } from "../../components/NotificationProvider";
import { sanitizeFilename } from "../../utils/csvExport";
import {
  type TefapExportFormat,
  type TefapExportRow,
  MERGED_WARN_THRESHOLD,
  ZIP_DOCUMENT_LIMIT,
  buildExport,
  manifestToCsv,
} from "./tefapExport";
import { primaryButtonSx, quietButtonSx } from "./tefapStyles";

interface BulkDownloadDialogProps {
  open: boolean;
  forms: TefapForm[];
  onClose: () => void;
}

const ALL_FORMS = "__all__";

const BulkDownloadDialog: React.FC<BulkDownloadDialogProps> = ({ open, forms, onClose }) => {
  const { showError, showSuccess } = useNotifications();

  const [formId, setFormId] = useState<string>(ALL_FORMS);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [latestOnly, setLatestOnly] = useState(true);
  const [format, setFormat] = useState<TefapExportFormat>("merged");
  const [submissions, setSubmissions] = useState<TefapSubmission[]>([]);
  const [counting, setCounting] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);

  const formsById = useMemo(() => new Map(forms.map((form) => [form.id, form])), [forms]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setCounting(true);

    void (async () => {
      try {
        const found = await tefapSubmissionService.listSubmissions({
          formId: formId === ALL_FORMS ? undefined : formId,
          from: from || undefined,
          to: to || undefined,
          latestPerClient: latestOnly,
        });
        if (!cancelled) setSubmissions(found);
      } catch (error) {
        if (!cancelled) {
          showError(error instanceof Error ? error.message : "Failed to count completed forms.");
        }
      } finally {
        if (!cancelled) setCounting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formId, from, latestOnly, open, showError, to]);

  // A submission whose template has been deleted cannot be rebuilt at all, so
  // it is excluded here rather than failing partway through the run.
  const rows: TefapExportRow[] = useMemo(
    () =>
      submissions.flatMap((submission) => {
        const form = formsById.get(submission.formId);
        return form ? [{ submission, form }] : [];
      }),
    [formsById, submissions]
  );

  const orphaned = submissions.length - rows.length;
  const zipTooLarge = format === "zip" && rows.length > ZIP_DOCUMENT_LIMIT;
  const mergedVeryLarge = format === "merged" && rows.length > MERGED_WARN_THRESHOLD;

  const handleExport = useCallback(async () => {
    setRunning(true);
    setProgress({ completed: 0, total: rows.length });

    try {
      const label =
        formId === ALL_FORMS ? "tefap-forms" : (formsById.get(formId)?.name ?? "tefap-forms");

      const result = await buildExport({
        rows,
        format,
        label,
        loadTemplate: (form) => tefapFormService.getTemplateBytes(form),
        onProgress: setProgress,
      });

      saveAs(result.blob, result.fileName);

      // The merged PDF has nowhere to carry the manifest, so it ships beside it.
      if (format === "merged") {
        saveAs(
          new Blob([manifestToCsv(result.manifest)], { type: "text/csv;charset=utf-8;" }),
          sanitizeFilename(result.fileName.replace(/\.pdf$/i, "_manifest.csv"))
        );
      }

      const failed = result.manifest.filter((entry) =>
        entry.warnings.startsWith("NOT EXPORTED")
      ).length;

      showSuccess(
        failed > 0
          ? `Exported ${result.documentCount} form(s); ${failed} could not be rebuilt (see the manifest).`
          : `Exported ${result.documentCount} form(s).`
      );
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to build the export.");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [format, formId, formsById, onClose, rows, showError, showSuccess]);

  return (
    <Dialog open={open} onClose={running ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, color: "var(--color-primary)" }}>
        Download completed forms
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label="Form"
            value={formId}
            onChange={(event) => setFormId(event.target.value)}
            fullWidth
          >
            <MenuItem value={ALL_FORMS}>All forms</MenuItem>
            {forms.map((form) => (
              <MenuItem key={form.id} value={form.id}>
                {form.name} (v{form.version})
              </MenuItem>
            ))}
          </TextField>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="From"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="To"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={latestOnly}
                onChange={(event) => setLatestOnly(event.target.checked)}
                sx={{
                  "& .Mui-checked": { color: "var(--color-primary)" },
                  "& .Mui-checked + .MuiSwitch-track": {
                    backgroundColor: "var(--color-primary)",
                  },
                }}
              />
            }
            label="Only each client's most recent form"
          />

          <TextField
            select
            label="Format"
            value={format}
            onChange={(event) => setFormat(event.target.value as TefapExportFormat)}
            fullWidth
            helperText={
              format === "merged"
                ? "One PDF, a page per client, plus a manifest CSV. Best for printing."
                : `One file per client plus a manifest, up to ${ZIP_DOCUMENT_LIMIT} forms. About 8% larger than merged.`
            }
          >
            <MenuItem value="merged">Merged PDF (recommended)</MenuItem>
            <MenuItem value="zip">ZIP of individual PDFs</MenuItem>
          </TextField>

          <Box>
            <Typography variant="body2">
              {counting ? "Counting..." : `${rows.length} completed form(s) selected.`}
            </Typography>
            {orphaned > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {orphaned} submission(s) reference a template that is no longer available and cannot
                be rebuilt. They are excluded.
              </Alert>
            )}
            {mergedVeryLarge && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {rows.length} forms is roughly {Math.round((rows.length * 170) / 1024)}MB and will
                take a while to build in the browser. Consider narrowing the date range.
              </Alert>
            )}
            {zipTooLarge && (
              <Alert severity="error" sx={{ mt: 1 }}>
                A ZIP is limited to {ZIP_DOCUMENT_LIMIT} forms. Narrow the range or choose a merged
                PDF.
              </Alert>
            )}
          </Box>

          {progress && (
            <Box>
              <LinearProgress
                variant="determinate"
                value={progress.total ? (progress.completed / progress.total) * 100 : 0}
                sx={{
                  borderRadius: "var(--border-radius-sm)",
                  backgroundColor: "var(--color-background-gray)",
                  "& .MuiLinearProgress-bar": { backgroundColor: "var(--color-primary)" },
                }}
              />
              <Typography variant="caption">
                Rebuilding {progress.completed} of {progress.total}...
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={running} sx={quietButtonSx}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={() => void handleExport()}
          disabled={running || counting || rows.length === 0 || zipTooLarge}
          sx={primaryButtonSx}
        >
          {running ? "Building..." : "Download"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkDownloadDialog;
