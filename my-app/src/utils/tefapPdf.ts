// PDF inspection, filling, and merging for TEFAP forms.
//
// Deliberately free of Firebase and React imports: everything here is a pure
// function over bytes, so it unit-tests without mocks and could be lifted into
// a Cloud Run job later if bulk exports outgrow the browser.
//
// pdf-lib is loaded dynamically. It is a large dependency and the vast majority
// of sessions never touch a TEFAP form, so it must stay out of the main bundle.

import type {
  TefapAcroField,
  TefapAcroFieldType,
  TefapAnnotation,
  TefapFieldPlacement,
  TefapFieldValue,
  TefapFormField,
  TefapPageSize,
  TefapPdfDiagnostic,
  TefapPdfInspection,
  TefapRect,
  TefapTextAlign,
} from "../types/tefap-types";
import { ServiceError } from "./serviceError";

type PdfLib = typeof import("pdf-lib");

let pdfLibPromise: Promise<PdfLib> | null = null;

/** Loads pdf-lib once per session and reuses it. */
const loadPdfLib = (): Promise<PdfLib> => {
  if (!pdfLibPromise) {
    pdfLibPromise = import("pdf-lib");
  }
  return pdfLibPromise;
};

export interface TefapFillWarning {
  fieldKey: string;
  code:
    | "missing-pdf-field"
    | "type-mismatch"
    | "unsupported-field"
    | "text-overflow"
    | "shared-widgets";
  message: string;
}

export interface TefapFillResult {
  bytes: Uint8Array;
  warnings: TefapFillWarning[];
}

export interface TefapFillOptions {
  /**
   * Flatten the form after filling so values cannot be edited afterwards and
   * render identically in every viewer. Defaults to true, and every caller
   * takes that default: the fill dialog's preview bytes are the same bytes it
   * downloads, so they have to be flattened. Kept as an option for callers that
   * only ever render.
   */
  flatten?: boolean;
}

/** Smallest font size auto-shrink will fall back to before it gives up. */
const MIN_OVERLAY_FONT_SIZE = 5;

/** Padding inside an overlay rect so drawn text never touches the border. */
const OVERLAY_PADDING_X = 2;

// --- Inspection -------------------------------------------------------------

/**
 * Classifies an AcroForm field by class identity rather than by
 * `field.constructor.name`.
 *
 * The production build minifies pdf-lib's class names, so a name comparison
 * matches nothing once deployed and reports every field as unsupported - while
 * passing every test, because Jest runs the unminified module.
 */
const acroFieldTypeOf = (field: unknown, lib: PdfLib): TefapAcroFieldType => {
  if (field instanceof lib.PDFTextField) return "text";
  if (field instanceof lib.PDFCheckBox) return "checkbox";
  if (field instanceof lib.PDFRadioGroup) return "radio";
  if (field instanceof lib.PDFDropdown || field instanceof lib.PDFOptionList) return "dropdown";
  return "unsupported";
};

/**
 * Field names Acrobat and Word generate when the author never named a field.
 * Such a name tells the admin nothing about what the box means, so mapping has
 * to be driven by the rendered page instead.
 */
const isUninformativeName = (name: string): boolean => {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return /^(undefined|untitled|field|text|check\s?box|button|radio)[\s_-]*\d*$/i.test(trimmed);
};

/**
 * Reads an uploaded PDF's structure so the mapping UI can offer real fields
 * where they exist and warn about the ones that cannot be trusted.
 *
 * Detection is generic rather than per-form: each fiscal year's release brings
 * its own authoring quirks, so nothing here is specific to a given form.
 */
