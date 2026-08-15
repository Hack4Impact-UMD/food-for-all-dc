// Client Query Tool — read-only, allowlisted ad-hoc filter builder for client-profile2.
// UI is responsible only for filter state, validation feedback, and rendering controls.
// All Firestore query construction/execution lives in services/client-query-service.ts.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../auth/firebaseConfig";
import dataSources from "../../config/dataSources";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import { clientService } from "../../services/client-service";
import { runClientQuery } from "../../services/client-query-service";
import { exportRowsWithColumns, RowData } from "../../components/Spreadsheet/export";
import { getNestedValue } from "../../utils/misc";
import {
  COLLECTIONS,
  COLLECTION_KEYS,
  CollectionKey,
  createEmptyFilter,
  getFieldDef,
  OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
  QueryFilter,
} from "../../types/query-tool-types";
import { validateFilters } from "../../utils/queryToolValidation";
import FilterValueInput from "./FilterValueInput";

type QueryState = "idle" | "loading" | "results" | "empty" | "error";

interface ResultColumn {
  key: string;
  label: string;
  getValue: (row: RowData) => unknown;
}

const formatCellValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return value.map((v) => (
      <Chip key={String(v)} label={String(v)} size="small" sx={{ marginRight: 0.5, marginBottom: 0.5 }} />
    ));
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  return String(value);
};

