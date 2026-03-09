import Papa from "papaparse";
import { saveAs } from "file-saver";

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;
const DANGEROUS_CSV_PREFIX = /^[=+\-@]|^[\t\r]/;

export type CsvRow = Record<string, unknown>;

export class CsvExportError extends Error {
  code: "EMPTY_DATA" | "DOWNLOAD_FAILED";

  constructor(code: "EMPTY_DATA" | "DOWNLOAD_FAILED", message: string) {
    super(message);
    this.name = "CsvExportError";
    this.code = code;
  }
}

export const sanitizeFilename = (filename: string): string => {
  const withoutControlChars = Array.from(filename)
    .filter((character) => character >= " ")
    .join("");
  const sanitized = withoutControlChars
    .replace(INVALID_FILENAME_CHARS, "_")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || "export.csv";
};

export const escapeCsvFormulaValue = (value: string): string => {
  if (!value) {
    return value;
  }

  return DANGEROUS_CSV_PREFIX.test(value) ? `'${value}` : value;
};

export const normalizeCsvValue = (value: unknown): string | number | boolean => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return escapeCsvFormulaValue(
      value
        .map((item) => normalizeCsvValue(item))
        .filter((item) => item !== "")
        .join(", ")
    );
  }

  if (typeof value === "object") {
    return escapeCsvFormulaValue(JSON.stringify(value));
  }

  return escapeCsvFormulaValue(String(value));
};

export const normalizeCsvRows = (
  rows: CsvRow[]
): Array<Record<string, string | number | boolean>> =>
  rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeCsvValue(value)]))
  );

export const downloadCsv = (rows: CsvRow[], filename: string): string => {
  if (rows.length === 0) {
    throw new CsvExportError("EMPTY_DATA", "No data available to export.");
  }

  const safeFilename = sanitizeFilename(filename);

  try {
    const csv = Papa.unparse(normalizeCsvRows(rows));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, safeFilename);
    return safeFilename;
  } catch (error) {
    throw new CsvExportError("DOWNLOAD_FAILED", "Failed to export CSV. Please try again.");
  }
};
