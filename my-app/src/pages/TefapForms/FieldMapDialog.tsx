import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import type {
  TefapActor,
  TefapForm,
  TefapFormField,
  TefapPdfInspection,
} from "../../types/tefap-types";
import { tefapFormService } from "../../services/tefap-form-service";
import { useNotifications } from "../../components/NotificationProvider";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import FieldMapper from "./FieldMapper";
import { primaryButtonSx, quietButtonSx } from "./tefapStyles";
import { reconcileFieldsWithInspection } from "../../utils/tefapFields";

interface FieldMapEditorProps {
  form: TefapForm;
  actor: TefapActor;
  onBack: () => void;
  onSaved: () => void;
}

/**
 * Edits the field map of a template that is already registered.
 *
 * Without this the mapping decided at upload time is final: a template with one
 * field bound to the wrong client value can only be replaced by uploading the
 * same PDF again and archiving the original.
 *
 * The PDF itself is never re-uploaded. Where the template already has
 * submissions the service turns the edit into a new version pointing at the
 * same stored file, because changing where a value lands would alter documents
 * clients have already certified - so the outcome is reported rather than
 * treated as an ordinary save.
 */
const FieldMapEditor: React.FC<FieldMapEditorProps> = ({ form, actor, onBack, onSaved }) => {
  const { showSuccess, showError } = useNotifications();

  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [inspection, setInspection] = useState<TefapPdfInspection | null>(null);
  const [fields, setFields] = useState<TefapFormField[]>([]);
  const [submissionCount, setSubmissionCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const formId = form.id;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        // requireForm rather than the cached row: the mapping is edited against
        // what is stored now, not what the list happened to load earlier.
        const current = await tefapFormService.requireForm(formId);
        const template = await tefapFormService.getTemplateBytes(current);
        const { inspectPdf } = await import("../../utils/tefapPdf");
        const result = await inspectPdf(template);
        const count = await tefapFormService.countSubmissions(formId);

        if (cancelled) return;

        setBytes(template);
        setInspection(result);
        setFields(reconcileFieldsWithInspection(current.fields, result));
        setSubmissionCount(count);
      } catch (error) {
        if (cancelled) return;
        showError(error instanceof Error ? error.message : "Failed to open the field mapping.");
        onBack();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [formId, onBack, showError]);

  const handleBack = useCallback(() => {
    if (saving) return;
    setBytes(null);
    setInspection(null);
    setFields([]);
    setSubmissionCount(null);
    onBack();
  }, [onBack, saving]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { createdNewVersion } = await tefapFormService.saveFieldMap(formId, fields, actor);

      showSuccess(
        createdNewVersion
          ? "Saved as a new version. The old one stays available so its existing submissions " +
              "still regenerate exactly as signed."
          : "Field mapping saved."
      );
      onSaved();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to save the field mapping.");
    } finally {
      setSaving(false);
    }
  }, [actor, fields, formId, onSaved, showError, showSuccess]);

  return (
    <Box>
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <LoadingIndicator />
        </Box>
      )}

      {!loading && inspection && bytes && (
        <Stack spacing={2}>
          {submissionCount !== null && submissionCount > 0 && (
            <Alert severity="info">
              {submissionCount} submission{submissionCount === 1 ? " has" : "s have"} already been
              recorded against this template, so saving creates version {form.version + 1} instead
              of editing this one. The current version is archived but stays readable.
            </Alert>
          )}

          {submissionCount === 0 && (
            <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
              No submissions reference this template yet, so the mapping is edited in place.
            </Typography>
          )}

          <FieldMapper
            templateBytes={bytes}
            inspection={inspection}
            fields={fields}
            onChange={setFields}
          />

          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={handleBack} disabled={saving} sx={quietButtonSx}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSave()}
              disabled={!inspection || saving}
              startIcon={
                saving ? (
                  <CircularProgress size={16} sx={{ color: "var(--color-white)" }} />
                ) : undefined
              }
              sx={primaryButtonSx}
            >
              {saving ? "Saving..." : "Save mapping"}
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
};

export default FieldMapEditor;
