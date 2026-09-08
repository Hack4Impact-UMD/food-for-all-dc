import React, { useCallback, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { TefapActor, TefapFormField, TefapPdfInspection } from "../../types/tefap-types";
import { tefapFormService } from "../../services/tefap-form-service";
import { useNotifications } from "../../components/NotificationProvider";
import FieldMapper from "./FieldMapper";
import { buildFieldsFromInspection } from "./tefapMapping";

interface FormUploadDialogProps {
  open: boolean;
  actor: TefapActor;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_CERT_MONTHS = 12;

const FormUploadDialog: React.FC<FormUploadDialogProps> = ({ open, actor, onClose, onSaved }) => {
  const { showSuccess, showError } = useNotifications();

  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [inspection, setInspection] = useState<TefapPdfInspection | null>(null);
  const [fields, setFields] = useState<TefapFormField[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [certMonths, setCertMonths] = useState(String(DEFAULT_CERT_MONTHS));
  const [inspecting, setInspecting] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setBytes(null);
    setInspection(null);
    setFields([]);
    setName("");
    setDescription("");
    setCertMonths(String(DEFAULT_CERT_MONTHS));
    setInspecting(false);
    setSaving(false);
  }, []);

  const handleClose = useCallback(() => {
    if (saving) return;
    reset();
    onClose();
  }, [onClose, reset, saving]);

  const handleFile = useCallback(
    async (picked: File | undefined) => {
      if (!picked) return;

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
      } catch (error) {
        showError(error instanceof Error ? error.message : "That file could not be read as a PDF.");
      } finally {
        setInspecting(false);
      }
    },
    [showError]
  );

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
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth>
      <DialogTitle>Upload a TEFAP form</DialogTitle>
      <DialogContent dividers>
        {!inspection && (
          <Stack spacing={2} alignItems="flex-start" sx={{ py: 2 }}>
            <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
              Choose the blank PDF supplied by the state. Its fillable fields are detected
              automatically so you can give each one a name.
            </Typography>
            <Button
              variant="contained"
              component="label"
              startIcon={inspecting ? <CircularProgress size={16} /> : <UploadFileIcon />}
              disabled={inspecting}
            >
              {inspecting ? "Reading PDF..." : "Choose PDF"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </Button>
          </Stack>
        )}

        {inspection && bytes && (
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

            <Box>
              <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
                {inspection.pageCount} page(s), {inspection.acroFields.length} fillable field(s)
                found.
              </Typography>
            </Box>

            {inspection.diagnostics.map((diagnostic) => (
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
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={!inspection || !name.trim() || saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {saving ? "Saving..." : "Save form"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FormUploadDialog;
