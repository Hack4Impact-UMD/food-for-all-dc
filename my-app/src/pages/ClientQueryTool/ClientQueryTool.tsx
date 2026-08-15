// Client Query Tool — read-only, allowlisted ad-hoc filter builder for client-profile2.
// UI is responsible only for filter state, validation feedback, and rendering controls.
// All Firestore query construction/execution lives in services/client-query-service.ts.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  TableSortLabel,
  Select,
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
import { formatAddressWithQuadrantAndUnit } from "../../utils/addressFormat";
import { formatAssignedTime, formatPhoneNumber } from "../../utils/queryToolFormatting";
import { TIME_SLOTS } from "../Delivery/utils/timeSlots";
import { useTagColors } from "../../context/TagColorContext";
import { getReadableTagTextColor, getTagColor, TagColorMap } from "../../utils/tagColors";
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

const formatCellValue = (value: unknown, tagColors?: TagColorMap): React.ReactNode => {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    if (tagColors) {
      const tags = value.filter((tag) => String(tag ?? "").trim());
      if (tags.length === 0) return "None";
      return tags.map((tag) => {
        const tagText = String(tag);
        const backgroundColor = getTagColor(tagText, tagColors);
        return (
          <Chip
            key={tagText}
            label={tagText}
            size="small"
            sx={{
              backgroundColor,
              color: getReadableTagTextColor(backgroundColor),
              marginRight: 0.5,
              marginBottom: 0.5,
            }}
          />
        );
      });
    }
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

const formatQueryTimestamp = (value: unknown, timeSensitive: boolean): string => {
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (value && typeof value === "object") {
    const timestamp = value as {
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
      type?: string;
    };
    if (typeof timestamp.toDate === "function") {
      date = timestamp.toDate();
    } else if (
      timestamp.type === "firestore/timestamp/1.0" &&
      typeof timestamp.seconds === "number"
    ) {
      date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1_000_000);
    }
  }

  if (!date || Number.isNaN(date.getTime())) return "";
  return timeSensitive ? date.toLocaleString() : date.toLocaleDateString();
};

const hasFilterValue = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
};

const CLIENT_DEFAULT_COLUMNS = [
  "__name",
  "address",
  "phone",
  "deliveryDetails.dietaryRestrictions",
  "deliveryDetails.deliveryInstructions",
  "lastDeliveryDate",
];

const DELIVERY_DEFAULT_COLUMNS = [
  "__name",
  "clusterIdChange",
  "join.tags",
  "join.zipCode",
  "join.ward",
  "assignedDriver",
  "assignedTime",
  "deliveryDetails.deliveryInstructions",
];

