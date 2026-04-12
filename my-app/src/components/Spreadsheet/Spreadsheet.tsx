import "./Spreadsheet.css";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../auth/firebaseConfig";
import { TableSortLabel, Icon, Tooltip } from "@mui/material";
import {
  parseSearchTermsProgressively,
  checkStringContains,
  checkStringEquals,
  extractKeyValue,
  globalSearchMatch,
  normalizeSearchKeyword,
  splitFilterValues,
} from "../../utils/searchFilter";
// Custom chevron icons for TableSortLabel with spacing
const iconStyle = { verticalAlign: "middle", marginLeft: 6 };
const ChevronUp = () => (
  <Icon fontSize="small" style={iconStyle}>
    keyboard_arrow_up
  </Icon>
);
const ChevronDown = () => (
  <Icon fontSize="small" style={iconStyle}>
    keyboard_arrow_down
  </Icon>
);
const ChevronUpDown = () => (
  <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1, marginLeft: 6 }}>
    <Icon fontSize="small" style={{ marginBottom: -4 }}>
      keyboard_arrow_up
    </Icon>
    <Icon fontSize="small" style={{ marginTop: -4 }}>
      keyboard_arrow_down
    </Icon>
  </span>
);
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableContainer,
  TableRow,
  TableCell,
  Stack,
  Chip,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  Skeleton,
  Typography,
} from "@mui/material";
import { Popover } from "@mui/material";
import type { RowData } from "./export";
import { TableVirtuoso } from "react-virtuoso";
import React, { memo, forwardRef, useCallback, useEffect, useState, useMemo, Suspense } from "react";
import type { HTMLAttributes } from "react";
import { useCustomColumns, allowedPropertyKeys } from "../../hooks/useCustomColumns";
import DietaryRestrictionsLegend from "../DietaryRestrictionsLegend";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { Select, MenuItem } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { styled } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { DateTime } from "luxon";

import { exportQueryResults, exportAllClients } from "./export";
const DeleteClientModal = React.lazy(() => import("./DeleteClientModal"));
import { clientService } from "../../services/client-service";
import { useClientData } from "../../context/ClientDataContext";
import type { FieldDefinition } from "../../types/spreadsheet-types";
import { useNotifications } from "../NotificationProvider";
import { CsvExportError } from "../../utils/csvExport";
import { getClientStatusPresentation } from "../../utils/clientStatus";
import type { ClientDeliverySummary } from "../../utils/lastDeliveryDate";

const StyleChip = styled(Chip)(({ theme }) => ({
  fontWeight: 500,
  fontSize: "0.85rem",
  backgroundColor: theme.palette.primary.light,
  color: theme.palette.primary.contrastText,
  borderRadius: 8,
  padding: "0 8px",
  margin: "2px 2px 2px 0",
  cursor: "pointer",
  "&:hover": {
    backgroundColor: theme.palette.primary.main,
  },
}));

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DELIVERY_SUMMARY_EXPORT_BATCH_SIZE = 100;

const formatTimestampLikeDate = (value: unknown): string => {
  if (value === null || value === undefined || value === "N/A") return "";

  if (value instanceof Date) {
    return DateTime.fromJSDate(value).setZone("America/New_York").toFormat("MM/dd/yyyy");
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return DateTime.fromSeconds((value as { seconds: number }).seconds)
      .setZone("America/New_York")
      .toFormat("MM/dd/yyyy");
  }

  if (typeof value === "string" && ISO_DATE_PATTERN.test(value.trim())) {
    const parsed = DateTime.fromISO(value, { zone: "America/New_York" });
    return parsed.isValid ? parsed.toFormat("MM/dd/yyyy") : value;
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return "";
  }

  return String(value);
};

const renderSafeSpreadsheetCellValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined || value === "N/A") return "";

  if (React.isValidElement(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.every((item) => React.isValidElement(item))) {
      return value as React.ReactNode[];
    }
    return value.map((item) => formatTimestampLikeDate(item)).join(", ");
  }

  return formatTimestampLikeDate(value);
};

function getCustomColumnDisplay(row: RowData, propertyKey: string): React.ReactNode {
  if (!propertyKey || propertyKey === "none") return "";
  if (propertyKey === "referralEntity" && row.referralEntity) {
    const entity = row.referralEntity;
    const name = entity?.name || "";
    const org = entity?.organization || "";
    const display = [name, org].filter(Boolean).join(", ");
    return display || "";
  }
  if (propertyKey === "tags" && Array.isArray(row.tags)) {
    return row.tags.length > 0
      ? row.tags.map((tag: string, i: number) => (
          <StyleChip
            key={i}
            label={tag}
            size="small"
            onClick={(e) => e.preventDefault()}
            sx={{ mb: 0.5, mr: 0.5 }}
          />
        ))
      : "";
  }
  if (propertyKey === "deliveryDetails.dietaryRestrictions.dietaryPreferences") {
    const value = row.deliveryDetails?.dietaryRestrictions?.dietaryPreferences;
    return value && value.trim() !== "" ? value.toString() : "";
  }
  if (propertyKey.includes(".")) {
    const keys = propertyKey.split(".");
    let value: any = row;
    for (const k of keys) {
      value = value && value[k];
      if (value === undefined) return "";
    }
    return formatTimestampLikeDate(value);
  }
  const value = row[propertyKey];
  return formatTimestampLikeDate(value);
}