const ClientQueryTool: React.FC = () => {
  const [collectionKey, setCollectionKey] = useState<CollectionKey>("clients");
  const [filters, setFilters] = useState<QueryFilter[]>([createEmptyFilter()]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [state, setState] = useState<QueryState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [results, setResults] = useState<RowData[]>([]);
  const [exportingMode, setExportingMode] = useState<"query" | "all" | "">("");
  const [exportError, setExportError] = useState("");
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [referralOrgOptions, setReferralOrgOptions] = useState<string[]>([]);
  const [fieldOptions, setFieldOptions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let isMounted = true;
    setFieldOptions({});

    const collectionConfigKey = COLLECTIONS[collectionKey].collectionKey as keyof typeof dataSources.firebase;
    const firestoreCollectionName = dataSources.firebase[collectionConfigKey];
    getDocs(collection(db, firestoreCollectionName))
      .then((snapshot) => {
        if (!isMounted) return;
        const nextOptions: Record<string, Set<string>> = {};
        COLLECTIONS[collectionKey].fields.forEach((fieldDef) => {
          if (!fieldDef.computed) {
            nextOptions[fieldDef.field] = new Set();
          }
        });
        snapshot.docs.forEach((document) => {
          const data = document.data();
          Object.keys(nextOptions).forEach((field) => {
            const fieldValue = getNestedValue(data, field);
            const values = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
            values.forEach((value) => {
              if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
                nextOptions[field].add(String(value).trim());
              }
            });
          });
        });
        setFieldOptions(
          Object.fromEntries(
            Object.entries(nextOptions).map(([field, values]) => [
              field,
              Array.from(values).sort((a, b) => a.localeCompare(b)),
            ])
          )
        );
      })
      .catch(() => undefined);

    clientService
      .getAllTags()
      .then((tags) => {
        if (isMounted) setTagOptions(tags);
      })
      .catch(() => undefined);

    getDocs(collection(db, dataSources.firebase.caseWorkersCollection))
      .then((snapshot) => {
        if (!isMounted) return;
        const orgs = Array.from(
          new Set(
            snapshot.docs
              .map((d) => (d.data().organization as string) || "")
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));
        setReferralOrgOptions(orgs);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [collectionKey]);

  const updateFilter = useCallback((id: string, updates: Partial<QueryFilter>) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const handleCollectionChange = useCallback((next: CollectionKey) => {
    setCollectionKey(next);
    setFilters([createEmptyFilter()]);
    setFieldErrors({});
    setFormErrors([]);
    setResults([]);
    setState("idle");
    setErrorMessage("");
  }, []);

  const handleFieldChange = useCallback(
    (id: string, field: string) => {
      const fieldDef = getFieldDef(collectionKey, field);
      const validOperators = fieldDef ? OPERATORS_BY_TYPE[fieldDef.type] : [];
      updateFilter(id, {
        field,
        operator: validOperators.length === 1 ? validOperators[0] : "",
        value: "",
      });
    },
    [updateFilter, collectionKey]
  );

  const handleAddFilter = useCallback(() => {
    setFilters((prev) => [...prev, createEmptyFilter()]);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setFilters((prev) => (prev.length === 1 ? prev : prev.filter((f) => f.id !== id)));
  }, []);

  const handleClear = useCallback(() => {
    setFilters([createEmptyFilter()]);
    setFieldErrors({});
    setFormErrors([]);
    setResults([]);
    setState("idle");
    setErrorMessage("");
  }, []);

  const handleRunQuery = useCallback(async () => {
    const validation = validateFilters(collectionKey, filters);
    setFieldErrors(validation.fieldErrors);
    setFormErrors(validation.formErrors);
    if (!validation.valid) {
      return;
    }

    setState("loading");
    setErrorMessage("");
    // Selecting Field/Operator/Value dropdowns can leave the page scrolled down
    // (the browser scrolls to reveal an open dropdown menu). Reset to the top on
    // submit, same as a normal "back to top on search" pattern, so the tool is
    // where the user expects it when results come back.
    window.scrollTo(0, 0);
    try {
      const result = await runClientQuery(collectionKey, filters);
      setResults(result.rows);
      setState(result.rows.length === 0 ? "empty" : "results");
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong running this query. Please try again."
      );
    }
  }, [filters, collectionKey]);

  const collectionDef = COLLECTIONS[collectionKey];

  // Full-row result columns: friendly Name + every allowlisted field for the
  // selected collection + any joined fields from a related collection.
  const resultColumns: ResultColumn[] = useMemo(() => {
    const columns: ResultColumn[] = [
      {
        key: "__name",
        label: "Name",
        getValue: (row) =>
          collectionDef.nameFields
            .map((field) => getNestedValue(row, field))
            .filter(Boolean)
            .join(", "),
      },
      ...collectionDef.fields.map((field) => ({
        key: field.field,
        label: field.label,
        getValue: (row: RowData) => getNestedValue(row, field.field),
      })),
    ];

    if (collectionKey === "clients") {
      columns.push({
        key: "lastDeliveryDate",
        label: "Last Delivery Date",
        getValue: (row) => row.lastDeliveryDate,
      });
    }

    if (collectionDef.join) {
      collectionDef.join.fields.forEach((field) => {
        columns.push({
          key: `join.${field.field}`,
          label: field.label,
          getValue: (row) => row[`join.${field.field}`],
        });
      });
    }

    return columns;
  }, [collectionDef, collectionKey]);

  const handleExportQueryResults = useCallback(async () => {
    setExportError("");
    setExportingMode("query");
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    try {
      exportRowsWithColumns(results, resultColumns, `${collectionKey}_query_results.csv`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Something went wrong exporting the data.");
    } finally {
      setExportingMode("");
    }
  }, [results, resultColumns, collectionKey]);

  const handleExportAll = useCallback(async () => {
    try {
      setExportingMode("all");
      setExportError("");
      const [allRows] = await Promise.all([
        runClientQuery(collectionKey, []),
        new Promise<void>((resolve) => setTimeout(resolve, 500)),
      ]);
      exportRowsWithColumns(allRows.rows, resultColumns, `${collectionKey}_all.csv`);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Something went wrong exporting the data."
      );
    } finally {
      setExportingMode("");
    }
  }, [collectionKey, resultColumns]);

  return (
    <Box
      sx={{ padding: 3, paddingX: { xs: 3, md: 6 }, maxWidth: 1400, marginX: "auto" }}
    >
      <Box>
        <Box sx={{ marginBottom: 2 }}>
          <Typography variant="h5" sx={{ color: "var(--color-primary)", fontWeight: 600 }}>
            Ad-Hoc Query Tool
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--color-border-black)" }}>
            Find information safely using filters. This tool is read-only.
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 2,
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <TextField
            select
            label="Collection"
            size="small"
            value={collectionKey}
            onChange={(e) => handleCollectionChange(e.target.value as CollectionKey)}
            sx={{ minWidth: 220 }}
          >
            {COLLECTION_KEYS.map((key) => (
              <MenuItem key={key} value={key}>
                {COLLECTIONS[key].label}
              </MenuItem>
            ))}
          </TextField>

          <Alert
            icon={<LockIcon fontSize="inherit" />}
            severity="info"
            sx={{ backgroundColor: "var(--color-background-green-light)" }}
          >
            <strong>Read Only</strong> — This tool views information only. Use the main app to add,
            edit, or manage client records.
          </Alert>
        </Box>

        <Card sx={{ padding: 2, marginBottom: 0 }}>
        <TableContainer>
          <Table size="small" aria-label="Filter builder">
            <TableHead>
              <TableRow>
                <TableCell>Field</TableCell>
                <TableCell>Operator</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Value</TableCell>
                <TableCell aria-label="Actions" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filters.map((filter) => {
                const fieldDef = getFieldDef(collectionKey, filter.field);
                const validOperators = fieldDef ? OPERATORS_BY_TYPE[fieldDef.type] : [];
                const rowError = fieldErrors[filter.id];
                return (
                  <TableRow key={filter.id}>
                    <TableCell sx={{ minWidth: 200 }}>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        label="Field"
                        id={`${filter.id}-field`}
                        value={filter.field}
                        onChange={(e) => handleFieldChange(filter.id, e.target.value)}
                        error={Boolean(rowError) && !filter.field}
                        helperText={!filter.field ? rowError : undefined}
                      >
                        {collectionDef.fields.map((f) => (
                          <MenuItem key={f.field} value={f.field}>
                            {f.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        label="Operator"
                        id={`${filter.id}-operator`}
                        value={filter.operator}
                        disabled={!fieldDef}
                        error={Boolean(rowError) && Boolean(filter.field) && !filter.operator}
                        helperText={filter.field && !filter.operator ? rowError : undefined}
                        onChange={(e) =>
                          updateFilter(filter.id, { operator: e.target.value as QueryFilter["operator"] })
                        }
                      >
                        {validOperators.map((op) => (
                          <MenuItem key={op} value={op}>
                            {OPERATOR_LABELS[op]} ({op})
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      {fieldDef && (
                        <Chip
                          label={fieldDef.type}
                          size="small"
                          sx={{ backgroundColor: "var(--color-background-green-tint)" }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      {fieldDef ? (
                        <FilterValueInput
                          id={filter.id}
                          fieldDef={fieldDef}
                          operator={filter.operator}
                          value={filter.value}
                          onChange={(value) => updateFilter(filter.id, { value })}
                          tagOptions={tagOptions}
                          referralOrgOptions={referralOrgOptions}
                          fieldOptions={fieldOptions[filter.field] || []}
                          errorText={fieldDef && filter.operator ? rowError : undefined}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        aria-label={`Remove filter ${fieldDef?.label ?? ""}`.trim()}
                        onClick={() => handleRemoveFilter(filter.id)}
                        disabled={filters.length === 1}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {formErrors.length > 0 && (
          <Box sx={{ marginTop: 2 }}>
            {formErrors.map((msg) => (
              <Alert severity="warning" key={msg} sx={{ marginBottom: 1 }} role="alert">
                {msg}
              </Alert>
            ))}
          </Box>
        )}

        <Box sx={{ display: "flex", gap: 1, marginTop: 2 }}>
          <Button
            variant="contained"
            onClick={handleRunQuery}
            sx={{ backgroundColor: "var(--color-primary)" }}
          >
            Run Query
          </Button>
          <Button variant="outlined" onClick={handleClear}>
            Clear
          </Button>
          <Button
            variant="text"
            startIcon={<AddIcon />}
            onClick={handleAddFilter}
            sx={{ color: "var(--color-primary)" }}
          >
            Add Filter
          </Button>
        </Box>
      </Card>
      </Box>

      <Box sx={{ marginTop: 2 }}>
        {state === "idle" && (
          <Typography variant="body2" color="text.secondary">
            Add one or more filters, then select Run Query.
          </Typography>
        )}

        {state === "loading" && <LoadingIndicator text="Running query..." />}

        {state === "error" && (
          <Alert severity="error" role="alert">
            {errorMessage}
          </Alert>
        )}

        {state === "empty" && (
          <Typography variant="body2" color="text.secondary">
            No clients matched these filters.
          </Typography>
        )}

        {state === "results" && (
          <Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 1,
              }}
            >
              <Typography variant="h6" sx={{ color: "var(--color-primary)" }}>
                Results ({results.length})
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {exportingMode && (
                  <Box
                    role="status"
                    aria-label="Export in progress"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      color: "#257e68",
                      fontWeight: 700,
                    }}
                  >
                    <CircularProgress size={28} thickness={5} sx={{ color: "#257e68" }} />
                    <Typography component="span" sx={{ color: "#257e68", fontWeight: 700 }}>
                      {exportingMode === "all" ? "Exporting all data..." : "Exporting query results..."}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleExportQueryResults}
                  disabled={Boolean(exportingMode)}
                  sx={{ minWidth: 220, minHeight: 48, fontWeight: 700 }}
                >
                  {exportingMode === "query" && (
                    <CircularProgress
                      size={24}
                      thickness={5}
                      sx={{ color: "var(--color-primary)", marginRight: 1.5, flexShrink: 0 }}
                    />
                  )}
                  {exportingMode === "query" ? "Exporting Query Results..." : "Export Query Results"}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleExportAll}
                  disabled={Boolean(exportingMode)}
                  sx={{ minWidth: 160, minHeight: 48, fontWeight: 700 }}
                >
                  {exportingMode === "all" && (
                    <CircularProgress
                      size={24}
                      thickness={5}
                      sx={{ color: "var(--color-primary)", marginRight: 1.5, flexShrink: 0 }}
                    />
                  )}
                  {exportingMode === "all" ? "Exporting All..." : "Export All"}
                </Button>
              </Box>
            </Box>
            </Box>
            {exportError && <Alert severity="error" sx={{ marginBottom: 1 }}>{exportError}</Alert>}
            <TableContainer component={Paper}>
              {/* Plain table: no inner vertical scroll container. Vertical scrolling
                  is the browser's normal page scroll; only horizontal overflow (for
                  wide result sets) is contained by TableContainer's default behavior. */}
              <Table size="small" aria-label="Query results">
                <TableHead>
                  <TableRow>
                    {resultColumns.map((col) => (
                      <TableCell
                        key={col.key}
                        sx={{ backgroundColor: "var(--color-background-green-tint)" }}
                      >
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((row) => (
                    <TableRow key={row.uid ?? row.id}>
                      {resultColumns.map((col) => (
                        <TableCell key={col.key}>{formatCellValue(col.getValue(row))}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ClientQueryTool;