const ClientQueryTool: React.FC = () => {
  const tagColors = useTagColors();
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
  const [driverOptions, setDriverOptions] = useState<string[]>([]);
  const [fieldOptions, setFieldOptions] = useState<Record<string, string[]>>({});
  const [visibleClientColumns, setVisibleClientColumns] = useState(CLIENT_DEFAULT_COLUMNS);
  const [visibleDeliveryColumns, setVisibleDeliveryColumns] = useState(DELIVERY_DEFAULT_COLUMNS);
  const [sortColumn, setSortColumn] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const queryRequestIdRef = useRef(0);
  const resultsTableRef = useRef<HTMLDivElement | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setFieldOptions({});
    setDriverOptions([]);
    if (collectionKey === "deliveries") {
      setFieldOptions({ assignedTime: TIME_SLOTS.map((slot) => slot.value) });
    }

    const collectionConfigKey = COLLECTIONS[collectionKey].collectionKey as keyof typeof dataSources.firebase;
    const firestoreCollectionName = dataSources.firebase[collectionConfigKey];
    getDocs(collection(db, firestoreCollectionName))
      .then((snapshot) => {
        if (!isMounted) return;
        const nextOptions: Record<string, Set<string>> = {};
        COLLECTIONS[collectionKey].fields.forEach((fieldDef) => {
          nextOptions[fieldDef.field] = new Set(fieldDef.options || []);
          if (fieldDef.type === "boolean") {
            nextOptions[fieldDef.field].add("true");
            nextOptions[fieldDef.field].add("false");
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
        setFieldOptions((current) =>
          Object.fromEntries(
            Object.entries(nextOptions).map(([field, values]) => [
              field,
              Array.from(new Set([...values, ...(current[field] || [])])).sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true })
              ),
            ])
          )
        );
      })
      .catch(() => undefined);

    if (collectionKey === "deliveries") {
      getDocs(collection(db, dataSources.firebase.clientsCollection))
        .then((snapshot) => {
          if (!isMounted) return;
          const wards = snapshot.docs
            .map((document) => String(document.data().ward ?? "").trim())
            .filter(Boolean);
          setFieldOptions((current) => ({
            ...current,
            ward: Array.from(new Set([...(current.ward || []), ...wards])).sort(),
          }));
        })
        .catch(() => undefined);

      getDocs(collection(db, dataSources.firebase.clustersCollection))
        .then((snapshot) => {
          if (!isMounted) return;
          const routeIds = snapshot.docs.flatMap((document) => {
            const clusters = document.data().clusters;
            return Array.isArray(clusters)
              ? clusters
                  .map((cluster) => String(cluster?.id ?? "").trim())
                  .filter(Boolean)
              : [];
          });
          const routeTimes = snapshot.docs.flatMap((document) => {
            const clusters = document.data().clusters;
            return Array.isArray(clusters)
              ? clusters.map((cluster) => String(cluster?.time ?? "").trim()).filter(Boolean)
              : [];
          });
          setFieldOptions((current) => ({
            ...current,
            cluster: Array.from(new Set([...(current.cluster || []), ...routeIds])).sort(
              (a, b) => a.localeCompare(b, undefined, { numeric: true })
            ),
            assignedTime: Array.from(
              new Set([...TIME_SLOTS.map((slot) => slot.value), ...(current.assignedTime || []), ...routeTimes])
            ).sort(),
          }));
        })
        .catch(() => undefined);
    }

    getDocs(collection(db, dataSources.firebase.driversCollection))
      .then((snapshot) => {
        if (!isMounted) return;
        const names = snapshot.docs
          .map((document) => String(document.data().name || "").trim())
          .filter(Boolean);
        setDriverOptions(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
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
    setFieldErrors((prev) => {
      if (!(id in prev)) return prev;
      if ("value" in updates && prev[id].startsWith("Choose an operator")) {
        return prev;
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleCollectionChange = useCallback((next: CollectionKey) => {
    queryRequestIdRef.current += 1;
    setCollectionKey(next);
    if (next === "clients") {
      setVisibleClientColumns(CLIENT_DEFAULT_COLUMNS);
    }
    if (next === "deliveries") {
      setVisibleDeliveryColumns(DELIVERY_DEFAULT_COLUMNS);
    }
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
    queryRequestIdRef.current += 1;
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
    const requestId = ++queryRequestIdRef.current;
    // Selecting Field/Operator/Value dropdowns can leave the page scrolled down
    // (the browser scrolls to reveal an open dropdown menu). Reset to the top on
    // submit, same as a normal "back to top on search" pattern, so the tool is
    // where the user expects it when results come back.
    window.scrollTo(0, 0);
    try {
      const result = await runClientQuery(collectionKey, filters);
      if (requestId !== queryRequestIdRef.current) return;
      setResults(result.rows);
      setState(result.rows.length === 0 ? "empty" : "results");
    } catch (error) {
      if (requestId !== queryRequestIdRef.current) return;
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
    ];

    if (collectionKey === "clients") {
      columns.push(
        {
          key: "address",
          label: "Address",
          getValue: (row) => formatAddressWithQuadrantAndUnit(row.address, row.quadrant, row.address2),
        },
        { key: "phone", label: "Phone", getValue: (row) => formatPhoneNumber(row.phone) },
        {
          key: "deliveryDetails.dietaryRestrictions",
          label: "Dietary Restrictions",
          getValue: (row) => {
            const restrictions = row.deliveryDetails?.dietaryRestrictions;
            return restrictions
              ? [
                  restrictions.halal && "Halal",
                  restrictions.kidneyFriendly && "Kidney Friendly",
                  restrictions.lowSodium && "Low Sodium",
                  restrictions.lowSugar && "Low Sugar",
                  restrictions.vegan && "Vegan",
                  restrictions.vegetarian && "Vegetarian",
                  ...(restrictions.foodAllergens || []),
                ].filter(Boolean).join(", ") || "None"
              : "None";
          },
        },
        {
          key: "deliveryDetails.deliveryInstructions",
          label: "Delivery Instructions",
          getValue: (row) => row.deliveryDetails?.deliveryInstructions || "None",
        }
      );
    }

    if (collectionKey === "deliveries") {
      columns.push(
        {
          key: "clusterIdChange",
          label: "Cluster ID",
          getValue: (row) => {
            const cluster = row.cluster;
            return cluster === undefined || cluster === null || String(cluster).trim() === "" || Number(cluster) === 0
              ? "Unassigned"
              : cluster;
          },
        },
        {
          key: "join.tags",
          label: "Tags",
          getValue: (row) => {
            const tags = row["join.tags"];
            return Array.isArray(tags) && tags.length > 0
              ? tags
              : tags
                ? [String(tags)]
                : "None";
          },
        },
        { key: "join.zipCode", label: "Zip Code", getValue: (row) => row["join.zipCode"] || "" },
        { key: "join.ward", label: "Ward", getValue: (row) => row["join.ward"] || "" },
        {
          key: "assignedDriver",
          label: "Assigned Driver",
          getValue: (row) => row.assignedDriverName || "No driver assigned",
        },
        {
          key: "assignedTime",
          label: "Assigned Time",
          getValue: (row) => formatAssignedTime(row.time),
        },
        {
          key: "deliveryDetails.deliveryInstructions",
          label: "Delivery Instructions",
          getValue: (row) => row.deliveryDetails?.deliveryInstructions || "No instructions",
        }
      );
    }

    columns.push(...collectionDef.fields.filter((field) => {
      if (collectionDef.nameFields.includes(field.field)) return false;
      return !(
        collectionKey === "deliveries" &&
        ["cluster", "assignedDriverName", "assignedTime", "ward"].includes(field.field)
      );
    }).map((field) => ({
        key: field.field,
        label: field.label,
        getValue: (row: RowData) => {
          let value = getNestedValue(row, field.field);
          if (collectionKey === "clients" && field.field === "address") {
            value = formatAddressWithQuadrantAndUnit(row.address, row.quadrant, row.address2);
          }
          if (collectionKey === "clients" && field.field === "deliveryDetails.dietaryRestrictions") {
            const restrictions = row.deliveryDetails?.dietaryRestrictions;
            value = restrictions
              ? [
                  restrictions.halal && "Halal",
                  restrictions.kidneyFriendly && "Kidney Friendly",
                  restrictions.lowSodium && "Low Sodium",
                  restrictions.lowSugar && "Low Sugar",
                  restrictions.vegan && "Vegan",
                  restrictions.vegetarian && "Vegetarian",
                  ...(restrictions.foodAllergens || []),
                ].filter(Boolean).join(", ") || "None"
              : "None";
          }
          if (field.format === "phone") return formatPhoneNumber(value);
          return field.type === "timestamp"
            ? formatQueryTimestamp(value, Boolean(field.timeSensitive))
            : value;
        },
      })));

    if (collectionKey === "clients") {
      columns.push({
        key: "lastDeliveryDate",
        label: "Last Delivery Date",
        getValue: (row) => row.lastDeliveryDate,
      });
    }

    if (collectionDef.join) {
      collectionDef.join.fields.forEach((field) => {
        if (collectionKey === "deliveries" && field.field === "tags") return;
        if (collectionKey === "deliveries" && ["zipCode", "ward"].includes(field.field)) return;
        columns.push({
          key: `join.${field.field}`,
          label: field.label,
          getValue: (row) => row[`join.${field.field}`],
        });
      });
    }

    return Array.from(new Map(columns.map((column) => [column.key, column])).values());
  }, [collectionDef, collectionKey]);

  const displayedColumns = useMemo(
    () =>
      collectionKey === "clients"
        ? resultColumns.filter((column) => visibleClientColumns.includes(column.key))
        : collectionKey === "deliveries"
          ? resultColumns.filter((column) => visibleDeliveryColumns.includes(column.key))
          : resultColumns,
    [collectionKey, resultColumns, visibleClientColumns, visibleDeliveryColumns]
  );

  const sortedResults = useMemo(() => {
    if (!sortColumn) return results;
    const column = displayedColumns.find((candidate) => candidate.key === sortColumn);
    if (!column) return results;
    const numericColumns = new Set([
      "clusterIdChange",
      "cluster",
      "total",
      "adults",
      "children",
      "seniors",
      "householdSnapshot.total",
      "householdSnapshot.adults",
      "householdSnapshot.children",
      "householdSnapshot.seniors",
    ]);
    const dateColumns = new Set([
      "deliveryDate",
      "updatedAt",
      "lastDeliveryDate",
      "startDate",
      "endDate",
      "famStartDate",
      "tefapCertDate",
      "dob",
      "referredDate",
    ]);
    const parseDateValue = (value: string): number => {
      const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (parts) return Date.UTC(Number(parts[3]), Number(parts[1]) - 1, Number(parts[2]));
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? Number.NaN : parsed;
    };
    const parseTimeValue = (value: string): number => {
      const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i) || value.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return Number.NaN;
      let hour = Number(match[1]);
      const minute = Number(match[2]);
      if (match[3]) {
        const isPm = match[3].toUpperCase() === "PM";
        hour = hour % 12 + (isPm ? 12 : 0);
      }
      return hour * 60 + minute;
    };
    const valueForSort = (value: unknown): string | number => {
      if (value === null || value === undefined) return "";
      if (typeof value === "number") return value;
      if (typeof value === "boolean") return value ? 1 : 0;
      if (Array.isArray(value)) return value.map(String).join(", ").toLowerCase();
      const text = String(value).trim();
      if (column.key === "assignedTime") return parseTimeValue(text);
      if (numericColumns.has(column.key)) {
        const numeric = Number(text.replace(/[^\d.-]/g, ""));
        return Number.isNaN(numeric) ? Number.NaN : numeric;
      }
      if (dateColumns.has(column.key)) return parseDateValue(text);
      return text.toLowerCase();
    };
    return [...results].sort((left, right) => {
      const a = valueForSort(column.getValue(left));
      const b = valueForSort(column.getValue(right));
      const aEmpty = a === "" || (typeof a === "number" && Number.isNaN(a));
      const bEmpty = b === "" || (typeof b === "number" && Number.isNaN(b));
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
      const comparison = typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [displayedColumns, results, sortColumn, sortDirection]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  useEffect(() => {
    const updateTableScrollWidth = () => {
      const container = resultsTableRef.current;
      const table = container?.firstElementChild as HTMLElement | null;
      setTableScrollWidth(Math.max(table?.scrollWidth || 0, container?.clientWidth || 0));
    };
    updateTableScrollWidth();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateTableScrollWidth);
    if (resultsTableRef.current) observer.observe(resultsTableRef.current);
    return () => observer.disconnect();
  }, [displayedColumns, results]);

  const syncHorizontalScroll = (source: "top" | "table") => {
    const sourceElement = source === "top" ? topScrollRef.current : resultsTableRef.current;
    const targetElement = source === "top" ? resultsTableRef.current : topScrollRef.current;
    if (sourceElement && targetElement && targetElement.scrollLeft !== sourceElement.scrollLeft) {
      targetElement.scrollLeft = sourceElement.scrollLeft;
    }
  };

  const handleExportQueryResults = useCallback(async () => {
    setExportError("");
    setExportingMode("query");
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    try {
      exportRowsWithColumns(results, displayedColumns, `${collectionKey}_query_results.csv`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Something went wrong exporting the data.");
    } finally {
      setExportingMode("");
    }
  }, [results, displayedColumns, collectionKey]);

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
      sx={{
        padding: 3,
        paddingX: { xs: 3, md: 6 },
        paddingBottom: { xs: 5, md: 8 },
        maxWidth: 1400,
        marginX: "auto",
      }}
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
                <TableCell sx={{ minWidth: 90 }}>Logic</TableCell>
                <TableCell>Field</TableCell>
                <TableCell>Operator</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Value</TableCell>
                <TableCell aria-label="Actions" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filters.map((filter, index) => {
                const fieldDef = getFieldDef(collectionKey, filter.field);
                const validOperators = fieldDef ? OPERATORS_BY_TYPE[fieldDef.type] : [];
                const rowError = fieldErrors[filter.id];
                const displayedRowError =
                  rowError ||
                  (fieldDef && filter.field && !filter.operator && hasFilterValue(filter.value)
                    ? `Choose an operator for ${fieldDef.label}.`
                    : undefined);
                return (
                  <TableRow key={filter.id}>
                    <TableCell sx={{ minWidth: 90 }}>
                      {index === 0 ? (
                        <Typography variant="body2" color="text.secondary">Where</Typography>
                      ) : (
                        <TextField
                          select
                          size="small"
                          fullWidth
                          label="Logic"
                          value={filter.logic || "AND"}
                          onChange={(event) => updateFilter(filter.id, { logic: event.target.value as "AND" | "OR" })}
                        >
                          <MenuItem value="AND">AND</MenuItem>
                          <MenuItem value="OR">OR</MenuItem>
                        </TextField>
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 200 }}>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        label="Field"
                        id={`${filter.id}-field`}
                        value={filter.field}
                        onChange={(e) => handleFieldChange(filter.id, e.target.value)}
                        error={Boolean(displayedRowError) && !filter.field}
                        helperText={!filter.field ? displayedRowError : undefined}
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
                        error={Boolean(displayedRowError) && Boolean(filter.field) && !filter.operator}
                        helperText={filter.field && !filter.operator ? displayedRowError : undefined}
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
                          driverOptions={driverOptions}
                          errorText={fieldDef && filter.operator ? displayedRowError : undefined}
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
            No {collectionDef.label.toLowerCase()} matched these filters.
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
                {(collectionKey === "clients" || collectionKey === "deliveries") && (
                  <Select
                    multiple
                    size="small"
                    value={collectionKey === "clients" ? visibleClientColumns : visibleDeliveryColumns}
                    onChange={(event) => {
                      const nextColumns = event.target.value as string[];
                      if (nextColumns.length === 0) return;
                      if (collectionKey === "clients") {
                        setVisibleClientColumns(nextColumns);
                      } else {
                        setVisibleDeliveryColumns(nextColumns);
                      }
                    }}
                    displayEmpty
                    renderValue={(selected) => `Displayed fields (${(selected as string[]).length})`}
                    sx={{ minWidth: 190 }}
                    aria-label={`Displayed ${collectionKey} fields`}
                  >
                    {resultColumns.map((column) => (
                      <MenuItem key={column.key} value={column.key}>
                        {column.label}
                      </MenuItem>
                    ))}
                  </Select>
                )}
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
            <Box sx={{ position: "relative" }}>
              <TableContainer
                component={Paper}
                ref={resultsTableRef}
                onScroll={() => syncHorizontalScroll("table")}
                sx={{ width: "100%", overflowX: "auto" }}
              >
              {/* Plain table: no inner vertical scroll container. Vertical scrolling
                  is the browser's normal page scroll; only horizontal overflow (for
                  wide result sets) is contained by TableContainer's default behavior. */}
              <Table
                size="small"
                aria-label="Query results"
                sx={{ width: "max-content", minWidth: "100%" }}
              >
                <TableHead>
                  <TableRow>
                    {displayedColumns.map((col) => (
                      <TableCell
                        key={col.key}
                        sx={{ backgroundColor: "var(--color-background-green-tint)", whiteSpace: "nowrap" }}
                      >
                        <TableSortLabel
                          active={sortColumn === col.key}
                          direction={sortColumn === col.key ? sortDirection : "asc"}
                          onClick={() => handleSort(col.key)}
                        >
                          {col.label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow aria-hidden="true">
                    <TableCell
                      colSpan={displayedColumns.length}
                      sx={{ height: 16, padding: 0, borderBottom: "none" }}
                    />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedResults.map((row) => (
                    <TableRow key={row.uid ?? row.id}>
                      {displayedColumns.map((col) => (
                        <TableCell key={col.key} sx={{ whiteSpace: "nowrap" }}>
                          {formatCellValue(
                            col.getValue(row),
                            ((collectionKey === "clients" && col.key === "tags") ||
                              (collectionKey === "deliveries" && col.key === "join.tags"))
                              ? tagColors
                              : undefined
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TableContainer>
              <Box
                ref={topScrollRef}
                onScroll={() => syncHorizontalScroll("top")}
                aria-label="Horizontal results scrollbar"
                sx={{
                  position: "absolute",
                  top: 36,
                  left: 0,
                  right: 0,
                  zIndex: 4,
                  height: 16,
                  overflowX: "auto",
                  overflowY: "hidden",
                  backgroundColor: "var(--color-white)",
                  scrollbarColor: "#257e68 #e5eee9",
                  "&::-webkit-scrollbar": { height: 14 },
                  "&::-webkit-scrollbar-track": { backgroundColor: "#e5eee9" },
                  "&::-webkit-scrollbar-thumb": { backgroundColor: "#257e68", borderRadius: 7 },
                }}
              >
                <Box sx={{ width: tableScrollWidth, height: 1 }} />
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ClientQueryTool;
