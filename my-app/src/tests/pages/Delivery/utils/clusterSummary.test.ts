import { describe, expect, it } from "@jest/globals";
import { buildClusterSummariesFromClusters, sortClusterSummaries } from "../../../../pages/Delivery/utils/clusterSummary";

describe("clusterSummary helpers", () => {
  // App coverage:
  // - cluster summary overlay in `src/pages/Delivery/ClusterMap.tsx`
  // - ensures summary counts are driven by persisted cluster membership, not filtered marker rows
  // Behavior contract: per-cluster counts come from cluster.deliveries (deduped), independent of UI filters.
  it("builds counts from cluster deliveries and ignores duplicate client ids", () => {
    const summaries = buildClusterSummariesFromClusters(
      [
        { id: "1", deliveries: ["c1", "c2", "c2"], driver: "Alice", time: "09:00" },
        { id: "2", deliveries: ["c3"], driver: "Bob", time: "10:00" },
      ],
      new Map(),
      (time) => time
    );

    expect(summaries).toEqual([
      {
        clusterId: "1",
        count: 2,
        driverLabel: "Alice",
        timeLabel: "09:00",
      },
      {
        clusterId: "2",
        count: 1,
        driverLabel: "Bob",
        timeLabel: "10:00",
      },
    ]);
  });

  // App coverage:
  // - cluster deliveries overlay defaults to showing routes in cluster-number order
  // - dispatchers can cycle between cluster order, highest-first, and lowest-first delivery counts
  // Behavior contract: default cluster sorting is ascending by cluster id; count sorting orders by count in the requested direction, then cluster id ascending.
  it("sorts cluster summaries by cluster number by default and by delivery count in both directions", () => {
    const summaries = [
      { clusterId: "10", count: 2, driverLabel: "Alice", timeLabel: "09:00" },
      { clusterId: "2", count: 4, driverLabel: "Bob", timeLabel: "10:00" },
      { clusterId: "1", count: 4, driverLabel: "Dana", timeLabel: "11:00" },
    ];

    const defaultClusterOrder = sortClusterSummaries(summaries, "cluster");
    const descending = sortClusterSummaries(summaries, "count-desc");
    const ascending = sortClusterSummaries(summaries, "count-asc");

    expect(defaultClusterOrder.map((summary) => summary.clusterId)).toEqual(["1", "2", "10"]);
    expect(descending.map((summary) => summary.clusterId)).toEqual(["1", "2", "10"]);
    expect(ascending.map((summary) => summary.clusterId)).toEqual(["10", "1", "2"]);
  });

  // App coverage:
  // - route assignment edits where per-client overrides can diverge from cluster defaults
  // - summary labels should surface mixed assignments while keeping counts stable
  // Behavior contract: overrides affect driver/time labels, but not cluster member counts.
  it("applies overrides to labels and reports mixed assignments when needed", () => {
    const overrides = new Map([
      ["c1", { clientId: "c1", driver: "Dana" }],
      ["c2", { clientId: "c2", time: "11:30" }],
    ]);

    const summaries = buildClusterSummariesFromClusters(
      [{ id: "3", deliveries: ["c1", "c2"], driver: "Alice", time: "09:00" }],
      overrides,
      (time) => time
    );

    expect(summaries).toEqual([
      {
        clusterId: "3",
        count: 2,
        driverLabel: "Mixed drivers",
        timeLabel: "Mixed times",
      },
    ]);
  });
});
