import React from "react";
import { DateTime } from "luxon";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { MockedFunction } from "jest-mock";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SummaryReport from "./SummaryReport";
import {
  loadAllReportClients,
  loadFirstDeliveriesByClientIds,
  loadInclusiveReportEvents,
} from "./reportDataLoader";

const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowWarning = jest.fn();

jest.mock("../../components/NotificationProvider", () => ({
  useNotifications: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
    showWarning: mockShowWarning,
  }),
}));

jest.mock("./reportDataLoader", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mockJest = require("@jest/globals").jest;

  return {
    loadAllReportClients: mockJest.fn(),
    loadFirstDeliveriesByClientIds: mockJest.fn(),
    loadInclusiveReportEvents: mockJest.fn(),
  };
});

const mockedLoadAllReportClients = loadAllReportClients as MockedFunction<
  typeof loadAllReportClients
>;
const mockedLoadFirstDeliveriesByClientIds =
  loadFirstDeliveriesByClientIds as MockedFunction<typeof loadFirstDeliveriesByClientIds>;
const mockedLoadInclusiveReportEvents = loadInclusiveReportEvents as MockedFunction<
  typeof loadInclusiveReportEvents
>;

describe("SummaryReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("ffaReportDateRangeStart", "2026-07-16");
    localStorage.setItem("ffaReportDateRangeEnd", "2026-08-12");

    mockedLoadInclusiveReportEvents.mockResolvedValue([]);
    mockedLoadFirstDeliveriesByClientIds.mockResolvedValue(new Map());
    mockedLoadAllReportClients.mockResolvedValue([
      {
        uid: "active-without-delivery",
        firstName: "Test",
        lastName: "Client",
        startDate: DateTime.fromISO("2026-06-01"),
        endDate: DateTime.fromISO("2026-08-12"),
        tags: ["HFA"],
      },
    ]);
  });

  it("counts an unserved client who was active at the selected report end date", async () => {
    render(<SummaryReport />);

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(mockedLoadAllReportClients).toHaveBeenCalledTimes(1));
    expect(mockedLoadFirstDeliveriesByClientIds).toHaveBeenCalledWith([]);

    fireEvent.click(await screen.findByRole("button", { name: "Tags" }));
    const tagsRegion = await screen.findByRole("region", { name: "Tags" });
    expect(within(tagsRegion).getByText("HFA")).toBeTruthy();
    expect(within(tagsRegion).getByText("1")).toBeTruthy();
  });
});
