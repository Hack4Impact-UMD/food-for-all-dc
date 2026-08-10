/** @jest-environment jsdom */
import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import ClusterMap from "../../../pages/Delivery/ClusterMap";

jest.mock("leaflet/dist/leaflet.css", () => ({}), { virtual: true });
jest.mock("leaflet.awesome-markers/dist/leaflet.awesome-markers.css", () => ({}), {
  virtual: true,
});
jest.mock("../../../assets/tsp-food-for-all-dc-logo.png", () => "mock-ffa-icon", {
  virtual: true,
});
jest.mock("leaflet.awesome-markers", () => ({}));
jest.mock("../../../services/driver-service", () => ({
  __esModule: true,
  default: {
    getInstance: () => ({ getAllDrivers: async () => [] }),
  },
}));

jest.mock("leaflet", () => {
  class FakePopup {
    private readonly element: HTMLElement;

    constructor(content: HTMLElement) {
      this.element = globalThis.document.createElement("div");
      this.element.appendChild(content);
      this.element.getBoundingClientRect = () => mockState.popupRect as DOMRect;
    }

    getElement() {
      return this.element;
    }
  }

  class FakeMap {
    handlers = new Map<string, Array<(event: { popup: FakePopup }) => void>>();
    lastPopupMarker: FakeMarker | null = null;
    panOffsets: Array<[number, number]> = [];
    container: HTMLElement;

    constructor(container: HTMLElement) {
      this.container = container;
      this.container.getBoundingClientRect = () => mockState.mapRect as DOMRect;
    }

    setView() {
      return this;
    }
    stop() {
      return this;
    }
    panBy(offset: [number, number]) {
      this.panOffsets.push(offset);
      return this;
    }
    fitBounds() {
      return this;
    }
    invalidateSize() {
      return this;
    }
    remove() {
      return this;
    }
    getContainer() {
      return this.container;
    }
    on(type: string, handler: (event: { popup: FakePopup }) => void) {
      this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
      return this;
    }
    off(type: string, handler: (event: { popup: FakePopup }) => void) {
      this.handlers.set(
        type,
        (this.handlers.get(type) ?? []).filter((item) => item !== handler)
      );
      return this;
    }
    fire(type: string, event: { popup: FakePopup }) {
      (this.handlers.get(type) ?? []).forEach((handler) => handler(event));
    }
    closePopup() {
      this.lastPopupMarker?.closePopup();
      return this;
    }
  }

  class FakeFeatureGroup {
    layers: FakeMarker[] = [];
    map: FakeMap | null = null;

    addTo(map: FakeMap) {
      this.map = map;
      return this;
    }
    clearLayers() {
      [...this.layers].forEach((layer) => layer.remove());
      this.layers = [];
      return this;
    }
    remove() {
      return this;
    }
    hasLayer(marker: FakeMarker) {
      return this.layers.includes(marker);
    }
    getLayers() {
      return this.layers;
    }
    getBounds() {
      return {};
    }
  }

  class FakeMarker {
    handlers = new Map<string, Array<(event: { popup: FakePopup }) => void>>();
    onceHandlers = new Map<string, Array<(event: { popup: FakePopup }) => void>>();
    popup: FakePopup | null = null;
    group: FakeFeatureGroup | null = null;
    map: FakeMap | null = null;
    open = false;

    bindPopup(content: HTMLElement) {
      this.popup = new FakePopup(content);
      return this;
    }
    on(type: string, handler: (event: { popup: FakePopup }) => void) {
      this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
      return this;
    }
    once(type: string, handler: (event: { popup: FakePopup }) => void) {
      this.onceHandlers.set(type, [...(this.onceHandlers.get(type) ?? []), handler]);
      return this;
    }
    fire(type: string, event: { popup: FakePopup }) {
      (this.handlers.get(type) ?? []).forEach((handler) => handler(event));
      const onceHandlers = this.onceHandlers.get(type) ?? [];
      this.onceHandlers.delete(type);
      onceHandlers.forEach((handler) => handler(event));
    }
    addTo(group: FakeFeatureGroup) {
      this.group = group;
      this.map = group.map;
      group.layers.push(this);
      return this;
    }
    remove() {
      this.closePopup();
      return this;
    }
    openPopup() {
      if (this.open || !this.popup) return this;
      this.open = true;
      this.map!.lastPopupMarker = this;
      globalThis.document.body.appendChild(this.popup.getElement());
      const event = { popup: this.popup };
      this.map!.fire("popupopen", event);
      this.fire("popupopen", event);
      return this;
    }
    closePopup() {
      if (!this.open || !this.popup) return this;
      this.open = false;
      this.popup.getElement().remove();
      const event = { popup: this.popup };
      this.map!.fire("popupclose", event);
      this.fire("popupclose", event);
      return this;
    }
    isPopupOpen() {
      return this.open;
    }
    getClientId() {
      return this.popup
        ?.getElement()
        .querySelector("[data-client-id]")
        ?.getAttribute("data-client-id");
    }
  }

  const mockState = {
    markers: [] as FakeMarker[],
    maps: [] as FakeMap[],
    popupRect: {} as DOMRect,
    mapRect: {} as DOMRect,
  };
  const leaflet = {
    __mockState: mockState,
    map: (container: HTMLElement) => {
      const map = new FakeMap(container);
      mockState.maps.push(map);
      return map;
    },
    featureGroup: () => new FakeFeatureGroup(),
    tileLayer: () => ({ addTo: () => undefined }),
    marker: () => {
      const marker = new FakeMarker();
      mockState.markers.push(marker);
      return marker;
    },
    divIcon: (options: unknown) => options,
    polygon: () => ({ addTo: () => undefined }),
  };

  return { __esModule: true, default: leaflet };
});

