import { describe, expect, it } from "@jest/globals";
import { RowData } from "../../../../pages/Delivery/types/deliveryTypes";
import {
  filterRowsForRouteReport,
  prepareRouteReportData,
} from "../../../../pages/Delivery/utils/routeReportData";

const makeRow = (id: string, firstName = id): RowData =>
  ({
    id,
    clientid: id,
    firstName,
    lastName: "Client",
    address: `${id} Example Street`,
    phone: "",
    deliveryDetails: {
      deliveryInstructions: "",
      dietaryRestrictions: {},
    },
  }) as RowData;

describe("prepareRouteReportData", () => {
  it("preserves cluster delivery order and splits effective assignment overrides", () => {
    const rows = [makeRow("client-1"), makeRow("client-2"), makeRow("client-3")];

    const result = prepareRouteReportData(
      "2026-08-22",
      rows,
      [
        {
          id: "4",
          driver: "Jane Smith",
          time: "09:00",
          deliveries: ["client-3", "client-1", "client-2"],
        },
      ],
      [{ clientId: "client-2", driver: "Sam Driver", time: "10:00" }]
    );

    expect(result.reports).toHaveLength(2);
    expect(result.reports[0]).toMatchObject({
      routeId: "4",
      driverName: "Jane Smith",
      assignedTime: "09:00",
    });
    expect(result.reports[0].deliveries.map(({ id }) => id)).toEqual(["client-3", "client-1"]);
    expect(result.reports[1].deliveries).toEqual([expect.objectContaining({ id: "client-2" })]);
    expect(result.issues).toEqual([]);
  });

  it("reports missing assignments and never duplicates a delivery", () => {
    const rows = [makeRow("assigned"), makeRow("no-driver"), makeRow("no-route")];

    const result = prepareRouteReportData("2026-08-22", rows, [
      {
        id: 1,
        driver: "Driver One",
        time: "",
        deliveries: ["assigned"],
      },
      {
        id: 2,
        driver: "Driver Two",
        time: "11:00",
        deliveries: ["assigned"],
      },
      {
        id: 3,
        driver: "",
        time: "12:00",
        deliveries: ["no-driver"],
      },
    ]);

    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]).toMatchObject({ routeId: "1", assignedTime: "" });
    expect(result.reports[0].deliveries).toHaveLength(1);
    expect(result.issues.map(({ delivery, reason }) => [delivery.id, reason])).toEqual([
      ["no-driver", "missing-driver"],
      ["no-route", "missing-route"],
    ]);
  });

  it("keeps apartments at the same street together without changing their relative order", () => {
    const firstApartment = { ...makeRow("first-apartment"), address: "116 T Street NE", address2: "#446" };
    const otherStreet = { ...makeRow("other-street"), address: "203 N Street NW", address2: "#420" };
    const secondApartment = { ...makeRow("second-apartment"), address: "116 T St NE", address2: "#239" };

    const result = prepareRouteReportData(
      "2026-08-22",
      [firstApartment, otherStreet, secondApartment],
      [
        {
          id: "1",
          driver: "Driver One",
          time: "09:00",
          deliveries: ["first-apartment", "other-street", "second-apartment"],
        },
      ]
    );

    expect(result.reports[0].deliveries.map(({ id }) => id)).toEqual([
      "first-apartment",
      "second-apartment",
      "other-street",
    ]);
  });
});

describe("filterRowsForRouteReport", () => {
  it("includes every row in driver routes and limits DoorDash routes using overrides", () => {
    const rows = [
      makeRow("driver"),
      makeRow("doordash"),
      makeRow("override-to-doordash"),
      makeRow("override-from-doordash"),
      makeRow("unassigned"),
    ];
    const clusters = [
      {
        id: "1",
        driver: "Driver One",
        deliveries: ["driver", "override-to-doordash"],
      },
      {
        id: "2",
        driver: "DoorDash",
        deliveries: ["doordash", "override-from-doordash"],
      },
    ];
    const overrides = [
      { clientId: "override-to-doordash", driver: "DoorDash" },
      { clientId: "override-from-doordash", driver: "Driver Two" },
    ];

    expect(
      filterRowsForRouteReport(rows, clusters, overrides, "Routes").map(({ id }) => id)
    ).toEqual([
      "driver",
      "doordash",
      "override-to-doordash",
      "override-from-doordash",
      "unassigned",
    ]);
    expect(
      filterRowsForRouteReport(rows, clusters, overrides, "DoorDash").map(({ id }) => id)
    ).toEqual(["doordash", "override-to-doordash"]);
  });

  it("uses the first membership when a delivery appears in conflicting routes", () => {
    const rows = [makeRow("duplicate")];
    const clusters = [
      { id: "1", driver: "Driver One", deliveries: ["duplicate"] },
      { id: "2", driver: "DoorDash", deliveries: ["duplicate"] },
    ];

    expect(filterRowsForRouteReport(rows, clusters, [], "Routes")).toEqual(rows);
    expect(filterRowsForRouteReport(rows, clusters, [], "DoorDash")).toEqual([]);
    expect(prepareRouteReportData("2026-08-22", rows, clusters).reports[0]).toMatchObject({
      routeId: "1",
      driverName: "Driver One",
    });
  });
});