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

  it("derives route reassignment ids from transaction state instead of render state", () => {
    expect(source).toContain("getClusterIdForClient(currentState.clusters, clientId)");
    expect(source).toContain("getNextClusterId(currentState.clusters)");
  });

  it("lets the map popup use the same selected-row bulk reassignment behavior", () => {
    expect(source).toContain("const selectedClientRows = selectedRows.has(clientId)");
    expect(source).toContain("rows.filter((candidateRow) => selectedRows.has(candidateRow.id))");
    expect(source).toContain(": [currentClient];");
  });

  it("keeps driver and time filters aligned with rendered override values", () => {
    expect(source).toContain(".compute?.(row, clusters, clientOverrides)");
    expect(source).toContain("[rows, searchQuery, customColumns, clusters, clientOverrides]");
  });

  it("resolves nested custom-column values for key:value filters", () => {
    expect(source).toContain("const fieldValue = getNestedPropertyValue(row, col.propertyKey);");
  });

  it("clears stale route selections after renumbering clusters", () => {
    expect(source).toMatch(
      /handleRenumberClusters[\s\S]*setSelectedRows\(new Set\(\)\)[\s\S]*setSelectedClusters\(new Set\(\)\)/
    );
  });

  it("preserves empty source clusters after moving all deliveries to a new route", () => {
    expect(source).not.toContain("if (!normalizedClusterId || normalizedDeliveries.length === 0)");
    expect(source).toContain("if (!normalizedClusterId) {");
    expect(source).toContain("deliveries: normalizedDeliveries");
  });

  it("shows a filtered total count when a route search is active", () => {
    expect(source).toContain("hasActiveRouteFilter && (");
    expect(source).toContain("Showing {sortedRows.length} filtered ");
    expect(source).toContain("of {rows.length}");
  });
});
