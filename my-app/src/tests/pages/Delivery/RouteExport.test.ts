import { describe, expect, it } from "@jest/globals";
import {
  buildRouteCsvRow,
  formatDeliveryExportHeaders,
} from "../../../pages/Delivery/RouteExport";
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

    expect(Object.keys(formatDeliveryExportHeaders([csvRow])[0])).toEqual([
      "FIRST NAME",
      "LAST NAME",
      "ADDRESS",
      "ZIP",
      "QUADRANT",
      "WARD",
      "PHONE",
      "ADULTS",
      "CHILDREN",
      "SENIORS",
      "TOTAL",
      "DELIVERY INSTRUCTIONS",
      "DIETARY RESTRICTIONS",
      "DIETARY PREFERENCES",
      "TEFAP",
      "START DATE",
      "TIME",
    ]);
  });

  it("formats delivery export headers in uppercase with readable spacing", () => {
    const [formattedRow] = formatDeliveryExportHeaders([
      {
        firstName: "Jamie",
        deliveryInstructions: "Call first",
        startDate: "2026-08-27",
        "Client Unit ": "Apt 4",
        "Dropoff Instructions \n(250 character max)": "Knock",
      },
    ]);

    expect(Object.keys(formattedRow)).toEqual([
      "FIRST NAME",
      "DELIVERY INSTRUCTIONS",
      "START DATE",
      "CLIENT UNIT",
      "DROPOFF INSTRUCTIONS (250 CHARACTER MAX)",
    ]);
  });
});