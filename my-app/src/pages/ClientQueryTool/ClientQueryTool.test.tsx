import React from "react";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("../../auth/firebaseConfig", () => ({ db: {} }));

jest.mock("../../config/dataSources", () => ({
  __esModule: true,
  default: {
    firebase: { clientsCollection: "client-profile2", caseWorkersCollection: "referral" },
  },
}));

jest.mock("firebase/firestore", () => ({
  collection: () => ({ mocked: "collection" }),
  getDocs: () => Promise.resolve({ docs: [] }),
}));

jest.mock("../../services/client-service", () => ({
  clientService: {
    getAllTags: () => Promise.resolve(["Halal", "Vegan"]),
  },
}));

jest.mock("../../services/client-query-service", () => ({
  __esModule: true,
  runClientQuery: () => Promise.resolve({ rows: [] }),
}));

jest.mock("../../components/Spreadsheet/export", () => ({
  exportQueryResults: () => undefined,
  exportRowsWithColumns: () => undefined,
}));

import ClientQueryTool from "./ClientQueryTool";
import * as clientQueryService from "../../services/client-query-service";

describe("ClientQueryTool", () => {
  beforeEach(() => {
    jest.spyOn(clientQueryService, "runClientQuery").mockResolvedValue({
      rows: [],
    });
  });

  it("starts with one filter row and an idle state message", () => {
    render(<ClientQueryTool />);
    expect(
      screen.getByText(/Add one or more filters, then select Run Query/i)
    ).toBeTruthy();
    expect(screen.getAllByLabelText(/Remove filter/i)).toHaveLength(1);
  });

  it("Add Filter creates a new row", () => {
    render(<ClientQueryTool />);
    fireEvent.click(screen.getByRole("button", { name: /Add Filter/i }));
    expect(screen.getAllByLabelText(/Remove filter/i)).toHaveLength(2);
  });

  it("Remove Filter removes a row", () => {
    render(<ClientQueryTool />);
    fireEvent.click(screen.getByRole("button", { name: /Add Filter/i }));
    const removeButtons = screen.getAllByLabelText(/Remove filter/i);
    fireEvent.click(removeButtons[0]);
    expect(screen.getAllByLabelText(/Remove filter/i)).toHaveLength(1);
  });

  it("prevents running an empty query and shows a validation message", async () => {
    render(<ClientQueryTool />);
    fireEvent.click(screen.getByRole("button", { name: /Run Query/i }));
    expect(await screen.findByText(/Choose a field/i)).toBeTruthy();
    expect(clientQueryService.runClientQuery).not.toHaveBeenCalled();
  });

  it("Clear resets filters and results", async () => {
    render(<ClientQueryTool />);
    fireEvent.click(screen.getByRole("button", { name: /Add Filter/i }));
    fireEvent.click(screen.getByRole("button", { name: /Clear/i }));
    expect(screen.getAllByLabelText(/Remove filter/i)).toHaveLength(1);
    expect(
      screen.getByText(/Add one or more filters, then select Run Query/i)
    ).toBeTruthy();
  });

  it("shows an empty results state when the query returns no rows", async () => {
    render(<ClientQueryTool />);

    fireEvent.mouseDown(screen.getByLabelText("Field"));
    fireEvent.click(await screen.findByRole("option", { name: /ZIP Code/i }));
    fireEvent.mouseDown(screen.getByLabelText("Operator"));
    fireEvent.click(await screen.findByRole("option", { name: /equals \(==\)/i }));
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "20002" } });

    fireEvent.click(screen.getByRole("button", { name: /Run Query/i }));

    await waitFor(() => expect(clientQueryService.runClientQuery).toHaveBeenCalled());
    expect(await screen.findByText(/No clients matched these filters/i)).toBeTruthy();
  });

  it("shows a friendly error state when the query service throws", async () => {
    jest
      .spyOn(clientQueryService, "runClientQuery")
      .mockRejectedValue(
        new Error(
          "This combination of filters requires an additional database index. Please contact an administrator."
        )
      );
    render(<ClientQueryTool />);

    fireEvent.mouseDown(screen.getByLabelText("Field"));
    fireEvent.click(await screen.findByRole("option", { name: /ZIP Code/i }));
    fireEvent.mouseDown(screen.getByLabelText("Operator"));
    fireEvent.click(await screen.findByRole("option", { name: /equals \(==\)/i }));
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "20002" } });

    fireEvent.click(screen.getByRole("button", { name: /Run Query/i }));

    expect(await screen.findByText(/additional database index/i)).toBeTruthy();
  });
});
