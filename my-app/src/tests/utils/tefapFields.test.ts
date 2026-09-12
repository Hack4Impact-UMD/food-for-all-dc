import { describe, expect, it } from "@jest/globals";
import {
  applyExclusivity,
  collectRadioControlValues,
  emptyValueFor,
  hasValue,
  isTefapTruthy,
  reconcileFieldsWithInspection,
  toValueList,
  toValueMap,
  validateRequired,
  visibleFields,
} from "../../utils/tefapFields";
import type { TefapFormField, TefapPdfInspection } from "../../types/tefap-types";

const field = (key: string, overrides: Partial<TefapFormField> = {}): TefapFormField => ({
  key,
  label: key,
  type: "text",
  required: false,
  placement: { kind: "acroform", pdfFieldName: key },
  prefill: { source: "none" },
  order: 0,
  ...overrides,
});

describe("emptyValueFor", () => {
  it("uses false for checkboxes and an empty string for everything else", () => {
    expect(emptyValueFor(field("box", { type: "checkbox" }))).toBe(false);
    expect(emptyValueFor(field("name"))).toBe("");
  });
});

describe("isTefapTruthy", () => {
  it("accepts affirmative static checkbox values", () => {
    expect(isTefapTruthy(true)).toBe(true);
    expect(isTefapTruthy("Yes")).toBe(true);
    expect(isTefapTruthy("checked")).toBe(true);
  });

  it("rejects negative static checkbox values", () => {
    expect(isTefapTruthy(false)).toBe(false);
    expect(isTefapTruthy("No")).toBe(false);
    expect(isTefapTruthy("off")).toBe(false);
  });
});

describe("collectRadioControlValues", () => {
  it("captures every field changed by a mirrored PDF checkbox group", () => {
    expect(
      collectRadioControlValues([
        { fieldKey: "tanf", option: "No", checked: true },
        { fieldKey: "snap", option: "No", checked: true },
      ])
    ).toEqual(
      new Map([
        ["tanf", "No"],
        ["snap", "No"],
      ])
    );
  });

  it("clears a field when none of its native options remains checked", () => {
    expect(
      collectRadioControlValues([
        { fieldKey: "tanf", option: "Yes", checked: false },
        { fieldKey: "tanf", option: "No", checked: false },
      ]).get("tanf")
    ).toBe("");
  });
});

describe("reconcileFieldsWithInspection", () => {
  it("upgrades a legacy checkbox mapping that targets a native radio group", () => {
    const legacy = field("assistance", {
      type: "checkbox",
      placement: { kind: "acroform", pdfFieldName: "Assistance" },
      exclusiveWith: ["other"],
    });
    const inspection: TefapPdfInspection = {
      pageCount: 1,
      pageSizes: [{ page: 1, width: 612, height: 792 }],
      diagnostics: [],
      acroFields: [
        {
          name: "Assistance",
          type: "radio",
          options: ["Yes", "No"],
          widgets: [],
        },
      ],
    };

    expect(reconcileFieldsWithInspection([legacy], inspection)).toEqual([
      expect.objectContaining({ type: "radio", options: ["Yes", "No"], exclusiveWith: undefined }),
    ]);
  });

  it("leaves genuine checkbox mappings unchanged", () => {
    const checkbox = field("consent", { type: "checkbox" });
    const inspection: TefapPdfInspection = {
      pageCount: 1,
      pageSizes: [{ page: 1, width: 612, height: 792 }],
      diagnostics: [],
      acroFields: [{ name: "consent", type: "checkbox", widgets: [] }],
    };

    expect(reconcileFieldsWithInspection([checkbox], inspection)[0]).toBe(checkbox);
  });
});

describe("toValueMap / toValueList", () => {
  it("round-trips values", () => {
    const values = [
      { field: "a", value: "one" },
      { field: "b", value: true },
    ];

    expect(toValueList(toValueMap(values))).toEqual(values);
  });

  it("lets a later entry win over an earlier duplicate", () => {
    const map = toValueMap([
      { field: "a", value: "first" },
      { field: "a", value: "second" },
    ]);

    expect(map.get("a")).toBe("second");
  });
});

describe("hasValue", () => {
  it("treats whitespace-only text as missing", () => {
    expect(hasValue(field("name"), "   ")).toBe(false);
    expect(hasValue(field("name"), " Jane ")).toBe(true);
  });

  it("treats an unchecked checkbox as missing", () => {
    const box = field("box", { type: "checkbox" });

    expect(hasValue(box, false)).toBe(false);
    expect(hasValue(box, true)).toBe(true);
  });

  it("treats an absent value as missing", () => {
    expect(hasValue(field("name"), undefined)).toBe(false);
  });

  it("counts a zero as supplied", () => {
    expect(hasValue(field("count", { type: "number" }), "0")).toBe(true);
  });
});

describe("validateRequired", () => {
  it("reports required fields that were left blank", () => {
    const fields = [
      field("name", { required: true, label: "Recipient name" }),
      field("zip", { required: true }),
    ];

    const issues = validateRequired(fields, [{ field: "zip", value: "20009" }]);

    expect(issues).toHaveLength(1);
    expect(issues[0].fieldKey).toBe("name");
    expect(issues[0].message).toBe("Recipient name is required.");
  });

  it("passes when every required field is supplied", () => {
    const fields = [field("name", { required: true })];

    expect(validateRequired(fields, [{ field: "name", value: "Jane" }])).toEqual([]);
  });

  it("exempts hidden fields, which the filler is never shown", () => {
    const fields = [field("proxyName", { required: true, hidden: true })];

    expect(validateRequired(fields, [])).toEqual([]);
  });

  it("ignores optional fields left blank", () => {
    expect(validateRequired([field("notes")], [])).toEqual([]);
  });
});

describe("applyExclusivity", () => {
  const yesNo = [
    field("yes", { type: "checkbox", exclusiveWith: ["no"] }),
    field("no", { type: "checkbox", exclusiveWith: ["yes"] }),
  ];

  it("clears the partner box when one is checked", () => {
    const values = toValueMap([
      { field: "yes", value: true },
      { field: "no", value: true },
    ]);

    const next = applyExclusivity(yesNo, values, "yes");

    expect(next.get("yes")).toBe(true);
    expect(next.get("no")).toBe(false);
  });

  it("leaves the partner alone when the box is being unchecked", () => {
    const values = toValueMap([
      { field: "yes", value: false },
      { field: "no", value: true },
    ]);

    expect(applyExclusivity(yesNo, values, "yes").get("no")).toBe(true);
  });

  it("does not mutate the map it was given", () => {
    const values = toValueMap([
      { field: "yes", value: true },
      { field: "no", value: true },
    ]);

    applyExclusivity(yesNo, values, "yes");

    expect(values.get("no")).toBe(true);
  });

  it("ignores a field that declares no partners", () => {
    const single = [field("solo", { type: "checkbox" })];
    const values = toValueMap([{ field: "solo", value: true }]);

    expect(applyExclusivity(single, values, "solo").get("solo")).toBe(true);
  });
});

describe("visibleFields", () => {
  it("drops hidden fields and sorts by display order", () => {
    const fields = [
      field("third", { order: 3 }),
      field("hidden", { order: 2, hidden: true }),
      field("first", { order: 1 }),
    ];

    expect(visibleFields(fields).map((entry) => entry.key)).toEqual(["first", "third"]);
  });
});
