import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Tooltip,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { saveAs } from "file-saver";
import type {
  TefapActor,
  TefapFieldValue,
  TefapForm,
  TefapSubmission,
} from "../../../types/tefap-types";
import type { ClientProfile } from "../../../types/client-types";
import { tefapFormService } from "../../../services/tefap-form-service";
import {
  defaultCertExpiry,
  tefapSubmissionService,
} from "../../../services/tefap-submission-service";
import { buildInitialValues } from "../../../utils/tefapPrefill";
import {
  applyExclusivity,
  toValueList,
  toValueMap,
  validateRequired,
  visibleFields,
} from "../../../utils/tefapFields";
import { useAuth } from "../../../auth/AuthProvider";
import { useNotifications } from "../../../components/NotificationProvider";
import { deliveryDate } from "../../../utils/deliveryDate";
import { sanitizeFilename } from "../../../utils/csvExport";
import {
  cardSx,
  fieldNameSx,
  metaChipSx,
  metaTextSx,
  primaryButtonSx,
  quietButtonSx,
  secondaryButtonSx,
  selectableCardSx,
} from "../../TefapForms/tefapStyles";

interface TefapFillDialogProps {
  open: boolean;
  clientId: string;
  client: ClientProfile;
  onClose: () => void;
  /** Fires after a submission is saved, with the new certification expiry. */
  onSubmitted: (certExpiresOn: string) => void;
}

const STEPS = ["Choose form", "Fill in", "Review & save"];

export const buildFilledFileName = (
  client: Pick<ClientProfile, "firstName" | "lastName">,
  formName: string,
  when: Date
): string =>
  sanitizeFilename(
    `${client.lastName || "client"}_${client.firstName || ""}_${formName}_` +
      `${deliveryDate.toISODateString(when)}.pdf`
  );

