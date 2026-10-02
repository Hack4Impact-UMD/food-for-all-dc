import { describe, expect, it } from "@jest/globals";
import { parseQueryDate } from "./queryToolFormatting";

describe("parseQueryDate", () => {
  it("preserves a Date while the picker is still editing its sections", () => {
    const partialDate = new Date(2027, 7, 24);
    partialDate.setFullYear(2);

    expect(parseQueryDate(partialDate)).toBe(partialDate);
  });
});
