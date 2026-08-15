import { describe, expect, it } from "@jest/globals";
import { createEmptyFilter, QueryFilter } from "../types/query-tool-types";
import { validateFilters } from "./queryToolValidation";

const makeFilter = (overrides: Partial<QueryFilter>): QueryFilter => ({
  ...createEmptyFilter(),
  ...overrides,
});

describe("validateFilters", () => {
  it("requires at least one filter", () => {
    const result = validateFilters("clients", []);
    expect(result.valid).toBe(false);
    expect(result.formErrors).toContain("Add one or more filters, then select Run Query.");
  });

  it("accepts a valid boolean filter", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "activeStatus", operator: "==", value: true }),
    ]);
    expect(result.valid).toBe(true);
  });

  it("accepts a valid text filter", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "ward", operator: "==", value: "Ward 1" }),
    ]);
    expect(result.valid).toBe(true);
  });

  it("accepts a valid numeric range filter", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "total", operator: ">=", value: 2 }),
    ]);
    expect(result.valid).toBe(true);
  });

  it("accepts a valid array-contains filter", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "tags", operator: "array-contains", value: "Halal" }),
    ]);
    expect(result.valid).toBe(true);
  });

  it("rejects an empty value", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "ward", operator: "==", value: "" }),
    ]);
    expect(result.valid).toBe(false);
    expect(Object.values(result.fieldErrors)[0]).toMatch(/Choose a value for Ward/);
  });

  it("rejects an invalid operator/type combination", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "activeStatus", operator: "array-contains" as any, value: true }),
    ]);
    expect(result.valid).toBe(false);
    expect(Object.values(result.fieldErrors)[0]).toMatch(/not a valid operator/);
  });

  it("rejects more than one array-contains filter", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "tags", operator: "array-contains", value: "Halal" }),
      makeFilter({ field: "tags", operator: "array-contains", value: "Vegan" }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.formErrors[0]).toMatch(/Only one "contains" filter/);
  });

  it("rejects more than one single-use operator (in/not-in/array-contains-any)", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "ward", operator: "in", value: ["Ward 1", "Ward 2"] }),
      makeFilter({ field: "tags", operator: "array-contains-any", value: ["Halal"] }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.formErrors[0]).toMatch(/is any of/);
  });

  it("requires a field to be selected", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "", operator: "==", value: "x" }),
    ]);
    expect(result.valid).toBe(false);
    expect(Object.values(result.fieldErrors)[0]).toMatch(/Choose a field/);
  });
});
