import { describe, expect, it } from "@jest/globals";
import {
  buildGeocodingAddress,
  formatAddressUnit,
  formatAddressWithQuadrant,
  formatAddressWithQuadrantAndUnit,
  isStreetStyleAddress,
  normalizeDuplicateAddress,
  normalizeQuadrantToken,
  resolveAddressQuadrant,
  shouldGeocodeClientLocation,
} from "./addressFormat";

describe("addressFormat", () => {
  it.each([
    ["528", "Unit 528"],
    ["suite 270", "Suite 270"],
    ["Apt. #4B", "Apt 4B"],
  ])("formats Google subpremise %s", (subpremise, expected) => {
    expect(formatAddressUnit(subpremise)).toBe(expected);
  });

  it("builds a geocoding address with the quadrant and without apartment data", () => {
    expect(
      buildGeocodingAddress({
        address: "100 Main Street",
        quadrant: "Northwest",
        city: "Washington",
        state: "DC",
        zipCode: "20001",
      })
    ).toBe("100 Main Street NW, Washington, DC, 20001");
  });

  it("builds a complete DC address when legacy locality fields are blank", () => {
    expect(
      buildGeocodingAddress({
        address: "201 I Street SW",
        quadrant: "SW",
        city: "",
        state: "",
        zipCode: "20024",
      })
    ).toBe("201 I Street SW, Washington, DC, 20024");
  });

  it("skips geocoding when the location is unchanged and complete", () => {
    const location = {
      address: "100 Main Street",
      address2: "Apt 4",
      quadrant: "NW",
      city: "Washington",
      state: "DC",
      zipCode: "20001",
      coordinates: [38.9, -77.0],
      ward: "1",
    };

    expect(shouldGeocodeClientLocation(location, { ...location, address2: "Apt 2" })).toBe(false);
  });

  it("geocodes an unchanged address when coordinates are missing", () => {
    const previous = {
      address: "100 Main Street",
      quadrant: "NW",
      city: "Washington",
      state: "DC",
      zipCode: "20001",
      coordinates: [38.9, -77.0],
      ward: "1",
    };

    expect(shouldGeocodeClientLocation({ ...previous, coordinates: [] }, previous)).toBe(true);
  });

  it("geocodes when the separate quadrant changes", () => {
    const previous = {
      address: "100 Main Street",
      quadrant: "NW",
      city: "Washington",
      state: "DC",
      zipCode: "20001",
      coordinates: [38.9, -77.0],
      ward: "1",
    };

    expect(shouldGeocodeClientLocation({ ...previous, quadrant: "NE" }, previous)).toBe(true);
  });

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

  it("treats the street quadrant as authoritative when fields disagree", () => {
    expect(resolveAddressQuadrant("201 I Street SW", "NW")).toBe("SW");
    expect(formatAddressWithQuadrant("201 I Street SW", "NW")).toBe("201 I Street SW");
  });

  it("standardizes full-word directions already in address", () => {
    expect(formatAddressWithQuadrant("1738 Massachusetts Avenue Southeast", "SE")).toBe(
      "1738 Massachusetts Avenue SE"
    );
  });

  it("does not turn status text into a geocoding address", () => {
    expect(isStreetStyleAddress("MOVED")).toBe(false);
    expect(formatAddressWithQuadrant("MOVED", "SW")).toBe("MOVED");
    expect(
      buildGeocodingAddress({
        address: "MOVED",
        quadrant: "SW",
        city: "",
        state: "",
        zipCode: "",
      })
    ).toBe("");
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

  it.each([
    ["Apt 524", ""],
    ["Apartment #524", ""],
    ["Unit 524", ""],
    ["Apt No. 524", ""],
    ["Apartment Number 524", ""],
    ["Ste 524", ""],
    ["#524", ""],
    ["", "Apartment #524"],
    ["", "Unit 524"],
  ])("normalizes apartment form %s / %s for duplicate checks", (embeddedUnit, address2) => {
    expect(
      normalizeDuplicateAddress({
        address: `100 Main Street Northwest ${embeddedUnit}`.trim(),
        address2,
        quadrant: "NW",
      })
    ).toEqual({ street: "100 main st nw", unit: "524" });
  });

  it("keeps different apartment numbers distinct", () => {
    const first = normalizeDuplicateAddress({
      address: "100 Main St NW",
      address2: "Apt 524",
      quadrant: "NW",
    });
    const second = normalizeDuplicateAddress({
      address: "100 Main Street Northwest",
      address2: "Apartment 525",
      quadrant: "Northwest",
    });

    expect(first.street).toBe(second.street);
    expect(first.unit).not.toBe(second.unit);
  });
});
