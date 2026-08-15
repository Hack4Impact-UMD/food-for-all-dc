// Read-only value input control for a single Client Query Tool filter row.
// Renders the correct control (boolean select, number, text, tag/org dropdown, date picker)
// based on the selected field's inferred type.

import React from "react";
import { Autocomplete, MenuItem, TextField } from "@mui/material";
import { QueryFieldDef, QueryOperator } from "../../types/query-tool-types";
import { formatAssignedTime, formatPhoneNumber } from "../../utils/queryToolFormatting";

interface FilterValueInputProps {
  fieldDef: QueryFieldDef;
  operator: QueryOperator | "";
  value: unknown;
  onChange: (value: unknown) => void;
  tagOptions: string[];
  referralOrgOptions: string[];
  driverOptions: string[];
  fieldOptions: string[];
  errorText?: string;
  id: string;
}

const isListOperator = (operator: QueryOperator | "") =>
  operator === "in" || operator === "not-in" || operator === "array-contains-any";

const cleanReferralOrganizationLabel = (value: string): string =>
  value
    .replace(/^\s*,\s*/, "")
    .trim();

const isOrganizationField = (field: QueryFieldDef): boolean =>
  field.field === "organization" || field.field === "referralEntity.organization";

const isWardField = (field: QueryFieldDef): boolean => field.field === "ward";
const isClusterField = (field: QueryFieldDef): boolean => field.field === "cluster";

const SearchableValueInput: React.FC<{
  options: string[];
  value: unknown;
  onChange: (value: unknown) => void;
  commonProps: Record<string, unknown>;
  labelId: string;
  optionLabels?: Record<string, string>;
  optionValues?: Record<string, string>;
}> = ({ options, value, onChange, commonProps, labelId, optionLabels, optionValues }) => (
  <Autocomplete
    freeSolo
    options={options}
    getOptionLabel={(option) => optionLabels?.[option] ?? option}
    value={typeof value === "string" ? value : null}
    onChange={(_, nextValue) => onChange(optionValues?.[nextValue ?? ""] ?? nextValue ?? "")}
    onInputChange={(_, nextValue, reason) => {
      if (reason === "input") {
        onChange(optionValues?.[nextValue] ?? nextValue);
      }
    }}
    renderInput={(params) => (
      <TextField
        {...params}
        {...commonProps}
        label="Value"
        aria-labelledby={labelId}
      />
    )}
  />
);

const MultiValueInput: React.FC<{
  options: string[];
  value: unknown;
  onChange: (value: unknown) => void;
  commonProps: Record<string, unknown>;
  optionLabels?: Record<string, string>;
  optionValues?: Record<string, string>;
}> = ({ options, value, onChange, commonProps, optionLabels, optionValues }) => {
  const rawSelectedValues = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  const selectedValues = rawSelectedValues.map((selected) => optionLabels?.[selected] ?? selected);

  return (
    <Autocomplete
      multiple
      freeSolo
      options={options}
      value={selectedValues}
      onChange={(_, nextValues) =>
        onChange(nextValues.map((nextValue) => optionValues?.[nextValue] ?? nextValue))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          {...commonProps}
          label="Values"
          placeholder="Select or type values"
        />
      )}
    />
  );
};

