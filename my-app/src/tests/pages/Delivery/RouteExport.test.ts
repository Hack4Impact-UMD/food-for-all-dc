import { describe, expect, it } from "@jest/globals";
import { buildRouteCsvRow } from "../../../pages/Delivery/RouteExport";
import { RowData } from "../../../pages/Delivery/types/deliveryTypes";

describe("route spreadsheet export", () => {
  it("uses the requested driver-route columns", () => {
    const row = {
      id: "client-1",
      clientid: "client-1",
      firstName: "Jamie",
      lastName: "Example",
      address: "123 Example St",
      phone: "202-555-0100",
      tefapCertDate: "2026-07-01",
      startDate: "2020-01-01",
      deliveryDetails: {
        deliveryInstructions: "",
        dietaryRestrictions: {
          lowSugar: false,
          kidneyFriendly: false,
          vegan: false,
          vegetarian: false,
          halal: false,
          microwaveOnly: false,
          softFood: false,
          lowSodium: false,
          noCookingEquipment: false,
          heartFriendly: false,
          foodAllergens: [],
          otherText: "",
          other: false,
        },
      },
    } as RowData;

    const csvRow = buildRouteCsvRow(row, "10:00 AM");

    expect(Object.keys(csvRow)).toEqual([
      "firstName",
      "lastName",
      "address",
      "zip",
      "quadrant",
      "ward",
      "phone",
      "adults",
      "children",
      "seniors",
      "total",
      "deliveryInstructions",
      "dietaryRestrictions",
      "dietaryPreferences",
      "tefap",
      "startDate",
      "time",
    ]);
    expect(csvRow.tefap).toBe("2026-07-01");
    expect(csvRow.startDate).toBe("2020-01-01");
  });
});