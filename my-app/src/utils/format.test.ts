import { describe, expect, it } from "@jest/globals";
import { formatPhoneNumberForSave } from "./format";

describe("formatPhoneNumberForSave", () => {
  it("formats ten-digit phone numbers with parentheses and a space", () => {
    expect(formatPhoneNumberForSave("2025550199")).toBe("(202) 555-0199");
    expect(formatPhoneNumberForSave("202-555-0199")).toBe("(202) 555-0199");
  });

  it("accepts a leading US country code", () => {
    expect(formatPhoneNumberForSave("+1 202 555 0199")).toBe("(202) 555-0199");
  });

  it("keeps optional blank values and rejects invalid numbers", () => {
    expect(formatPhoneNumberForSave("  ")).toBe("");
    expect(formatPhoneNumberForSave("555-0199")).toBeNull();
    expect(formatPhoneNumberForSave("call 2025550199")).toBeNull();
    expect(formatPhoneNumberForSave("202/555/0199")).toBeNull();
  });
});
