import { describe, expect, it } from "@jest/globals";
import {
  annotationsForFields,
  buildFieldsFromInspection,
  isSharedWidgetField,
  reindex,
  splitSharedField,
  suggestClientKey,
} from "../../../pages/TefapForms/tefapMapping";
import type { TefapAcroField, TefapPdfInspection } from "../../../types/tefap-types";

const acro = (
  name: string,
  widgets: Array<Partial<{ page: number; x: number; y: number; width: number; height: number }>>,
  over: Partial<TefapAcroField> = {}
): TefapAcroField => ({
  name,
  type: "text",
  widgets: widgets.map((w) => ({
    page: w.page ?? 1,
    x: w.x ?? 0,
    y: w.y ?? 0,
    width: w.width ?? 100,
    height: w.height ?? 20,
  })),
  ...over,
});

const inspectionOf = (acroFields: TefapAcroField[]): TefapPdfInspection => ({
  pageCount: 2,
  pageSizes: [
    { page: 1, width: 612, height: 792 },
    { page: 2, width: 612, height: 792 },
  ],
  acroFields,
  diagnostics: [],
});

describe("suggestClientKey", () => {
  it("matches a label to the client value of the same name", () => {
    expect(suggestClientKey("Ward")).toBe("ward");
    expect(suggestClientKey("Number in Household")).toBe("householdSize");
  });

  it("matches a label that wholly contains a client value's name", () => {
    expect(suggestClientKey("Client Ward Number")).toBe("ward");
  });

  it("offers nothing when the label matches no client value", () => {
    expect(suggestClientKey("Distribution Site Location")).toBeUndefined();
    expect(suggestClientKey("Text1")).toBeUndefined();
  });

  // A duplicated field is usually a second, unrelated block on the form (a proxy
  // or alternate contact), so binding it to the client's own value would be wrong.
  it("does not match a suffixed duplicate of a field it would otherwise match", () => {
    expect(suggestClientKey("Zip_2")).toBeUndefined();
    expect(suggestClientKey("Ward_2")).toBeUndefined();
  });

  // "Name" is a fragment of "Full name", but on real forms a bare "Name" is
  // usually the proxy or alternate contact, not the client.
  it("does not match a label that is merely a fragment of a client value's name", () => {
    expect(suggestClientKey("Name")).toBeUndefined();
  });

  it("ignores labels too short to match on", () => {
    expect(suggestClientKey("A")).toBeUndefined();
  });
});

describe("buildFieldsFromInspection", () => {
  it("orders fields the way the page reads, top to bottom then left to right", () => {
    const fields = buildFieldsFromInspection(
      inspectionOf([
        acro("lower", [{ y: 300 }]),
        acro("upper right", [{ y: 700, x: 300 }]),
        acro("upper left", [{ y: 700, x: 72 }]),
      ])
    );

    expect(fields.map((f) => f.label)).toEqual(["upper left", "upper right", "lower"]);
  });

  it("puts page one before page two", () => {
    const fields = buildFieldsFromInspection(
      inspectionOf([acro("second page", [{ page: 2, y: 700 }]), acro("first page", [{ y: 100 }])])
    );

    expect(fields.map((f) => f.label)).toEqual(["first page", "second page"]);
  });

  it("gives every field a unique key", () => {
    const fields = buildFieldsFromInspection(
      inspectionOf([acro("Zip", [{ y: 500 }]), acro("Zip_2", [{ y: 400 }])])
    );

    expect(new Set(fields.map((f) => f.key)).size).toBe(2);
  });

  // A value saved into the template is the form author's own default.
  it("offers a value already saved in the template as a fixed prefill", () => {
    const fields = buildFieldsFromInspection(
      inspectionOf([acro("Distribution Site Name", [{}], { currentValue: "FOOD FOR ALL DC" })])
    );

    expect(fields[0].prefill).toEqual({ source: "static", staticValue: "FOOD FOR ALL DC" });
  });

  it("binds a recognised label to the client profile", () => {
    const fields = buildFieldsFromInspection(inspectionOf([acro("Ward", [{}])]));

    expect(fields[0].prefill).toEqual({ source: "client", clientKey: "ward" });
  });

  it("leaves an unrecognised field unbound", () => {
    const fields = buildFieldsFromInspection(inspectionOf([acro("Text1", [{}])]));

    expect(fields[0].prefill).toEqual({ source: "none" });
  });

  it("prefers the template's own saved value over a guessed binding", () => {
    const fields = buildFieldsFromInspection(
      inspectionOf([acro("Ward", [{}], { currentValue: "Ward 4" })])
    );

    expect(fields[0].prefill.source).toBe("static");
  });

  it("maps checkbox and radio fields to a checkbox", () => {
    const fields = buildFieldsFromInspection(
      inspectionOf([
        acro("box", [{}], { type: "checkbox" }),
        acro("group", [{ y: 100 }], { type: "radio" }),
      ])
    );

    expect(fields.every((f) => f.type === "checkbox")).toBe(true);
  });

  it("skips fields of a type that cannot be filled", () => {
    const fields = buildFieldsFromInspection(
      inspectionOf([acro("sig", [{}], { type: "unsupported" })])
    );

    expect(fields).toEqual([]);
  });
});

