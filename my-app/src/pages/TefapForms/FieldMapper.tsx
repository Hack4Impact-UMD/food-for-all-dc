import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import type { TefapFormField, TefapPdfInspection } from "../../types/tefap-types";
import { TEFAP_CLIENT_FIELD_SOURCES } from "../../utils/tefapPrefill";
import {
  annotationsForFields,
  isSharedWidgetField,
  reindex,
  splitSharedField,
} from "./tefapMapping";

interface FieldMapperProps {
  templateBytes: Uint8Array;
  inspection: TefapPdfInspection;
  fields: TefapFormField[];
  onChange: (fields: TefapFormField[]) => void;
}

const FIELD_TYPES: Array<{ value: TefapFormField["type"]; label: string }> = [
  { value: "text", label: "Text" },
  { value: "multiline", label: "Long text" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "checkbox", label: "Checkbox" },
];

/**
 * Maps a template's fields to friendly names, types, and prefills.
 *
 * The preview is the point of this screen. Form authors name fields carelessly,
 * so the numbered boxes drawn on the page are what let an admin see that the
 * field named "Frequency" is actually the Weekly checkbox.
 */
const FieldMapper: React.FC<FieldMapperProps> = ({
  templateBytes,
  inspection,
  fields,
  onChange,
}) => {
  const [selectedKey, setSelectedKey] = useState<string | undefined>(fields[0]?.key);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewError, setPreviewError] = useState<string>("");
  const objectUrlRef = useRef<string>("");

  const annotations = useMemo(
    () => annotationsForFields(fields, inspection, selectedKey),
    [fields, inspection, selectedKey]
  );

  // Rebuilding the preview means re-rendering the whole PDF, so it is keyed on
  // what actually moves a box rather than on every keystroke in a label.
  const annotationSignature = useMemo(
    () =>
      annotations
        .map((a) => `${a.page}:${a.x}:${a.y}:${a.width}:${a.height}:${a.label}:${a.highlighted}`)
        .join("|"),
    [annotations]
  );

  useEffect(() => {
    let cancelled = false;

    const build = async () => {
      try {
        const { annotatePdf } = await import("../../utils/tefapPdf");
        const bytes = await annotatePdf(templateBytes, annotations);
        if (cancelled) return;

        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = url;
        setPreviewUrl(url);
        setPreviewError("");
      } catch (error) {
        if (!cancelled) {
          setPreviewError(error instanceof Error ? error.message : "Preview failed to render.");
        }
      }
    };

    void build();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateBytes, annotationSignature]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  const updateField = useCallback(
    (key: string, patch: Partial<TefapFormField>) => {
      onChange(fields.map((field) => (field.key === key ? { ...field, ...patch } : field)));
    },
    [fields, onChange]
  );

  const handleSplit = useCallback(
    (key: string) => {
      onChange(splitSharedField(fields, key, inspection));
    },
    [fields, inspection, onChange]
  );

  const handleRemove = useCallback(
    (key: string) => {
      onChange(reindex(fields.filter((field) => field.key !== key)));
    },
    [fields, onChange]
  );

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" },
        gap: 2,
        alignItems: "start",
      }}
    >
      <Box sx={{ position: { md: "sticky" }, top: 0 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: "var(--color-text-secondary)" }}>
          Numbered boxes match the list. The highlighted box is the field you are editing.
        </Typography>
        {previewError ? (
          <Alert severity="warning">{previewError}</Alert>
        ) : (
          <Box
            component="iframe"
            title="Form preview"
            src={previewUrl}
            sx={{
              width: "100%",
              height: { xs: 420, md: 640 },
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 1,
              backgroundColor: "var(--color-white)",
            }}
          />
        )}
      </Box>

      <Stack spacing={1.5}>
        {fields.length === 0 && (
          <Alert severity="info">
            This PDF has no fillable fields to map. Support for placing fields by hand is not
            available yet.
          </Alert>
        )}

        {fields.map((field, index) => {
          const shared = isSharedWidgetField(field, inspection);
          const isSelected = field.key === selectedKey;

          return (
            <Paper
              key={field.key}
              variant="outlined"
              onClick={() => setSelectedKey(field.key)}
              sx={{
                p: 1.5,
                cursor: "pointer",
                borderColor: isSelected ? "var(--color-primary)" : undefined,
                borderWidth: isSelected ? 2 : 1,
                opacity: field.hidden ? 0.6 : 1,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Chip label={index + 1} size="small" color={isSelected ? "primary" : "default"} />
                <TextField
                  size="small"
                  label="Label"
                  value={field.label}
                  onChange={(event) => updateField(field.key, { label: event.target.value })}
                  sx={{ flexGrow: 1 }}
                />
                <Tooltip title={field.hidden ? "Show to filler" : "Hide from filler"}>
                  <IconButton
                    size="small"
                    onClick={() => updateField(field.key, { hidden: !field.hidden })}
                  >
                    {field.hidden ? (
                      <VisibilityOffIcon fontSize="small" />
                    ) : (
                      <VisibilityIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Stack>

              <Typography
                variant="caption"
                sx={{ color: "var(--color-text-secondary)", display: "block", mb: 1 }}
              >
                {field.placement.kind === "acroform"
                  ? `PDF field: ${field.placement.pdfFieldName}`
                  : `Drawn on page ${field.placement.page}`}
              </Typography>

              {shared && (
                <Alert
                  severity="warning"
                  sx={{ mb: 1 }}
                  action={
                    <Button
                      size="small"
                      startIcon={<CallSplitIcon />}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSplit(field.key);
                      }}
                    >
                      Split
                    </Button>
                  }
                >
                  This one PDF field controls several boxes, so they cannot be answered
                  independently. Split it to give each box its own answer.
                </Alert>
              )}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
                <TextField
                  select
                  size="small"
                  label="Type"
                  value={field.type}
                  onChange={(event) =>
                    updateField(field.key, { type: event.target.value as TefapFormField["type"] })
                  }
                  sx={{ minWidth: 130 }}
                >
                  {FIELD_TYPES.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  size="small"
                  label="Prefill from"
                  value={field.prefill.source}
                  onChange={(event) =>
                    updateField(field.key, {
                      prefill: {
                        source: event.target.value as TefapFormField["prefill"]["source"],
                      },
                    })
                  }
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="none">Nothing</MenuItem>
                  <MenuItem value="client">Client profile</MenuItem>
                  <MenuItem value="static">Fixed value</MenuItem>
                </TextField>

                {field.prefill.source === "client" && (
                  <TextField
                    select
                    size="small"
                    label="Client value"
                    value={field.prefill.clientKey ?? ""}
                    onChange={(event) =>
                      updateField(field.key, {
                        prefill: { source: "client", clientKey: event.target.value },
                      })
                    }
                    sx={{ minWidth: 180 }}
                  >
                    {TEFAP_CLIENT_FIELD_SOURCES.map((source) => (
                      <MenuItem key={source.key} value={source.key}>
                        {source.group}: {source.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {field.prefill.source === "static" && (
                  <TextField
                    size="small"
                    label="Fixed value"
                    value={field.prefill.staticValue ?? ""}
                    onChange={(event) =>
                      updateField(field.key, {
                        prefill: { source: "static", staticValue: event.target.value },
                      })
                    }
                    sx={{ minWidth: 180 }}
                  />
                )}
              </Stack>

              <Stack direction="row" spacing={2} alignItems="center">
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={field.required}
                      onChange={(event) =>
                        updateField(field.key, { required: event.target.checked })
                      }
                    />
                  }
                  label="Required"
                />
                <Button
                  size="small"
                  color="error"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemove(field.key);
                  }}
                >
                  Remove
                </Button>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

export default FieldMapper;
