jest.mock('firebase/firestore');
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BasePage from "../pages/Base/Base";
import { UserType } from "../types";

jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ userRole: mockUserRole, logout: jest.fn() })
}));
let mockUserRole: UserType | null = null;

describe("Navigation Bar Tests", () => {
  afterEach(() => { mockUserRole = null; });

  it("renders all expected links for Admin", () => {
    mockUserRole = UserType.Admin;
    render(
      <MemoryRouter>
        <BasePage />
      </MemoryRouter>
    );
    expect(screen.getByText(/clients/i)).toBeInTheDocument();
    expect(screen.getByText(/calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/users/i)).toBeInTheDocument();
    expect(screen.getByText(/delivery/i)).toBeInTheDocument();
  });

  it("renders correct links for Driver", () => {
    mockUserRole = UserType.Driver;
    render(
      <MemoryRouter>
        <BasePage />
      </MemoryRouter>
    );
    expect(screen.getByText(/clients/i)).toBeInTheDocument();
    expect(screen.getByText(/calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/delivery/i)).toBeInTheDocument();
    expect(screen.queryByText(/users/i)).not.toBeInTheDocument();
  });

  it("highlights active tab based on route", () => {
    mockUserRole = UserType.Admin;
    render(
      <MemoryRouter initialEntries={["/calendar"]}>
        <BasePage />
      </MemoryRouter>
    );
    // Query for the tab by text and check its parent/container for 'active' class
    const calendarTab = screen.getByText(/calendar/i);
    // Find the closest parent with a class indicating selection
    const tabContainer = calendarTab.closest('div');
    expect(tabContainer).toHaveClass('tabContainerSelected');
  });
});