const mergeDeliverySummaries = (
  rows: RowData[],
  readyIds: Set<string>,
  summaries: Map<string, ClientDeliverySummary>
): RowData[] =>
  rows.map((row) => {
    if (!readyIds.has(row.uid)) {
      return row;
    }

    const summary = summaries.get(row.uid);
    return {
      ...row,
      lastDeliveryDate: summary?.lastDeliveryDate ?? "",
      missedStrikeCount: summary?.missedStrikeCount ?? 0,
      deliverySummaryReady: true,
    };
  });

type SpreadsheetRowContentProps = {
  index: number;
  row: RowData;
  fields: FieldDefinition[];
  customColumns: Array<{ id: string; label: string; propertyKey: string }>;
  navigate: ReturnType<typeof useNavigate>;
  onOpenMenu: (event: React.MouseEvent<HTMLElement>, row: RowData) => void;
};

const SpreadsheetRowContent = memo(
  ({ index, row, fields, customColumns, navigate, onOpenMenu }: SpreadsheetRowContentProps) => {
    const rowBg = index % 2 === 0 ? "rgb(243, 243, 243)" : "rgb(249, 249, 249)";

    return (
      <>
        {fields.map((field) => (
          <TableCell
            key={field.key}
            sx={{
              py: 2,
              width: 160,
              minWidth: 160,
              maxWidth: 160,
              backgroundColor: rowBg,
            }}
          >
            {field.key === "fullname" ? (
              (() => {
                const statusPresentation = getClientStatusPresentation(
                  row.activeStatus,
                  row.deliverySummaryReady ? row.missedStrikeCount : 0
                );

                return (
                  <span style={{ display: "flex", alignItems: "center" }}>
                    <Tooltip title={statusPresentation.tooltip} placement="right">
                      {statusPresentation.isActive ? (
                        <CheckCircleIcon
                          sx={{
                            color: statusPresentation.color,
                            fontSize: "1.1rem",
                            mr: 0.5,
                            verticalAlign: "middle",
                          }}
                        />
                      ) : (
                        <CancelIcon
                          sx={{
                            color: statusPresentation.color,
                            fontSize: "1.1rem",
                            mr: 0.5,
                            verticalAlign: "middle",
                          }}
                        />
                      )}
                    </Tooltip>
                    <a
                      className="name-link"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/profile/${row.uid ?? ""}`, {
                          state: { userData: row },
                        });
                      }}
                    >
                      {field.compute ? field.compute(row) : `${row.lastName}, ${row.firstName}`}
                    </a>
                  </span>
                );
              })()
            ) : field.compute ? (
              renderSafeSpreadsheetCellValue(field.compute(row))
            ) : (
              renderSafeSpreadsheetCellValue(row[field.key as keyof RowData])
            )}
          </TableCell>
        ))}
        {customColumns.map((col) => (
          <TableCell
            key={col.id}
            sx={{
              py: 2,
              width: 200,
              minWidth: 200,
              maxWidth: 200,
              backgroundColor: rowBg,
            }}
          >
            {col.propertyKey !== "none" ? getCustomColumnDisplay(row, col.propertyKey) : "N/A"}
          </TableCell>
        ))}
        <TableCell
          align="right"
          sx={{ py: 2, width: 80, minWidth: 80, maxWidth: 80, backgroundColor: rowBg }}
          key={`actions-${row.id}`}
        >
          <IconButton
            onClick={(e) => {
              onOpenMenu(e, row);
            }}
            sx={{
              color: "var(--color-text-medium)",
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.04)",
                color: "var(--color-primary-darker)",
              },
            }}
          >
            <MoreVertIcon />
          </IconButton>
        </TableCell>
      </>
    );
  },
  (previousProps, nextProps) =>
    previousProps.row === nextProps.row &&
    previousProps.index === nextProps.index &&
    previousProps.fields === nextProps.fields &&
    previousProps.customColumns === nextProps.customColumns
);
SpreadsheetRowContent.displayName = "SpreadsheetRowContent";

const Spreadsheet: React.FC = () => {
  const navigate = useNavigate();
  // Route Protection: redirect to login if not authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: "asc" | "desc" | null;
  }>({ key: "fullname", direction: "asc" });

  // Sorting handler
  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        // Toggle direction only between asc and desc
        if (prev.direction === "asc") return { key, direction: "desc" };
        return { key, direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  };
  const [forceRerender, setForceRerender] = useState(0);
  const virtuosoRef = React.useRef<any>(null);
  const { clients, loading, error, refresh } = useClientData();
  const { showError, showSuccess, showWarning } = useNotifications();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [menuAnchorPosition, setMenuAnchorPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [menuRow, setMenuRow] = useState<RowData | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [clientIdToDelete, setClientIdToDelete] = useState<string | null>(null);
  const [clientNameToDelete, setClientNameToDelete] = useState<string>("");
  const previousClientIdsRef = React.useRef<string>("");
  const customColumnsHook = useCustomColumns({ page: "Spreadsheet" });
  const customColumns = customColumnsHook.customColumns;
  const handleAddCustomColumn = customColumnsHook.handleAddCustomColumn;
  const handleCustomHeaderChange = customColumnsHook.handleCustomHeaderChange;
  const handleRemoveCustomColumn = customColumnsHook.handleRemoveCustomColumn;

  useEffect(() => {
    const nextClientIds = clients.map((client) => client.uid).join("|");
    const shouldResetTable = previousClientIdsRef.current !== nextClientIds;
    previousClientIdsRef.current = nextClientIds;

    if (!shouldResetTable) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (virtuosoRef.current && typeof virtuosoRef.current.scrollToIndex === "function") {
        virtuosoRef.current.scrollToIndex({ index: 0, align: "start" });
      }
      setForceRerender((f) => f + 1);
    }, 100);

    return () => window.clearTimeout(timer);
  }, [clients]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const hydrateRowsForExport = useCallback(async (sourceRows: RowData[]) => {
    const pendingClientIds = Array.from(
      new Set(
        sourceRows
          .filter((row) => !row.deliverySummaryReady)
          .map((row) => row.uid)
          .filter(Boolean)
      )
    );

    if (pendingClientIds.length === 0) {
      return sourceRows;
    }

    const readyIds = new Set(pendingClientIds);
    const summaries = new Map<string, ClientDeliverySummary>();

    for (
      let index = 0;
      index < pendingClientIds.length;
      index += DELIVERY_SUMMARY_EXPORT_BATCH_SIZE
    ) {
      const batchIds = pendingClientIds.slice(index, index + DELIVERY_SUMMARY_EXPORT_BATCH_SIZE);
      const batchSummaries = await clientService.getClientDeliverySummaries(batchIds);
      batchSummaries.forEach((summary, clientId) => {
        summaries.set(clientId, summary);
      });
    }

    return mergeDeliverySummaries(sourceRows, readyIds, summaries);
  }, []);

  const handleOpenMenu = useCallback((event: React.MouseEvent<HTMLElement>, row: RowData) => {
    event.stopPropagation();
    setMenuAnchorPosition({ top: event.clientY, left: event.clientX });
    setMenuRow(row);
  }, []);

  const handleExportAction = async (
    sourceRows: RowData[],
    exportFn: (rowsToExport: RowData[]) => string,
    successMessage: (filename: string) => string
  ) => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const exportRows = await hydrateRowsForExport(sourceRows);
      const filename = exportFn(exportRows);
      showSuccess(successMessage(filename));
    } catch (error) {
      if (error instanceof CsvExportError && error.code === "EMPTY_DATA") {
        showWarning(error.message);
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to export CSV.";
      showError(message);
    } finally {
      setIsExporting(false);
    }
  };

  // TableVirtuoso MUI integration
  const TableComponent = forwardRef<HTMLTableElement, React.ComponentProps<typeof Table>>(
    (props, ref) => <Table {...props} ref={ref} stickyHeader />
  );
  TableComponent.displayName = "VirtuosoTable";
  const TableHeadComponent = forwardRef<
    HTMLTableSectionElement,
    HTMLAttributes<HTMLTableSectionElement>
  >((props, ref) => <thead {...props} ref={ref} />);
  TableHeadComponent.displayName = "VirtuosoTableHead";
  const TableRowComponent = forwardRef<HTMLTableRowElement, React.ComponentProps<typeof TableRow>>(
    (props, ref) => (
      <TableRow
        {...props}
        ref={ref}
        className={["table-row", props.className].filter(Boolean).join(" ")}
      />
    )
  );
  TableRowComponent.displayName = "VirtuosoTableRow";
  const TableBodyComponent = forwardRef<
    HTMLTableSectionElement,
    HTMLAttributes<HTMLTableSectionElement>
  >((props, ref) => <tbody {...props} ref={ref} />);
  TableBodyComponent.displayName = "VirtuosoTableBody";
  const VirtuosoTableComponents = {
    Table: TableComponent,
    TableHead: TableHeadComponent,
    TableRow: TableRowComponent,
    TableBody: TableBodyComponent,
  } as const;

  const fields: FieldDefinition[] = useMemo(
    () => [
      {
        key: "fullname",
        label: "Name",
        type: "text",
        compute: (data: RowData) => `${data.lastName}, ${data.firstName}`,
      },
      {
        key: "address",
        label: "Address",
        type: "text",
        compute: (data: RowData) => {
          // Append address2 (apartment/unit) if present
          const address2 = typeof data.address2 === "string" ? data.address2 : "";
          if (address2.trim() !== "") {
            return `${data.address} ${address2}`.trim();
          }
          return data.address;
        },
      },
      { key: "phone", label: "Phone", type: "text" },
      {
        key: "deliveryDetails.dietaryRestrictions",
        label: "Dietary Restrictions",
        type: "text",
        sortable: false,
        compute: (data: RowData) => {
          const dr = data.deliveryDetails?.dietaryRestrictions;
          if (!dr) return <span style={{ color: "var(--color-text-light)" }}>None</span>;
          const dietary: string[] = [];
          const allergies: string[] = [];
          const other: string[] = [];
          if (dr.halal) dietary.push("Halal");
          if (dr.kidneyFriendly) dietary.push("Kidney Friendly");
          if (dr.lowSodium) dietary.push("Low Sodium");
          if (dr.lowSugar) dietary.push("Low Sugar");
          if (dr.microwaveOnly) dietary.push("Microwave Only");
          if (dr.noCookingEquipment) dietary.push("No Cooking Equipment");
          if (dr.softFood) dietary.push("Soft Food");
          if (dr.vegan) dietary.push("Vegan");
          if (dr.vegetarian) dietary.push("Vegetarian");
          if (dr.heartFriendly) dietary.push("Heart Friendly");
          if (Array.isArray(dr.foodAllergens) && dr.foodAllergens.length > 0)
            allergies.push(...dr.foodAllergens);
          if (Array.isArray(dr.other) && dr.other.length > 0) other.push(...dr.other);
          if (dr.otherText && dr.otherText.trim() !== "") other.push(dr.otherText.trim());
          const chips: React.ReactNode[] = [];
          dietary.forEach((item, i) =>
            chips.push(
              <Chip
                key={`dietary-${item}-${i}`}
                label={item}
                size="small"
                sx={{
                  backgroundColor: "var(--color-background-green-light)",
                  color: "var(--color-primary)",
                  fontWeight: 500,
                  mr: 0.5,
                  mb: 0.5,
                }}
              />
            )
          );
          allergies.forEach((item, i) =>
            chips.push(
              <Chip
                key={`allergy-${item}-${i}`}
                label={item}
                size="small"
                sx={{
                  backgroundColor: "var(--color-allergy-background)",
                  color: "var(--color-error-text-alt)",
                  fontWeight: 500,
                  mr: 0.5,
                  mb: 0.5,
                }}
              />
            )
          );
          other.forEach((item, i) =>
            chips.push(
              <Chip
                key={`other-${item}-${i}`}
                label={item}
                size="small"
                sx={{
                  backgroundColor: "var(--color-other-restriction-background)",
                  color: "var(--color-other-restriction-text)",
                  fontWeight: 500,
                  mr: 0.5,
                  mb: 0.5,
                }}
              />
            )
          );
          return chips.length > 0 ? (
            chips
          ) : (
            <span style={{ color: "var(--color-text-light)" }}>None</span>
          );
        },
      },
      {
        key: "deliveryDetails.deliveryInstructions",
        label: "Delivery Instructions",
        type: "text",
        compute: (data: RowData) => data.deliveryDetails?.deliveryInstructions || "None",
      },
      {
        key: "lastDeliveryDate",
        label: "Last Delivery Date",
        type: "text",
        compute: (data: RowData) => (data.deliverySummaryReady ? data.lastDeliveryDate || "" : ""),
      },
    ],
    []
  );

  // --- Sorting and filtering logic (with sorting) ---
  // Ensure filteredRows is always the correct RowData shape for export, and optimize with useMemo
  const filteredRows: RowData[] = useMemo(() => {
    let result = clients;
    if (debouncedSearch.trim()) {
      const validSearchTerms = parseSearchTermsProgressively(debouncedSearch.trim());

      const keyValueTerms = validSearchTerms.filter((term) => term.includes(":"));
      const nonKeyValueTerms = validSearchTerms.filter((term) => !term.includes(":"));

      if (keyValueTerms.length > 0) {
        const visibleFieldKeys = new Set([
          ...fields.map((f) => f.key),
          ...customColumns.map((col) => col.propertyKey).filter((key) => key !== "none"),
        ]);

        const checkValueOrInArray = (
          value: unknown,
          query: string,
          exactMatch = false
        ): boolean => {
          if (value === undefined || value === null) {
            return false;
          }

          if (Array.isArray(value)) {
            return value.some((item) =>
              exactMatch ? checkStringEquals(item, query) : checkStringContains(item, query)
            );
          }

          return exactMatch ? checkStringEquals(value, query) : checkStringContains(value, query);
        };

        const isVisibleField = (keyword: string): boolean => {
          const normalizedKeyword = normalizeSearchKeyword(keyword);

          const fieldMappings: { [key: string]: string[] } = {
            fullname: ["name", "first name", "firstname", "last name", "lastname"],
            address: ["address"],
            phone: ["phone"],
            email: ["email"],
            "deliveryDetails.dietaryRestrictions": ["dietary restrictions", "dietary"],
            "deliveryDetails.deliveryInstructions": ["delivery instructions", "instructions"],
          };

          for (const [fieldKey, aliases] of Object.entries(fieldMappings)) {
            if (
              visibleFieldKeys.has(fieldKey) &&
              aliases.some((alias) => normalizeSearchKeyword(alias) === normalizedKeyword)
            ) {
              return true;
            }
          }

          const customColumnMappings: { [key: string]: string[] } = {
            adults: ["adults"],
            children: ["children"],
            deliveryFreq: ["delivery freq", "delivery frequency"],
            ethnicity: ["ethnicity"],
            gender: ["gender"],
            language: ["language"],
            notes: ["notes"],
            referralEntity: ["referral entity", "referral"],
            tags: ["tags", "tag"],
            tefapCert: ["tefap", "tefap cert"],
            dob: ["dob"],
            lastDeliveryDate: ["last delivery date"],
          };

          for (const [propertyKey, aliases] of Object.entries(customColumnMappings)) {
            if (
              visibleFieldKeys.has(propertyKey) &&
              aliases.some((alias) => normalizeSearchKeyword(alias) === normalizedKeyword)
            ) {
              return true;
            }
          }

          return false;
        };

        result = result.filter((row) => {
          return keyValueTerms.every((term) => {
            const { keyword, searchValue, isKeyValue: isKeyValueSearch } = extractKeyValue(term);
            const normalizedKeyword = normalizeSearchKeyword(keyword);

            if (isKeyValueSearch && searchValue) {
              if (!isVisibleField(keyword)) {
                return true;
              }

              const searchValues = splitFilterValues(searchValue);
              const matchesAnySearchValue = (matcher: (candidate: string) => boolean): boolean =>
                searchValues.some((candidate: string) => matcher(candidate));

              switch (normalizedKeyword) {
                case "name":
                  return matchesAnySearchValue(
                    (candidate) =>
                      checkStringContains(`${row.firstName ?? ""} ${row.lastName ?? ""}`, candidate) ||
                      checkStringContains(row.firstName, candidate) ||
                      checkStringContains(row.lastName, candidate)
                  );
                case "firstname":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.firstName, candidate)
                  );
                case "lastname":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.lastName, candidate)
                  );
                case "address":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.address, candidate)
                  );
                case "phone":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.phone, candidate)
                  );
                case "email":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.email, candidate)
                  );
                case "dietaryrestrictions":
                case "dietary": {
                  const dr = row.deliveryDetails?.dietaryRestrictions;
                  if (!dr) return false;
                  const dietaryTerms = [
                    dr.halal ? "halal" : "",
                    dr.kidneyFriendly ? "kidney friendly" : "",
                    dr.lowSodium ? "low sodium" : "",
                    dr.lowSugar ? "low sugar" : "",
                    dr.microwaveOnly ? "microwave only" : "",
                    dr.noCookingEquipment ? "no cooking equipment" : "",
                    dr.softFood ? "soft food" : "",
                    dr.vegan ? "vegan" : "",
                    dr.vegetarian ? "vegetarian" : "",
                    dr.heartFriendly ? "heart friendly" : "",
                    ...(Array.isArray(dr.foodAllergens) ? dr.foodAllergens : []),
                    ...(Array.isArray(dr.other) ? dr.other : []),
                    dr.otherText || "",
                  ].filter(Boolean);
                  return matchesAnySearchValue((candidate) =>
                    dietaryTerms.some((dietaryTerm) => checkStringContains(dietaryTerm, candidate))
                  );
                }
                case "deliveryinstructions":
                case "instructions":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.deliveryDetails?.deliveryInstructions, candidate)
                  );
                case "adults":
                  return matchesAnySearchValue((candidate) =>
                    checkValueOrInArray(row.adults, candidate, true)
                  );
                case "children":
                  return matchesAnySearchValue((candidate) =>
                    checkValueOrInArray(row.children, candidate, true)
                  );
                case "deliveryfreq":
                case "deliveryfrequency":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.deliveryFreq, candidate)
                  );
                case "ethnicity":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.ethnicity, candidate)
                  );
                case "gender":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.gender, candidate)
                  );
                case "language":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.language, candidate)
                  );
                case "notes":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.notes, candidate)
                  );
                case "referralentity":
                case "referral": {
                  const referralEntity = row.referralEntity;

                  if (referralEntity && typeof referralEntity === "object") {
                    return matchesAnySearchValue(
                      (candidate) =>
                        checkStringContains(referralEntity.name, candidate) ||
                        checkStringContains(referralEntity.organization, candidate)
                    );
                  }
                  return false;
                }
                case "tags":
                case "tag":
                  return matchesAnySearchValue((candidate) => checkValueOrInArray(row.tags, candidate));
                case "tefap":
                case "tefapcert":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.tefapCert, candidate)
                  );
                case "dob":
                  return matchesAnySearchValue((candidate) =>
                    checkValueOrInArray(row.dob, candidate, true)
                  );
                case "lastdeliverydate":
                  return matchesAnySearchValue((candidate) =>
                    checkStringContains(row.lastDeliveryDate, candidate)
                  );
                default: {
                  const matchesCustomColumn = customColumns.some((col) => {
                    if (
                      col.propertyKey !== "none" &&
                      visibleFieldKeys.has(col.propertyKey) &&
                      normalizeSearchKeyword(col.propertyKey).includes(normalizedKeyword)
                    ) {
                      if (col.propertyKey.includes(".")) {
                        const keys = col.propertyKey.split(".");
                        let value: unknown = row;
                        for (const k of keys) {
                          value = value && (value as Record<string, unknown>)[k];
                          if (value === undefined) return false;
                        }
                        return matchesAnySearchValue((candidate) =>
                          checkValueOrInArray(value, candidate)
                        );
                      }

                      if (col.propertyKey in row) {
                        const fieldValue = row[col.propertyKey as keyof RowData];
                        return matchesAnySearchValue((candidate) =>
                          checkValueOrInArray(fieldValue, candidate)
                        );
                      }
                    }
                    return false;
                  });
                  return matchesCustomColumn;
                }
              }
            }

            return true;
          });
        });
      }

      if (nonKeyValueTerms.length > 0) {
        const searchableFields = [
          "firstName",
          "lastName",
          "address",
          "phone",
          "email",
          "deliveryDetails.deliveryInstructions",
          ...customColumns.map((col) => col.propertyKey).filter((key) => key !== "none"),
        ];
        result = result.filter((row) =>
          nonKeyValueTerms.every((term) => globalSearchMatch(row, term, searchableFields))
        );
      }
    }
    // Sort if needed
    if (sortConfig.key && sortConfig.direction) {
      const field = fields.find((f) => f.key === sortConfig.key);
      if (field) {
        // Special case for fullname: sort by lastName, firstName
        if (field.key === "fullname") {
          result = [...result].sort((a, b) => {
            const aLast = a.lastName?.toLowerCase() || "";
            const bLast = b.lastName?.toLowerCase() || "";
            if (aLast < bLast) return sortConfig.direction === "asc" ? -1 : 1;
            if (aLast > bLast) return sortConfig.direction === "asc" ? 1 : -1;
            const aFirst = a.firstName?.toLowerCase() || "";
            const bFirst = b.firstName?.toLowerCase() || "";
            if (aFirst < bFirst) return sortConfig.direction === "asc" ? -1 : 1;
            if (aFirst > bFirst) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
          });
        } else {
          result = [...result].sort((a, b) => {
            const aValue = field.compute ? field.compute(a) : a[field.key];
            const bValue = field.compute ? field.compute(b) : b[field.key];
            const aComp =
              typeof aValue === "string" || typeof aValue === "number"
                ? aValue
                : aValue?.props?.label || aValue?.toString?.() || "";
            const bComp =
              typeof bValue === "string" || typeof bValue === "number"
                ? bValue
                : bValue?.props?.label || bValue?.toString?.() || "";
            if (aComp === null || aComp === undefined) {
              if (bComp === null || bComp === undefined) return 0;
              return 1;
            }
            if (bComp === null || bComp === undefined) return -1;
            if (aComp < bComp) return sortConfig.direction === "asc" ? -1 : 1;
            if (aComp > bComp) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
          });
        }
      } else {
        result = [...result].sort((a, b) => {
          let aValue = a[sortConfig.key as keyof RowData];
          let bValue = b[sortConfig.key as keyof RowData];

          if (sortConfig.key === "tags") {
            aValue = Array.isArray(aValue) ? aValue.join(", ").toLowerCase() : "";
            bValue = Array.isArray(bValue) ? bValue.join(", ").toLowerCase() : "";
          }

          const aStr = aValue === null || aValue === undefined ? "" : String(aValue).toLowerCase();
          const bStr = bValue === null || bValue === undefined ? "" : String(bValue).toLowerCase();
          if (aStr === bStr) return 0;
          if (sortConfig.direction === "asc") {
            return aStr < bStr ? -1 : 1;
          } else {
            return aStr > bStr ? -1 : 1;
          }
        });
      }
    }
    return result;
  }, [clients, debouncedSearch, sortConfig, fields, customColumns]);

  const isInitialLoading = loading && clients.length === 0;
  const hasBlockingError = Boolean(error) && clients.length === 0;
  const isEmptyState = !loading && !error && clients.length === 0;

  // --- TableVirtuoso rendering ---
  return (
    <Box
      className="box"
      sx={{
        px: { xs: 2, sm: 3, md: 4 },
        py: 2,
        maxWidth: "100%",
        overflowX: "hidden",
        backgroundColor: "var(--color-transparent)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        mt: 0,
        height: "calc(100vh - var(--layout-page-offset))",
      }}
    >
      <div style={{ color: "var(--color-primary)", fontWeight: 600, marginBottom: 8 }}></div>
      {/* Search bar and actions */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          width: "100%",
          zIndex: 10,
          backgroundColor: "var(--color-background-main)",
          pb: 3,
          pt: 0,
          borderBottom: "none",
          boxShadow: "none",
          margin: 0,
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ position: "relative", width: "100%" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search clients (e.g., smith, name:john,jane, address:"main st", gender:female,male)'
              style={{
                width: "100%",
                height: "50px",
                backgroundColor: "var(--color-background-gray)",
                border: "none",
                borderRadius: "25px",
                padding: "0 48px",
                fontSize: "16px",
                color: "var(--color-text-dark)",
                boxSizing: "border-box",
                transition: "all 0.2s ease",
                boxShadow: "inset 0 2px 3px rgba(0,0,0,0.05)",
              }}
            />
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
            sx={{ "& .MuiButton-root": { height: { sm: "36px" } } }}
          >
            <Button
              variant="contained"
              color="secondary"
              onClick={() => setSearchQuery("")}
              className="view-all"
              sx={{
                borderRadius: "25px",
                px: 2,
                py: 0.5,
                minWidth: { xs: "100%", sm: "100px" },
                maxWidth: { sm: "120px" },
                textTransform: "none",
                fontSize: "0.875rem",
                lineHeight: 1.5,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                transition: "all 0.2s ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                },
                alignSelf: { xs: "stretch", sm: "flex-start" },
              }}
            >
              View All
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setExportDialogOpen(true)}
              sx={{
                borderRadius: "25px",
                px: 2,
                py: 0.5,
                minWidth: { xs: "100%", sm: "100px" },
                maxWidth: { sm: "120px" },
                textTransform: "none",
                fontSize: "0.875rem",
                lineHeight: 1.5,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                transition: "all 0.2s ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                },
                alignSelf: { xs: "stretch", sm: "flex-start" },
              }}
            >
              Export
            </Button>
            <Suspense fallback={null}>
              {exportDialogOpen && (
                <Dialog
                  open={exportDialogOpen}
                  onClose={() => setExportDialogOpen(false)}
                  maxWidth="xs"
                  fullWidth
                >
                  <DialogTitle>Export Options</DialogTitle>
                  <DialogContent sx={{ pt: 3, overflow: "visible" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <Button
                        variant="contained"
                        color="primary"
                        disabled={isExporting}
                        onClick={() => {
                          setExportDialogOpen(false);
                          void handleExportAction(
                            filteredRows,
                            (rowsToExport) => exportQueryResults(rowsToExport, customColumns),
                            (filename) => `Exported ${filename}.`
                          );
                        }}
                      >
                        {isExporting ? "Preparing Export..." : "Export Query Results"}
                      </Button>
                      <Button
                        variant="contained"
                        color="secondary"
                        disabled={isExporting}
                        onClick={() => {
                          setExportDialogOpen(false);
                          void handleExportAction(
                            clients,
                            (rowsToExport) => exportAllClients(rowsToExport),
                            (filename) => `Exported ${filename}.`
                          );
                        }}
                      >
                        {isExporting ? "Preparing Export..." : "Export All Clients"}
                      </Button>
                    </Box>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setExportDialogOpen(false)} color="error">
                      Cancel
                    </Button>
                  </DialogActions>
                </Dialog>
              )}
            </Suspense>
            <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate("/profile")}
                className="create-client"
                sx={{
                  backgroundColor: "var(--color-primary-darker)",
                  borderRadius: "25px",
                  px: 2,
                  py: 0.5,
                  minWidth: { xs: "100%", sm: "140px" },
                  maxWidth: { sm: "160px" },
                  textTransform: "none",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    backgroundColor: "var(--color-primary-darkest)",
                    transform: "translateY(-2px)",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                  },
                  alignSelf: { xs: "stretch", sm: "flex-end" },
                }}
              >
                + Create Client
              </Button>
            </Box>
          </Stack>
        </Stack>
      </Box>

      {/* Dietary Restrictions Color Legend */}
      <DietaryRestrictionsLegend />

      {error && clients.length > 0 && (
        <Alert
          severity="error"
          sx={{ mt: 1 }}
          action={
            <Button color="inherit" size="small" onClick={() => void refresh()}>
              Retry
            </Button>
          }
        >
          {error.message || "Failed to refresh client data. Showing the last loaded results."}
        </Alert>
      )}

      {/* TableVirtuoso for desktop/table view only */}
      <Box
        className="table-container"
        sx={{ mt: 1, mb: 0, width: "100%", flex: 1, minHeight: 0, overflow: "auto" }}
      >
        {isInitialLoading ? (
          <TableContainer
            component={Paper}
            sx={{
              height: "100%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              borderRadius: "12px",
              overflow: "auto",
              minHeight: 0,
            }}
          >
            <Table sx={{ minWidth: 650 }}>
              <tbody>
                <TableRow>
                  {fields.map((field) => (
                    <TableCell key={field.key}>
                      <Skeleton variant="text" width={100} />
                    </TableCell>
                  ))}
                  {customColumns.map((col) => (
                    <TableCell key={col.id}>
                      <Skeleton variant="text" width={100} />
                    </TableCell>
                  ))}
                  <TableCell key="actions">
                    <Skeleton variant="circular" width={32} height={32} />
                  </TableCell>
                </TableRow>
                {[...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    {fields.map((field) => (
                      <TableCell key={field.key}>
                        <Skeleton variant="rectangular" width={100} height={24} />
                      </TableCell>
                    ))}
                    {customColumns.map((col) => (
                      <TableCell key={col.id}>
                        <Skeleton variant="rectangular" width={100} height={24} />
                      </TableCell>
                    ))}
                    <TableCell key="actions">
                      <Skeleton variant="circular" width={32} height={32} />
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        ) : hasBlockingError ? (
          <TableContainer
            component={Paper}
            sx={{
              height: "100%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              borderRadius: "12px",
              overflow: "auto",
              minHeight: 0,
            }}
          >
            <Box
              sx={{
                height: "100%",
                minHeight: 240,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 3,
              }}
            >
              <Alert
                severity="error"
                sx={{ width: "100%", maxWidth: 560 }}
                action={
                  <Button color="inherit" size="small" onClick={() => void refresh()}>
                    Retry
                  </Button>
                }
              >
                {error?.message || "Failed to load client data."}
              </Alert>
            </Box>
          </TableContainer>
        ) : isEmptyState ? (
          <TableContainer
            component={Paper}
            sx={{
              height: "100%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              borderRadius: "12px",
              overflow: "auto",
              minHeight: 0,
            }}
          >
            <Box
              sx={{
                height: "100%",
                minHeight: 240,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 3,
              }}
            >
              <Typography sx={{ color: "text.secondary" }}>No clients found.</Typography>
            </Box>
          </TableContainer>
        ) : (
          <TableContainer
            component={Paper}
            sx={{
              height: "100%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              borderRadius: "12px",
              overflow: "auto",
              minHeight: 0,
            }}
          >
            <TableVirtuoso
              ref={virtuosoRef}
              style={{ height: "100%" }}
              data={filteredRows}
              components={VirtuosoTableComponents}
              overscan={200}
              key={forceRerender}
              fixedHeaderContent={() => (
                <TableRow sx={{ position: "sticky", top: 0, zIndex: 2 }}>
                  {fields.map((field) => {
                    const isSortable = field.sortable !== false;
                    return (
                      <TableCell
                        className="table-header"
                        key={field.key}
                        sx={{
                          backgroundColor: "var(--color-background-green-tint)",
                          borderBottom: "2px solid var(--color-border-medium)",
                          width: 160,
                          minWidth: 160,
                          maxWidth: 160,
                          cursor: isSortable ? "pointer" : "default",
                        }}
                        onClick={isSortable ? () => handleSort(field.key) : undefined}
                      >
                        {isSortable ? (
                          <TableSortLabel
                            active={sortConfig.key === field.key}
                            direction={sortConfig.direction === null ? "asc" : sortConfig.direction}
                            hideSortIcon={true}
                            IconComponent={() => null}
                          >
                            {field.label}
                            {sortConfig.key === field.key ? (
                              sortConfig.direction === "asc" ? (
                                <ChevronUp />
                              ) : sortConfig.direction === "desc" ? (
                                <ChevronDown />
                              ) : (
                                <ChevronUpDown />
                              )
                            ) : (
                              <ChevronUpDown />
                            )}
                          </TableSortLabel>
                        ) : (
                          <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>
                            {field.label}
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                  {/* Custom columns header */}
                  {customColumns.map((col) => (
                    <TableCell
                      className="table-header"
                      key={col.id}
                      sx={{
                        backgroundColor: "var(--color-background-green-tint)",
                        borderBottom: "2px solid var(--color-border-medium)",
                        width: 200,
                        minWidth: 200,
                        maxWidth: 200,
                        padding: "8px",
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", flexWrap: "nowrap", gap: 0.5 }}
                      >
                        <Select
                          value={col.propertyKey}
                          onChange={(e) => handleCustomHeaderChange(e, col.id)}
                          variant="outlined"
                          displayEmpty
                          size="small"
                          sx={{
                            minWidth: 100,
                            flexGrow: 1,
                            color: "var(--color-primary)",
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            background: "var(--color-white)",
                            "& .MuiOutlinedInput-input": {
                              padding: "4px 8px",
                            },
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {allowedPropertyKeys
                            .filter(
                              (key) =>
                                ![
                                  "fullname",
                                  "address",
                                  "phone",
                                  "deliveryDetails.dietaryRestrictions",
                                  "deliveryDetails.deliveryInstructions",
                                ].includes(key)
                            )
                            .map((key: string) => {
                              let label = key.charAt(0).toUpperCase() + key.slice(1);
                              if (key === "deliveryDetails.dietaryRestrictions.dietaryPreferences")
                                label = "Dietary Preferences";
                              if (key === "famStartDate") label = "FAM Start Date";
                              return (
                                <MenuItem key={key} value={key}>
                                  {key === "none" ? "None" : label}
                                </MenuItem>
                              );
                            })}
                        </Select>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomColumn(col.id);
                          }}
                          sx={{
                            color: "var(--color-error-text)",
                            padding: "2px",
                            minWidth: "auto",
                            "&:hover": {
                              backgroundColor: "rgba(211, 47, 47, 0.04)",
                            },
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        {col.propertyKey !== "none" && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSort(col.propertyKey);
                            }}
                            sx={{
                              color: "var(--color-primary)",
                              padding: "2px",
                              minWidth: "auto",
                              "&:hover": {
                                backgroundColor: "rgba(37, 126, 104, 0.04)",
                              },
                            }}
                            aria-label={`Sort by ${col.label || col.propertyKey}`}
                          >
                            {sortConfig.key === col.propertyKey ? (
                              sortConfig.direction === "asc" ? (
                                <ChevronUp />
                              ) : sortConfig.direction === "desc" ? (
                                <ChevronDown />
                              ) : (
                                <ChevronUpDown />
                              )
                            ) : (
                              <ChevronUpDown />
                            )}
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  ))}
                  {/* Add column button */}
                  <TableCell
                    className="table-header"
                    align="right"
                    sx={{
                      backgroundColor: "var(--color-background-green-tint)",
                      borderBottom: "2px solid var(--color-border-medium)",
                      width: 80,
                      minWidth: 80,
                      maxWidth: 80,
                    }}
                  >
                    <IconButton
                      onClick={handleAddCustomColumn}
                      color="primary"
                      aria-label="add custom column"
                      sx={{
                        backgroundColor: "rgba(37, 126, 104, 0.06)",
                        "&:hover": { backgroundColor: "rgba(37, 126, 104, 0.12)" },
                      }}
                    >
                      <AddIcon sx={{ color: "var(--color-primary)" }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )}
              itemContent={(index, row: RowData) => (
                <SpreadsheetRowContent
                  index={index}
                  row={row}
                  fields={fields}
                  customColumns={customColumns}
                  navigate={navigate}
                  onOpenMenu={handleOpenMenu}
                />
              )}
            />
            <Popover
              open={Boolean(menuAnchorPosition)}
              anchorReference="anchorPosition"
              anchorPosition={
                menuAnchorPosition
                  ? { top: menuAnchorPosition.top, left: menuAnchorPosition.left }
                  : undefined
              }
              onClose={() => {
                setMenuAnchorPosition(null);
                setMenuRow(null);
              }}
              PaperProps={{ elevation: 2, sx: { borderRadius: "8px", minWidth: "150px" } }}
            >
              <MenuItem
                onClick={() => {
                  if (menuRow)
                    navigate(`/profile/${menuRow.uid ?? ""}`, {
                      state: { userData: menuRow },
                    });
                  setMenuAnchorPosition(null);
                  setMenuRow(null);
                }}
                sx={{ py: 1.5 }}
              >
                <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
              </MenuItem>
              <MenuItem
                onClick={() => {
                  if (menuRow) {
                    setClientIdToDelete(menuRow.uid ?? null);
                    setClientNameToDelete(`${menuRow.lastName}, ${menuRow.firstName}`);
                  }
                  setMenuAnchorPosition(null);
                  setMenuRow(null);
                }}
                sx={{ py: 1.5 }}
              >
                <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
              </MenuItem>
            </Popover>
          </TableContainer>
        )}
      </Box>

      <Suspense fallback={null}>
        {Boolean(clientIdToDelete) && (
          <DeleteClientModal
            handleMenuClose={() => {
              setClientIdToDelete(null);
              setClientNameToDelete("");
            }}
            handleDeleteRow={async (id: string) => {
              await clientService.deleteClient(id);
              await refresh();
            }}
            open={Boolean(clientIdToDelete)}
            setOpen={(isOpen: boolean) => {
              if (!isOpen) {
                setClientIdToDelete(null);
                setClientNameToDelete("");
              }
            }}
            id={clientIdToDelete ?? ""}
            name={clientNameToDelete}
          />
        )}
      </Suspense>
    </Box>
  );
};

export default Spreadsheet;
