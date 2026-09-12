import { describe, expect, it } from "@jest/globals";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { fillPdf, inspectPdf, mergePdfs, rectFromTopLeft } from "../../utils/tefapPdf";
import type { TefapFormField } from "../../types/tefap-types";

const LETTER: [number, number] = [612, 792];

/** A PDF with no AcroForm at all, standing in for a flat print-to-PDF form. */
const buildFlatPdf = async (pageCount = 1): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    doc.addPage(LETTER);
  }
  return doc.save();
};

/**
 * A fillable PDF reproducing the defect shapes real TEFAP releases ship with:
 * a text field carrying a saved default, a field named "undefined", and a
 * radio group whose two widgets sit on different rows of the form so they
 * cannot be set independently.
 */
const buildFillablePdf = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage(LETTER);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const name = form.createTextField("Recipient Name");
  name.addToPage(page, { x: 72, y: 700, width: 200, height: 20 });

  const site = form.createTextField("Distribution Site Name");
  site.setText("FOOD FOR ALL DC");
  site.addToPage(page, { x: 320, y: 700, width: 200, height: 20 });

  const medicaid = form.createCheckBox("Household receives Medicaid Yes");
  medicaid.addToPage(page, { x: 223, y: 600, width: 11, height: 11 });

  const medicaidNo = form.createCheckBox("No_3");
  medicaidNo.addToPage(page, { x: 252, y: 600, width: 11, height: 11 });

  // One field, two widgets on separate rows - the shared-value defect.
  const shared = form.createRadioGroup("Household receives TANF");
  shared.addOptionToPage("row1", page, { x: 413, y: 640, width: 11, height: 11 });
  shared.addOptionToPage("row2", page, { x: 413, y: 620, width: 11, height: 11 });

  // A single checkbox field drawing two boxes, which therefore share one value.
  const duplicated = form.createCheckBox("undefined");
  duplicated.addToPage(page, { x: 442, y: 640, width: 11, height: 11 });
  duplicated.addToPage(page, { x: 442, y: 620, width: 11, height: 11 });

  const auto = form.createTextField("Text1");
  auto.addToPage(page, { x: 72, y: 560, width: 120, height: 20 });

  form.updateFieldAppearances(font);
  return doc.save();
};

const acroField = (
  key: string,
  pdfFieldName: string,
  overrides: Partial<TefapFormField> = {}
): TefapFormField => ({
  key,
  label: key,
  type: "text",
  required: false,
  placement: { kind: "acroform", pdfFieldName },
  prefill: { source: "none" },
  order: 0,
  ...overrides,
});

const overlayField = (key: string, overrides: Partial<TefapFormField> = {}): TefapFormField => ({
  key,
  label: key,
  type: "text",
  required: false,
  placement: {
    kind: "overlay",
    page: 1,
    x: 72,
    y: 500,
    width: 200,
    height: 20,
    fontSize: 11,
    align: "left",
  },
  prefill: { source: "none" },
  order: 0,
  ...overrides,
});

