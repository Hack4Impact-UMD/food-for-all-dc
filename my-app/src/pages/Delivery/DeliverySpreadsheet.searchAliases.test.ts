import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

describe("DeliverySpreadsheet search alias regression guards", () => {
  const sourcePath = path.resolve(__dirname, "DeliverySpreadsheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  it("normalizes extracted key-value keywords before switch handling", () => {
    expect(source).toContain("const normalizedKeyword = normalizeSearchKeyword(keyword);");
    expect(source).toContain("switch (normalizedKeyword)");
    expect(source).toContain('case "clusterid":');
    expect(source).toContain('case "routeid":');
    expect(source).toContain('case "assigneddriver":');
    expect(source).toContain('case "assignedtime":');
    expect(source).toContain('case "deliveryinstructions":');
    expect(source).toContain('case "deliveryfreq":');
    expect(source).toContain('case "deliveryfrequency":');
    expect(source).toContain('case "tefapcert":');
    expect(source).toContain('case "referralentity":');
  });

  it("normalizes custom column aliases for visible-field matching", () => {
    expect(source).toMatch(
      /customColumnMappings[\s\S]*aliases\.some\(\(alias\) => normalizeSearchKeyword\(alias\) === normalizedKeyword\)/
    );
  });

  it("bulk reassigns all checked rows when changing the route dropdown for a selected cluster", () => {
    expect(source).toContain("selectedRows.has(row.id)");
    expect(source).toContain("moveClientsToCluster(");
  });

  it("preserves empty source clusters after moving all deliveries to a new route", () => {
    expect(source).not.toContain("if (!normalizedClusterId || normalizedDeliveries.length === 0)");
    expect(source).toContain("if (!normalizedClusterId) {");
    expect(source).toContain("deliveries: normalizedDeliveries");
  });

  it("shows a filtered total count when a route search is active", () => {
    expect(source).toContain("hasActiveRouteFilter && (");
    expect(source).toContain('Showing {sortedRows.length} filtered ');
    expect(source).toContain('of {rows.length}');
  });
});
