import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";
import RouteReportsPreview from "../../../pages/Delivery/components/RouteReportsPreview";
import { DriverRouteReport, RouteReportData } from "../../../pages/Delivery/utils/routeReportData";

jest.mock("../../../pages/Delivery/components/RouteOverviewMap", () => ({
  __esModule: true,
  default: ({ routeId }: { routeId: string }) => <div>Map for route {routeId}</div>,
}));

const makeReport = (deliveryCount: number): DriverRouteReport => ({
  key: "4::jane smith::09:00",
  routeId: "4",
  driverName: "Jane Smith",
  assignedTime: "09:00",
  deliveryDate: "2026-08-22",
  deliveries: Array.from({ length: deliveryCount }, (_, index) => ({
    id: `client-${index + 1}`,
    clientid: `client-${index + 1}`,
    firstName: index === 0 ? "Tina" : `Client ${index + 1}`,
    lastName: index === 0 ? "Baldwin" : "Example",
    address: index === 1 ? "" : `${index + 1} Example Street SE`,
    phone: index === 1 ? "" : "202-555-1234",
    deliveryDetails: {
      deliveryInstructions:
        index === 0 ? "Please call prior to delivery. ".repeat(20) : "",
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
    adults: 2,
    seniors: 1,
    children: 3,
  })),
});

describe("RouteReportsPreview", () => {
  it("clears stale page scroll locks when opened and closed", () => {
    document.body.classList.add("route-reports-scroll-locked");
    document.documentElement.classList.add("route-reports-scroll-locked");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const reportData: RouteReportData = {
      reports: [makeReport(1)],
      issues: [],
    };
    const onClose = jest.fn();
    const { unmount } = render(
      <RouteReportsPreview reportData={reportData} onClose={onClose} />
    );

    expect(document.body.classList.contains("route-reports-scroll-locked")).toBe(false);
    expect(document.documentElement.classList.contains("route-reports-scroll-locked")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Close route report preview" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe("");

    unmount();
  });

  it("renders a readable 10+ stop report with missing optional fields", () => {
    const reportData: RouteReportData = {
      reports: [makeReport(11)],
      issues: [],
    };

    render(<RouteReportsPreview reportData={reportData} onClose={jest.fn()} />);

    expect(screen.getByText("Route 4")).toBeTruthy();
    expect(screen.queryByText(/Cluster 4/)).toBeNull();
    // "Jane Smith" and the delivery date also appear on the summary front page.
    expect(screen.getAllByText("Jane Smith")).toHaveLength(2);
    expect(screen.getAllByText("Saturday, August 22, 2026")).toHaveLength(2);
    expect(screen.getByText("9:00 AM")).toBeTruthy();
    expect(screen.getByText("Tina Baldwin - 9:00 AM")).toBeTruthy();
    expect(screen.queryByText("1. Tina Baldwin - 9:00 AM")).toBeNull();
    expect(screen.getAllByLabelText("Completion checkbox")).toHaveLength(11);
    expect(screen.getByText("Address unavailable")).toBeTruthy();
    expect(screen.getAllByText("No special instructions.")).toHaveLength(10);
    expect(screen.getAllByText("Household: Adults 2 | Seniors 1 | Children 3")).toHaveLength(11);
    expect(screen.getByText(/Please call prior to delivery/).textContent).toContain(
      "Please call prior to delivery."
    );
  });

  it("shows assignment issues and invokes browser printing", () => {
    const printSpy = jest.spyOn(window, "print").mockImplementation(() => undefined);
    const reportData: RouteReportData = {
      reports: [makeReport(1)],
      issues: [
        { delivery: makeReport(1).deliveries[0], routeId: "", reason: "missing-route" },
        { delivery: makeReport(1).deliveries[0], routeId: "3", reason: "missing-driver" },
      ],
    };

    render(<RouteReportsPreview reportData={reportData} onClose={jest.fn()} />);
    expect(
      screen.getByText(/Needs assignment: 1 without a route and 1 without a driver/)
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Print All Reports" }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("does not duplicate the meridiem for 12-hour assignment times", () => {
    const report = makeReport(1);
    report.assignedTime = "9:00 AM";

    render(
      <RouteReportsPreview reportData={{ reports: [report], issues: [] }} onClose={jest.fn()} />
    );

    expect(screen.queryByText(/AM AM/)).toBeNull();
    expect(screen.getByText("Tina Baldwin - 9:00 AM")).toBeTruthy();
  });
});