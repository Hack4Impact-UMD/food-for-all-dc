/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import React from "react";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("keeps static route totals in the overlay even when the table is filtered down", async () => {
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
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText("of 2 assigned")).toBeNull();
    expect(
      screen.getByText(
        "Some saved route assignments are out of date. Counts below reflect today's filtered deliveries."
      )
    ).toBeTruthy();
  });

  it("keeps routes visible in the overlay even when the current filter hides all of their rows", async () => {
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
        visibleRows: [],
        clusters: [{ id: "3", deliveries: ["c1"], driver: "Dana", time: "09:00" }],
        clientOverrides: [],
        onClusterUpdate: async () => true,
        onRenumberClusters: async () => true,
      })
    );

    expect(await screen.findByText("Cluster Deliveries")).toBeTruthy();
    expect(screen.getByText("No deliveries match current filter")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Dana")).toBeTruthy();
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

  it("shows all invalid deliveries for the day in a read-only popover", async () => {
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
            clusterId: "3",
          },
          {
            id: "c2",
            firstName: "B",
            lastName: "Two",
            address: "2 Main St",
            coordinates: [],
            clusterId: "4",
          },
          {
            id: "c3",
            firstName: "C",
            lastName: "Three",
            address: "3 Main St",
            coordinates: [0, 0],
          },
          {
            id: "c4",
            firstName: "D",
            lastName: "Four",
            address: "4 Main St",
            coordinates: [38.9, -77.03],
            clusterId: "5",
          },
        ],
        visibleRows: [
          {
            id: "c1",
            firstName: "A",
            lastName: "One",
            address: "1 Main St",
            coordinates: [0, 0],
            clusterId: "3",
          },
          {
            id: "c4",
            firstName: "D",
            lastName: "Four",
            address: "4 Main St",
            coordinates: [38.9, -77.03],
            clusterId: "5",
          },
        ],
        clusters: [
          { id: "3", deliveries: ["c1"], driver: "Dana", time: "09:00" },
          { id: "4", deliveries: ["c2"], driver: "Eli", time: "10:00" },
          { id: "5", deliveries: ["c4"], driver: "Fran", time: "11:00" },
        ],
        clientOverrides: [],
        onClusterUpdate: async () => true,
        onRenumberClusters: async () => true,
      })
    );

    const invalidBadge = await screen.findByRole("button", {
      name: "Show deliveries with invalid coordinates",
    });

    expect(invalidBadge.textContent).toContain("3 invalid coordinates");

    fireEvent.click(invalidBadge);

    expect(await screen.findByText("Missing map locations")).toBeTruthy();
    expect(screen.getByText("These deliveries can't be shown on the map today.")).toBeTruthy();
    expect(screen.getByText("A One • Route 3")).toBeTruthy();
    expect(screen.getByText("B Two • Route 4")).toBeTruthy();
    expect(screen.getByText("C Three • Unassigned")).toBeTruthy();

    const invalidItems = screen.getAllByRole("listitem");
    expect(invalidItems.map((item) => item.textContent)).toEqual([
      "A One • Route 3",
      "B Two • Route 4",
      "C Three • Unassigned",
    ]);

    fireEvent.click(invalidBadge);

    await waitFor(() => {
      expect(screen.queryByText("Missing map locations")).toBeNull();
    });
    expect(screen.getByText("Cluster Deliveries")).toBeTruthy();
  });
});