describe("isSharedWidgetField", () => {
  it("flags a field that draws more than one box", () => {
    const inspection = inspectionOf([acro("shared", [{ y: 300 }, { y: 280 }])]);
    const [field] = buildFieldsFromInspection(inspection);

    expect(isSharedWidgetField(field, inspection)).toBe(true);
  });

  it("does not flag an ordinary single-box field", () => {
    const inspection = inspectionOf([acro("single", [{}])]);
    const [field] = buildFieldsFromInspection(inspection);

    expect(isSharedWidgetField(field, inspection)).toBe(false);
  });
});

describe("splitSharedField", () => {
  // The defect this exists for: one PDF field owning two boxes on unrelated rows
  // can only ever hold one answer between them.
  const inspection = inspectionOf([
    acro("TANF and SNAP", [
      { y: 317, x: 413, width: 11, height: 7 },
      { y: 296, x: 413, width: 11, height: 7 },
    ]),
  ]);

  it("replaces the shared field with one independent field per box", () => {
    const fields = buildFieldsFromInspection(inspection);
    const split = splitSharedField(fields, fields[0].key, inspection);

    expect(split).toHaveLength(2);
    expect(new Set(split.map((f) => f.key)).size).toBe(2);
  });

  it("anchors each new field to its own rectangle from the PDF", () => {
    const fields = buildFieldsFromInspection(inspection);
    const split = splitSharedField(fields, fields[0].key, inspection);

    expect(split[0].placement).toMatchObject({ kind: "overlay", y: 317 });
    expect(split[1].placement).toMatchObject({ kind: "overlay", y: 296 });
  });

  it("makes the split fields checkboxes so each box gets its own answer", () => {
    const fields = buildFieldsFromInspection(inspection);
    const split = splitSharedField(fields, fields[0].key, inspection);

    expect(split.every((f) => f.type === "checkbox")).toBe(true);
  });

  it("renumbers the surviving fields", () => {
    const withNeighbour = inspectionOf([
      ...inspection.acroFields,
      acro("after", [{ y: 100, width: 50, height: 10 }]),
    ]);
    const fields = buildFieldsFromInspection(withNeighbour);
    const split = splitSharedField(fields, fields[0].key, withNeighbour);

    expect(split.map((f) => f.order)).toEqual([0, 1, 2]);
  });

  it("leaves an ordinary field untouched", () => {
    const single = inspectionOf([acro("single", [{}])]);
    const fields = buildFieldsFromInspection(single);

    expect(splitSharedField(fields, fields[0].key, single)).toBe(fields);
  });

  it("ignores an unknown key", () => {
    const fields = buildFieldsFromInspection(inspection);

    expect(splitSharedField(fields, "nope", inspection)).toBe(fields);
  });
});

describe("annotationsForFields", () => {
  it("numbers the boxes to match the list positions", () => {
    const inspection = inspectionOf([acro("a", [{ y: 700 }]), acro("b", [{ y: 500 }])]);
    const fields = buildFieldsFromInspection(inspection);

    expect(annotationsForFields(fields, inspection).map((a) => a.label)).toEqual(["1", "2"]);
  });

  it("highlights only the selected field", () => {
    const inspection = inspectionOf([acro("a", [{ y: 700 }]), acro("b", [{ y: 500 }])]);
    const fields = buildFieldsFromInspection(inspection);

    const annotations = annotationsForFields(fields, inspection, fields[1].key);

    expect(annotations.map((a) => a.highlighted)).toEqual([false, true]);
  });

  it("uses an overlay field's own rectangle", () => {
    const inspection = inspectionOf([acro("shared", [{ y: 317 }, { y: 296 }])]);
    const fields = buildFieldsFromInspection(inspection);
    const split = splitSharedField(fields, fields[0].key, inspection);

    expect(annotationsForFields(split, inspection).map((a) => a.y)).toEqual([317, 296]);
  });

  it("skips a field with no drawable box", () => {
    const inspection = inspectionOf([acro("ghost", [{ width: 0, height: 0 }])]);
    const fields = buildFieldsFromInspection(inspection);

    expect(annotationsForFields(fields, inspection)).toEqual([]);
  });
});

describe("reindex", () => {
  it("renumbers order to match array position", () => {
    const inspection = inspectionOf([acro("a", [{ y: 700 }]), acro("b", [{ y: 500 }])]);
    const fields = buildFieldsFromInspection(inspection);
    const reversed = reindex([fields[1], fields[0]]);

    expect(reversed.map((f) => f.order)).toEqual([0, 1]);
    expect(reversed[0].label).toBe("b");
  });
});
