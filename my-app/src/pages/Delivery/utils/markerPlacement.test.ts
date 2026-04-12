import { describe, expect, it } from "@jest/globals";
import { buildMarkerPlacementMap, normalizeMarkerPoint } from "./markerPlacement";

describe("markerPlacement helpers", () => {
  it("keeps single markers at their original coordinates", () => {
    const placements = buildMarkerPlacementMap([
      { id: "c1", coordinates: [38.9, -77.03] as [number, number] },
    ]);

    expect(placements.get("c1")).toEqual({ lat: 38.9, lng: -77.03 });
  });

  it("spreads clients with identical coordinates into distinct marker positions", () => {
    const placements = buildMarkerPlacementMap([
      { id: "c1", coordinates: [38.9, -77.03] as [number, number] },
      { id: "c2", coordinates: [38.9, -77.03] as [number, number] },
      { id: "c3", coordinates: [38.9, -77.03] as [number, number] },
    ]);

    const placedPoints = [placements.get("c1"), placements.get("c2"), placements.get("c3")];
    const uniquePoints = new Set(placedPoints.map((point) => JSON.stringify(point)));

    expect(uniquePoints.size).toBe(3);
    expect(placedPoints.every((point) => point !== undefined)).toBe(true);
  });

  it("skips non-renderable coordinates when building placements", () => {
    const placements = buildMarkerPlacementMap([
      { id: "c1", coordinates: [0, 0] as [number, number] },
      { id: "c2", coordinates: [] as [] },
      { id: "c3", coordinates: [38.9, -77.03] as [number, number] },
    ]);

    expect(placements.has("c1")).toBe(false);
    expect(placements.has("c2")).toBe(false);
    expect(placements.get("c3")).toEqual({ lat: 38.9, lng: -77.03 });
  });

  it("normalizes array and object coordinates into marker points", () => {
    expect(normalizeMarkerPoint([38.9, -77.03] as [number, number])).toEqual({
      lat: 38.9,
      lng: -77.03,
    });
    expect(normalizeMarkerPoint([38.9, -77.03, 15] as [number, number, number])).toEqual({
      lat: 38.9,
      lng: -77.03,
    });
    expect(normalizeMarkerPoint({ lat: 38.9, lng: -77.03 })).toEqual({
      lat: 38.9,
      lng: -77.03,
    });
  });
});
