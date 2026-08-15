import { describe, expect, it, jest } from "@jest/globals";
import { buildAllClientsExportRows } from "../../../components/Spreadsheet/export";
import { normalizeCsvValue } from "../../../utils/csvExport";
import { mapClientDocToSpreadsheetBaseRow } from "../../../services/client-service";

jest.mock("../../../auth/firebaseConfig", () => ({ db: {} }));

describe("client spreadsheet exports", () => {
  // App coverage:
  // - Export All Clients receives Firestore client documents through the spreadsheet row mapper
  // - startDate is the required delivery-eligibility date shown as Start Date in client exports
  // Behavior contract: the canonical client startDate reaches the downloaded CSV under Start Date.
  it("includes the canonical client start date in Export All Clients", () => {
    const row = mapClientDocToSpreadsheetBaseRow("client-1", {
      firstName: "Ada",
      lastName: "Lovelace",
      startDate: "2026-07-04",
    });

    const [exportedRow] = buildAllClientsExportRows([row]);

    expect(exportedRow).toEqual(expect.objectContaining({ "Start Date": "2026-07-04" }));
  });

  it("preserves Lifestyle Challenges for spreadsheet custom columns", () => {
    const row = mapClientDocToSpreadsheetBaseRow("client-1", {
      lifeChallenges: "Limited transportation access",
    });

    expect(row.lifeChallenges).toBe("Limited transportation access");
  });

  it("formats serialized Firestore timestamps as readable ISO dates", () => {
    expect(
      normalizeCsvValue({
        type: "firestore/timestamp/1.0",
        seconds: 1784908800,
        nanoseconds: 0,
      })
    ).toBe("2026-07-24T16:00:00.000Z");
  });
});
