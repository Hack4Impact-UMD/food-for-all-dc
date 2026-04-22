import { describe, expect, it } from "@jest/globals";
import {
  checkStringEquals,
  checkStringContains,
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

  it("preserves key:value terms when value is unquoted and contains spaces", () => {
    const terms = parseSearchTermsProgressively("assigned driver:sarah jones ward:7");

    expect(terms).toEqual(["assigned driver:sarah jones", "ward:7"]);
  });

  it("splits when the next token is a recognized key like ward", () => {
    const terms = parseSearchTermsProgressively("driver:sarah jones ward:7");

    expect(terms).toEqual(["driver:sarah jones", "ward:7"]);
  });

  it("does not split on colon text inside a value when token is not a known key", () => {
    const terms = parseSearchTermsProgressively("address:123 main st apt: 2 ward:7");

    expect(terms).toEqual(["address:123 main st apt: 2", "ward:7"]);
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

  it("treats semicolon as an explicit separator between key:value filters", () => {
    const terms = parseSearchTermsProgressively(
      "language:english; delivery instructions:call before arriving"
    );

    expect(terms).toEqual(["language:english", "delivery instructions:call before arriving"]);
  });

  // App coverage:
  // - Routes page filtering should allow AND across columns while still allowing OR within one column
  // - supports user input like `cluster: 1, 2, ward: 2` in a single search box
  // Behavior contract: the parser must split the cluster filter from the ward filter even when a comma is used between them.
  it("preserves multiple column filters when a multi-value filter is followed by another key:value term", () => {
    const spacedTerms = parseSearchTermsProgressively("cluster: 1, 2, ward: 2");
    const compactTerms = parseSearchTermsProgressively("cluster:1,2,ward:2");

    expect(spacedTerms).toEqual(["cluster: 1, 2", "ward: 2"]);
    expect(compactTerms).toEqual(["cluster:1,2", "ward:2"]);
  });

  it("preserves supported multi-word aliases as a single key:value term", () => {
    expect(parseSearchTermsProgressively("dietary restrictions:vegan")).toEqual([
      "dietary restrictions:vegan",
    ]);
    expect(parseSearchTermsProgressively("first name:john")).toEqual(["first name:john"]);
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
    expect(checkStringEquals("Ward 2", "2")).toBe(true);
    expect(checkStringEquals("10", "1")).toBe(false);
    expect(checkStringEquals("12", "2")).toBe(false);
    expect(checkStringEquals("Ward 12", "2")).toBe(false);
  });

  it("treats none as a match for missing or empty values", () => {
    expect(checkStringContains(undefined, "none")).toBe(true);
    expect(checkStringContains(null, "None")).toBe(true);
    expect(checkStringContains("", "none")).toBe(true);
    expect(checkStringEquals(undefined, "none")).toBe(true);
    expect(checkStringEquals("", "none")).toBe(true);
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

  it("extracts key:value gracefully when keyword/value have one-sided quotes", () => {
    const quotedKeyword = extractKeyValue('"assigned driver:Sarah');
    const quotedValue = extractKeyValue('assigned driver:"Sarah Jones');

    expect(quotedKeyword).toEqual({
      keyword: "assigned driver",
      searchValue: "Sarah",
      isKeyValue: true,
    });

    expect(quotedValue).toEqual({
      keyword: "assigned driver",
      searchValue: "Sarah Jones",
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
