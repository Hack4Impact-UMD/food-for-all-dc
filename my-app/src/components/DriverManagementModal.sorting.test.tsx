import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";
import DriverManagementModal from "./DriverManagementModal";

jest.mock("firebase/firestore", () => ({
  doc: () => undefined,
  updateDoc: async () => undefined,
  addDoc: async () => ({ id: "mock-driver" }),
  deleteDoc: async () => undefined,
  collection: () => undefined,
}));

jest.mock("../auth/firebaseConfig", () => ({
  db: {},
}));

jest.mock("./ConfirmationModal", () => () => null);

describe("DriverManagementModal sorting", () => {
  const baseDrivers = [
    {
      id: "driver-10",
      name: "Saturday Driver 10",
      phone: "2021112222",
      email: "saturday@foodforalldc.org",
    },
    {
      id: "driver-2",
      name: "Saturday Driver 2",
      phone: "2021112222",
      email: "saturday@foodforalldc.org",
    },
    {
      id: "driver-1",
      name: "Saturday Driver 1",
      phone: "2021112222",
      email: "saturday@foodforalldc.org",
    },
    {
      id: "driver-11",
      name: "Saturday Driver 11",
      phone: "2021112222",
      email: "saturday@foodforalldc.org",
    },
  ];

  const renderModal = () => {
    render(
      <DriverManagementModal
        open={true}
        onClose={jest.fn()}
        drivers={baseDrivers}
        onDriversChange={jest.fn()}
      />
    );
  };

  it("sorts driver names using natural numeric order in ascending mode", () => {
    renderModal();

    const driverNames = screen.getAllByText(/Saturday Driver \d+/).map((node) => node.textContent);

    expect(driverNames).toEqual([
      "Saturday Driver 1",
      "Saturday Driver 2",
      "Saturday Driver 10",
      "Saturday Driver 11",
    ]);
  });

  it("sorts driver names using natural numeric order in descending mode", () => {
    renderModal();

    fireEvent.click(screen.getByText("Driver"));

    const driverNames = screen.getAllByText(/Saturday Driver \d+/).map((node) => node.textContent);

    expect(driverNames).toEqual([
      "Saturday Driver 11",
      "Saturday Driver 10",
      "Saturday Driver 2",
      "Saturday Driver 1",
    ]);
  });
});
