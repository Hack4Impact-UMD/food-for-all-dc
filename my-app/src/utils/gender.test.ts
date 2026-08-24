import { describe, expect, it } from "@jest/globals";
import { GENDER_OPTIONS, normalizeGender } from "./gender";

describe("normalizeGender", () => {
  it("keeps every canonical option unchanged", () => {
    for (const option of GENDER_OPTIONS) {
      expect(normalizeGender(option)).toBe(option);
    }
  });

  it("matches stored values case-insensitively and ignores surrounding whitespace", () => {
    expect(normalizeGender("male")).toBe("Male");
    expect(normalizeGender("  FEMALE ")).toBe("Female");
  });

  it("falls back to Unknown for missing values", () => {
    expect(normalizeGender(undefined)).toBe("Unknown");
    expect(normalizeGender(null)).toBe("Unknown");
    expect(normalizeGender("")).toBe("Unknown");
  });

  it("falls back to Unknown for values the dropdown cannot represent", () => {
    expect(normalizeGender("M")).toBe("Unknown");
    expect(normalizeGender("Nonbinary")).toBe("Unknown");
    expect(normalizeGender(42)).toBe("Unknown");
  });
});
