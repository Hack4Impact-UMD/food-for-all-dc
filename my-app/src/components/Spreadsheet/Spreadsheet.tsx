import './Spreadsheet.css';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../services/firebase";
import { TableSortLabel, Icon } from "@mui/material";
import {
  parseSearchTermsProgressively,
  checkStringContains,
  extractKeyValue,
  globalSearchMatch
} from "../../utils/searchFilter";
// Custom chevron icons for TableSortLabel with spacing
const iconStyle = { verticalAlign: 'middle', marginLeft: 6 };
const ChevronUp = () => (
  <Icon fontSize="small" style={iconStyle}>keyboard_arrow_up</Icon>
);
const ChevronDown = () => (
  <Icon fontSize="small" style={iconStyle}>keyboard_arrow_down</Icon>
);
const ChevronUpDown = () => (
  <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1, marginLeft: 6 }}>
    <Icon fontSize="small" style={{ marginBottom: -4 }}>keyboard_arrow_up</Icon>
    <Icon fontSize="small" style={{ marginTop: -4 }}>keyboard_arrow_down</Icon>
  </span>
);
import { Box, Button, IconButton, Paper, Table, TableContainer, TableRow, TableCell, Stack, Chip, Dialog, DialogActions, DialogTitle, DialogContent, Skeleton } from "@mui/material";
import { Popover } from "@mui/material";
import type { RowData } from "./export";
import { TableVirtuoso } from 'react-virtuoso';
import React, { forwardRef, useEffect, useState, useMemo, Suspense } from 'react';
import type { HTMLAttributes } from 'react';
import { useCustomColumns, allowedPropertyKeys } from "../../hooks/useCustomColumns";
import DietaryRestrictionsLegend from "../DietaryRestrictionsLegend";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { Select, MenuItem } from "@mui/material";
// Duplicate import removed
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { styled } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

import { exportQueryResults, exportAllClients } from "./export";
const DeleteClientModal = React.lazy(() => import("./DeleteClientModal"));
import { clientService } from '../../services/client-service';
import { useClientData } from '../../context/ClientDataContext';