describe("inspectPdf", () => {
  it("reports page count and page sizes", async () => {
    const inspection = await inspectPdf(await buildFlatPdf(2));

    expect(inspection.pageCount).toBe(2);
    expect(inspection.pageSizes).toEqual([
      { page: 1, width: 612, height: 792 },
      { page: 2, width: 612, height: 792 },
    ]);
  });

  it("flags a PDF that has no fillable fields", async () => {
    const inspection = await inspectPdf(await buildFlatPdf());

    expect(inspection.acroFields).toHaveLength(0);
    expect(inspection.diagnostics.map((d) => d.code)).toContain("no-acroform-fields");
  });

  it("discovers fields with their types and saved values", async () => {
    const inspection = await inspectPdf(await buildFillablePdf());
    const byName = new Map(inspection.acroFields.map((field) => [field.name, field]));

    expect(byName.get("Recipient Name")?.type).toBe("text");
    expect(byName.get("Distribution Site Name")?.currentValue).toBe("FOOD FOR ALL DC");
    expect(byName.get("Household receives Medicaid Yes")?.type).toBe("checkbox");
    expect(byName.get("Household receives TANF")?.type).toBe("radio");
  });

  it("records every widget a field draws, and which page it is on", async () => {
    const inspection = await inspectPdf(await buildFillablePdf());
    const shared = inspection.acroFields.find((f) => f.name === "Household receives TANF");

    expect(shared?.widgets).toHaveLength(2);
    expect(shared?.widgets.every((widget) => widget.page === 1)).toBe(true);
  });

  it("accepts radio options as one single-choice field", async () => {
    const inspection = await inspectPdf(await buildFillablePdf());
    const diagnostic = inspection.diagnostics.find((d) => d.code === "shared-widgets");

    expect(diagnostic).toBeDefined();
    expect(diagnostic?.fieldNames).not.toContain("Household receives TANF");
    expect(diagnostic?.fieldNames).toContain("undefined");
  });

  it("flags auto-generated field names that say nothing about the field", async () => {
    const inspection = await inspectPdf(await buildFillablePdf());
    const diagnostic = inspection.diagnostics.find((d) => d.code === "uninformative-name");

    expect(diagnostic?.fieldNames).toContain("Text1");
    expect(diagnostic?.fieldNames).not.toContain("Recipient Name");
  });
});

describe("rectFromTopLeft", () => {
  it("flips a top-left rect onto pdf-lib's bottom-left origin", () => {
    expect(rectFromTopLeft({ x: 72, y: 100, width: 200, height: 20 }, 792)).toEqual({
      x: 72,
      y: 672,
      width: 200,
      height: 20,
    });
  });

  it("puts a rect at the very top of the page flush against the top edge", () => {
    const flipped = rectFromTopLeft({ x: 0, y: 0, width: 10, height: 50 }, 792);

    expect(flipped.y + flipped.height).toBe(792);
  });
});

