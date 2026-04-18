import { describe, expect, it } from "@jest/globals";
import { escapeCsvFormulaValue, normalizeCsvRows, sanitizeFilename } from "../../utils/csvExport";

describe("csvExport safety utilities", () => {
  // App coverage:
  // - export flows in delivery/profile pages derive filenames from user-visible labels
  // - unsafe filename characters can break downloads on some OS/browser combinations
  // Behavior contract: invalid filename characters and control chars are sanitized predictably.
  it("sanitizes invalid filename characters and control characters", () => {
    expect(sanitizeFilename(" deliveries:\\march/2026*report?.csv\n")).toBe(
      "deliveries__march_2026_report_.csv"
    );
  });

  // App coverage:
  // - CSV cells can be opened in spreadsheet software that interprets formula-like prefixes
  // - escaping prevents CSV formula injection from user-provided text values
  // Behavior contract: dangerous prefixes are apostrophe-escaped and safe values remain unchanged.
  it("escapes dangerous formula prefixes", () => {
    expect(escapeCsvFormulaValue("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvFormulaValue("+1+2")).toBe("'+1+2");
    expect(escapeCsvFormulaValue("normal text")).toBe("normal text");
    expect(escapeCsvFormulaValue("")).toBe("");
  });

  // App coverage:
  // - export formatters pass mixed row values (arrays, objects, dates, nulls) into CSV normalization
  // - stable normalization prevents malformed CSV cells and preserves downstream readability
  // Behavior contract: rows normalize to safe scalar values with formula escaping applied.
  it("normalizes complex row values into safe CSV scalars", () => {
    const rows = [
      {
        name: "Alice",
        notes: "@risk",
        tags: ["veg", "=cmd"],
        metadata: { area: "NW", score: 2 },
        active: true,
        visits: 3,
        optional: null,
        when: new Date("2026-03-31T00:00:00.000Z"),
      },
    ];

    expect(normalizeCsvRows(rows)).toEqual([
      {
        name: "Alice",
        notes: "'@risk",
        tags: "veg, '=cmd",
        metadata: '{"area":"NW","score":2}',
        active: true,
        visits: 3,
        optional: "",
        when: "2026-03-31T00:00:00.000Z",
      },
    ]);
  });
});
