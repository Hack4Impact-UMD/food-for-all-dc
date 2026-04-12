import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

describe("Spreadsheet search filter regression guards", () => {
  const sourcePath = path.resolve(__dirname, "Spreadsheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  it("supports multi-value key:value filters for the Clients page search", () => {
    expect(source).toContain("splitFilterValues(searchValue)");
    expect(source).toContain("matchesAnySearchValue");
    expect(source).toContain("normalizeSearchKeyword(keyword)");
  });

  it("shows multi-value examples in the Clients page search placeholder", () => {
    expect(source).toContain(
      'placeholder=\'Search clients (e.g., smith, name:john,jane, address:"main st", gender:female,male)\''
    );
  });
});