describe("fillPdf", () => {
  it("writes a value into an AcroForm text field", async () => {
    const template = await buildFillablePdf();
    const fields = [acroField("name", "Recipient Name")];

    const { bytes, warnings } = await fillPdf(
      template,
      fields,
      [{ field: "name", value: "Jane Doe" }],
      { flatten: false }
    );

    expect(warnings).toHaveLength(0);
    const filled = await PDFDocument.load(bytes);
    expect(filled.getForm().getTextField("Recipient Name").getText()).toBe("Jane Doe");
  });

  // pdf-lib resolves a button's appearance from the field-level value and falls
  // back to the "off" appearance when that lookup misses, so a checked box can
  // flatten as unchecked. The engine draws the mark itself instead, which also
  // means button fields are always removed from the output.
  it("draws a mark for a checked box rather than using the PDF's own field", async () => {
    const template = await buildFillablePdf();
    const fields = [
      acroField("yes", "Household receives Medicaid Yes", { type: "checkbox" }),
      acroField("no", "No_3", { type: "checkbox" }),
    ];

    const checked = await fillPdf(
      template,
      fields,
      [
        { field: "yes", value: true },
        { field: "no", value: false },
      ],
      { flatten: false }
    );

    const unchecked = await fillPdf(
      template,
      fields,
      [
        { field: "yes", value: false },
        { field: "no", value: false },
      ],
      { flatten: false }
    );

    expect(checked.warnings).toHaveLength(0);
    expect(checked.bytes.length).toBeGreaterThan(unchecked.bytes.length);
  });

  it("draws only the selected target for an inferred Yes/No radio pair", async () => {
    const template = await buildFillablePdf();
    const field = acroField("medicaid", "Household receives Medicaid Yes", {
      type: "radio",
      options: ["Yes", "No"],
      radioOptions: [
        {
          value: "Yes",
          placement: { kind: "acroform", pdfFieldName: "Household receives Medicaid Yes" },
        },
        {
          value: "No",
          placement: {
            kind: "overlay",
            page: 1,
            x: 252,
            y: 600,
            width: 11,
            height: 11,
            fontSize: 11,
            align: "center",
          },
        },
      ],
    });

    const selected = await fillPdf(template, [field], [{ field: "medicaid", value: "No" }]);
    const blank = await fillPdf(template, [field], [{ field: "medicaid", value: "" }]);

    expect(selected.warnings).toHaveLength(0);
    expect(selected.bytes.length).toBeGreaterThan(blank.bytes.length);
  });

  it("removes button fields from the output so their state cannot be altered", async () => {
    const template = await buildFillablePdf();
    const fields = [acroField("yes", "Household receives Medicaid Yes", { type: "checkbox" })];

    const { bytes } = await fillPdf(template, fields, [{ field: "yes", value: true }], {
      flatten: false,
    });

    const names = (await PDFDocument.load(bytes))
      .getForm()
      .getFields()
      .map((f) => f.getName());
    expect(names).not.toContain("Household receives Medicaid Yes");
  });

  it("warns when one checkbox field drives several boxes, and marks them all", async () => {
    const template = await buildFillablePdf();
    const fields = [acroField("shared", "undefined", { type: "checkbox" })];

    const { warnings } = await fillPdf(template, fields, [{ field: "shared", value: true }]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("shared-widgets");
  });

  it("marks the widget matching the chosen option of a radio group", async () => {
    const template = await buildFillablePdf();
    const fields = [acroField("row", "Household receives TANF", { type: "checkbox" })];

    const first = await fillPdf(template, fields, [{ field: "row", value: "row1" }]);
    const second = await fillPdf(template, fields, [{ field: "row", value: "row2" }]);

    expect(first.warnings).toHaveLength(0);
    expect(second.warnings).toHaveLength(0);
  });

  it("warns when a radio group has no option matching the answer", async () => {
    const template = await buildFillablePdf();
    const fields = [acroField("row", "Household receives TANF", { type: "checkbox" })];

    const { warnings } = await fillPdf(template, fields, [{ field: "row", value: "row9" }]);

    expect(warnings[0].code).toBe("type-mismatch");
  });

  // The mapper collapses a radio group to a checkbox, so an unticked one
  // arrives as false. Rendering that as the string "No" and looking for a
  // matching option put a warning into every bulk-export manifest.
  it("says nothing about a radio group left unticked", async () => {
    const template = await buildFillablePdf();
    const fields = [acroField("row", "Household receives TANF", { type: "checkbox" })];

    const { warnings } = await fillPdf(template, fields, [{ field: "row", value: false }]);

    expect(warnings).toHaveLength(0);
  });

  // A boolean from a legacy mapping cannot identify which radio option was meant.
  it("explains why a ticked multi-option radio group cannot be resolved", async () => {
    const template = await buildFillablePdf();
    const fields = [acroField("row", "Household receives TANF", { type: "checkbox" })];

    const { warnings } = await fillPdf(template, fields, [{ field: "row", value: true }]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("shared-widgets");
    expect(warnings[0].message).toContain("cannot say which option to mark");
  });

  it("uses checkbox string truthiness consistently", async () => {
    const template = await buildFillablePdf();
    const fields = [acroField("yes", "Household receives Medicaid Yes", { type: "checkbox" })];

    const checked = await fillPdf(template, fields, [{ field: "yes", value: "Yes" }]);
    const unchecked = await fillPdf(template, fields, [{ field: "yes", value: "No" }]);

    expect(checked.bytes.length).toBeGreaterThan(unchecked.bytes.length);
  });

  it("warns instead of throwing when the template no longer has a mapped field", async () => {
    const template = await buildFillablePdf();
    const fields = [acroField("gone", "Field That Was Removed")];

    const { warnings } = await fillPdf(template, fields, [{ field: "gone", value: "anything" }]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("missing-pdf-field");
  });

  it("leaves fields alone when no value was supplied for them", async () => {
    const template = await buildFillablePdf();
    const fields = [acroField("site", "Distribution Site Name")];

    const { bytes } = await fillPdf(template, fields, [], { flatten: false });

    const filled = await PDFDocument.load(bytes);
    expect(filled.getForm().getTextField("Distribution Site Name").getText()).toBe(
      "FOOD FOR ALL DC"
    );
  });

  it("flattens by default so filled values cannot be edited afterwards", async () => {
    const template = await buildFillablePdf();
    const fields = [acroField("name", "Recipient Name")];

    const { bytes } = await fillPdf(template, fields, [{ field: "name", value: "Jane Doe" }]);

    const filled = await PDFDocument.load(bytes);
    expect(filled.getForm().getFields()).toHaveLength(0);
  });

  it("draws overlay text onto a PDF that has no form fields at all", async () => {
    const template = await buildFlatPdf();
    const fields = [overlayField("note")];

    const { bytes, warnings } = await fillPdf(template, fields, [
      { field: "note", value: "Overlay value" },
    ]);

    expect(warnings).toHaveLength(0);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("warns when overlay text cannot be shrunk enough to fit its box", async () => {
    const template = await buildFlatPdf();
    const narrow = overlayField("note", {
      placement: {
        kind: "overlay",
        page: 1,
        x: 72,
        y: 500,
        width: 12,
        height: 10,
        fontSize: 11,
        align: "left",
      },
    });

    const { warnings } = await fillPdf(
      template,
      [narrow],
      [{ field: "note", value: "A value far too long for this box" }]
    );

    expect(warnings.map((warning) => warning.code)).toContain("text-overflow");
  });

  // A trailing newline used to leave an empty final line, which counted against
  // the rect's height and shrank text that would otherwise have fit.
  it("does not count a trailing newline as a line that has to fit", async () => {
    const template = await buildFlatPdf();
    const box = overlayField("note", {
      type: "multiline",
      placement: {
        kind: "overlay",
        page: 1,
        x: 72,
        y: 500,
        width: 200,
        height: 14,
        fontSize: 11,
        align: "left",
      },
    });

    const plain = await fillPdf(template, [box], [{ field: "note", value: "Washington DC" }]);
    const trailing = await fillPdf(template, [box], [{ field: "note", value: "Washington DC\n" }]);

    expect(plain.warnings).toHaveLength(0);
    expect(trailing.warnings).toEqual(plain.warnings);
  });

  it("warns when an overlay field points at a page the PDF does not have", async () => {
    const template = await buildFlatPdf(1);
    const offPage = overlayField("note", {
      placement: {
        kind: "overlay",
        page: 4,
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        fontSize: 11,
        align: "left",
      },
    });

    const { warnings } = await fillPdf(template, [offPage], [{ field: "note", value: "Anything" }]);

    expect(warnings[0].code).toBe("missing-pdf-field");
  });

  it("skips drawing an overlay checkbox that is not checked", async () => {
    const template = await buildFlatPdf();
    const box = overlayField("box", { type: "checkbox" });

    const unchecked = await fillPdf(template, [box], [{ field: "box", value: false }]);
    const checked = await fillPdf(template, [box], [{ field: "box", value: true }]);

    expect(checked.bytes.length).toBeGreaterThan(unchecked.bytes.length);
  });
});

describe("mergePdfs", () => {
  it("concatenates documents and preserves total page count", async () => {
    const merged = await mergePdfs([await buildFlatPdf(2), await buildFlatPdf(1)]);

    expect((await PDFDocument.load(merged)).getPageCount()).toBe(3);
  });

  // pdf-lib parses a page-less PDF back as a single blank page, so returning an
  // empty document here would hand the user a blank sheet that looks like a
  // successful export.
  it("rejects an empty export rather than returning a blank page", async () => {
    await expect(mergePdfs([])).rejects.toThrow("There are no forms to export.");
  });
});