const row = {
  id: "delivery-a",
  firstName: "Alex",
  lastName: "Adams",
  address: "1 Main St",
  coordinates: [38.9, -77.03] as [number, number],
};

const rect = (left: number, top: number, right: number, bottom: number) => ({
  x: left,
  y: top,
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
  toJSON: () => ({}),
});

const getLeafletMockState = () =>
  (
    jest.requireMock("leaflet") as {
      default: {
        __mockState: {
          markers: Array<{
            getClientId(): string | undefined;
            closePopup(): void;
            isPopupOpen(): boolean;
          }>;
          maps: Array<{ panOffsets: Array<[number, number]> }>;
          popupRect: ReturnType<typeof rect>;
          mapRect: ReturnType<typeof rect>;
        };
      };
    }
  ).default.__mockState;

beforeEach(() => {
  const mockState = getLeafletMockState();
  mockState.markers.length = 0;
  mockState.maps.length = 0;
  mockState.popupRect = rect(0, 0, 0, 0);
  mockState.mapRect = rect(0, 0, 0, 0);
});

const latestDeliveryMarker = () => {
  const deliveryMarkers = getLeafletMockState().markers.filter(
    (marker) => marker.getClientId() === row.id
  );
  return deliveryMarkers[deliveryMarkers.length - 1]!;
};

const props = (visiblePopupDeliveryIds: Set<string>, onClearHighlight = jest.fn()) => ({
  allRows: [row],
  visibleRows: [row],
  clusters: [{ id: "1", deliveries: [row.id] }],
  clientOverrides: [],
  onClusterUpdate: async () => true,
  onMarkerClick: jest.fn(),
  onClearHighlight,
  visiblePopupDeliveryIds,
});

describe("ClusterMap controlled popup behavior", () => {
  it("does not treat a programmatic close as a user deselection", async () => {
    const onClearHighlight = jest.fn();
    const { rerender } = render(<ClusterMap {...props(new Set([row.id]), onClearHighlight)} />);

    await waitFor(() => expect(latestDeliveryMarker().isPopupOpen()).toBe(true));
    rerender(<ClusterMap {...props(new Set(), onClearHighlight)} />);

    await waitFor(() => expect(latestDeliveryMarker().isPopupOpen()).toBe(false));
    expect(onClearHighlight).not.toHaveBeenCalled();
  });

  it("honors an immediate user close after a programmatic open", async () => {
    const onClearHighlight = jest.fn();
    render(<ClusterMap {...props(new Set([row.id]), onClearHighlight)} />);

    await waitFor(() => expect(latestDeliveryMarker().isPopupOpen()).toBe(true));
    act(() => latestDeliveryMarker().closePopup());

    expect(onClearHighlight).toHaveBeenCalledWith(row.id);
  });

  it("preserves requested popups while markers are rebuilt", async () => {
    const onClearHighlight = jest.fn();
    const initialProps = props(new Set([row.id]), onClearHighlight);
    const { rerender } = render(<ClusterMap {...initialProps} />);

    await waitFor(() => expect(latestDeliveryMarker().isPopupOpen()).toBe(true));
    rerender(<ClusterMap {...initialProps} clusters={[{ id: "2", deliveries: [row.id] }]} />);

    await waitFor(() => expect(latestDeliveryMarker().isPopupOpen()).toBe(true));
    expect(onClearHighlight).not.toHaveBeenCalled();
  });

  it("pans an open popup clear of the selected-deliveries controls", async () => {
    const mockState = getLeafletMockState();
    mockState.mapRect = rect(0, 0, 1000, 400);
    mockState.popupRect = rect(400, 50, 650, 200);

    const selectedDeliveriesControl = globalThis.document.createElement("div");
    selectedDeliveriesControl.setAttribute("aria-label", "Selected deliveries");
    selectedDeliveriesControl.getBoundingClientRect = () =>
      rect(600, 0, 800, 400) as DOMRect;
    globalThis.document.body.appendChild(selectedDeliveriesControl);

    render(<ClusterMap {...props(new Set([row.id]))} />);

    await waitFor(() => {
      const latestMap = mockState.maps[mockState.maps.length - 1];
      expect(latestMap.panOffsets).toContainEqual([66, 0]);
    });

    selectedDeliveriesControl.remove();
  });
});
