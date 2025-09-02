import React, { useMemo, useCallback, useState } from "react";
import {
  withPerformanceOptimization,
  useDebounce,
  usePerformanceMonitor,
  useStableCallback,
} from "../../hooks/usePerformance";
import { LazyLoadContainer, ConditionalRender } from "../performance";

// Enhanced table row component with performance optimization
const SpreadsheetRow = withPerformanceOptimization(
  ({
    row,
    columns,
    isSelected,
    onEdit,
    onDelete,
    onSelect,
    isEditing,
    editingData,
    onSave,
    onCancel,
    onFieldChange,
  }: {
    row: any;
    columns: any[];
    isSelected: boolean;
    onEdit: (row: any) => void;
    onDelete: (row: any) => void;
    onSelect: (row: any) => void;
    isEditing: boolean;
    editingData?: any;
    onSave: () => void;
    onCancel: () => void;
    onFieldChange: (field: string, value: any) => void;
  }) => {
    usePerformanceMonitor(`SpreadsheetRow-${row.id}`);

    const stableOnEdit = useStableCallback(() => onEdit(row), [onEdit, row]);
    const stableOnDelete = useStableCallback(() => onDelete(row), [onDelete, row]);
    const stableOnSelect = useStableCallback(() => onSelect(row), [onSelect, row]);

    return (
      <tr className={isSelected ? "selected" : ""}>
        {columns.map((column) => (
          <td key={column.key}>
            <ConditionalRender condition={isEditing}>
              <input
                type="text"
                value={editingData?.[column.key] || ""}
                onChange={(e) => onFieldChange(column.key, e.target.value)}
                placeholder={column.label}
              />
              <span>{row[column.key]}</span>
            </ConditionalRender>
          </td>
        ))}
        <td>
          <ConditionalRender condition={isEditing}>
            <div>
              <button onClick={onSave}>Save</button>
              <button onClick={onCancel}>Cancel</button>
            </div>
            <div>
              <button onClick={stableOnEdit}>Edit</button>
              <button onClick={stableOnDelete}>Delete</button>
            </div>
          </ConditionalRender>
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if essential props change
    return (
      prevProps.row.id === nextProps.row.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isEditing === nextProps.isEditing &&
      JSON.stringify(prevProps.editingData) === JSON.stringify(nextProps.editingData)
    );
  }
);

// Enhanced search component with debouncing
const SpreadsheetSearch = withPerformanceOptimization(
  ({
    onSearch,
    placeholder = "Search...",
    debounceMs = 300,
  }: {
    onSearch: (query: string) => void;
    placeholder?: string;
    debounceMs?: number;
  }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, debounceMs);

    React.useEffect(() => {
      onSearch(debouncedSearchTerm);
    }, [debouncedSearchTerm, onSearch]);

    return (
      <input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />
    );
  }
);

// Virtual scrolling container for large datasets
const VirtualizedSpreadsheet = withPerformanceOptimization(
  ({
    data,
    columns,
    height = 400,
    rowHeight = 50,
    onEdit,
    onDelete,
    selectedRows = [],
    onRowSelect,
  }: {
    data: any[];
    columns: any[];
    height?: number;
    rowHeight?: number;
    onEdit: (row: any) => void;
    onDelete: (row: any) => void;
    selectedRows?: any[];
    onRowSelect: (row: any) => void;
  }) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [editingRow, setEditingRow] = useState<any>(null);
    const [editingData, setEditingData] = useState<any>({});

    usePerformanceMonitor("VirtualizedSpreadsheet");

    // Calculate visible rows
    const visibleRows = useMemo(() => {
      const startIndex = Math.floor(scrollTop / rowHeight);
      const visibleCount = Math.ceil(height / rowHeight);
      const endIndex = Math.min(startIndex + visibleCount + 5, data.length); // Buffer

      return data.slice(startIndex, endIndex).map((row, index) => ({
        ...row,
        virtualIndex: startIndex + index,
      }));
    }, [data, scrollTop, rowHeight, height]);

    const stableOnEdit = useStableCallback((row: any) => {
      setEditingRow(row);
      setEditingData({ ...row });
    }, []);

    const stableOnSave = useStableCallback(() => {
      onEdit(editingData);
      setEditingRow(null);
      setEditingData({});
    }, [editingData, onEdit]);

    const stableOnCancel = useStableCallback(() => {
      setEditingRow(null);
      setEditingData({});
    }, []);

    const stableOnFieldChange = useStableCallback((field: string, value: any) => {
      setEditingData((prev: any) => ({ ...prev, [field]: value }));
    }, []);

    return (
      <div style={{ height, overflow: "auto" }}>
        <div
          style={{ height: data.length * rowHeight, position: "relative" }}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          <div
            style={{
              transform: `translateY(${Math.floor(scrollTop / rowHeight) * rowHeight}px)`,
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            {visibleRows.map((row) => (
              <SpreadsheetRow
                key={row.id}
                row={row}
                columns={columns}
                isSelected={selectedRows.includes(row.id)}
                onEdit={stableOnEdit}
                onDelete={onDelete}
                onSelect={onRowSelect}
                isEditing={editingRow?.id === row.id}
                editingData={editingData}
                onSave={stableOnSave}
                onCancel={stableOnCancel}
                onFieldChange={stableOnFieldChange}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
);

// Performance-optimized spreadsheet controls
const SpreadsheetControls = withPerformanceOptimization(
  ({
    onAdd,
    onExport,
    onImport,
    selectedCount,
    onBulkDelete,
    filters,
    onFilterChange,
  }: {
    onAdd: () => void;
    onExport: () => void;
    onImport: () => void;
    selectedCount: number;
    onBulkDelete: () => void;
    filters: any;
    onFilterChange: (filters: any) => void;
  }) => {
    return (
      <div className="spreadsheet-controls">
        <button onClick={onAdd}>Add New</button>
        <button onClick={onExport}>Export</button>
        <button onClick={onImport}>Import</button>
        <ConditionalRender condition={selectedCount > 0}>
          <button onClick={onBulkDelete}>Delete Selected ({selectedCount})</button>
        </ConditionalRender>
      </div>
    );
  }
);

export { SpreadsheetRow, SpreadsheetSearch, VirtualizedSpreadsheet, SpreadsheetControls };
