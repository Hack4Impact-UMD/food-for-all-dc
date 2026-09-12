import { describe, expect, it } from "@jest/globals";
import {
  TEFAP_CLIENT_FIELD_SOURCES,
  buildInitialValues,
  getClientFieldSource,
  resolvePrefill,
} from "../../utils/tefapPrefill";
import type { ClientProfile } from "../../types/client-types";
import type { TefapFormField } from "../../types/tefap-types";

const client = (overrides: Partial<ClientProfile> = {}): ClientProfile =>
  ({
    firstName: "Jane",
    lastName: "Doe",
    address: "1810 16th St",
    address2: "Apt 4",
    quadrant: "NW",
    city: "Washington",
    state: "DC",
    zipCode: "20009",
    ward: "Ward 1",
    phone: "202-555-0134",
    email: "jane@example.com",
    adults: 2,
    children: 1,
    seniors: 0,
    total: 3,
    ...overrides,
  }) as ClientProfile;

const field = (overrides: Partial<TefapFormField> = {}): TefapFormField => ({
  key: "field",
  label: "Field",
  type: "text",
  required: false,
  placement: { kind: "acroform", pdfFieldName: "Field" },
  prefill: { source: "none" },
  order: 0,
  ...overrides,
});

describe("TEFAP_CLIENT_FIELD_SOURCES", () => {
  it("exposes unique keys so the mapping menu has no ambiguous entries", () => {
    const keys = TEFAP_CLIENT_FIELD_SOURCES.map((source) => source.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("resolves every source to a string for a fully populated client", () => {
    for (const source of TEFAP_CLIENT_FIELD_SOURCES) {
      expect(typeof source.resolve(client())).toBe("string");
    }
  });

  it("resolves every source to a string for an empty client", () => {
    const blank = {} as ClientProfile;

    for (const source of TEFAP_CLIENT_FIELD_SOURCES) {
      expect(typeof source.resolve(blank)).toBe("string");
    }
  });
});

describe("getClientFieldSource", () => {
  it("finds a known source and returns nothing for an unknown key", () => {
    expect(getClientFieldSource("fullName")?.label).toBe("Full name");
    expect(getClientFieldSource("socialSecurityNumber")).toBeUndefined();
  });
});

describe("resolvePrefill", () => {
  it("returns the static value when the source is static", () => {
    const staticField = field({
      prefill: { source: "static", staticValue: "FOOD FOR ALL DC" },
    });

    expect(resolvePrefill(staticField, null)).toBe("FOOD FOR ALL DC");
  });

  it("reads an allowlisted value off the client", () => {
    const bound = field({ prefill: { source: "client", clientKey: "fullName" } });

    expect(resolvePrefill(bound, client())).toBe("Jane Doe");
  });

  it("combines address, quadrant, and unit into the full address", () => {
    const bound = field({ prefill: { source: "client", clientKey: "fullAddress" } });

    expect(resolvePrefill(bound, client())).toBe("1810 16th St NW Apt 4");
  });

  it("falls back to blank for a client key outside the allowlist", () => {
    const bound = field({ prefill: { source: "client", clientKey: "notARealField" } });

    expect(resolvePrefill(bound, client())).toBe("");
  });

  it("falls back to blank when there is no client to read from", () => {
    const bound = field({ prefill: { source: "client", clientKey: "fullName" } });

    expect(resolvePrefill(bound, null)).toBe("");
  });

  it("returns an empty value appropriate to the field type", () => {
    expect(resolvePrefill(field({ type: "checkbox" }), client())).toBe(false);
    expect(resolvePrefill(field(), client())).toBe("");
  });

  it("checks a bound checkbox only when the client value is present", () => {
    const bound = field({
      type: "checkbox",
      prefill: { source: "client", clientKey: "email" },
    });

    expect(resolvePrefill(bound, client())).toBe(true);
    expect(resolvePrefill(bound, client({ email: "" }))).toBe(false);
  });
});

describe("household size", () => {
  const resolve = (overrides: Partial<ClientProfile>) =>
    getClientFieldSource("householdSize")!.resolve(client(overrides));

  it("prefers the stored total", () => {
    expect(resolve({ total: 5, adults: 1, children: 1, seniors: 0 })).toBe("5");
  });

  it("sums the component counts when no total is stored", () => {
    expect(resolve({ total: 0, adults: 2, children: 3, seniors: 1 })).toBe("6");
  });

  it("returns blank when the household is unknown", () => {
    expect(resolve({ total: 0, adults: 0, children: 0, seniors: 0 })).toBe("");
  });
});

describe("buildInitialValues", () => {
  it("produces one entry per field, prefilled where bound", () => {
    const fields = [
      field({ key: "name", prefill: { source: "client", clientKey: "fullName" } }),
      field({ key: "site", prefill: { source: "static", staticValue: "FOOD FOR ALL DC" } }),
      field({ key: "income" }),
    ];

    expect(buildInitialValues(fields, client())).toEqual([
      { field: "name", value: "Jane Doe" },
      { field: "site", value: "FOOD FOR ALL DC" },
      { field: "income", value: "" },
    ]);
  });

  it("builds a blank preview without a client while preserving static values", () => {
    const fields = [
      field({ key: "name", prefill: { source: "client", clientKey: "fullName" } }),
      field({ key: "site", prefill: { source: "static", staticValue: "FOOD FOR ALL DC" } }),
    ];

    expect(buildInitialValues(fields, null)).toEqual([
      { field: "name", value: "" },
      { field: "site", value: "FOOD FOR ALL DC" },
    ]);
  });
});
