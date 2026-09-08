// Bulk regeneration of completed TEFAP forms.
//
// Nothing filled is ever stored, so an export rebuilds every document from
// (template bytes + field map + answers). The template is fetched once per form
// and reused, which is what keeps a few hundred documents practical in a browser.

import type { TefapForm, TefapSubmission } from "../../types/tefap-types";
import type { TefapFillWarning } from "../../utils/tefapPdf";
import { ServiceError } from "../../utils/serviceError";
import { sanitizeFilename } from "../../utils/csvExport";
import { deliveryDate } from "../../utils/deliveryDate";

export type TefapExportFormat = "merged" | "zip";

/**
 * Above this many documents a ZIP is refused.
 *
 * Measured on the FY26 template (184KB, with an embedded logo): merged output
 * runs about 170KB per client and a ZIP about 184KB per client. Merging is only
 * ~8% smaller - pdf-lib's copyPages duplicates a page's fonts and images rather
 * than sharing them - so neither format escapes growing linearly. The ZIP is
 * capped because jszip assembles the whole archive in memory on top of the
 * documents themselves, roughly doubling peak usage.
 */
export const ZIP_DOCUMENT_LIMIT = 300;

/**
 * Past this many documents a merged export is still allowed but warned about.
 * At roughly 170KB per client this is around 85MB, which is slow to build in a
 * browser and unwieldy to open. Exports larger than this belong in a server-side
 * job rather than a tab.
 */
export const MERGED_WARN_THRESHOLD = 500;

export interface TefapExportRow {
  submission: TefapSubmission;
  form: TefapForm;
}

export interface TefapExportProgress {
  completed: number;
  total: number;
}

export interface TefapExportResult {
  blob: Blob;
  fileName: string;
  documentCount: number;
  /** One row per document, whether or not it had problems. */
  manifest: TefapManifestRow[];
}

export interface TefapManifestRow {
  client: string;
  clientId: string;
  form: string;
  formVersion: number;
  submittedAt: string;
  certExpiresOn: string;
  submittedBy: string;
  fileName: string;
  warnings: string;
}

/** Filename for one client's completed form. */
export const submissionFileName = (submission: TefapSubmission): string =>
  sanitizeFilename(
    `${submission.clientName || submission.clientId}_${submission.formName}_` +
      `${deliveryDate.toISODateString(submission.submittedAt)}.pdf`
  );

/**
 * Makes each name unique by appending a counter to repeats.
 *
 * Two clients can share a name, and one client can complete the same form twice
 * in a day. A ZIP silently drops entries whose names collide, so the duplicates
 * have to be resolved before anything is added to it.
 */
export const uniqueFileNames = (names: string[]): string[] => {
  const seen = new Map<string, number>();

  return names.map((name) => {
    const taken = seen.get(name) ?? 0;
    seen.set(name, taken + 1);
    if (taken === 0) return name;

    const dot = name.lastIndexOf(".");
    return dot === -1
      ? `${name}_${taken + 1}`
      : `${name.slice(0, dot)}_${taken + 1}${name.slice(dot)}`;
  });
};

const manifestRow = (
  row: TefapExportRow,
  fileName: string,
  warnings: TefapFillWarning[]
): TefapManifestRow => ({
  client: row.submission.clientName,
  clientId: row.submission.clientId,
  form: row.submission.formName,
  formVersion: row.submission.formVersion,
  submittedAt: deliveryDate.toISODateString(row.submission.submittedAt),
  certExpiresOn: row.submission.certExpiresOn ?? "",
  submittedBy: row.submission.submittedBy.name,
  fileName,
  warnings: warnings.map((warning) => warning.message).join("; "),
});

export const manifestToCsv = (rows: TefapManifestRow[]): string => {
  const columns: Array<[keyof TefapManifestRow, string]> = [
    ["client", "Client"],
    ["clientId", "Client ID"],
    ["form", "Form"],
    ["formVersion", "Form version"],
    ["submittedAt", "Submitted"],
    ["certExpiresOn", "Certification expires"],
    ["submittedBy", "Submitted by"],
    ["fileName", "File"],
    ["warnings", "Warnings"],
  ];

  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    columns.map(([, header]) => escape(header)).join(","),
    ...rows.map((row) => columns.map(([key]) => escape(row[key])).join(",")),
  ].join("\n");
};

export interface BuildExportOptions {
  rows: TefapExportRow[];
  format: TefapExportFormat;
  /** Resolves a form's template bytes; the caller's cache makes this cheap. */
  loadTemplate: (form: TefapForm) => Promise<Uint8Array>;
  onProgress?: (progress: TefapExportProgress) => void;
  label?: string;
}

/**
 * Rebuilds every submission and packages the result.
 *
 * A document that fails to fill does not abort the run - one bad record should
 * not cost an admin the other several hundred - it is recorded in the manifest
 * and skipped.
 */
export const buildExport = async (options: BuildExportOptions): Promise<TefapExportResult> => {
  const { rows, format, loadTemplate, onProgress, label = "tefap-forms" } = options;

  if (rows.length === 0) {
    throw new ServiceError("There are no completed forms to export.", "tefap/empty-export");
  }
  if (format === "zip" && rows.length > ZIP_DOCUMENT_LIMIT) {
    throw new ServiceError(
      `A ZIP is limited to ${ZIP_DOCUMENT_LIMIT} forms; this selection has ${rows.length}. ` +
        "Narrow the date range, or export a merged PDF instead.",
      "tefap/zip-too-large"
    );
  }

  const { fillPdf, mergePdfs } = await import("../../utils/tefapPdf");
  const names = uniqueFileNames(rows.map((row) => submissionFileName(row.submission)));

  const manifest: TefapManifestRow[] = [];
  const documents: Array<{ name: string; bytes: Uint8Array }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    try {
      const template = await loadTemplate(row.form);
      const { bytes, warnings } = await fillPdf(template, row.form.fields, row.submission.values);

      documents.push({ name: names[index], bytes });
      manifest.push(manifestRow(row, names[index], warnings));
    } catch (error) {
      manifest.push({
        ...manifestRow(row, names[index], []),
        warnings: `NOT EXPORTED: ${error instanceof Error ? error.message : "unknown error"}`,
      });
    }

    onProgress?.({ completed: index + 1, total: rows.length });
  }

  if (documents.length === 0) {
    throw new ServiceError(
      "None of the selected forms could be rebuilt.",
      "tefap/export-all-failed"
    );
  }

  const stamp = deliveryDate.todayISODateString();

  if (format === "merged") {
    const merged = await mergePdfs(documents.map((entry) => entry.bytes));
    return {
      blob: new Blob([merged], { type: "application/pdf" }),
      fileName: sanitizeFilename(`${label}_${stamp}.pdf`),
      documentCount: documents.length,
      manifest,
    };
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const entry of documents) {
    zip.file(entry.name, entry.bytes);
  }
  zip.file("manifest.csv", manifestToCsv(manifest));

  return {
    blob: await zip.generateAsync({ type: "blob" }),
    fileName: sanitizeFilename(`${label}_${stamp}.zip`),
    documentCount: documents.length,
    manifest,
  };
};
