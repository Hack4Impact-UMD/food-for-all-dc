import { describe, expect, it } from "@jest/globals";
import {
  annotationsForFields,
  buildFieldsFromInspection,
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

  // The registry lists the primary phone before the alternate, so a first-match
  // rule bound "Alternate Phone Number" to the client's own phone.
  it("prefers the most specific client value when several match", () => {
    expect(suggestClientKey("Alternate Phone Number")).toBe("alternativePhone");
    expect(suggestClientKey("Phone Number")).toBe("phone");
  });

  // A label naming somebody else is exactly the case a plausible wrong guess
  // does the most harm: it puts the client's own details into a proxy block on
  // a signed federal eligibility form.
  it("offers nothing for a field belonging to someone other than the client", () => {
    expect(suggestClientKey("Proxy First Name")).toBeUndefined();
    expect(suggestClientKey("Emergency Contact Zip Code")).toBeUndefined();
    expect(suggestClientKey("Spouse Date of Birth")).toBeUndefined();
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

  it("makes newly discovered fields visible and editable to staff", () => {
    const [field] = buildFieldsFromInspection(inspectionOf([acro("Name", [{}])]));

    expect(field.hidden).toBe(false);
    expect(field.readOnly).toBe(false);
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

  it("preserves a radio group as one single-choice field with the PDF's options", () => {
    const fields = buildFieldsFromInspection(
      inspectionOf([
        acro("box", [{}], { type: "checkbox" }),
        acro("group", [{ y: 120 }, { y: 100 }], { type: "radio", options: ["Yes", "No"] }),
      ])
    );

    expect(fields.find((field) => field.label === "box")?.type).toBe("checkbox");
    expect(fields.find((field) => field.label === "group")).toMatchObject({
      type: "radio",
      options: ["Yes", "No"],
    });
  });

  it("combines each named Yes checkbox with the unnamed No widget on its row", () => {
    const fields = buildFieldsFromInspection(
      inspectionOf([
        acro("Household receives TANF", [{ x: 400, y: 120, width: 10 }], {
          type: "checkbox",
        }),
        acro("Household receives SNAP", [{ x: 400, y: 100, width: 10 }], {
          type: "checkbox",
        }),
        acro("undefined", [{ x: 430, y: 120 }, { x: 430, y: 100 }], {
          type: "checkbox",
        }),
      ])
    );

    expect(fields).toHaveLength(2);
    expect(fields.map((field) => field.label)).toEqual([
      "Household receives TANF",
      "Household receives SNAP",
    ]);
    expect(fields.every((field) => field.type === "radio")).toBe(true);
    expect(fields.every((field) => field.options?.join("|") === "Yes|No")).toBe(true);
    expect(fields[0].radioOptions?.[1].placement).toMatchObject({
      kind: "overlay",
      x: 430,
      y: 120,
    });
    expect(fields[1].radioOptions?.[1].placement).toMatchObject({
      kind: "overlay",
      x: 430,
      y: 100,
    });
  });

  it("rejects a partial pairing with a shared No field", () => {
    const fields = buildFieldsFromInspection(
      inspectionOf([
        acro("Household receives TANF", [{ x: 400, y: 120, width: 10 }], {
          type: "checkbox",
        }),
        acro("undefined", [{ x: 430, y: 120 }, { x: 430, y: 100 }], {
          type: "checkbox",
        }),
      ])
    );

    expect(fields).toHaveLength(2);
    expect(fields.find((field) => field.label === "Household receives TANF")).toMatchObject({
      type: "checkbox",
      radioOptions: undefined,
    });
    expect(fields.find((field) => field.label === "undefined")?.type).toBe("checkbox");
  });

  it("skips fields of a type that cannot be filled", () => {
    const fields = buildFieldsFromInspection(
      inspectionOf([acro("sig", [{}], { type: "unsupported" })])
    );

    expect(fields).toEqual([]);
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

  it("uses one field number for every option in a radio group", () => {
    const inspection = inspectionOf([
      acro("choice", [{ y: 317 }, { y: 296 }], { type: "radio", options: ["Yes", "No"] }),
    ]);
    const fields = buildFieldsFromInspection(inspection);

    expect(annotationsForFields(fields, inspection).map((a) => a.label)).toEqual(["1", "1"]);
  });

  it("skips a field with no drawable box", () => {
    const inspection = inspectionOf([acro("ghost", [{ width: 0, height: 0 }])]);
    const fields = buildFieldsFromInspection(inspection);

    expect(annotationsForFields(fields, inspection)).toEqual([]);
  });
});
