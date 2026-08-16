import { describe, expect, it } from "@jest/globals";
import {
  buildGeocodingAddress,
  formatAddressWithQuadrant,
  formatAddressWithQuadrantAndUnit,
  normalizeQuadrantToken,
  shouldGeocodeClientLocation,
} from "./addressFormat";

describe("addressFormat", () => {
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
