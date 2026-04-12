/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import React from "react";
import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import ClusterMap from "./ClusterMap";

jest.mock("leaflet/dist/leaflet.css", () => ({}), { virtual: true });
jest.mock("leaflet.awesome-markers/dist/leaflet.awesome-markers.css", () => ({}), {
  virtual: true,
});
jest.mock("../../assets/tsp-food-for-all-dc-logo.png", () => "mock-ffa-icon", { virtual: true });

jest.mock("leaflet", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("leaflet.awesome-markers", () => ({}));

jest.mock("../../services/driver-service", () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      getAllDrivers: async () => [],
    }),
  },
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  writable: true,
});

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
    expect(source).toContain("handleClusterReorder");
    expect(source).toContain("usedClusterCount");
    expect(source).toContain("hasUnassignedClusterSlots");
    expect(source).toContain(
      "assignmentSummary.done && hasUnassignedClusterSlots && canRenumberClusters"
    );
    expect(source).toContain("Renumber");
    expect(source).toContain("Sorting by delivery count (highest first)");
    expect(source).toContain("Sorting by delivery count (lowest first)");
    expect(source).toContain("Sorting by cluster number");
    expect(source).toContain("Renumber clusters to 1-");
    expect(source).toMatch(/<Typography[^>]*>[\s\S]*Sort[\s\S]*<\/Typography>/);
  });

  it("renders the cluster summary overlay without invalid element errors", async () => {
    localStorage.setItem("clusterSummaryEnabled", "true");

    render(
      React.createElement(ClusterMap, {
        allRows: [
          {
            id: "c1",
            firstName: "A",
            lastName: "One",
            address: "1 Main St",
            coordinates: [38.9, -77.03],
          },
        ],
        visibleRows: [
          {
            id: "c1",
            firstName: "A",
            lastName: "One",
            address: "1 Main St",
            coordinates: [38.9, -77.03],
          },
        ],
        clusters: [{ id: "3", deliveries: ["c1", "c2"], driver: "Dana", time: "09:00" }],
        clientOverrides: [],
        onClusterUpdate: async () => true,
        onRenumberClusters: async () => true,
      })
    );

    expect(await screen.findByText("Cluster Deliveries")).toBeTruthy();
    expect(screen.getByText("Day total: 1")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("shows filtered route counts in the overlay and surfaces stale assignment notice when needed", async () => {
    localStorage.setItem("clusterSummaryEnabled", "true");

    render(
      React.createElement(ClusterMap, {
        allRows: [
          {
            id: "c1",
            firstName: "A",
            lastName: "One",
            address: "1 Main St",
            coordinates: [38.9, -77.03],
          },
        ],
        visibleRows: [
          {
            id: "c1",
            firstName: "A",
            lastName: "One",
            address: "1 Main St",
            coordinates: [38.9, -77.03],
          },
        ],
        clusters: [{ id: "3", deliveries: ["c1", "c2"], driver: "Dana", time: "09:00" }],
        clientOverrides: [],
        onClusterUpdate: async () => true,
        onRenumberClusters: async () => true,
      })
    );

    expect(await screen.findByText("Cluster Deliveries")).toBeTruthy();
    expect(screen.getByText("Day total: 1")).toBeTruthy();
    expect(screen.getByText("of 2 assigned")).toBeTruthy();
    expect(
      screen.getByText(
        "Some saved route assignments are out of date. Counts below reflect today's filtered deliveries."
      )
    ).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("does not show the stale assignment notice when saved routes match the loaded day rows", async () => {
    localStorage.setItem("clusterSummaryEnabled", "true");

    render(
      React.createElement(ClusterMap, {
        allRows: [
          {
            id: "c1",
            firstName: "A",
            lastName: "One",
            address: "1 Main St",
            coordinates: [38.9, -77.03],
          },
        ],
        visibleRows: [
          {
            id: "c1",
            firstName: "A",
            lastName: "One",
            address: "1 Main St",
            coordinates: [38.9, -77.03],
          },
        ],
        clusters: [{ id: "3", deliveries: ["c1"], driver: "Dana", time: "09:00" }],
        clientOverrides: [],
        onClusterUpdate: async () => true,
        onRenumberClusters: async () => true,
      })
    );

    expect(await screen.findByText("Cluster Deliveries")).toBeTruthy();
    expect(screen.queryByText(/Some saved route assignments are out of date\./i)).toBeNull();
  });

  it("keeps the existing invalid coordinate badge visible", async () => {
    localStorage.setItem("clusterSummaryEnabled", "true");

    render(
      React.createElement(ClusterMap, {
        allRows: [
          {
            id: "c1",
            firstName: "A",
            lastName: "One",
            address: "1 Main St",
            coordinates: [0, 0],
          },
        ],
        visibleRows: [
          {
            id: "c1",
            firstName: "A",
            lastName: "One",
            address: "1 Main St",
            coordinates: [0, 0],
          },
        ],
        clusters: [{ id: "3", deliveries: ["c1"], driver: "Dana", time: "09:00" }],
        clientOverrides: [],
        onClusterUpdate: async () => true,
        onRenumberClusters: async () => true,
      })
    );

    expect(await screen.findByText("1 invalid coordinates")).toBeTruthy();
  });
});