const StyleChip = styled(Chip)(({ theme }) => ({
  fontWeight: 500,
  fontSize: "0.85rem",
  backgroundColor: theme.palette.primary.light,
  color: theme.palette.primary.contrastText,
  borderRadius: 8,
  padding: "0 8px",
  margin: "2px 2px 2px 0",
  cursor: "pointer",
  '&:hover': {
    backgroundColor: theme.palette.primary.main
  }
}));

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
          <StyleChip key={i} label={tag} size="small" onClick={(e) => e.preventDefault()} sx={{ mb: 0.5, mr: 0.5 }} />
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
    return value !== undefined && value !== null && value !== "N/A" ? value.toString() : "";
  }
  const value = row[propertyKey];
  return value !== undefined && value !== null && value !== "N/A" ? value.toString() : "";

}

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
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' | null }>({ key: 'fullname', direction: 'asc' });

  // Sorting handler
  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        // Toggle direction only between asc and desc
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return { key, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };
  const [rows, setRows] = useState<RowData[]>([]);
  const [forceRerender, setForceRerender] = useState(0);
  const virtuosoRef = React.useRef<any>(null);
  const { clients, refresh } = useClientData();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [menuAnchorPosition, setMenuAnchorPosition] = useState<{ top: number; left: number } | null>(null);
  const [menuRow, setMenuRow] = useState<RowData | null>(null);
  // Remove selectedRowId if not used elsewhere
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [clientIdToDelete, setClientIdToDelete] = useState<string | null>(null);
  const [clientNameToDelete, setClientNameToDelete] = useState<string>("");
  // ...existing code...
  const customColumnsHook = useCustomColumns({ page: "Spreadsheet" });
  const customColumns = customColumnsHook.customColumns;
  const handleAddCustomColumn = customColumnsHook.handleAddCustomColumn;
  const handleCustomHeaderChange = customColumnsHook.handleCustomHeaderChange;
  const handleRemoveCustomColumn = customColumnsHook.handleRemoveCustomColumn;

  useEffect(() => {
    setRows(clients);
    setTimeout(() => {
      if (virtuosoRef.current && typeof virtuosoRef.current.scrollToIndex === 'function') {
        virtuosoRef.current.scrollToIndex({ index: 0, align: 'start' });
      }
      setForceRerender(f => f + 1);
    }, 100);
  }, [clients]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // TableVirtuoso MUI integration
  const TableComponent = forwardRef<HTMLTableElement, React.ComponentProps<typeof Table>>((props, ref) => (
    <Table {...props} ref={ref} stickyHeader />
  ));
  TableComponent.displayName = 'VirtuosoTable';
  const TableHeadComponent = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>((props, ref) => (
    <thead {...props} ref={ref} />
  ));
  TableHeadComponent.displayName = 'VirtuosoTableHead';
  const TableRowComponent = forwardRef<HTMLTableRowElement, React.ComponentProps<typeof TableRow>>((props, ref) => (
    <TableRow {...props} ref={ref} className={['table-row', props.className].filter(Boolean).join(' ')} />
  ));
  TableRowComponent.displayName = 'VirtuosoTableRow';
  const TableBodyComponent = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>((props, ref) => (
    <tbody {...props} ref={ref} />
  ));
  TableBodyComponent.displayName = 'VirtuosoTableBody';
  const VirtuosoTableComponents = {
    Table: TableComponent,
    TableHead: TableHeadComponent,
    TableRow: TableRowComponent,
    TableBody: TableBodyComponent,
  } as const;

  // --- Fields for table columns ---
  const fields = useMemo(() => [
    { key: "fullname", label: "Name", type: "text", compute: (data: RowData) => `${data.lastName}, ${data.firstName}` },
    { key: "address", label: "Address", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "deliveryDetails.dietaryRestrictions", label: "Dietary Restrictions", type: "text", compute: (data: RowData) => {
      const dr = data.deliveryDetails?.dietaryRestrictions;
      if (!dr) return <span style={{ color: '#888' }}>None</span>;
      // Define categories
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
      if (Array.isArray(dr.foodAllergens) && dr.foodAllergens.length > 0) allergies.push(...dr.foodAllergens);
      if (Array.isArray(dr.other) && dr.other.length > 0) other.push(...dr.other);
      if (dr.otherText && dr.otherText.trim() !== "") other.push(dr.otherText.trim());
      // Render chips
      const chips: React.ReactNode[] = [];
      dietary.forEach((item, i) => chips.push(
        <Chip key={`dietary-${item}-${i}`} label={item} size="small" sx={{ backgroundColor: '#e6f4ea', color: '#257e68', fontWeight: 500, mr: 0.5, mb: 0.5 }} />
      ));
      allergies.forEach((item, i) => chips.push(
        <Chip key={`allergy-${item}-${i}`} label={item} size="small" sx={{ backgroundColor: '#fdeaea', color: '#c62828', fontWeight: 500, mr: 0.5, mb: 0.5 }} />
      ));
      other.forEach((item, i) => chips.push(
        <Chip key={`other-${item}-${i}`} label={item} size="small" sx={{ backgroundColor: '#f3eafd', color: '#6c3483', fontWeight: 500, mr: 0.5, mb: 0.5 }} />
      ));
      return chips.length > 0 ? chips : <span style={{ color: '#888' }}>None</span>;
    } },
    { key: "deliveryDetails.deliveryInstructions", label: "Delivery Instructions", type: "text", compute: (data: RowData) => data.deliveryDetails?.deliveryInstructions || "None" },
    { key: "lastDeliveryDate", label: "Last Delivery Date", type: "text", compute: (data: RowData) => data.lastDeliveryDate || "" },
  ], []);

  // --- Sorting and filtering logic (with sorting) ---
  // Ensure filteredRows is always the correct RowData shape for export, and optimize with useMemo
  const filteredRows: RowData[] = useMemo(() => {
  let result = rows;
    if (debouncedSearch.trim()) {
      const validSearchTerms = parseSearchTermsProgressively(debouncedSearch.trim());

      const keyValueTerms = validSearchTerms.filter(term => term.includes(':'));
      const nonKeyValueTerms = validSearchTerms.filter(term => !term.includes(':'));
      
      if (keyValueTerms.length > 0) {
        const visibleFieldKeys = new Set([
          ...fields.map(f => f.key),
          ...customColumns.map(col => col.propertyKey).filter(key => key !== "none")
        ]);

        const isVisibleField = (keyword: string): boolean => {
          const lowerKeyword = keyword.toLowerCase();

          const fieldMappings: { [key: string]: string[] } = {
            "fullname": ["name", "firstname", "lastname"],
            "address": ["address"],
            "phone": ["phone"],
            "deliveryDetails.dietaryRestrictions": ["dietary restrictions", "dietary"],
            "deliveryDetails.deliveryInstructions": ["delivery instructions", "instructions"]
          };

          for (const [fieldKey, aliases] of Object.entries(fieldMappings)) {
            if (visibleFieldKeys.has(fieldKey) && aliases.some(alias => alias === lowerKeyword)) {
              return true;
            }
          }

          const customColumnMappings: { [key: string]: string[] } = {
            "adults": ["adults"],
            "children": ["children"],
            "deliveryFreq": ["delivery freq", "delivery frequency"],
            "ethnicity": ["ethnicity"],
            "gender": ["gender"],
            "language": ["language"],
            "notes": ["notes"],
            "referralEntity": ["referral entity", "referral"],
            "tefapCert": ["tefap", "tefap cert"],
            "dob": ["dob"],
            "lastDeliveryDate": ["last delivery date"],
            "email": ["email"]
          };

          for (const [propertyKey, aliases] of Object.entries(customColumnMappings)) {
            if (visibleFieldKeys.has(propertyKey) && aliases.some(alias => alias === lowerKeyword)) {
              return true;
            }
          }

          return false;
        };

        result = result.filter(row => {
          return keyValueTerms.every(term => {
            const { keyword, searchValue, isKeyValue: isKeyValueSearch } = extractKeyValue(term);

            if (isKeyValueSearch && searchValue) {
              if (!isVisibleField(keyword)) {
                return true;
              }

              switch (keyword) {
                case "name":
                case "firstname":
                  return checkStringContains(row.firstName, searchValue);
                case "lastname":
                  return checkStringContains(row.lastName, searchValue);
                case "address":
                  return checkStringContains(row.address, searchValue);
                case "phone":
                  return checkStringContains(row.phone, searchValue);
                case "email":
                  return checkStringContains(row.email, searchValue);
                case "dietary restrictions":
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
                    dr.otherText || ""
                  ].filter(Boolean);
                  return dietaryTerms.some(term => checkStringContains(term, searchValue));
                }
                case "delivery instructions":
                case "instructions":
                  return checkStringContains(row.deliveryDetails?.deliveryInstructions, searchValue);
                default: {
                  const matchesCustomColumn = customColumns.some((col) => {
                    if (col.propertyKey !== "none" && visibleFieldKeys.has(col.propertyKey)) {
                      if (col.propertyKey.includes(".")) {
                        const keys = col.propertyKey.split(".");
                        let value: unknown = row;
                        for (const k of keys) {
                          value = value && (value as Record<string, unknown>)[k];
                          if (value === undefined) return false;
                        }
                        return checkStringContains(String(value || ""), searchValue);
                      } else {
                        if (col.propertyKey in row) {
                          const fieldValue = row[col.propertyKey as keyof RowData];
                          return checkStringContains(fieldValue, searchValue);
                        }
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
          'firstName',
          'lastName',
          'address',
          'phone',
          'email',
          'deliveryDetails.deliveryInstructions',
          ...customColumns.map(col => col.propertyKey).filter(key => key !== "none")
        ];
        result = result.filter(row =>
          nonKeyValueTerms.every(term => globalSearchMatch(row, term, searchableFields))
        );
      }
    }
    // Sort if needed
    if (sortConfig.key && sortConfig.direction) {
      const field = fields.find(f => f.key === sortConfig.key);
      if (field) {
        // Special case for fullname: sort by lastName, firstName
        if (field.key === 'fullname') {
          result = [...result].sort((a, b) => {
            const aLast = a.lastName?.toLowerCase() || '';
            const bLast = b.lastName?.toLowerCase() || '';
            if (aLast < bLast) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aLast > bLast) return sortConfig.direction === 'asc' ? 1 : -1;
            const aFirst = a.firstName?.toLowerCase() || '';
            const bFirst = b.firstName?.toLowerCase() || '';
            if (aFirst < bFirst) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aFirst > bFirst) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
          });
        } else {
          // Use field.compute if present, else direct property
          result = [...result].sort((a, b) => {
            const aValue = field.compute ? field.compute(a) : a[field.key];
            const bValue = field.compute ? field.compute(b) : b[field.key];
            // If compute returns a ReactNode (e.g., chips), fallback to string
            const aComp = typeof aValue === 'string' || typeof aValue === 'number' ? aValue : (aValue?.props?.label || aValue?.toString?.() || '');
            const bComp = typeof bValue === 'string' || typeof bValue === 'number' ? bValue : (bValue?.props?.label || bValue?.toString?.() || '');
            if (aComp === null || aComp === undefined) {
              if (bComp === null || bComp === undefined) return 0;
              return 1;
            }
            if (bComp === null || bComp === undefined) return -1;
            if (aComp < bComp) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aComp > bComp) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
          });
        }
      } else {
        // Custom column: sort by string value
        result = [...result].sort((a, b) => {
          const aValue = a[sortConfig.key as keyof RowData];
          const bValue = b[sortConfig.key as keyof RowData];
          const aStr = aValue === null || aValue === undefined ? '' : String(aValue).toLowerCase();
          const bStr = bValue === null || bValue === undefined ? '' : String(bValue).toLowerCase();
          if (aStr === bStr) return 0;
          if (sortConfig.direction === 'asc') {
            return aStr < bStr ? -1 : 1;
          } else {
            return aStr > bStr ? -1 : 1;
          }
        });
      }
    }
    return result;
  }, [rows, debouncedSearch, sortConfig, fields, customColumns]);

  // --- TableVirtuoso rendering ---
  return (
  <Box className="box" sx={{ px: { xs: 2, sm: 3, md: 4 }, py: 2, maxWidth: "100%", overflowX: "hidden", backgroundColor: "transparent", position: "relative", display: "flex", flexDirection: "column", mt: 0, height: 'calc(100vh - 133px)' }}>
      <div style={{ color: '#257e68', fontWeight: 600, marginBottom: 8 }}>
      </div>
      {/* Search bar and actions */}
      <Box sx={{ position: "sticky", top: 0, width: "100%", zIndex: 10, backgroundColor: "#fff", pb: 3, pt: 0, borderBottom: "none", boxShadow: "none", margin: 0 }}>
        <Stack spacing={3}>
          <Box sx={{ position: "relative", width: "100%" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder='Search clients (e.g., smith, name:john, address:"main st")'
              style={{ width: "100%", height: "50px", backgroundColor: "#EEEEEE", border: "none", borderRadius: "25px", padding: "0 48px", fontSize: "16px", color: "#333333", boxSizing: "border-box", transition: "all 0.2s ease", boxShadow: "inset 0 2px 3px rgba(0,0,0,0.05)" }}
            />
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ '& .MuiButton-root': { height: { sm: '36px' } } }}>
            <Button variant="contained" color="secondary" onClick={() => setSearchQuery("")} className="view-all" sx={{ borderRadius: "25px", px: 2, py: 0.5, minWidth: { xs: '100%', sm: '100px' }, maxWidth: { sm: '120px' }, textTransform: "none", fontSize: "0.875rem", lineHeight: 1.5, boxShadow: "0 2px 4px rgba(0,0,0,0.1)", transition: "all 0.2s ease", "&:hover": { transform: "translateY(-2px)", boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>View All</Button>
            <Button variant="contained" color="primary" onClick={() => setExportDialogOpen(true)} sx={{ borderRadius: "25px", px: 2, py: 0.5, minWidth: { xs: '100%', sm: '100px' }, maxWidth: { sm: '120px' }, textTransform: "none", fontSize: "0.875rem", lineHeight: 1.5, boxShadow: "0 2px 4px rgba(0,0,0,0.1)", transition: "all 0.2s ease", "&:hover": { transform: "translateY(-2px)", boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>Export</Button>
            <Suspense fallback={null}>
              {exportDialogOpen && (
                <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="xs" fullWidth>
                  <DialogTitle>Export Options</DialogTitle>
                  <DialogContent sx={{ pt: 3, overflow: "visible" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <Button variant="contained" color="primary" onClick={() => { setExportDialogOpen(false); exportQueryResults(filteredRows, customColumns); }}>Export Query Results</Button>
                      <Button variant="contained" color="secondary" onClick={() => { setExportDialogOpen(false); exportAllClients(rows); }}>Export All Clients</Button>
                    </Box>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setExportDialogOpen(false)} color="error">Cancel</Button>
                  </DialogActions>
                </Dialog>
              )}
            </Suspense>
            <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "flex-end" }}>
              <Button variant="contained" color="primary" onClick={() => navigate("/profile")} className="create-client" sx={{ backgroundColor: "#2E5B4C", borderRadius: "25px", px: 2, py: 0.5, minWidth: { xs: '100%', sm: '140px' }, maxWidth: { sm: '160px' }, textTransform: "none", fontSize: "0.875rem", lineHeight: 1.5, boxShadow: "0 2px 4px rgba(0,0,0,0.1)", transition: "all 0.2s ease", "&:hover": { backgroundColor: "#234839", transform: "translateY(-2px)", boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }, alignSelf: { xs: 'stretch', sm: 'flex-end' } }}>+ Create Client</Button>
            </Box>
          </Stack>
        </Stack>
      </Box>
      
      {/* Dietary Restrictions Color Legend */}
      <DietaryRestrictionsLegend />
      
    {/* TableVirtuoso for desktop/table view only */}
  <Box className="table-container" sx={{ mt: 1, mb: 0, width: "100%", flex: 1, minHeight: 0, overflow: 'auto' }}>
        {rows.length === 0 ? (
          <TableContainer component={Paper} sx={{ height: '100%', boxShadow: "0 4px 12px rgba(0,0,0,0.05)", borderRadius: "12px", overflow: 'auto', minHeight: 0 }}>
            <Table sx={{ minWidth: 650 }}>
              <tbody>
                <TableRow>
                  {fields.map((field) => (
                    <TableCell key={field.key}><Skeleton variant="text" width={100} /></TableCell>
                  ))}
                  {customColumns.map((col) => (
                    <TableCell key={col.id}><Skeleton variant="text" width={100} /></TableCell>
                  ))}
                  <TableCell key="actions"><Skeleton variant="circular" width={32} height={32} /></TableCell>
                </TableRow>
                {[...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    {fields.map((field) => (
                      <TableCell key={field.key}><Skeleton variant="rectangular" width={100} height={24} /></TableCell>
                    ))}
                    {customColumns.map((col) => (
                      <TableCell key={col.id}><Skeleton variant="rectangular" width={100} height={24} /></TableCell>
                    ))}
                    <TableCell key="actions"><Skeleton variant="circular" width={32} height={32} /></TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        ) : (
          <TableContainer component={Paper} sx={{ height: '100%', boxShadow: "0 4px 12px rgba(0,0,0,0.05)", borderRadius: "12px", overflow: 'auto', minHeight: 0 }}>
            <TableVirtuoso
              ref={virtuosoRef}
              style={{ height: '100%' }}
              data={filteredRows}
              components={VirtuosoTableComponents}
              overscan={200}
              key={forceRerender}
              fixedHeaderContent={() => (
                <TableRow sx={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  {fields.map((field) => (
                    <TableCell
                      className="table-header"
                      key={field.key}
                      sx={{ backgroundColor: "#f5f9f7", borderBottom: "2px solid #e0e0e0", width: 160, minWidth: 160, maxWidth: 160, cursor: 'pointer' }}
                      onClick={() => handleSort(field.key)}
                    >
                      <TableSortLabel
                        active={sortConfig.key === field.key}
                        direction={sortConfig.direction === null ? 'asc' : sortConfig.direction}
                        hideSortIcon={true}
                        IconComponent={() => null}
                      >
                        {field.label}
                        {sortConfig.key === field.key
                          ? (sortConfig.direction === 'asc' ? <ChevronUp />
                            : sortConfig.direction === 'desc' ? <ChevronDown />
                            : <ChevronUpDown />)
                          : <ChevronUpDown />}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                  {/* Custom columns header */}
                  {customColumns.map((col) => (
                    <TableCell className="table-header" key={col.id} sx={{ backgroundColor: "#f5f9f7", borderBottom: "2px solid #e0e0e0", width: 200, minWidth: 200, maxWidth: 200, padding: '8px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 0.5 }}>
                        <Select
                          value={col.propertyKey}
                          onChange={e => handleCustomHeaderChange(e, col.id)}
                          variant="outlined"
                          displayEmpty
                          size="small"
                          sx={{ 
                            minWidth: 100, 
                            flexGrow: 1,
                            color: "#257e68", 
                            fontWeight: 600, 
                            fontSize: '0.875rem', 
                            background: 'white',
                            '& .MuiOutlinedInput-input': {
                              padding: '4px 8px'
                            }
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          {allowedPropertyKeys
                            .filter(key => ![
                              'fullname',
                              'address',
                              'phone',
                              'deliveryDetails.dietaryRestrictions',
                              'deliveryDetails.deliveryInstructions'
                            ].includes(key))
                            .map((key: string) => {
                              let label = key.charAt(0).toUpperCase() + key.slice(1);
                              if (key === "deliveryDetails.dietaryRestrictions.dietaryPreferences") label = "Dietary Preferences";
                              return <MenuItem key={key} value={key}>{key === 'none' ? 'None' : label}</MenuItem>;
                            })}
                        </Select>
                        <IconButton 
                          size="small" 
                          onClick={e => { e.stopPropagation(); handleRemoveCustomColumn(col.id); }} 
                          sx={{ 
                            color: "#d32f2f", 
                            padding: '2px',
                            minWidth: 'auto',
                            '&:hover': {
                              backgroundColor: 'rgba(211, 47, 47, 0.04)'
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        {col.propertyKey !== 'none' && (
                          <IconButton
                            size="small"
                            onClick={e => {
                              e.stopPropagation();
                              handleSort(col.propertyKey);
                            }}
                            sx={{ 
                              color: '#257e68', 
                              padding: '2px',
                              minWidth: 'auto',
                              '&:hover': {
                                backgroundColor: 'rgba(37, 126, 104, 0.04)'
                              }
                            }}
                            aria-label={`Sort by ${col.label || col.propertyKey}`}
                          >
                            {sortConfig.key === col.propertyKey
                              ? (sortConfig.direction === 'asc' ? <ChevronUp />
                                : sortConfig.direction === 'desc' ? <ChevronDown />
                                : <ChevronUpDown />)
                              : <ChevronUpDown />}
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  ))}
                  {/* Add column button */}
                  <TableCell className="table-header" align="right" sx={{ backgroundColor: "#f5f9f7", borderBottom: "2px solid #e0e0e0", width: 80, minWidth: 80, maxWidth: 80 }}>
                    <IconButton onClick={handleAddCustomColumn} color="primary" aria-label="add custom column" sx={{ backgroundColor: "rgba(37, 126, 104, 0.06)", '&:hover': { backgroundColor: "rgba(37, 126, 104, 0.12)" } }}>
                      <AddIcon sx={{ color: "#257e68" }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )}
              itemContent={(index, row: RowData) => {
                const rowBg = index % 2 === 0 ? 'rgb(243, 243, 243)' : 'rgb(249, 249, 249)';
                return [
                  ...fields.map((field) => (
                    <TableCell key={field.key} sx={{ py: 2, width: 160, minWidth: 160, maxWidth: 160, backgroundColor: rowBg }}>
                      {field.key === "fullname"
                        ? (
                          <a
                            className="name-link"
                            href="#"
                            onClick={e => { e.preventDefault(); navigate(`/profile/${row.uid ?? ''}`, { state: { userData: row } }); }}
                          >
                            {field.compute ? field.compute(row) : `${row.lastName}, ${row.firstName}`}
                          </a>
                        )
                        : field.compute
                        ? field.compute(row)
                        : row[field.key as keyof RowData]}
                    </TableCell>
                  )),
                  ...customColumns.map((col) => (
                    <TableCell key={col.id} sx={{ py: 2, width: 200, minWidth: 200, maxWidth: 200, backgroundColor: rowBg }}>
                      {col.propertyKey !== "none" ? getCustomColumnDisplay(row, col.propertyKey) : "N/A"}
                    </TableCell>
                  )),
                  <TableCell align="right" sx={{ py: 2, width: 80, minWidth: 80, maxWidth: 80, backgroundColor: rowBg }} key={`actions-${row.id}`}>
                    <IconButton onClick={e => { e.stopPropagation(); setMenuAnchorPosition({ top: e.clientY, left: e.clientX }); setMenuRow(row); }} sx={{ color: "#757575", "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.04)", color: "#2E5B4C" } }}>
                      <MoreVertIcon />
                    </IconButton>
                    <Popover
                      open={Boolean(menuAnchorPosition)}
                      anchorReference="anchorPosition"
                      anchorPosition={menuAnchorPosition ? { top: menuAnchorPosition.top, left: menuAnchorPosition.left } : undefined}
                      onClose={() => { setMenuAnchorPosition(null); setMenuRow(null); }}
                      PaperProps={{ elevation: 3, sx: { borderRadius: "8px", minWidth: "150px" } }}
                    >
                      <MenuItem onClick={() => { if (menuRow) navigate(`/profile/${menuRow.uid ?? ''}`, { state: { userData: menuRow } }); setMenuAnchorPosition(null); setMenuRow(null); }} sx={{ py: 1.5 }}><EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit</MenuItem>
                      <MenuItem onClick={() => {
                        if (menuRow) {
                          setClientIdToDelete(menuRow.uid ?? null);
                          setClientNameToDelete(`${menuRow.lastName}, ${menuRow.firstName}`);
                        }
                        setMenuAnchorPosition(null);
                        setMenuRow(null);
                      }} sx={{ py: 1.5 }}><DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete</MenuItem>
                    </Popover>
                  </TableCell>
                ];
              }}
            />
          </TableContainer>
        )}
      </Box>

      <Suspense fallback={null}>
        {Boolean(clientIdToDelete) && (
          <DeleteClientModal
            handleMenuClose={() => { setClientIdToDelete(null); setClientNameToDelete(""); }}
            handleDeleteRow={async (id: string) => {
              await clientService.deleteClient(id);
              await refresh();
            }}
            open={Boolean(clientIdToDelete)}
            setOpen={(isOpen: boolean) => { if (!isOpen) { setClientIdToDelete(null); setClientNameToDelete(""); } }}
            id={clientIdToDelete ?? ""}
            name={clientNameToDelete}
          />
        )}
      </Suspense>
    </Box>
  );
};

export default Spreadsheet;
