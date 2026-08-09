import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

describe("DeliverySpreadsheet map selection state", () => {
  const sourcePath = path.resolve(__dirname, "../../../pages/Delivery/DeliverySpreadsheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  it("tracks selected deliveries separately from visible popups", () => {
    expect(source).toContain("const [selectedDeliveryIds, setSelectedDeliveryIds]");
    expect(source).toContain("const [visiblePopupDeliveryIds, setVisiblePopupDeliveryIds]");
    expect(source).toContain("const isHighlighted = selectedDeliveryIds.has(row.id)");
  });

  it("keeps bulk popup actions independent from selection", () => {
    expect(source).toMatch(
      /handleShowAllSelectedPopups[\s\S]*?setVisiblePopupDeliveryIds\(new Set\(selectedDeliveryIds\)\)/m
    );
    expect(source).toMatch(
      /handleHideAllSelectedPopups[\s\S]*?setVisiblePopupDeliveryIds\(new Set\(\)\)/m
    );
    expect(source).toMatch(
      /handleClearSelectedDeliveries[\s\S]*?setSelectedDeliveryIds\(new Set\(\)\);[\s\S]*?setVisiblePopupDeliveryIds\(new Set\(\)\)/m
    );
  });

  it("adds marker-clicked deliveries to both sets and removes popup-X deliveries from both", () => {
    expect(source).toMatch(
      /handleMarkerClick[\s\S]*?setSelectedDeliveryIds[\s\S]*?setVisiblePopupDeliveryIds/m
    );
    expect(source).toMatch(
      /clearRowHighlight[\s\S]*?next\.delete\(clientId\)[\s\S]*?setVisiblePopupDeliveryIds[\s\S]*?next\.delete\(clientId\)/m
    );
  });

  it("shows the newest selected delivery first", () => {
    expect(source).toMatch(
      /Array\.from\(selectedDeliveryIds\)\s*\.reverse\(\)\s*\.flatMap/m
    );
  });
});