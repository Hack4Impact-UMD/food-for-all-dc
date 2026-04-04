import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

describe("DeliverySpreadsheet search alias regression guards", () => {
  const sourcePath = path.resolve(__dirname, "DeliverySpreadsheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  it("normalizes extracted key-value keywords before switch handling", () => {
    expect(source).toContain("const normalizedKeyword = normalizeSearchKeyword(keyword);");
    expect(source).toContain("switch (normalizedKeyword)");
  });

  it("normalizes custom column aliases for visible-field matching", () => {
    expect(source).toMatch(
      /customColumnMappings[\s\S]*aliases\.some\(\(alias\) => normalizeSearchKeyword\(alias\) === normalizedKeyword\)/
    );
  });
});
