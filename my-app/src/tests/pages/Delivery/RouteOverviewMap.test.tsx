import { describe, expect, it } from "@jest/globals";
import {
  buildDcInsetMapLayout,
  buildStaticMapLayout,
  getRouteMarkerColors,
} from "../../../pages/Delivery/components/RouteOverviewMap";

describe("RouteOverviewMap marker contrast", () => {
  it("uses dark text on light route colors", () => {
    expect(getRouteMarkerColors("2")).toEqual({
      backgroundColor: "#00FF00",
      textColor: "#000000",
    });
  });

  it("uses white text on dark route colors", () => {
    expect(getRouteMarkerColors("3")).toEqual({
      backgroundColor: "#0000FF",
      textColor: "#ffffff",
    });
  });
});

describe("RouteOverviewMap tile coverage", () => {
  it("overscans the viewport so print width changes cannot expose a blank edge", () => {
    const layoutWidth = 620;
    const widerPrintWidth = 750;
    const { tiles } = buildStaticMapLayout([], layoutWidth);
    const leftEdge = Math.min(...tiles.map(({ x }) => x));
    const rightEdge = Math.max(...tiles.map(({ x }) => x + 256));

    expect(leftEdge).toBeLessThanOrEqual(0);
    expect(rightEdge).toBeGreaterThanOrEqual(widerPrintWidth);
  });

  it("places route deliveries on a fixed DC overview inset", () => {
    const deliveries = [
      {
        id: "northwest-client",
        clientid: "northwest-client",
        coordinates: [38.995, -77.12],
      },
      {
        id: "southeast-client",
        clientid: "southeast-client",
        coordinates: [38.79, -76.91],
      },
    ] as any;
    const layout = buildDcInsetMapLayout(deliveries);

    expect(layout.tiles.length).toBeGreaterThan(0);
    expect(layout.markers).toHaveLength(2);
    layout.markers.forEach((marker) => {
      expect(marker.x).toBeGreaterThan(0);
      expect(marker.x).toBeLessThan(132);
      expect(marker.y).toBeGreaterThan(0);
      expect(marker.y).toBeLessThan(132);
    });
  });
});