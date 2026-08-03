import { describe, expect, it } from "@jest/globals";
import { renameTagInClientRows, updateClientRows } from "../../context/ClientDataContext";
import { RowData } from "../../components/Spreadsheet/export";

describe("ClientDataContext cache updates", () => {
  it("updates tags for one client without changing other rows", () => {
    const clients = [
      { uid: "client-1", tags: ["Existing"] },
      { uid: "client-2", tags: ["Other"] },
    ] as RowData[];

    const updatedClients = updateClientRows(clients, "client-1", {
      tags: ["Existing", "New Tag"],
    });

    expect(updatedClients[0].tags).toEqual(["Existing", "New Tag"]);
    expect(updatedClients[1]).toBe(clients[1]);
  });

  it("renames a tag across loaded clients without creating duplicates", () => {
    const clients = [
      { uid: "client-1", tags: ["Priority", "Existing"] },
      { uid: "client-2", tags: ["Priority", "Renamed"] },
      { uid: "client-3", tags: ["Other"] },
    ] as RowData[];

    const updatedClients = renameTagInClientRows(clients, "Priority", "Renamed");

    expect(updatedClients[0].tags).toEqual(["Renamed", "Existing"]);
    expect(updatedClients[1].tags).toEqual(["Renamed"]);
    expect(updatedClients[2]).toBe(clients[2]);
  });
});