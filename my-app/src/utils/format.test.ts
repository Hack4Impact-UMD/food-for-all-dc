import { describe, expect, it } from "@jest/globals";
import { formatPhoneNumberForSave, normalizePhoneInput } from "./format";

describe("normalizePhoneInput", () => {
  it("removes invisible formatting characters from pasted phone numbers", () => {
    expect(normalizePhoneInput("202\u200B-555\u200E-0199\u2060")).toBe("202-555-0199");
  });

  it("normalizes unusual Unicode spaces", () => {
    expect(normalizePhoneInput("202\u00A0555\u202F0199")).toBe("202 555 0199");
  });

  it("preserves visible invalid characters for validation", () => {
    expect(normalizePhoneInput("call 202/555/0199")).toBe("call 202/555/0199");
  });
});

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
