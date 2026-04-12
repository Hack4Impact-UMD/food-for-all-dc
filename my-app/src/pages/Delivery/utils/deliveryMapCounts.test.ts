import { describe, expect, it } from "@jest/globals";
import { buildClusterCountSnapshot, isRenderableCoordinate } from "./deliveryMapCounts";

describe("deliveryMapCounts helpers", () => {
  it("rejects zero coordinates so unrenderable clients are counted as missing", () => {
    expect(isRenderableCoordinate([0, 0])).toBe(false);
    expect(isRenderableCoordinate({ lat: 0, lng: 0 })).toBe(false);
    expect(isRenderableCoordinate([38.9, -77.03])).toBe(true);
    expect(isRenderableCoordinate([38.9, -77.03, 15])).toBe(true);
  });

  it("matches overlay, spreadsheet, and markers when no rows are filtered and all coordinates render", () => {
    const rows = [
      { id: "c1", coordinates: [38.90, -77.03] as [number, number] },
      { id: "c2", coordinates: [38.91, -77.02] as [number, number] },
      { id: "c3", coordinates: [38.92, -77.01] as [number, number] },
    ];

    const snapshot = buildClusterCountSnapshot({
      clusterId: "3",
      allRows: rows,
      visibleRows: rows,
      clusters: [{ id: "3", deliveries: ["c1", "c2", "c3"] }],
    });

    expect(snapshot).toMatchObject({
      overlayCount: 3,
      spreadsheetCount: 3,
      markerCount: 3,
      missingCoordinateCount: 0,
      filteredOutCount: 0,
      highestCount: 3,
      highestCountSources: ["overlay", "spreadsheet", "markers"],
      reason: "match",
    });
  });

  it("still matches all three counts when the spreadsheet is filtered down to one full cluster", () => {
    const allRows = [
      { id: "c1", coordinates: [38.90, -77.03] as [number, number] },
      { id: "c2", coordinates: [38.91, -77.02] as [number, number] },
      { id: "c3", coordinates: [38.92, -77.01] as [number, number] },
      { id: "other", coordinates: [38.93, -77.00] as [number, number] },
    ];
    const visibleRows = allRows.filter((row) => row.id !== "other");

    const snapshot = buildClusterCountSnapshot({
      clusterId: "3",
      allRows,
      visibleRows,
      clusters: [
        { id: "3", deliveries: ["c1", "c2", "c3"] },
        { id: "4", deliveries: ["other"] },
      ],
    });

    expect(snapshot.overlayCount).toBe(3);
    expect(snapshot.spreadsheetCount).toBe(3);
    expect(snapshot.markerCount).toBe(3);
    expect(snapshot.reason).toBe("match");
  });

  it("biases toward overlay and spreadsheet counts when a visible client is missing coordinates", () => {
    const clusterRows = Array.from({ length: 14 }, (_, index) => ({
      id: `c${index + 1}`,
      coordinates:
        index === 13 ? ([0, 0] as [number, number]) : ([38.9 + index * 0.001, -77.03] as [number, number]),
    }));

    const snapshot = buildClusterCountSnapshot({
      clusterId: "3",
      allRows: clusterRows,
      visibleRows: clusterRows,
      clusters: [{ id: "3", deliveries: clusterRows.map((row) => row.id) }],
    });

    expect(snapshot.overlayCount).toBe(14);
    expect(snapshot.spreadsheetCount).toBe(14);
    expect(snapshot.markerCount).toBe(13);
    expect(snapshot.highestCountSources).toEqual(["overlay", "spreadsheet"]);
    expect(snapshot.reason).toBe("missing-coordinates");
    expect(snapshot.missingCoordinateCount).toBe(1);
    expect(snapshot.missingCoordinateClientIds).toEqual(["c14"]);
  });

  it("biases toward overlay counts and reports filtered-out clients when the spreadsheet filter hides one route member", () => {
    const allRows = Array.from({ length: 14 }, (_, index) => ({
      id: `c${index + 1}`,
      coordinates: [38.9 + index * 0.001, -77.03] as [number, number],
    }));
    const visibleRows = allRows.filter((row) => row.id !== "c14");

    const snapshot = buildClusterCountSnapshot({
      clusterId: "3",
      allRows,
      visibleRows,
      clusters: [{ id: "3", deliveries: allRows.map((row) => row.id) }],
    });

    expect(snapshot.overlayCount).toBe(14);
    expect(snapshot.spreadsheetCount).toBe(13);
    expect(snapshot.markerCount).toBe(13);
    expect(snapshot.highestCountSources).toEqual(["overlay"]);
    expect(snapshot.reason).toBe("filtered-out");
    expect(snapshot.filteredOutCount).toBe(1);
    expect(snapshot.filteredOutClientIds).toEqual(["c14"]);
  });
});
