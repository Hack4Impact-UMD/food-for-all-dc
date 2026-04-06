import { describe, expect, it } from "@jest/globals";
import {
  assignDriverToRoutes,
  assignTimeToRoutes,
  findRouteSlotConflict,
  moveClientToCluster,
  moveClientsToCluster,
  updateClientRouteAssignment,
  type RouteAssignmentState,
} from "./routeAssignmentState";

const createState = (): RouteAssignmentState => ({
  clusters: [
    { id: "1", driver: "Alice", time: "09:00", deliveries: ["c1", "c2"] },
    { id: "2", driver: "Bob", time: "10:00", deliveries: ["c3"] },
  ],
  clientOverrides: [
    { clientId: "c1", driver: "Alice", time: "09:00" },
    { clientId: "c3", driver: "Bob", time: "10:00" },
  ],
});

describe("routeAssignmentState helpers", () => {
  // App coverage:
  // - route assignment validation in Delivery page actions before persisting cluster updates
  // - conflict UX in map/spreadsheet when two routes share identical driver+time slots
  // Behavior contract: conflict detection is case-insensitive for driver names and returns the
  // existing route/incoming route IDs for touched routes that collide.
  it("detects conflicting route slots for touched routes", () => {
    const state: RouteAssignmentState = {
      clusters: [
        { id: "1", driver: "Alice", time: "09:00", deliveries: ["c1"] },
        { id: "2", driver: "alice", time: "09:00", deliveries: ["c2"] },
      ],
      clientOverrides: [],
    };

    const conflict = findRouteSlotConflict(state, ["2"]);

    expect(conflict).toEqual({
      driver: "alice",
      time: "09:00",
      existingRouteId: "1",
      incomingRouteId: "2",
    });
  });

  // App coverage:
  // - bulk "Assign Driver" action in Delivery spreadsheet/map controls
  // - ensures route-level assignment updates clear stale per-client driver overrides for affected routes
  // Behavior contract: assigning a driver updates target routes and removes only affected driver overrides.
  it("assigns drivers to selected routes and clears affected client driver overrides", () => {
    const state = createState();

    const result = assignDriverToRoutes(state, ["1"], "  Carla  ");

    expect(result.clusters.find((cluster) => cluster.id === "1")?.driver).toBe("Carla");
    expect(result.clusters.find((cluster) => cluster.id === "2")?.driver).toBe("Bob");
    expect(result.clientOverrides).toEqual([
      { clientId: "c1", time: "09:00" },
      { clientId: "c3", driver: "Bob", time: "10:00" },
    ]);
    expect(result.touchedRouteIds).toEqual(["1"]);
  });

  // App coverage:
  // - bulk "Assign Time" action in Delivery spreadsheet/map controls
  // - ensures route-level time changes clear stale per-client time overrides for affected clients only
  // Behavior contract: assigning a time updates target routes and strips affected time overrides.
  it("assigns times to selected routes and clears affected client time overrides", () => {
    const state = createState();

    const result = assignTimeToRoutes(state, ["2"], " 11:30 ");

    expect(result.clusters.find((cluster) => cluster.id === "2")?.time).toBe("11:30");
    expect(result.clusters.find((cluster) => cluster.id === "1")?.time).toBe("09:00");
    expect(result.clientOverrides).toEqual([
      { clientId: "c1", driver: "Alice", time: "09:00" },
      { clientId: "c3", driver: "Bob" },
    ]);
    expect(result.touchedRouteIds).toEqual(["2"]);
  });

  // App coverage:
  // - marker/table client reassignment between routes in Delivery map+spreadsheet
  // - keeps cluster memberships in sync and prevents stale overrides after a client moves routes
  // Behavior contract: moving a client removes it from old route, adds to new route, and drops that client's override.
  it("moves a client between clusters and removes that client override", () => {
    const state: RouteAssignmentState = {
      clusters: [
        { id: "1", driver: "Alice", time: "09:00", deliveries: ["c1", "c2"] },
        { id: "2", driver: "Bob", time: "10:00", deliveries: ["c3"] },
      ],
      clientOverrides: [
        { clientId: "c2", driver: "Alice", time: "09:00" },
        { clientId: "c3", driver: "Bob", time: "10:00" },
      ],
    };

    const result = moveClientToCluster(state, "c2", "1", "2");

    expect(result.clusters.find((cluster) => cluster.id === "1")?.deliveries).toEqual(["c1"]);
    expect(result.clusters.find((cluster) => cluster.id === "2")?.deliveries).toEqual(["c3", "c2"]);
    expect(result.clientOverrides).toEqual([{ clientId: "c3", driver: "Bob", time: "10:00" }]);
    expect(result.touchedRouteIds).toEqual(["1", "2"]);
  });

  // App coverage:
  // - bulk checkbox selection on the Routes spreadsheet followed by changing the cluster dropdown
  // - ensures all checked deliveries move together instead of only the clicked row moving
  // Behavior contract: bulk cluster reassignment moves every selected client, removes their overrides,
  // and reports both the old and new touched route IDs.
  it("moves multiple selected clients to a new cluster in one mutation", () => {
    const state: RouteAssignmentState = {
      clusters: [
        { id: "1", driver: "Alice", time: "09:00", deliveries: ["c1", "c2"] },
        { id: "2", driver: "Bob", time: "10:00", deliveries: ["c3"] },
      ],
      clientOverrides: [
        { clientId: "c1", driver: "Alice", time: "09:00" },
        { clientId: "c2", driver: "Alice", time: "09:00" },
        { clientId: "c3", driver: "Bob", time: "10:00" },
      ],
    };

    const result = moveClientsToCluster(
      state,
      [
        { clientId: "c1", oldClusterId: "1" },
        { clientId: "c2", oldClusterId: "1" },
      ],
      "3"
    );

    expect(result.clusters.find((cluster) => cluster.id === "1")?.deliveries).toEqual([]);
    expect(result.clusters.find((cluster) => cluster.id === "3")?.deliveries).toEqual([
      "c1",
      "c2",
    ]);
    expect(result.clientOverrides).toEqual([{ clientId: "c3", driver: "Bob", time: "10:00" }]);
    expect(result.touchedRouteIds).toEqual(["1", "3"]);
  });

  // App coverage:
  // - per-client route assignment updates when editing cluster/driver/time from popup or table controls
  // - clears route-wide override fields (driver/time) when route-level values are explicitly updated
  // Behavior contract: updating route-level driver/time for a target cluster preserves cluster membership and
  // removes corresponding override fields for all clients in target route.
  it("updates route-level driver/time and clears matching overrides for clients in target route", () => {
    const state: RouteAssignmentState = {
      clusters: [
        { id: "1", driver: "Alice", time: "09:00", deliveries: ["c1", "c2"] },
        { id: "2", driver: "Bob", time: "10:00", deliveries: ["c3"] },
      ],
      clientOverrides: [
        { clientId: "c1", driver: "Alice", time: "09:00" },
        { clientId: "c2", driver: "Alice", time: "09:00" },
      ],
    };

    const result = updateClientRouteAssignment(state, {
      clientId: "c1",
      oldClusterId: "1",
      newClusterId: "1",
      driverUpdateRequested: true,
      timeUpdateRequested: true,
      driverValue: "Dana",
      timeValue: "12:00",
    });

    expect(result.clusters.find((cluster) => cluster.id === "1")).toMatchObject({
      driver: "Dana",
      time: "12:00",
      deliveries: ["c1", "c2"],
    });
    expect(result.clientOverrides).toEqual([]);
    expect(result.touchedRouteIds).toEqual(["1"]);
  });
});
