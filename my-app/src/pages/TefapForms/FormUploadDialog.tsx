import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Chip,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { TefapActor, TefapFormField, TefapPdfInspection } from "../../types/tefap-types";
import type { ClientProfile } from "../../types/client-types";
import { MAX_TEMPLATE_BYTES, tefapFormService } from "../../services/tefap-form-service";
import { clientService } from "../../services/client-service";
import { useNotifications } from "../../components/NotificationProvider";
import { buildInitialValues } from "../../utils/tefapPrefill";
import FieldMapper from "./FieldMapper";
import { buildFieldsFromInspection } from "./tefapMapping";
import {
  metaChipSx,
  primaryButtonSx,
  quietButtonSx,
  secondaryButtonSx,
} from "./tefapStyles";

const DEFAULT_CERT_MONTHS = 12;
const STEPS = ["Upload", "Map fields", "Preview & submit"];

const megabytes = (bytes: number): string => `${Math.round((bytes / 1024 / 1024) * 10) / 10}MB`;

interface FormUploadDialogProps {
  actor: TefapActor;
  onStepChange: (step: number) => void;
  onSaved: () => void;
}

const FormUploadDialog: React.FC<FormUploadDialogProps> = ({
  actor,
  onStepChange,
  onSaved,
}) => {
  const { showSuccess, showError } = useNotifications();

  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [inspection, setInspection] = useState<TefapPdfInspection | null>(null);
  const [fields, setFields] = useState<TefapFormField[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [certMonths, setCertMonths] = useState(String(DEFAULT_CERT_MONTHS));
  const [inspecting, setInspecting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [exampleClient, setExampleClient] = useState<ClientProfile | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const previewUrlRef = useRef("");

  const reset = useCallback(() => {
    setFile(null);
    setBytes(null);
    setInspection(null);
    setFields([]);
    setName("");
    setDescription("");
    setCertMonths(String(DEFAULT_CERT_MONTHS));
    setInspecting(false);
    setDragging(false);
    setStep(0);
    onStepChange(0);
    setPreviewing(false);
    setExampleClient(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreviewUrl("");
    setSaving(false);
  }, [onStepChange]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  const handleFile = useCallback(
    async (picked: File | undefined) => {
      if (!picked) return;

      // Checked before the file is read. createForm enforces the same limit,
      // but only at save time - by which point the PDF has been buffered,
      // inspected, previewed and hand-mapped, and all of that work is lost.
      if (picked.size > MAX_TEMPLATE_BYTES) {
        showError(
          `"${picked.name}" is ${megabytes(picked.size)}, over the ` +
            `${megabytes(MAX_TEMPLATE_BYTES)} limit for a template.`
        );
        return;
      }

      setInspecting(true);
      try {
        const buffer = new Uint8Array(await picked.arrayBuffer());
        const { inspectPdf } = await import("../../utils/tefapPdf");
        const result = await inspectPdf(buffer);

        setFile(picked);
        setBytes(buffer);
        setInspection(result);
        setFields(buildFieldsFromInspection(result));
        setName((current) => current || picked.name.replace(/\.pdf$/i, ""));
        setStep(1);
        onStepChange(1);
      } catch (error) {
        showError(error instanceof Error ? error.message : "That file could not be read as a PDF.");
      } finally {
        setInspecting(false);
      }
    },
    [onStepChange, showError]
  );

  const handlePreview = useCallback(async () => {
    if (!bytes) return;

    setPreviewing(true);
    try {
      const { clients } = await clientService.getAllClients(1);
      const client = clients[0] ?? null;

      const { fillPdf } = await import("../../utils/tefapPdf");
      const result = await fillPdf(bytes, fields, buildInitialValues(fields, client));
      const url = URL.createObjectURL(new Blob([result.bytes], { type: "application/pdf" }));
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setExampleClient(client);
      setStep(2);
      onStepChange(2);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to build the example preview.");
    } finally {
      setPreviewing(false);
    }
  }, [bytes, fields, onStepChange, showError]);

  const handleSave = useCallback(async () => {
    if (!file || !bytes || !inspection) return;

    setSaving(true);
    try {
      await tefapFormService.createForm(
        {
          name,
          description,
          file,
          fileName: file.name,
          pageCount: inspection.pageCount,
          fields,
          certValidityMonths: Number(certMonths) || DEFAULT_CERT_MONTHS,
        },
        actor
      );

      showSuccess(`"${name}" is ready to use.`);
      reset();
      onSaved();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to save the form.");
    } finally {
      setSaving(false);
    }
  }, [
    actor,
    bytes,
    certMonths,
    description,
    fields,
    file,
    inspection,
    name,
    onSaved,
    reset,
    showError,
    showSuccess,
  ]);

  return (
    <Box>
      <Stepper
        activeStep={step}
        alternativeLabel
        sx={{
          mb: 3,
          "& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed": {
            color: "var(--color-primary)",
          },
          "& .MuiStepConnector-line": {
            borderColor: "var(--color-primary)",
            borderTopWidth: 3,
            opacity: 0.35,
          },
          "& .MuiStepConnector-root.Mui-active .MuiStepConnector-line, & .MuiStepConnector-root.Mui-completed .MuiStepConnector-line":
            {
              borderColor: "var(--color-primary)",
              opacity: 1,
            },
        }}
      >
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {step === 0 && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Template file
          </Typography>
          <Box
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void handleFile(event.dataTransfer.files[0]);
            }}
            sx={{
              minHeight: 220,
              border: "1px dashed var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              backgroundColor: dragging
                ? "var(--color-background-green-light)"
                : "var(--color-background-green-tint)",
              transition: "background-color 0.15s ease",
            }}
          >
            <Stack spacing={1} alignItems="center">
              <UploadFileIcon sx={{ fontSize: 42, color: "var(--color-primary)" }} />
              <Typography variant="body2">Drag and drop a PDF file here</Typography>
              <Typography variant="caption">or</Typography>
              <Button
                variant="contained"
                component="label"
                disabled={inspecting}
                sx={primaryButtonSx}
              >
                {inspecting ? "Reading..." : "Choose file"}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
              </Button>
              <Typography variant="caption" sx={{ color: "var(--color-text-medium-alt)" }}>
                Only PDF files are accepted.
              </Typography>
            </Stack>
          </Box>
        </Paper>
      )}

      {step === 1 && inspection && bytes && (
        <Box>
        <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Form name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Certification valid for (months)"
                value={certMonths}
                onChange={(event) => setCertMonths(event.target.value.replace(/[^0-9]/g, ""))}
                sx={{ minWidth: 220 }}
              />
            </Stack>

            <TextField
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />

            <Stack direction="row" spacing={1}>
              <Chip size="small" label={`${inspection.pageCount} pages`} sx={metaChipSx} />
              <Chip
                size="small"
                label={`${inspection.acroFields.length} fillable fields`}
                sx={metaChipSx}
              />
            </Stack>

            {inspection.diagnostics
              .map((diagnostic) => ({
                ...diagnostic,
                fieldNames: diagnostic.fieldNames.filter((fieldName) =>
                  fields.some(
                    (field) =>
                      (field.placement.kind === "acroform" &&
                        field.placement.pdfFieldName === fieldName) ||
                      field.radioOptions?.some(
                        (option) =>
                          option.placement.kind === "acroform" &&
                          option.placement.pdfFieldName === fieldName
                      )
                  )
                ),
              }))
              .filter(
                (diagnostic) =>
                  diagnostic.fieldNames.length > 0 || diagnostic.code === "no-acroform-fields"
              )
              .map((diagnostic) => (
              <Alert
                key={diagnostic.code}
                severity={diagnostic.code === "no-acroform-fields" ? "error" : "warning"}
              >
                <AlertTitle>
                  {diagnostic.code === "shared-widgets" && "Some fields control more than one box"}
                  {diagnostic.code === "uninformative-name" && "Some fields have unhelpful names"}
                  {diagnostic.code === "no-acroform-fields" && "This PDF is not fillable"}
                </AlertTitle>
                {diagnostic.message}
                {diagnostic.fieldNames.length > 0 && (
                  <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
                    {diagnostic.fieldNames.join(", ")}
                  </Typography>
                )}
              </Alert>
              ))}

            <FieldMapper
              templateBytes={bytes}
              inspection={inspection}
              fields={fields}
              onChange={setFields}
            />
        </Stack>
        </Box>
      )}

      {step === 2 && (
        <Stack spacing={2}>
          <Alert severity="info">
            Previewing the mapped form with {exampleClient?.firstName} {exampleClient?.lastName},
            the first client returned from client-profile2. This does not change their record.
          </Alert>
          <Box
            component="iframe"
            title="Filled TEFAP template preview"
            src={previewUrl}
            sx={{ width: "100%", height: "70vh", border: "1px solid var(--color-border-medium)" }}
          />
        </Stack>
      )}

      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mt: 3 }}>
        {step > 0 && (
          <Button
            onClick={() => {
              const previousStep = step - 1;
              setStep(previousStep);
              onStepChange(previousStep);
            }}
            disabled={saving || previewing}
            sx={quietButtonSx}
          >
            Back
          </Button>
        )}
        {step === 1 && (
          <Button
            variant="contained"
            onClick={() => void handlePreview()}
            disabled={!name.trim() || previewing}
            startIcon={previewing ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={primaryButtonSx}
          >
            {previewing ? "Building preview..." : "Preview"}
          </Button>
        )}
        {step === 2 && (
          <Stack direction="row" spacing={1}>
            <Button
              onClick={() => {
                setStep(1);
                onStepChange(1);
              }}
              disabled={saving}
              sx={secondaryButtonSx}
            >
              Edit mapping
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSave()}
              disabled={!name.trim() || saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={primaryButtonSx}
            >
              {saving ? "Saving..." : "Save template"}
            </Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default FormUploadDialog;
