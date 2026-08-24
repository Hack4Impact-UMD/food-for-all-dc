import { describe, expect, it } from "@jest/globals";
import {
  buildGeocodingAddress,
  formatAddressWithQuadrant,
  formatAddressWithQuadrantAndUnit,
  isStreetStyleAddress,
  normalizeQuadrantToken,
  replaceAddressQuadrant,
  resolveAddressQuadrant,
  shouldGeocodeClientLocation,
  splitAddressUnit,
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

  it("replaces the street token when a user explicitly changes the quadrant", () => {
    expect(replaceAddressQuadrant("100 Main Street NW", "NE")).toBe("100 Main Street NE");
    expect(replaceAddressQuadrant("100 Main Street Northwest", "SE")).toBe(
      "100 Main Street SE"
    );
  });

  it("appends the selected quadrant when the street does not contain one", () => {
    expect(replaceAddressQuadrant("100 Main Street", "Southwest")).toBe(
      "100 Main Street SW"
    );
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

  it("moves a manually typed apartment from address 1 to address 2", () => {
    expect(splitAddressUnit("2401 Calvert Street NW Apt 528")).toEqual({
      address: "2401 Calvert Street NW",
      address2: "Apt 528",
    });
  });

  it("repairs spacing when an apartment is typed inside the street address", () => {
    expect(splitAddressUnit("2401  apt 528Calvert street NW")).toEqual({
      address: "2401 Calvert street NW",
      address2: "Apt 528",
    });
  });

  it("supports unit, suite, and hash notation", () => {
    expect(splitAddressUnit("100 Main Street Unit 4B").address2).toBe("Unit 4B");
    expect(splitAddressUnit("100 Main Street, Ste. 200").address2).toBe("Suite 200");
    expect(splitAddressUnit("100 Main Street #12").address2).toBe("Unit 12");
  });

  it("does not treat street names beginning with Ste as suite markers", () => {
    expect(splitAddressUnit("1339 Fort Stevens Drive NW", "Apt 217")).toEqual({
      address: "1339 Fort Stevens Drive NW",
      address2: "Apt 217",
    });
  });
});
