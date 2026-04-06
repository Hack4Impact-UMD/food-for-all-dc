import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

describe("ClusterMap popup regression guards", () => {
  // Protects against popups opening and immediately closing due to map click propagation
  // or default Leaflet auto-close behavior.
  it("keeps explicit popup options to prevent immediate close", () => {
    const sourcePath = path.resolve(__dirname, "ClusterMap.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source).toContain("closeOnClick: false");
    expect(source).toContain("autoClose: false");
    expect(source).toContain("closePopupOnClick: false");
  });

  // Ensures both interaction entry points (direct marker click and table-driven openMapPopup)
  // explicitly open the marker popup.
  it("opens marker popup directly on marker click", () => {
    const sourcePath = path.resolve(__dirname, "ClusterMap.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source).toMatch(/\.on\("click",\s*\(\)\s*=>\s*\{[\s\S]*?marker\.openPopup\(\)/m);
    expect(source).toMatch(/openMapPopup\s*=\s*\(clientId:\s*string\)\s*=>\s*\{[\s\S]*?marker\.openPopup\(\)/m);
  });

  it("lets the cluster summary overlay toggle sorting by number of deliveries", () => {
    const sourcePath = path.resolve(__dirname, "ClusterMap.tsx");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source).toContain("clusterSummarySortMode");
    expect(source).toContain("sortClusterSummaries(");
    expect(source).toContain("ArrowDownwardIcon");
    expect(source).toContain("ArrowUpwardIcon");
    expect(source).toContain("FormatListNumberedIcon");
    expect(source).toContain("handleClusterSummarySortToggle");
    expect(source).toContain("Sorting by delivery count (highest first)");
    expect(source).toContain("Sorting by delivery count (lowest first)");
    expect(source).toContain("Sorting by cluster number");
    expect(source).toMatch(/<Typography[^>]*>[\s\S]*Sort[\s\S]*<\/Typography>/);
  });
});