export const inspectPdf = async (bytes: Uint8Array): Promise<TefapPdfInspection> => {
  const pdfLib = await loadPdfLib();
  const { PDFDocument } = pdfLib;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const pages = doc.getPages();
  const pageSizes: TefapPageSize[] = pages.map((page, index) => {
    const { width, height } = page.getSize();
    return { page: index + 1, width, height };
  });

  // Widgets reference their page by ref, so build a lookup to turn that into a
  // 1-based page number.
  const pageNumberByRef = new Map<unknown, number>();
  pages.forEach((page, index) => pageNumberByRef.set(page.ref, index + 1));

  const acroFields: TefapAcroField[] = [];
  const diagnostics: TefapPdfDiagnostic[] = [];

  let fields: ReturnType<ReturnType<typeof doc.getForm>["getFields"]> = [];
  try {
    fields = doc.getForm().getFields();
  } catch {
    // A malformed or absent AcroForm is not fatal - it just means every field
    // has to be placed by overlay.
    fields = [];
  }

  const sharedWidgetNames: string[] = [];
  const uninformativeNames: string[] = [];

  for (const field of fields) {
    const name = field.getName();
    const type = acroFieldTypeOf(field, pdfLib);

    const widgets: TefapRect[] = field.acroField.getWidgets().map((widget) => {
      const rect = widget.getRectangle();
      const pageRef = widget.P();
      return {
        page: (pageRef && pageNumberByRef.get(pageRef)) ?? 1,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    });

    let currentValue: string | boolean | undefined;
    let options: string[] | undefined;

    try {
      if (type === "text") {
        currentValue = (field as any).getText() ?? undefined;
      } else if (type === "checkbox") {
        currentValue = (field as any).isChecked();
      } else if (type === "radio") {
        currentValue = (field as any).getSelected() ?? undefined;
        options = (field as any).getOptions();
      } else if (type === "dropdown") {
        const selected = (field as any).getSelected?.();
        currentValue = Array.isArray(selected) ? selected[0] : selected;
        options = (field as any).getOptions?.();
      }
    } catch {
      // Reading a value can throw on damaged fields. The field is still worth
      // offering for mapping, just without a suggested default.
      currentValue = undefined;
    }

    acroFields.push({ name, type, currentValue, options, widgets });

    // One field driving several widgets means those widgets cannot be set
    // independently: a radio group holds a single selection, and duplicate
    // checkbox widgets share one value. Whenever those widgets sit on
    // different rows of the form, the field is unusable as-is and the admin
    // needs to place each widget as its own overlay field.
    if (widgets.length > 1) {
      sharedWidgetNames.push(name);
    }
    if (isUninformativeName(name)) {
      uninformativeNames.push(name);
    }
  }

  if (fields.length === 0) {
    diagnostics.push({
      code: "no-acroform-fields",
      fieldNames: [],
      message:
        "This PDF has no fillable form fields. Every value will need to be placed " +
        "manually on the page.",
    });
  }

  if (sharedWidgetNames.length > 0) {
    diagnostics.push({
      code: "shared-widgets",
      fieldNames: sharedWidgetNames,
      message:
        `${sharedWidgetNames.length} field(s) control more than one box on the page and ` +
        "cannot be set independently. Place each box as its own field to control them separately.",
    });
  }

  if (uninformativeNames.length > 0) {
    diagnostics.push({
      code: "uninformative-name",
      fieldNames: uninformativeNames,
      message:
        `${uninformativeNames.length} field(s) have auto-generated names that do not say what ` +
        "they are. Check the page preview before labelling them.",
    });
  }

  return { pageCount: doc.getPageCount(), pageSizes, acroFields, diagnostics };
};

// --- Filling ----------------------------------------------------------------

const asText = (value: string | boolean): string => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
};

const isTruthy = (value: string | boolean): boolean => {
  if (typeof value === "boolean") return value;
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && !["false", "no", "n", "0", "off", "unchecked"].includes(normalized);
};

/**
 * Splits text into lines that fit within maxWidth. Words longer than the line
 * are hard-broken rather than allowed to overflow the rect.
 */