const FilterValueInput: React.FC<FilterValueInputProps> = ({
  fieldDef,
  operator,
  value,
  onChange,
  tagOptions,
  referralOrgOptions,
  driverOptions,
  fieldOptions,
  errorText,
  id,
}) => {
  const labelId = `${id}-value-label`;
  const commonProps = {
    id: `${id}-value`,
    fullWidth: true,
    size: "small" as const,
    error: Boolean(errorText),
    helperText: errorText,
  };
  const smartOptions = Array.from(
    new Set([
      ...(fieldDef.options || []),
      ...(isOrganizationField(fieldDef) ? referralOrgOptions : []),
      ...(fieldDef.field === "assignedDriverName" ? driverOptions : []),
      ...(fieldDef.type === "textList" ? tagOptions : []),
      ...fieldOptions,
    ])
  );
  const displayOptions = Array.from(
    new Set(
      fieldDef.format === "phone" ? smartOptions.map(formatPhoneNumber).filter(Boolean) : smartOptions
    )
  );
  const optionLabels =
    isOrganizationField(fieldDef)
      ? Object.fromEntries(displayOptions.map((option) => [option, cleanReferralOrganizationLabel(option)]))
      : undefined;
  const selectableOptions =
    isOrganizationField(fieldDef)
      ? displayOptions.filter((option) => Boolean(optionLabels?.[option]))
      : displayOptions;
  const dropdownOptions =
    isOrganizationField(fieldDef)
      ? Array.from(new Set(selectableOptions.map((option) => optionLabels?.[option] ?? option)))
      : selectableOptions;
  const optionValues =
    isOrganizationField(fieldDef)
      ? Object.fromEntries(selectableOptions.map((option) => [optionLabels?.[option] ?? option, option]))
      : undefined;
  const timeOptionLabels =
    fieldDef.field === "assignedTime"
      ? Object.fromEntries(selectableOptions.map((option) => [option, formatAssignedTime(option)]))
      : undefined;
  const timeDropdownOptions =
    fieldDef.field === "assignedTime"
      ? Array.from(new Set(selectableOptions.map((option) => formatAssignedTime(option))))
      : dropdownOptions;
  const timeOptionValues =
    fieldDef.field === "assignedTime"
      ? Object.fromEntries(selectableOptions.map((option) => [formatAssignedTime(option), option]))
      : optionValues;
  const normalizedDropdownOptions = isWardField(fieldDef) || isClusterField(fieldDef)
    ? Array.from(new Set(selectableOptions.map((option) => {
        if (isClusterField(fieldDef) && option === "0") return "Unassigned";
        return option.match(/\d+/)?.[0] || "";
      }).filter(Boolean)))
    : dropdownOptions;
  const normalizedOptionLabels = isWardField(fieldDef) || isClusterField(fieldDef)
    ? Object.fromEntries(selectableOptions.map((option) => [option, isClusterField(fieldDef) && option === "0" ? "Unassigned" : option.match(/\d+/)?.[0] || option]))
    : optionLabels;
  const normalizedOptionValues = isWardField(fieldDef)
    ? Object.fromEntries(normalizedDropdownOptions.map((option) => [option, option]))
    : isClusterField(fieldDef)
      ? Object.fromEntries(selectableOptions.map((option) => [option === "0" ? "Unassigned" : option, option]))
    : optionValues;

  if (fieldDef.type === "boolean") {
    return (
      <TextField
        {...commonProps}
        select
        label="Value"
        value={value === true ? "true" : value === false ? "false" : ""}
        onChange={(e) => onChange(e.target.value === "true")}
      >
        <MenuItem value="true">True</MenuItem>
        <MenuItem value="false">False</MenuItem>
      </TextField>
    );
  }

  if (fieldDef.type === "number") {
    if (isListOperator(operator)) {
      return (
        <MultiValueInput
          options={normalizedDropdownOptions}
          value={isClusterField(fieldDef) && String(value ?? "") === "0" ? "Unassigned" : value}
          onChange={onChange}
          commonProps={commonProps}
          optionLabels={normalizedOptionLabels}
          optionValues={normalizedOptionValues}
        />
      );
    }
    if (selectableOptions.length > 0) {
      return (
        <SearchableValueInput
          options={normalizedDropdownOptions}
          value={value}
          onChange={onChange}
          commonProps={commonProps}
          labelId={labelId}
          optionLabels={normalizedOptionLabels}
          optionValues={normalizedOptionValues}
        />
      );
    }
    return (
      <TextField
        {...commonProps}
        type="number"
        label="Value"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    );
  }

  if (fieldDef.format === "phone") {
    if (isListOperator(operator)) {
      return (
        <MultiValueInput
          options={dropdownOptions}
          value={value}
          onChange={onChange}
          commonProps={commonProps}
        />
      );
    }
    return (
      <TextField
        {...commonProps}
        label="Value"
        value={formatPhoneNumber(value)}
        onChange={(e) => onChange(formatPhoneNumber(e.target.value))}
        placeholder="(XXX) XXX-XXXX"
      />
    );
  }

  if (fieldDef.type === "timestamp") {
    // Date only — the field stores a precise instant, but queries compare whole days.
    return (
      <TextField
        {...commonProps}
        type="date"
        label="Value"
        InputLabelProps={{ shrink: true }}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (fieldDef.field === "assignedTime") {
    if (isListOperator(operator)) {
      return (
        <MultiValueInput
          options={timeDropdownOptions}
          value={value}
          onChange={onChange}
          commonProps={commonProps}
          optionLabels={timeOptionLabels}
          optionValues={timeOptionValues}
        />
      );
    }
    return (
      <SearchableValueInput
        options={timeDropdownOptions}
        value={typeof value === "string" ? formatAssignedTime(value) : value}
        onChange={onChange}
        commonProps={commonProps}
        labelId={labelId}
        optionLabels={timeOptionLabels}
        optionValues={timeOptionValues}
      />
    );
  }

  if (fieldDef.type === "textList") {
    // e.g. tags — offer known values as a dropdown when available.
    if (operator === "array-contains") {
      if (displayOptions.length > 0) {
        return (
          <SearchableValueInput
            options={displayOptions}
            value={value}
            onChange={onChange}
            commonProps={commonProps}
            labelId={labelId}
          />
        );
      }
      return (
        <TextField
          {...commonProps}
          label="Value"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    if (isListOperator(operator) && displayOptions.length > 0) {
      return (
        <MultiValueInput
          options={dropdownOptions}
          value={value}
          onChange={onChange}
          commonProps={commonProps}
        />
      );
    }

    if (displayOptions.length > 0 && !isListOperator(operator)) {
      return (
        <SearchableValueInput
          options={dropdownOptions}
          value={value}
          onChange={onChange}
          commonProps={commonProps}
          labelId={labelId}
          optionLabels={optionLabels}
        />
      );
    }
    return (
      <TextField
        {...commonProps}
        label="Value"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (isListOperator(operator)) {
    return (
      <MultiValueInput
        options={normalizedDropdownOptions}
        value={value}
        onChange={onChange}
        commonProps={commonProps}
      />
    );
  }

  // Text fields: prefer known option lists (ward, quadrant, referral org) as dropdowns.
  const options = normalizedDropdownOptions;

  if (options && options.length > 0 && !isListOperator(operator)) {
    return (
      <SearchableValueInput
        options={options}
        value={isWardField(fieldDef) ? String(value ?? "").match(/\d+/)?.[0] || "" : value}
        onChange={onChange}
        commonProps={commonProps}
        labelId={labelId}
        optionLabels={optionLabels}
        optionValues={normalizedOptionValues}
      />
    );
  }

  return (
    <TextField
      {...commonProps}
      label={isListOperator(operator) || operator === "array-contains" ? "Values (comma separated)" : "Value"}
      value={typeof value === "string" ? value : Array.isArray(value) ? value.join(", ") : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

export default FilterValueInput;
