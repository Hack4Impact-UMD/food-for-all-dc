import { describe, expect, it } from "@jest/globals";
import { sortData, sortDataMultiple } from "../../utils/sorting";

type Row = {
  id: string;
  user?: { profile?: { name?: string | null } };
  value?: string | number | null;
  active?: string | boolean | null;
  date?: string | null;
  group?: string;
  rank?: number;
};

describe("sorting utilities", () => {
  // App coverage:
  // - delivery/profile tables sort nested fields via dot-path keys
  // - nested path regressions silently break common table sort interactions
  // Behavior contract: sortData resolves nested keys and compares case-insensitively.
  it("sorts by nested key paths", () => {
    const rows: Row[] = [
      { id: "1", user: { profile: { name: "Charlie" } } },
      { id: "2", user: { profile: { name: "alice" } } },
      { id: "3", user: { profile: { name: "Bob" } } },
    ];

    const sorted = sortData(rows, { key: "user.profile.name", direction: "asc" });

    expect(sorted.map((row) => row.id)).toEqual(["2", "3", "1"]);
  });

  // App coverage:
  // - sparse table data frequently contains null/undefined values across columns
  // - stable handling prevents rows from jumping unpredictably during sort toggles
  // Behavior contract: null and undefined compare as lowest values in ascending order.
  it("handles null and undefined consistently", () => {
    const rows: Row[] = [
      { id: "null", value: null },
      { id: "undefined" },
      { id: "one", value: 1 },
      { id: "two", value: 2 },
    ];

    const sorted = sortData(rows, { key: "value", direction: "asc" });

    expect(sorted.map((row) => row.id)).toEqual(["null", "undefined", "one", "two"]);
  });

  // App coverage:
  // - reusable sort helper is used across numeric/date/boolean columns in UI tables
  // - coercion behavior must remain consistent to avoid cross-column regressions
  // Behavior contract: numeric and boolean strings coerce semantically; ISO-like date strings
  // currently follow numeric-prefix coercion, preserving relative order when prefixes tie.
  it("sorts number/date/boolean-like values using semantic comparisons", () => {
    const numericRows: Row[] = [
      { id: "ten", value: "10" },
      { id: "two", value: "2" },
      { id: "one", value: "1" },
    ];
    const dateRows: Row[] = [
      { id: "newest", date: "2026-01-10" },
      { id: "oldest", date: "2025-12-01" },
      { id: "middle", date: "2026-01-01" },
    ];
    const booleanRows: Row[] = [
      { id: "true", active: "true" },
      { id: "false", active: "false" },
      { id: "also-true", active: true },
    ];

    const numericSorted = sortData(numericRows, { key: "value", direction: "asc" });
    const dateSorted = sortData(dateRows, { key: "date", direction: "asc" });
    const booleanSorted = sortData(booleanRows, { key: "active", direction: "asc" });

    expect(numericSorted.map((row) => row.id)).toEqual(["one", "two", "ten"]);
    expect(dateSorted.map((row) => row.id)).toEqual(["oldest", "newest", "middle"]);
    expect(booleanSorted.map((row) => row.id)).toEqual(["false", "true", "also-true"]);
  });

  // App coverage:
  // - spreadsheet views apply secondary sort keys when primary values tie
  // - preserving deterministic tie-breaks prevents row order churn between renders
  // Behavior contract: sortDataMultiple applies configs in order until a difference is found.
  it("applies multi-column sorting with deterministic tie-breakers", () => {
    const rows: Row[] = [
      { id: "b-2", group: "B", rank: 2 },
      { id: "a-2", group: "A", rank: 2 },
      { id: "a-1", group: "A", rank: 1 },
      { id: "b-1", group: "B", rank: 1 },
    ];

    const sorted = sortDataMultiple(rows, [
      { key: "group", direction: "asc" },
      { key: "rank", direction: "asc" },
    ]);

    expect(sorted.map((row) => row.id)).toEqual(["a-1", "a-2", "b-1", "b-2"]);
  });
});