const wrapText = (
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number
): string[] => {
  const lines: string[] = [];

  for (const paragraph of text.split(/\r?\n/)) {
    let current = "";

    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
        current = "";
      }

      // A single word too wide for the line gets broken character by character.
      let chunk = "";
      for (const char of word) {
        if (font.widthOfTextAtSize(chunk + char, fontSize) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      current = chunk;
    }

    lines.push(current);
  }

  // A trailing newline leaves an empty final paragraph. Keeping it would count
  // a line that draws nothing against the rect's height, shrinking the text to
  // fit a gap that is not there. Interior blanks stay: those are real spacing.
  while (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.length > 0 ? lines : [""];
};

/** Left edge for a line of text given the rect's alignment. */
const alignedX = (
  rectX: number,
  rectWidth: number,
  textWidth: number,
  align: TefapTextAlign
): number => {
  if (align === "center") return rectX + (rectWidth - textWidth) / 2;
  if (align === "right") return rectX + rectWidth - textWidth - OVERLAY_PADDING_X;
  return rectX + OVERLAY_PADDING_X;
};

/**
 * Converts a rect measured from the top-left of a page (how a browser overlay
 * reports coordinates) into pdf-lib's bottom-left origin.
 *
 * Exported because it is the single easiest thing to get wrong when the visual
 * placement UI lands, and it deserves its own tests.
 */
export const rectFromTopLeft = (
  rect: { x: number; y: number; width: number; height: number },
  pageHeight: number
): { x: number; y: number; width: number; height: number } => ({
  x: rect.x,
  y: pageHeight - rect.y - rect.height,
  width: rect.width,
  height: rect.height,
});

interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Draws an X centred in a box, scaled to it. */
const drawCheckMark = (page: any, font: any, rect: DrawRect): void => {
  const size = Math.min(rect.width, rect.height) * 1.1;
  const markWidth = font.widthOfTextAtSize("X", size);
  page.drawText("X", {
    x: rect.x + (rect.width - markWidth) / 2,
    y: rect.y + (rect.height - size * 0.72) / 2,
    size,
    font,
  });
};

interface PendingMark {
  pageIndex: number;
  rect: DrawRect;
}

interface PendingText {
  pageIndex: number;
  field: TefapFormField;
  text: string;
  placement: Extract<TefapFieldPlacement, { kind: "overlay" }>;
}

/**
 * Fills a template with a submission's answers.
 *
 * Checkbox and radio answers are always drawn as marks rather than set through
 * the PDF's own button fields. pdf-lib resolves a button's appearance from the
 * field-level value and silently falls back to the "off" appearance when that
 * lookup misses, so flattening a checked box can render it unchecked. Drawing
 * the mark ourselves is deterministic, and it matches how these forms are
 * authored anyway: the empty square is usually static page content with an
 * invisible widget on top, so stamping the widget would double-draw the box.
 *
 * Missing PDF fields never throw: a template can legitimately drift from the
 * field map, and a bulk export of hundreds of clients must not abort because
 * one field went away. Such problems come back as warnings for the caller to
 * surface (the bulk export writes them into its manifest).
 */
export const fillPdf = async (
  templateBytes: Uint8Array,
  fields: TefapFormField[],
  values: TefapFieldValue[],
  options: TefapFillOptions = {}
): Promise<TefapFillResult> => {
  const pdfLib = await loadPdfLib();
  const { PDFDocument, StandardFonts } = pdfLib;
  const { flatten = true } = options;

  const doc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const pages = doc.getPages();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const warnings: TefapFillWarning[] = [];

  const pageIndexByRef = new Map<unknown, number>();
  pages.forEach((page, index) => pageIndexByRef.set(page.ref, index));

  const valueByField = new Map<string, string | boolean>();
  for (const entry of values) {
    valueByField.set(entry.field, entry.value);
  }

  // Everything drawn is queued and painted after the form is torn down, so a
  // flattened widget can never paint over a value.
  const pendingMarks: PendingMark[] = [];
  const pendingTexts: PendingText[] = [];

  const widgetRects = (target: any): PendingMark[] =>
    target.acroField.getWidgets().map((widget: any) => {
      const rect = widget.getRectangle();
      const pageRef = widget.P();
      return {
        pageIndex: (pageRef && pageIndexByRef.get(pageRef)) ?? 0,
        rect,
      };
    });

  for (const field of fields) {
    if (!valueByField.has(field.key)) continue;

    const raw = valueByField.get(field.key) as string | boolean;

    if (field.placement.kind === "acroform") {
      const pdfFieldName = field.placement.pdfFieldName;
      let target: any;

      try {
        target = form.getField(pdfFieldName);
      } catch {
        warnings.push({
          fieldKey: field.key,
          code: "missing-pdf-field",
          message: `"${field.label}" could not be written: the PDF has no field named "${pdfFieldName}".`,
        });
        continue;
      }

      const targetType = acroFieldTypeOf(target, pdfLib);

      try {
        if (targetType === "text") {
          target.setText(asText(raw));
        } else if (targetType === "dropdown") {
          const selection = asText(raw);
          if (selection) target.select(selection);
        } else if (targetType === "checkbox") {
          if (!isTruthy(raw)) continue;

          const marks = widgetRects(target);
          if (marks.length > 1) {
            warnings.push({
              fieldKey: field.key,
              code: "shared-widgets",
              message:
                `"${field.label}" controls ${marks.length} boxes on the page, so all of them ` +
                "were marked. Place each box as its own field to set them independently.",
            });
          }
          pendingMarks.push(...marks);
        } else if (targetType === "radio") {
          const marks = widgetRects(target);

          // The mapper collapses a radio group to a checkbox, so the answer
          // usually arrives as a boolean with no option name attached. A group
          // drawing a single box is a checkbox in all but name and can be
          // marked directly; one drawing several cannot be resolved from a
          // yes/no, and the admin has to split it into per-box fields.
          if (typeof raw === "boolean") {
            if (!raw) continue;

            if (marks.length === 1) {
              pendingMarks.push(marks[0]);
            } else {
              warnings.push({
                fieldKey: field.key,
                code: "shared-widgets",
                message:
                  `"${field.label}" is a radio group controlling ${marks.length} boxes, so a ` +
                  "yes/no answer cannot say which to mark. Split it into one field per box.",
              });
            }
            continue;
          }

          // A literal option name (from the template's own saved value) picks
          // its box directly. Note this is deliberately not gated on
          // isTruthy: "No" is a legitimate option name.
          const selection = raw.trim();
          if (!selection) continue;

          const optionIndex = (target.getOptions() as string[]).indexOf(selection);

          if (optionIndex >= 0 && marks[optionIndex]) {
            pendingMarks.push(marks[optionIndex]);
          } else {
            warnings.push({
              fieldKey: field.key,
              code: "type-mismatch",
              message: `"${field.label}" has no option matching "${selection}".`,
            });
          }
        } else {
          warnings.push({
            fieldKey: field.key,
            code: "unsupported-field",
            message: `"${field.label}" uses a PDF field type that cannot be filled automatically.`,
          });
        }
      } catch (error) {
        warnings.push({
          fieldKey: field.key,
          code: "type-mismatch",
          message:
            `"${field.label}" could not be set to "${asText(raw)}": ` +
            `${error instanceof Error ? error.message : "unknown error"}.`,
        });
      }

      continue;
    }

    // Overlay placement: draw straight onto the page at a fixed rectangle.
    const placement = field.placement;
    const pageIndex = placement.page - 1;

    if (!pages[pageIndex]) {
      warnings.push({
        fieldKey: field.key,
        code: "missing-pdf-field",
        message: `"${field.label}" is placed on page ${placement.page}, which this PDF does not have.`,
      });
      continue;
    }

    if (field.type === "checkbox") {
      if (isTruthy(raw)) {
        pendingMarks.push({ pageIndex, rect: placement });
      }
      continue;
    }

    const text = asText(raw);
    if (text) {
      pendingTexts.push({ pageIndex, field, text, placement });
    }
  }

  // Without this, viewers that ignore field appearance streams show text field
  // values as blank.
  try {
    form.updateFieldAppearances(helvetica);
  } catch {
    // A template with no form has nothing to update.
  }

  // Drop button fields without stamping them: their answers are drawn as marks,
  // and stamping would paint a second box over the static one.
  //
  // Each removal is guarded on its own. pdf-lib throws on a widget whose page
  // reference is missing - an authoring defect these forms do ship with - and a
  // single throw must not leave every later button in the document to be
  // flattened with its "off" appearance over the mark queued above.
  for (const field of form.getFields()) {
    const type = acroFieldTypeOf(field, pdfLib);
    if (type !== "checkbox" && type !== "radio") continue;

    try {
      form.removeField(field);
    } catch {
      // This one will not come out; the rest still can.
    }
  }

  if (flatten) {
    try {
      form.flatten();
    } catch {
      // Flattening can fail on damaged forms; the filled values still render.
    }
  }

  for (const mark of pendingMarks) {
    const page = pages[mark.pageIndex];
    if (page) drawCheckMark(page, helvetica, mark.rect);
  }

  for (const pending of pendingTexts) {
    const { placement, field, text } = pending;
    const page = pages[pending.pageIndex];
    if (!page) continue;

    const maxWidth = Math.max(placement.width - OVERLAY_PADDING_X * 2, 1);
    const multiline = field.type === "multiline";

    // Shrink to fit rather than spilling outside the rect.
    let fontSize = placement.fontSize;
    let lines = multiline ? wrapText(text, helvetica, fontSize, maxWidth) : [text];

    const fits = () =>
      lines.every((line) => helvetica.widthOfTextAtSize(line, fontSize) <= maxWidth) &&
      lines.length * fontSize * 1.15 <= placement.height + fontSize * 0.15;

    while (!fits() && fontSize > MIN_OVERLAY_FONT_SIZE) {
      fontSize -= 0.5;
      lines = multiline ? wrapText(text, helvetica, fontSize, maxWidth) : [text];
    }

    if (!fits()) {
      warnings.push({
        fieldKey: field.key,
        code: "text-overflow",
        message: `"${field.label}" is too long to fit its box and may be clipped.`,
      });
    }

    const lineHeight = fontSize * 1.15;
    // Single-line values sit centred in the box; multi-line values start at the
    // top and run down.
    const firstBaseline = multiline
      ? placement.y + placement.height - fontSize
      : placement.y + (placement.height - fontSize * 0.72) / 2;

    lines.forEach((line, index) => {
      if (!line) return;
      page.drawText(line, {
        x: alignedX(
          placement.x,
          placement.width,
          helvetica.widthOfTextAtSize(line, fontSize),
          placement.align
        ),
        y: firstBaseline - index * lineHeight,
        size: fontSize,
        font: helvetica,
      });
    });
  }

  return { bytes: await doc.save(), warnings };
};

// --- Merging ----------------------------------------------------------------

/**
 * Concatenates filled documents into one PDF.
 *
 * This is how bulk export should normally run: every output shares the same
 * template, so a merged document is far smaller than the equivalent set of
 * separate files and prints as a single job.
 *
 * Rejects an empty list rather than returning an empty document: pdf-lib parses
 * a page-less PDF back as a single blank page, so exporting nothing would hand
 * the user a blank sheet that looks like a successful export.
 */
export const mergePdfs = async (documents: Uint8Array[]): Promise<Uint8Array> => {
  if (documents.length === 0) {
    throw new ServiceError("There are no forms to export.", "tefap/empty-merge");
  }

  const { PDFDocument } = await loadPdfLib();
  const merged = await PDFDocument.create();

  for (const bytes of documents) {
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
};

// --- Annotation -------------------------------------------------------------

/**
 * Draws a numbered box over each mapped region of a template.
 *
 * This is how the mapping UI shows which box a PDF field actually controls.
 * Form authors name fields carelessly - a checkbox labelled "Weekly" on screen
 * can be named after the label beside it, and auto-generated names like "Text1"
 * say nothing at all - so a name-only list is not enough to map a form
 * correctly. Rendering onto the PDF itself avoids taking on a PDF rasteriser
 * just to show the page.
 */
export const annotatePdf = async (
  templateBytes: Uint8Array,
  annotations: TefapAnnotation[]
): Promise<Uint8Array> => {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();

  const doc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  const accent = rgb(0.85, 0.33, 0.05);
  const normal = rgb(0.14, 0.45, 0.72);

  for (const annotation of annotations) {
    const page = pages[annotation.page - 1];
    if (!page) continue;

    const colour = annotation.highlighted ? accent : normal;

    page.drawRectangle({
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
      borderColor: colour,
      borderWidth: annotation.highlighted ? 1.5 : 1,
      color: colour,
      opacity: annotation.highlighted ? 0.18 : 0.08,
      borderOpacity: 1,
    });

    // Badge sits above the box and flush with its right edge. Form labels run
    // left-aligned beside their field, so the right side is the side least
    // likely to cover the text the admin needs to read.
    const badgeSize = 7;
    const badgeWidth = font.widthOfTextAtSize(annotation.label, badgeSize) + 4;
    const badgeHeight = badgeSize + 3;
    const aboveY = annotation.y + annotation.height + 1;
    const badgeY = aboveY + badgeHeight > page.getSize().height ? annotation.y : aboveY;
    const badgeX = Math.max(annotation.x + annotation.width - badgeWidth, 0);

    page.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: badgeWidth,
      height: badgeHeight,
      color: colour,
      opacity: 1,
    });

    page.drawText(annotation.label, {
      x: badgeX + 2,
      y: badgeY + 2.5,
      size: badgeSize,
      font,
      color: rgb(1, 1, 1),
    });
  }

  return doc.save();
};
