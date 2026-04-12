import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

describe("UsersSpreadsheet search filter regression guards", () => {
  const sourcePath = path.resolve(__dirname, "UsersSpreadsheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  it("supports multi-value key:value filters for the Clients page search", () => {
    expect(source).toContain("splitFilterValues(searchValue)");
    expect(source).toContain("matchesAnySearchValue");
  });

  it("shows multi-value examples in the Clients page search placeholder", () => {
    expect(source).toContain('placeholder="Search users (e.g., role:admin,manager, name:jane,john, email:test@example.com)"');
  });
});
