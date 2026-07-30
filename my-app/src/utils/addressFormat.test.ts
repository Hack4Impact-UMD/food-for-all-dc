import { describe, expect, it } from "@jest/globals";
import {
  formatAddressWithQuadrant,
  formatAddressWithQuadrantAndUnit,
  normalizeQuadrantToken,
} from "./addressFormat";

describe("addressFormat", () => {
  it("normalizes full-word quadrant tokens", () => {
    expect(normalizeQuadrantToken("Southeast")).toBe("SE");
    expect(normalizeQuadrantToken("northwest")).toBe("NW");
  });

  it("appends normalized quadrant when base address lacks one", () => {
    expect(formatAddressWithQuadrant("1738 Massachusetts Avenue", "Southeast")).toBe(
      "1738 Massachusetts Avenue SE"
    );
  });

  it("does not duplicate quadrant when already present", () => {
    expect(formatAddressWithQuadrant("1738 Massachusetts Avenue SE", "SE")).toBe(
      "1738 Massachusetts Avenue SE"
    );
  });

  it("standardizes full-word directions already in address", () => {
    expect(formatAddressWithQuadrant("1738 Massachusetts Avenue Southeast", "SE")).toBe(
      "1738 Massachusetts Avenue SE"
    );
  });

  it("keeps apartment/unit text when formatting full address", () => {
    expect(
      formatAddressWithQuadrantAndUnit(
        "1738 Massachusetts Avenue",
        "Southeast",
        "Apartment 4B"
      )
    ).toBe("1738 Massachusetts Avenue SE Apartment 4B");
  });
});
