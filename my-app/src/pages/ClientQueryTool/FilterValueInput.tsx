// Read-only value input control for a single Client Query Tool filter row.
// Renders the correct control (boolean select, number, text, tag/org dropdown, date picker)
// based on the selected field's inferred type.

import React from "react";
import { Autocomplete, MenuItem, TextField } from "@mui/material";
import { QueryFieldDef, QueryOperator } from "../../types/query-tool-types";
import { formatPhoneNumber } from "../../utils/queryToolFormatting";

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
}> = ({ options, value, onChange, commonProps }) => {
  const selectedValues = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

  return (
    <Autocomplete
      multiple
      freeSolo
      options={options}
      value={selectedValues}
      onChange={(_, nextValues) => onChange(nextValues)}
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
          options={fieldOptions}
          value={value}
          onChange={onChange}
          commonProps={commonProps}
        />
      );
    }
    if (selectableOptions.length > 0) {
      return (
        <SearchableValueInput
          options={dropdownOptions}
          value={value}
          onChange={onChange}
          commonProps={commonProps}
          labelId={labelId}
          optionLabels={optionLabels}
          optionValues={optionValues}
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
        options={dropdownOptions}
        value={value}
        onChange={onChange}
        commonProps={commonProps}
      />
    );
  }

  // Text fields: prefer known option lists (ward, quadrant, referral org) as dropdowns.
  const options = dropdownOptions;

  if (options && options.length > 0 && !isListOperator(operator)) {
    return (
      <SearchableValueInput
        options={options}
        value={value}
        onChange={onChange}
        commonProps={commonProps}
        labelId={labelId}
        optionLabels={optionLabels}
        optionValues={optionValues}
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
