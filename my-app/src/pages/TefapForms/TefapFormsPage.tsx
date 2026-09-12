import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import type { TefapActor, TefapForm } from "../../types/tefap-types";
import { tefapFormService } from "../../services/tefap-form-service";
import { useAuth } from "../../auth/AuthProvider";
import { useNotifications } from "../../components/NotificationProvider";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import { deliveryDate } from "../../utils/deliveryDate";
import FormUploadDialog from "./FormUploadDialog";
import FieldMapEditor from "./FieldMapDialog";
import BulkDownloadDialog from "./BulkDownloadDialog";
import {
  cardSx,
  metaChipSx,
  pageContainerSx,
  pageSubtitleSx,
  pageTitleSx,
  primaryButtonSx,
  secondaryButtonSx,
  statusChipSx,
} from "./tefapStyles";

const TefapFormsPage: React.FC = () => {
  const { user, name } = useAuth();
  const { showError, showSuccess } = useNotifications();

  const [forms, setForms] = useState<TefapForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [previewForm, setPreviewForm] = useState<TefapForm | null>(null);
  const [mappingForm, setMappingForm] = useState<TefapForm | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const actor: TefapActor = useMemo(
    () => ({
      uid: user?.uid ?? "",
      name: name ?? user?.email ?? "Unknown",
      email: user?.email ?? "",
    }),
    [name, user]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setForms(await tefapFormService.listForms(true));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to load TEFAP forms.");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleForms = useMemo(
    () => forms.filter((form) => showArchived || form.status === "active"),
    [forms, showArchived]
  );

  const handlePreview = useCallback(
    async (form: TefapForm) => {
      // Cleared first. The dialog opens the moment previewForm is set, so a URL
      // left over from the last preview would render that template under this
      // one's title - long enough, on a slow connection, to archive the wrong
      // form on the strength of it.
      setPreviewUrl("");
      setPreviewForm(form);
      try {
        setPreviewUrl(await tefapFormService.getTemplateUrl(form));
      } catch (error) {
        setPreviewForm(null);
        showError(error instanceof Error ? error.message : "Failed to open the form.");
      }
    },
    [showError]
  );

  const handleClosePreview = useCallback(() => {
    setPreviewForm(null);
    setPreviewUrl("");
  }, []);

  const handleCloseMapping = useCallback(() => {
    setMappingForm(null);
  }, []);

  const handleStatus = useCallback(
    async (form: TefapForm) => {
      const next = form.status === "active" ? "archived" : "active";
      try {
        await tefapFormService.setStatus(form.id, next, actor);
        showSuccess(next === "archived" ? "Form archived." : "Form restored.");
        await load();
      } catch (error) {
        showError(error instanceof Error ? error.message : "Failed to update the form.");
      }
    },
    [actor, load, showError, showSuccess]
  );

  return (
    <Box sx={pageContainerSx}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={pageTitleSx}>
            {mappingForm ? `Edit field mapping - ${mappingForm.name}` : "Upload TEFAP Template"}
          </Typography>
          <Typography variant="body2" sx={pageSubtitleSx}>
            {mappingForm
              ? "Update the fields used by staff when completing this template."
              : "Upload a blank PDF template, map its fields, and confirm the result."}
          </Typography>
        </Box>
        {!mappingForm && (
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                />
              }
              label="Show archived"
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={() => setDownloadOpen(true)}
              disabled={forms.length === 0}
              sx={secondaryButtonSx}
            >
              Export
            </Button>
          </Stack>
        )}
      </Stack>

      {mappingForm ? (
        <FieldMapEditor
          form={mappingForm}
          actor={actor}
          onBack={handleCloseMapping}
          onSaved={() => {
            handleCloseMapping();
            void load();
          }}
        />
      ) : (
        <FormUploadDialog actor={actor} onStepChange={setUploadStep} onSaved={() => void load()} />
      )}

      {!mappingForm && uploadStep === 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ ...pageTitleSx, mb: 1 }}>
            Saved templates
          </Typography>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <LoadingIndicator />
            </Box>
          ) : visibleForms.length === 0 ? (
            <Alert severity="info">
              No TEFAP forms yet. Upload the blank PDF supplied by the state to get started.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={cardSx}>
              <Table size="small">
                <TableHead>
                  <TableRow
                    sx={{
                      "& th": {
                        fontWeight: 700,
                        color: "var(--color-text-medium-alt2)",
                        backgroundColor: "var(--color-background-green-tint)",
                        whiteSpace: "nowrap",
                      },
                    }}
                  >
                    <TableCell>Name</TableCell>
                    <TableCell align="right">Version</TableCell>
                    <TableCell align="right">Fields</TableCell>
                    <TableCell align="right">Pages</TableCell>
                    <TableCell align="right">Cert valid</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Updated</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleForms.map((form) => (
                    <TableRow key={form.id} hover>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, color: "var(--color-text-primary)" }}
                        >
                          {form.name}
                        </Typography>
                        {form.description && (
                          <Typography
                            variant="caption"
                            sx={{ color: "var(--color-text-medium-alt)", display: "block" }}
                          >
                            {form.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{form.version}</TableCell>
                      <TableCell align="right">{form.fields.length}</TableCell>
                      <TableCell align="right">{form.pageCount}</TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={`${form.certValidityMonths} mo`}
                          sx={metaChipSx}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={form.status}
                          sx={statusChipSx(form.status === "active")}
                        />
                      </TableCell>
                      <TableCell>{deliveryDate.toDisplayString(form.updatedAt)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="View the blank form">
                          <IconButton
                            size="small"
                            onClick={() => void handlePreview(form)}
                            sx={{ color: "var(--color-primary)" }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit the field mapping">
                          <IconButton
                            size="small"
                            onClick={() => setMappingForm(form)}
                            sx={{ color: "var(--color-primary)" }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={form.status === "active" ? "Archive" : "Restore"}>
                          <IconButton
                            size="small"
                            onClick={() => void handleStatus(form)}
                            sx={{ color: "var(--color-text-medium-alt)" }}
                          >
                            {form.status === "active" ? (
                              <ArchiveIcon fontSize="small" />
                            ) : (
                              <UnarchiveIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      <BulkDownloadDialog
        open={downloadOpen}
        forms={forms}
        onClose={() => setDownloadOpen(false)}
      />

      <Dialog open={Boolean(previewForm)} onClose={handleClosePreview} maxWidth="md" fullWidth>
        <DialogTitle
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          {previewForm?.name}
          <IconButton onClick={handleClosePreview} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {previewUrl ? (
            <Box
              component="iframe"
              title="TEFAP form"
              src={previewUrl}
              sx={{ width: "100%", height: "70vh", border: "none" }}
            />
          ) : (
            <Box
              sx={{
                height: "70vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LoadingIndicator />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default TefapFormsPage;
