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

  it("accepts a complete date from the date picker", () => {
    const result = validateFilters("deliveries", [
      makeFilter({ field: "deliveryDate", operator: "==", value: new Date(2027, 7, 24) }),
    ]);

    expect(result.valid).toBe(true);
  });

  it("rejects an incomplete year from the date picker", () => {
    const incompleteDate = new Date(2027, 7, 24);
    incompleteDate.setFullYear(2);
    const result = validateFilters("deliveries", [
      makeFilter({ field: "deliveryDate", operator: "==", value: incompleteDate }),
    ]);

    expect(result.valid).toBe(false);
    expect(Object.values(result.fieldErrors)[0]).toMatch(/complete valid date/i);
  });

  it("rejects malformed date text", () => {
    const result = validateFilters("deliveries", [
      makeFilter({ field: "deliveryDate", operator: "==", value: "2-08-24" }),
    ]);

    expect(result.valid).toBe(false);
    expect(Object.values(result.fieldErrors)[0]).toMatch(/complete valid date/i);
  });

  it("accepts a valid array-contains filter", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "tags", operator: "array-contains", value: "Halal" }),
    ]);
    expect(result.valid).toBe(true);
  });

  it("rejects multiple values for array-contains", () => {
    const result = validateFilters("clients", [
      makeFilter({
        field: "tags",
        operator: "array-contains",
        value: ["Halal", "Vegan"],
      }),
    ]);

    expect(result.valid).toBe(false);
    expect(Object.values(result.fieldErrors)[0]).toMatch(/one value/i);
  });

  it("rejects an array value for array-contains even when it has one item", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "tags", operator: "array-contains", value: ["Halal"] }),
    ]);

    expect(result.valid).toBe(false);
    expect(Object.values(result.fieldErrors)[0]).toMatch(/one value/i);
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

  it("allows multiple array-contains filters", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "tags", operator: "array-contains", value: "Halal" }),
      makeFilter({ field: "tags", operator: "array-contains", value: "Vegan" }),
    ]);
    expect(result.valid).toBe(true);
  });

  it("allows membership operators across different fields", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "ward", operator: "in", value: ["Ward 1", "Ward 2"] }),
      makeFilter({ field: "tags", operator: "array-contains-any", value: ["Halal"] }),
    ]);
    expect(result.valid).toBe(true);
  });

  it("allows multiple membership operators on the same field", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "ward", operator: "in", value: ["1"] }),
      makeFilter({ field: "ward", operator: "not-in", value: ["2"] }),
    ]);
    expect(result.valid).toBe(true);
  });

  it("allows combinations of not-in and not equals", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "ward", operator: "not-in", value: ["Ward 1"] }),
      makeFilter({ field: "city", operator: "!=", value: "Washington" }),
    ]);

    expect(result.valid).toBe(true);
  });

  it("allows multiple not-equals filters", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "ward", operator: "!=", value: "Ward 1" }),
      makeFilter({ field: "city", operator: "!=", value: "Washington" }),
    ]);

    expect(result.valid).toBe(true);
  });

  it("enforces Firestore list value limits", () => {
    const tooManyNotInValues = Array.from({ length: 11 }, (_, index) => `Ward ${index}`);
    const tooManyInValues = Array.from({ length: 31 }, (_, index) => `Ward ${index}`);
    const tooManyContainsAnyValues = Array.from({ length: 31 }, (_, index) => `Tag ${index}`);

    const notInResult = validateFilters("clients", [
      makeFilter({ field: "ward", operator: "not-in", value: tooManyNotInValues }),
    ]);
    const containsAnyResult = validateFilters("clients", [
      makeFilter({
        field: "tags",
        operator: "array-contains-any",
        value: tooManyContainsAnyValues,
      }),
    ]);
    const inResult = validateFilters("clients", [
      makeFilter({ field: "ward", operator: "in", value: tooManyInValues }),
    ]);

    expect(notInResult.valid).toBe(false);
    expect(inResult.valid).toBe(false);
    expect(containsAnyResult.valid).toBe(false);
  });

  it("enforces Firestore list value limits for comma-separated input", () => {
    const result = validateFilters("clients", [
      makeFilter({
        field: "ward",
        operator: "not-in",
        value: Array.from({ length: 11 }, (_, index) => `Ward ${index}`).join(","),
      }),
    ]);

    expect(result.valid).toBe(false);
  });

  it("requires a field to be selected", () => {
    const result = validateFilters("clients", [
      makeFilter({ field: "", operator: "==", value: "x" }),
    ]);
    expect(result.valid).toBe(false);
    expect(Object.values(result.fieldErrors)[0]).toMatch(/Choose a field/);
  });
});