const TefapFillDialog: React.FC<TefapFillDialogProps> = ({
  open,
  clientId,
  client,
  onClose,
  onSubmitted,
}) => {
  const { user, name } = useAuth();
  const { showError, showSuccess } = useNotifications();

  const [step, setStep] = useState(0);
  const [forms, setForms] = useState<TefapForm[]>([]);
  const [history, setHistory] = useState<TefapSubmission[]>([]);
  const [selectedForm, setSelectedForm] = useState<TefapForm | null>(null);
  const [values, setValues] = useState<Map<string, string | boolean>>(new Map());
  const [certExpiresOn, setCertExpiresOn] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [filledBytes, setFilledBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const objectUrlRef = useRef("");

  const actor: TefapActor = useMemo(
    () => ({
      uid: user?.uid ?? "",
      name: name ?? user?.email ?? "Unknown",
      email: user?.email ?? "",
    }),
    [name, user]
  );

  const fields = useMemo(
    () => (selectedForm ? visibleFields(selectedForm.fields) : []),
    [selectedForm]
  );

  const reset = useCallback(() => {
    setStep(0);
    setSelectedForm(null);
    setValues(new Map());
    setCertExpiresOn("");
    setPreviewUrl("");
    setFilledBytes(null);
    setIssues([]);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const [available, past] = await Promise.all([
          tefapFormService.listForms(),
          tefapSubmissionService.listForClient(clientId),
        ]);
        if (cancelled) return;
        setForms(available);
        setHistory(past);
      } catch (error) {
        if (!cancelled) {
          showError(error instanceof Error ? error.message : "Failed to load TEFAP forms.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, open, showError]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  const handleChooseForm = useCallback(
    (form: TefapForm) => {
      setSelectedForm(form);
      setValues(toValueMap(buildInitialValues(form.fields, client)));
      setCertExpiresOn(defaultCertExpiry(form.certValidityMonths));
      setIssues([]);
      setStep(1);
    },
    [client]
  );

  const setValue = useCallback(
    (key: string, value: string | boolean) => {
      setValues((current) => {
        const next = new Map(current);
        next.set(key, value);
        return selectedForm ? applyExclusivity(selectedForm.fields, next, key) : next;
      });
    },
    [selectedForm]
  );

  const handleReview = useCallback(async () => {
    if (!selectedForm) return;

    const valueList = toValueList(values);
    const problems = validateRequired(selectedForm.fields, valueList);
    setIssues(problems.map((problem) => problem.message));
    if (problems.length > 0) return;

    setLoading(true);
    try {
      const template = await tefapFormService.getTemplateBytes(selectedForm);
      const { fillPdf } = await import("../../../utils/tefapPdf");
      const { bytes, warnings } = await fillPdf(template, selectedForm.fields, valueList);

      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = url;

      setFilledBytes(bytes);
      setPreviewUrl(url);
      setIssues(warnings.map((warning) => warning.message));
      setStep(2);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to build the form.");
    } finally {
      setLoading(false);
    }
  }, [selectedForm, showError, values]);

  const handleDownload = useCallback(() => {
    if (!filledBytes || !selectedForm) return;

    saveAs(
      new Blob([filledBytes], { type: "application/pdf" }),
      buildFilledFileName(client, selectedForm.name, new Date())
    );
  }, [client, filledBytes, selectedForm]);

  const handleSave = useCallback(async () => {
    if (!selectedForm) return;

    setSaving(true);
    try {
      await tefapSubmissionService.createSubmission(
        {
          clientId,
          clientName: `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim(),
          form: selectedForm,
          values: toValueList(values),
          certExpiresOn,
        },
        actor
      );

      // Written through the client service so the profile's own date handling
      // and audit metadata apply. Profile refreshes its copy via onSubmitted,
      // otherwise its next save would write back the stale certification date.
      const { clientService } = await import("../../../services/client-service");
      await clientService.updateClient(clientId, {
        tefapCert: Boolean(certExpiresOn),
        tefapCertDate: certExpiresOn,
      });

      showSuccess("TEFAP form saved.");
      onSubmitted(certExpiresOn);
      handleDownload();
      reset();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to save the TEFAP form.");
    } finally {
      setSaving(false);
    }
  }, [
    actor,
    certExpiresOn,
    client,
    clientId,
    handleDownload,
    onClose,
    onSubmitted,
    reset,
    selectedForm,
    showError,
    showSuccess,
    values,
  ]);

  const handleRedownload = useCallback(
    async (submission: TefapSubmission) => {
      setLoading(true);
      try {
        const form = await tefapFormService.getForm(submission.formId);
        if (!form) throw new Error("That form's template is no longer available.");

        const template = await tefapFormService.getTemplateBytes(form);
        const { fillPdf } = await import("../../../utils/tefapPdf");
        const { bytes } = await fillPdf(template, form.fields, submission.values);

        saveAs(
          new Blob([bytes], { type: "application/pdf" }),
          buildFilledFileName(client, submission.formName, submission.submittedAt)
        );
      } catch (error) {
        showError(error instanceof Error ? error.message : "Failed to rebuild that form.");
      } finally {
        setLoading(false);
      }
    },
    [client, showError]
  );

  const handleClose = useCallback(() => {
    if (saving) return;
    reset();
    onClose();
  }, [onClose, reset, saving]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, color: "var(--color-primary)" }}>TEFAP form</DialogTitle>
      <DialogContent dividers>
        <Stepper
          activeStep={step}
          sx={{
            mb: 3,
            "& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed": {
              color: "var(--color-primary)",
            },
            "& .MuiStepLabel-label.Mui-active": { fontWeight: 600 },
          }}
        >
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {step === 0 && !loading && (
          <Stack spacing={2}>
            {forms.length === 0 ? (
              <Alert severity="info">
                No TEFAP forms have been set up yet. An admin can add one from the TEFAP Forms page.
              </Alert>
            ) : (
              <Stack spacing={1}>
                {forms.map((form) => (
                  <Paper
                    key={form.id}
                    variant="outlined"
                    component="button"
                    type="button"
                    onClick={() => handleChooseForm(form)}
                    sx={selectableCardSx(false)}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={fieldNameSx} noWrap>
                          {form.name}
                        </Typography>
                        {form.description && (
                          <Typography variant="caption" sx={metaTextSx} noWrap display="block">
                            {form.description}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        size="small"
                        label={`Valid ${form.certValidityMonths} mo`}
                        sx={metaChipSx}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}

            {history.length > 0 && (
              <>
                <Divider />
                <Typography variant="subtitle2">Previously completed</Typography>
                <Stack spacing={1}>
                  {history.map((submission) => (
                    <Paper key={submission.id} variant="outlined" sx={{ ...cardSx, p: 1.5 }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={fieldNameSx} noWrap>
                            {submission.formName}
                          </Typography>
                          <Typography variant="caption" sx={metaTextSx}>
                            {deliveryDate.toDisplayString(submission.submittedAt)} ·{" "}
                            {submission.submittedBy.name}
                          </Typography>
                        </Box>
                        <Tooltip title="Download a copy">
                          <IconButton
                            size="small"
                            onClick={() => void handleRedownload(submission)}
                            sx={{ color: "var(--color-primary)" }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </>
            )}
          </Stack>
        )}

        {step === 1 && selectedForm && !loading && (
          <Stack spacing={2}>
            {issues.length > 0 && (
              <Alert severity="error">
                {issues.map((issue) => (
                  <div key={issue}>{issue}</div>
                ))}
              </Alert>
            )}

            {fields.map((field) =>
              field.type === "checkbox" ? (
                <FormControlLabel
                  key={field.key}
                  control={
                    <Checkbox
                      checked={values.get(field.key) === true}
                      onChange={(event) => setValue(field.key, event.target.checked)}
                    />
                  }
                  label={
                    <span>
                      {field.label}
                      {field.required && " *"}
                    </span>
                  }
                />
              ) : (
                <TextField
                  key={field.key}
                  label={field.label}
                  required={field.required}
                  type={field.type === "date" ? "date" : "text"}
                  multiline={field.type === "multiline"}
                  minRows={field.type === "multiline" ? 2 : undefined}
                  InputLabelProps={field.type === "date" ? { shrink: true } : undefined}
                  value={String(values.get(field.key) ?? "")}
                  onChange={(event) => setValue(field.key, event.target.value)}
                  fullWidth
                />
              )
            )}
          </Stack>
        )}

        {step === 2 && selectedForm && !loading && (
          <Stack spacing={2}>
            {issues.length > 0 && (
              <Alert severity="warning">
                {issues.map((issue) => (
                  <div key={issue}>{issue}</div>
                ))}
              </Alert>
            )}

            <Paper variant="outlined" sx={{ ...cardSx, p: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ sm: "flex-start" }}
                justifyContent="space-between"
              >
                <TextField
                  size="small"
                  label="Certification valid until"
                  type="date"
                  value={certExpiresOn}
                  onChange={(event) => setCertExpiresOn(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText={`Suggested: ${selectedForm.certValidityMonths} mo`}
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={selectedForm.name} sx={metaChipSx} />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownload}
                    sx={secondaryButtonSx}
                  >
                    PDF
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Box
              component="iframe"
              title="Completed TEFAP form"
              src={previewUrl}
              sx={{ width: "100%", height: "55vh", border: "1px solid rgba(0,0,0,0.12)" }}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving} sx={quietButtonSx}>
          Cancel
        </Button>
        {step === 1 && (
          <>
            <Button onClick={() => setStep(0)} sx={quietButtonSx}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleReview()}
              disabled={loading}
              sx={primaryButtonSx}
            >
              Review
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Button onClick={() => setStep(1)} disabled={saving} sx={quietButtonSx}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSave()}
              disabled={saving}
              startIcon={
                saving ? (
                  <CircularProgress size={16} sx={{ color: "var(--color-white)" }} />
                ) : undefined
              }
              sx={primaryButtonSx}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TefapFillDialog;
