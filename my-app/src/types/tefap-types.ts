// Type definitions for TEFAP form templates, field mappings, and submissions.
//
// A TEFAP template is an unfilled PDF stored in Firebase Storage plus a field
// map describing how to fill it. We never store filled PDFs - a submission
// records only the answers, and the filled document is regenerated on demand
// from (template bytes + field map + answers).

/** How a single mapped field gets written onto the PDF. */
export type TefapFieldPlacement =
  | {
      /** Write through the PDF's own AcroForm field of this name. */
      kind: "acroform";
      pdfFieldName: string;
    }
  | {
      /**
       * Draw directly onto the page at a fixed rectangle. Used when the PDF has
       * no AcroForm at all, and as a per-field escape hatch when a form's own
       * field is unusable (for example when one field drives several widgets,
       * so writing it would fill unrelated boxes).
       */
      kind: "overlay";
      /** 1-based page number. */
      page: number;
      /** Rect in PDF points, origin bottom-left, matching pdf-lib's axes. */
      x: number;
      y: number;
      width: number;
      height: number;
      fontSize: number;
      align: TefapTextAlign;
    };

export type TefapTextAlign = "left" | "center" | "right";

export type TefapFieldType = "text" | "multiline" | "date" | "number" | "checkbox";

/** Where a field's initial value comes from when a filler opens the form. */
export type TefapPrefillSource = "none" | "static" | "client";

export interface TefapPrefill {
  source: TefapPrefillSource;
  /** Used when source is "static". */
  staticValue?: string;
  /** Key into the client prefill registry. Used when source is "client". */
  clientKey?: string;
}

/** One admin-mapped field on a template. */
export interface TefapFormField {
  /**
   * Stable identifier for this field within the template. Generated at mapping
   * time and never reused, so answers stay attached to the right question even
   * if the admin renames the label or the PDF's own field names change.
   */
  key: string;
  /** Admin-supplied human-readable name. PDF field names are often wrong. */
  label: string;
  type: TefapFieldType;
  required: boolean;
  placement: TefapFieldPlacement;
  prefill: TefapPrefill;
  /** Mapped but not shown to the filler (for example an unused proxy block). */
  hidden?: boolean;
  /** Display order in the fill dialog. */
  order: number;
  /**
   * Keys of other fields that must be unchecked when this one is checked.
   * Lets a Yes/No pair of independent checkboxes behave like a radio group.
   */
  exclusiveWith?: string[];
}

export type TefapFormStatus = "active" | "archived";

/**
 * A versioned template. Templates are immutable once submissions reference
 * them: forms change structurally between fiscal years, so regenerating an old
 * submission against a new template would produce a nonsense document.
 */
export interface TefapForm {
  id: string;
  name: string;
  description?: string;
  version: number;
  status: TefapFormStatus;
  /** Path within the Storage bucket holding the unfilled PDF. */
  storagePath: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  /** ISO date strings bounding when this template should be used. */
  effectiveFrom?: string;
  effectiveTo?: string;
  /** How long a certification made with this form stays valid. */
  certValidityMonths: number;
  fields: TefapFormField[];
  createdAt: Date;
  createdBy: TefapActor;
  updatedAt: Date;
  updatedBy: TefapActor;
}

export interface TefapActor {
  uid: string;
  name: string;
  email: string;
}

/**
 * One answer. Stored as an array rather than a keyed map because PDF field
 * names routinely contain dots, which collide with Firestore's field paths.
 */
export interface TefapFieldValue {
  /** Matches TefapFormField.key. */
  field: string;
  value: string | boolean;
}

/** An append-only record of one client completing one template. */
export interface TefapSubmission {
  id: string;
  clientId: string;
  /** Denormalized so the admin list and ZIP filenames avoid an N+1 read. */
  clientName: string;
  formId: string;
  formName: string;
  formVersion: number;
  values: TefapFieldValue[];
  submittedAt: Date;
  submittedBy: TefapActor;
  /** Expiry written back to the client profile's tefapCertDate, ISO date. */
  certExpiresOn?: string;
  /** Set when this submission corrects an earlier one. */
  supersedesId?: string;
}

// --- PDF inspection ---------------------------------------------------------

export type TefapAcroFieldType = "text" | "checkbox" | "radio" | "dropdown" | "unsupported";

/** A rectangle on a page, in PDF points with a bottom-left origin. */
export interface TefapRect {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An AcroForm field discovered in an uploaded PDF. */
export interface TefapAcroField {
  name: string;
  type: TefapAcroFieldType;
  /** Value already saved in the template, offered as a default prefill. */
  currentValue?: string | boolean;
  /** Selectable values for checkbox, radio, and dropdown fields. */
  options?: string[];
  /**
   * Every widget this field draws. More than one means the widgets share a
   * single value, so filling the field writes to all of them at once.
   */
  widgets: TefapRect[];
}

export type TefapDiagnosticCode =
  /** One field drives several widgets, so they cannot be set independently. */
  | "shared-widgets"
  /** Field name looks auto-generated and tells the admin nothing. */
  | "uninformative-name"
  /** No AcroForm fields at all, so every field needs overlay placement. */
  | "no-acroform-fields";

/**
 * A problem found in an uploaded PDF, surfaced during mapping. These are
 * detected generically rather than special-cased per form, because each
 * fiscal year's release brings its own authoring quirks.
 */
export interface TefapPdfDiagnostic {
  code: TefapDiagnosticCode;
  /** Field names this diagnostic concerns, empty for document-wide issues. */
  fieldNames: string[];
  message: string;
}

export interface TefapPageSize {
  page: number;
  width: number;
  height: number;
}

/** The result of inspecting an uploaded PDF, used to drive the mapping UI. */
export interface TefapPdfInspection {
  pageCount: number;
  pageSizes: TefapPageSize[];
  acroFields: TefapAcroField[];
  diagnostics: TefapPdfDiagnostic[];
}
