import { describe, expect, it } from "@jest/globals";
import { extractKeyValue, parseSearchTermsProgressively } from "./searchFilter";

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
