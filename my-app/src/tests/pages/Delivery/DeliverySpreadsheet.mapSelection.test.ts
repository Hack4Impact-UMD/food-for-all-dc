import { describe, expect, it } from "@jest/globals";
import { getClusterColor } from "../../../pages/Delivery/utils/clusterColors";
import {
  EMPTY_MAP_DELIVERY_SELECTION,
  mapDeliverySelectionReducer,
  MapDeliverySelectionState,
} from "../../../pages/Delivery/utils/mapDeliverySelection";

const state = (
  selectedDeliveryIds: string[],
  visiblePopupDeliveryIds: string[]
): MapDeliverySelectionState => ({
  selectedDeliveryIds: new Set(selectedDeliveryIds),
  visiblePopupDeliveryIds: new Set(visiblePopupDeliveryIds),
});

describe("DeliverySpreadsheet map selection state", () => {
  it("keeps selection independent from popup visibility", () => {
    const selected = mapDeliverySelectionReducer(EMPTY_MAP_DELIVERY_SELECTION, {
      type: "toggle-table-delivery",
      deliveryId: "delivery-a",
      popupAvailable: true,
    });
    const hidden = mapDeliverySelectionReducer(selected, { type: "hide-all-popups" });

    expect(Array.from(hidden.selectedDeliveryIds)).toEqual(["delivery-a"]);
    expect(Array.from(hidden.visiblePopupDeliveryIds)).toEqual([]);
  });

  it("keeps mapless deliveries selected without claiming a popup is visible", () => {
    const selected = mapDeliverySelectionReducer(EMPTY_MAP_DELIVERY_SELECTION, {
      type: "toggle-table-delivery",
      deliveryId: "delivery-without-coordinates",
      popupAvailable: false,
    });

    expect(Array.from(selected.selectedDeliveryIds)).toEqual(["delivery-without-coordinates"]);
    expect(selected.visiblePopupDeliveryIds.size).toBe(0);
  });

  it("show all opens only selected deliveries with markers", () => {
    const result = mapDeliverySelectionReducer(state(["a", "b", "c"], []), {
      type: "show-all-popups",
      popupAvailableDeliveryIds: new Set(["a", "c", "not-selected"]),
    });

    expect(Array.from(result.selectedDeliveryIds)).toEqual(["a", "b", "c"]);
    expect(Array.from(result.visiblePopupDeliveryIds)).toEqual(["a", "c"]);
  });

  it("removes only the popup closed by the user", () => {
    const result = mapDeliverySelectionReducer(state(["a", "b"], ["a", "b"]), {
      type: "close-popup",
      deliveryId: "a",
    });

    expect(Array.from(result.selectedDeliveryIds)).toEqual(["b"]);
    expect(Array.from(result.visiblePopupDeliveryIds)).toEqual(["b"]);
  });

  it("cleans up filtered selections and mapless popup state together", () => {
    const result = mapDeliverySelectionReducer(state(["a", "b", "c"], ["a", "b", "c"]), {
      type: "retain-deliveries",
      deliveryIds: new Set(["a", "b"]),
      popupAvailableDeliveryIds: new Set(["a"]),
    });

    expect(Array.from(result.selectedDeliveryIds)).toEqual(["a", "b"]);
    expect(Array.from(result.visiblePopupDeliveryIds)).toEqual(["a"]);
  });

  it("uses the same route color mapping as the map", () => {
    expect(getClusterColor("12")).toBe("#4B0082");
    expect(getClusterColor("Route 12")).toBe("#4B0082");
    expect(getClusterColor("north")).toBe(getClusterColor("north"));
  });
});
