import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
  TefapPdfInspection,
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
import TefapPdfForm from "./TefapPdfForm";

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
  const [templateBytes, setTemplateBytes] = useState<Uint8Array | null>(null);
  const [inspection, setInspection] = useState<TefapPdfInspection | null>(null);
  const [values, setValues] = useState<Map<string, string | boolean>>(new Map());
  const [certExpiresOn, setCertExpiresOn] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [filledBytes, setFilledBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const objectUrlRef = useRef("");

  // Id of a submission that committed while a later step failed. Saving is two
  // writes, and tefapSubmissions is append-only: without this, a failure on the
  // second write reads as "nothing saved" and the retry records a second
  // certification for the same client, form and day.
  const submissionIdRef = useRef("");

  // Mirrors submissionIdRef for rendering. Once the append-only record exists
  // the answers behind it can no longer change, so every control that edits them
  // is locked - otherwise an edit made before the retry would reach the PDF and
  // the client profile while the stored submission kept the old values.
  const [recorded, setRecorded] = useState(false);

  const actor: TefapActor = useMemo(
    () => ({
      uid: user?.uid ?? "",
      name: name ?? user?.email ?? "Unknown",
      email: user?.email ?? "",
    }),
    [name, user]
  );

  const reset = useCallback(() => {
    setStep(0);
    setSelectedForm(null);
    setTemplateBytes(null);
    setInspection(null);
    setValues(new Map());
    setCertExpiresOn("");
    setPreviewUrl("");
    setFilledBytes(null);
    setIssues([]);
    submissionIdRef.current = "";
    setRecorded(false);
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
    async (form: TefapForm) => {
      setLoading(true);
      try {
        const bytes = await tefapFormService.getTemplateBytes(form);
        const { inspectPdf } = await import("../../../utils/tefapPdf");
        const nextInspection = await inspectPdf(bytes);

        setTemplateBytes(bytes);
        setInspection(nextInspection);
      } catch (error) {
        showError(error instanceof Error ? error.message : "Failed to open the TEFAP form.");
        return;
      } finally {
        setLoading(false);
      }

      setSelectedForm(form);
      setValues(toValueMap(buildInitialValues(form.fields, client)));
      setCertExpiresOn(defaultCertExpiry(form.certValidityMonths));
      setIssues([]);
      setStep(1);
    },
    [client, showError]
  );

  const setValue = useCallback(
    (key: string, value: string | boolean) => {
      // The stored submission is append-only, so once it exists these values are
      // what it holds. Refusing the edit here keeps that true no matter which
      // control calls in.
      if (recorded) return;
      setValues((current) => {
        const next = new Map(current);
        next.set(key, value);
        return selectedForm ? applyExclusivity(selectedForm.fields, next, key) : next;
      });
    },
    [recorded, selectedForm]
  );

  const handleReview = useCallback(async () => {
    if (!selectedForm) return;

    const valueList = toValueList(values);
    const problems = validateRequired(selectedForm.fields, valueList);
    setIssues(problems.map((problem) => problem.message));
    if (problems.length > 0) return;

    setLoading(true);
    try {
      const template = templateBytes ?? (await tefapFormService.getTemplateBytes(selectedForm));
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
  }, [selectedForm, showError, templateBytes, values]);

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
      // Skipped when a previous attempt already recorded the submission and
      // only the profile write failed.
      if (!submissionIdRef.current) {
        try {
          const submission = await tefapSubmissionService.createSubmission(
            {
              clientId,
              clientName: `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim(),
              form: selectedForm,
              values: toValueList(values),
              certExpiresOn,
            },
            actor
          );
          submissionIdRef.current = submission.id;
          setRecorded(true);
        } catch (error) {
          showError(error instanceof Error ? error.message : "Failed to save the TEFAP form.");
          return;
        }
      }

      // Written through the client service so the profile's own date handling
      // and audit metadata apply. Profile refreshes its copy via onSubmitted,
      // otherwise its next save would write back the stale certification date.
      try {
        const { clientService } = await import("../../../services/client-service");
        await clientService.updateClient(clientId, {
          tefapCert: Boolean(certExpiresOn),
          tefapCertDate: certExpiresOn,
        });
      } catch (error) {
        // Deliberately distinct from the message above: the form itself is
        // recorded, and only the profile's certification date is behind.
        showError(
          "The TEFAP form was saved, but the client's certification date could not be " +
            `updated: ${error instanceof Error ? error.message : "unknown error"}. ` +
            "Press Retry - the form will not be recorded twice, and its answers are now locked."
        );
        return;
      }

      showSuccess("TEFAP form saved.");
      onSubmitted(certExpiresOn);
      handleDownload();
      reset();
      onClose();
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
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
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

        {step === 1 && selectedForm && templateBytes && inspection && !loading && (
          <Stack spacing={2}>
            {issues.length > 0 && (
              <Alert severity="error">
                {issues.map((issue) => (
                  <div key={issue}>{issue}</div>
                ))}
              </Alert>
            )}

            <TefapPdfForm
              bytes={templateBytes}
              inspection={inspection}
              fields={selectedForm.fields}
              values={values}
              onChange={setValue}
            />
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

            {recorded && (
              <Alert severity="info">
                This form is already recorded and its answers can no longer be changed. Only the
                client&apos;s certification date is still to be updated. To correct an answer,
                cancel and complete the form again.
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
                  disabled={recorded}
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
            {/* Hidden once the submission is recorded: going back would edit
                answers that the stored record can no longer be updated to match. */}
            {!recorded && (
              <Button onClick={() => setStep(1)} disabled={saving} sx={quietButtonSx}>
                Back
              </Button>
            )}
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
              {saving ? "Saving..." : recorded ? "Retry" : "Save"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TefapFillDialog;
