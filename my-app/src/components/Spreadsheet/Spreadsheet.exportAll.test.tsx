import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";
import Spreadsheet from "./Spreadsheet";

type TestRow = ReturnType<typeof buildRow>;

const mockExportAllClients = jest.fn<string, [TestRow[]]>(() => "all.csv");
const mockLoadAllRemaining = jest.fn<Promise<TestRow[]>, []>();
const mockNoop = jest.fn();

const buildRow = (index: number) => ({
  id: `client-${index}`,
  uid: `client-${index}`,
  clientid: `client-${index}`,
  firstName: `First${index}`,
  lastName: `Last${index}`,
  address: `${index} Main St`,
  deliveryDetails: { deliveryInstructions: "", dietaryRestrictions: {} },
  deliverySummaryReady: true,
  ethnicity: "",
});

const mockInitialRows = Array.from({ length: 500 }, (_, index) => buildRow(index));
const mockAllRows = Array.from({ length: 502 }, (_, index) => buildRow(index));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    callback({ uid: "staff-user" });
    return () => undefined;
  },
}));

jest.mock("../../auth/firebaseConfig", () => ({ auth: {} }));
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNoop }));
jest.mock("../../context/ClientDataContext", () => ({
  useClientData: () => ({
    clients: mockInitialRows,
    loading: false,
    loadingMore: false,
    hasMore: true,
    error: null,
    refresh: mockNoop,
    loadMore: mockNoop,
    loadAllRemaining: mockLoadAllRemaining,
  }),
}));
jest.mock("./export", () => ({
  exportAllClients: (rows: TestRow[]) => mockExportAllClients(rows),
  exportQueryResults: () => "query.csv",
}));
jest.mock("../../services/client-service", () => ({
  clientService: {
    searchClientsByName: async () => [],
    getClientsByIds: async () => [],
    getClientDeliverySummaries: async () => new Map(),
    deleteClient: async () => undefined,
  },
}));
jest.mock("../../hooks/useCustomColumns", () => ({
  allowedPropertyKeys: [],
  useCustomColumns: () => ({
    customColumns: [],
    handleAddCustomColumn: mockNoop,
    handleCustomHeaderChange: mockNoop,
    handleRemoveCustomColumn: mockNoop,
  }),
}));
jest.mock("../../hooks/useSearchKeyAutocomplete", () => ({
  useSearchKeyAutocomplete: () => ({
    inputRef: { current: null },
    handleInputChange: mockNoop,
    handleInputFocus: mockNoop,
    handleInputClick: mockNoop,
    handleInputBlur: mockNoop,
    handleInputKeyDown: mockNoop,
    handleInputKeyUp: mockNoop,
  }),
}));
jest.mock("../NotificationProvider", () => ({
  useNotifications: () => ({
    showError: mockNoop,
    showSuccess: mockNoop,
    showWarning: mockNoop,
  }),
}));
jest.mock("../DietaryRestrictionsLegend", () => () => null);
jest.mock("./DeleteClientModal", () => () => null);
jest.mock("react-virtuoso", () => {
  // The factory is hoisted, so it cannot use the module-level React import.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ReactActual = require("react") as typeof import("react");
  return {
    TableVirtuoso: ReactActual.forwardRef<HTMLDivElement, { data: unknown[] }>(({ data }, ref) => (
      <div ref={ref}>{data.length}</div>
    )),
  };
});

describe("Spreadsheet export all", () => {
  it("waits for all remaining pages before creating the CSV", async () => {
    mockLoadAllRemaining.mockResolvedValue(mockAllRows);
    render(<Spreadsheet />);

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(await screen.findByRole("button", { name: "Export All Clients" }));

    await waitFor(() => expect(mockExportAllClients).toHaveBeenCalledTimes(1));
    expect(mockLoadAllRemaining).toHaveBeenCalledTimes(1);
    expect(mockExportAllClients.mock.calls[0][0]).toHaveLength(502);
  });
});
