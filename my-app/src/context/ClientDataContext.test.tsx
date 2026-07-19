import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";
import { ClientDataProvider, useClientData } from "./ClientDataContext";
import type { RowData } from "../components/Spreadsheet/export";

type MockPageResult = {
  clients: RowData[];
  lastDoc: { id: string } | null;
};

const mockGetAllClientsForSpreadsheet = jest.fn<Promise<MockPageResult>, unknown[]>();

jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "staff-user" }, loading: false }),
}));

jest.mock("../services/client-service", () => ({
  clientService: {
    getAllClientsForSpreadsheet: (...args: unknown[]) =>
      mockGetAllClientsForSpreadsheet(...args),
  },
}));

const buildRow = (index: number): RowData =>
  ({
    id: `client-${index}`,
    uid: `client-${index}`,
    firstName: `First${index}`,
    lastName: `Last${index}`,
    address: `${index} Main St`,
    deliveryDetails: { deliveryInstructions: "", dietaryRestrictions: {} },
    ethnicity: "",
  }) as RowData;

const ContextConsumer = () => {
  const { clients, loadAllRemaining } = useClientData();
  const [exportCount, setExportCount] = React.useState<number | null>(null);

  return (
    <div>
      <span data-testid="loaded-count">{clients.length}</span>
      <span data-testid="export-count">{exportCount ?? ""}</span>
      <button
        type="button"
        onClick={() => {
          void loadAllRemaining().then((allClients) => setExportCount(allClients.length));
        }}
      >
        load-all
      </button>
    </div>
  );
};

describe("ClientDataContext pagination", () => {
  it("returns every row after loading all remaining pages", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => buildRow(index));
    const finalPage = [buildRow(500), buildRow(501)];
    mockGetAllClientsForSpreadsheet
      .mockResolvedValueOnce({ clients: firstPage, lastDoc: { id: "cursor-500" } })
      .mockResolvedValueOnce({ clients: finalPage, lastDoc: { id: "cursor-502" } });

    render(
      <ClientDataProvider>
        <ContextConsumer />
      </ClientDataProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loaded-count").textContent).toBe("500"));
    fireEvent.click(screen.getByRole("button", { name: "load-all" }));

    await waitFor(() => expect(screen.getByTestId("export-count").textContent).toBe("502"));
    expect(screen.getByTestId("loaded-count").textContent).toBe("502");
    expect(mockGetAllClientsForSpreadsheet).toHaveBeenCalledTimes(2);
  });
});
