import { describe, expect, it } from "@jest/globals";
import {
  checkStringEquals,
  extractKeyValue,
  parseSearchTermsProgressively,
  splitFilterValues,
} from "./searchFilter";

describe("searchFilter parsing", () => {
  // App coverage:
  // - route search input parsing in `src/pages/Delivery/DeliverySpreadsheet.tsx` (`visibleRows` filter path)
  // - supports key:value and free-text search on the Routes page
  // Behavior contract: plain multi-term input splits by spaces into separate terms.
  it("splits plain space-separated terms", () => {
    const terms = parseSearchTermsProgressively("ward:7 driver:maria");

    expect(terms).toEqual(["ward:7", "driver:maria"]);
  });

  // App coverage:
  // - quoted free-text searching in the Routes search bar
  // - avoids breaking full names/addresses into unrelated term fragments
  // Behavior contract: quoted phrases are preserved as a single term.
  it("keeps quoted phrases as a single search term", () => {
    const terms = parseSearchTermsProgressively('"john smith" ward:7');

    expect(terms).toEqual(['"john smith"', "ward:7"]);
  });

  // App coverage:
  // - key-value search entries with quoted values in DeliverySpreadsheet
  // - enables `name:"value with spaces"` syntax used in placeholder examples
  // Behavior contract: key + quoted value remains one term instead of splitting at whitespace.
  it("preserves key:value terms when value is quoted and contains spaces", () => {
    const terms = parseSearchTermsProgressively('name: "john smith" driver:maria');

    expect(terms).toEqual(['name: "john smith"', "driver:maria"]);
  });

  // App coverage:
  // - Routes page filter input for cluster IDs with or without a space after `:`
  // - ensures `cluster:12` and `cluster: 12` are both parsed as key:value filters
  // Behavior contract: spaces immediately after the colon remain part of the same term.
  it("preserves key:value terms when a filter includes a space after the colon", () => {
    const compactTerms = parseSearchTermsProgressively("cluster:12 driver:maria");
    const spacedTerms = parseSearchTermsProgressively("cluster: 12 driver:maria");

    expect(compactTerms).toEqual(["cluster:12", "driver:maria"]);
    expect(spacedTerms).toEqual(["cluster: 12", "driver:maria"]);
  });

  // App coverage:
  // - Routes page key:value parsing for comma-separated values in a single column filter
  // - supports input like `cluster: 1, 2 ward:7` without splitting `2` into a stray term
  // Behavior contract: comma-separated values remain attached to the same key:value filter term.
  it("preserves multi-value key:value filters as a single search term", () => {
    const terms = parseSearchTermsProgressively("cluster: 1, 2 ward:7");

    expect(terms).toEqual(["cluster: 1, 2", "ward:7"]);
  });

  // App coverage:
  // - multi-value Routes page filtering across columns like cluster, ward, driver, and tags
  // - each comma-separated entry should be treated as an OR value for the same key
  // Behavior contract: splitFilterValues trims entries and preserves quoted comma text as one value.
  it("splits comma-separated filter values while preserving quoted entries", () => {
    const values = splitFilterValues('1, 2, "north east"');

    expect(values).toEqual(["1", "2", "north east"]);
  });

  // App coverage:
  // - exact-match route filters like cluster, ward, and zip should not over-match partial numeric strings
  // - prevents `cluster:1,2` from including route ids like `10`, `11`, or `12`
  // Behavior contract: exact comparison is case-insensitive but does not allow substring matches.
  it("matches exact discrete filter values without partial numeric matches", () => {
    expect(checkStringEquals("1", "1")).toBe(true);
    expect(checkStringEquals(" 2 ", "2")).toBe(true);
    expect(checkStringEquals("10", "1")).toBe(false);
    expect(checkStringEquals("12", "2")).toBe(false);
  });

  // App coverage:
  // - key-value extraction in DeliverySpreadsheet filtering switch/case
  // - drives matching logic for fields like `name`, `ward`, `driver`, etc.
  // Behavior contract: extractKeyValue lowercases keyword and strips surrounding quotes.
  it("extracts normalized keyword and unquoted value from key-value terms", () => {
    const parsed = extractKeyValue('Name: "John Smith"');

    expect(parsed).toEqual({
      keyword: "name",
      searchValue: "John Smith",
      isKeyValue: true,
    });
  });

  // App coverage:
  // - fallback path for non key-value free-text terms in route filtering
  // - prevents accidental key-value handling when no colon is present
  // Behavior contract: extractKeyValue flags non key-value terms correctly.
  it("returns non-key-value metadata when no colon exists", () => {
    const parsed = extractKeyValue("john");

    expect(parsed).toEqual({
      keyword: "",
      searchValue: "",
      isKeyValue: false,
    });
  });
});
