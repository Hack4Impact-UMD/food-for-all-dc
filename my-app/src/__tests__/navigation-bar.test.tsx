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
    expect(screen.getByText(/routes/i)).toBeInTheDocument();
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
    expect(screen.getByText(/routes/i)).toBeInTheDocument();
    expect(screen.queryByText(/users/i)).not.toBeInTheDocument();
  });

  it("highlights active tab based on route", () => {
    mockUserRole = UserType.Admin;
    render(
      <MemoryRouter initialEntries={["/calendar"]}>
        <BasePage />
      </MemoryRouter>
    );
    // Query for all elements with 'calendar' text
    const calendarTabs = screen.getAllByText(/calendar/i);
    // Find the tab that is inside a container with 'tabContainerSelected' class
    const selectedTab = calendarTabs.find(tab => {
      // Try to find the closest ancestor with the class
      let container = tab.closest('.tabContainerSelected');
      // Fallback: check parent element if not found
      if (!container && tab.parentElement && tab.parentElement.classList.contains('tabContainerSelected')) {
        container = tab.parentElement;
      }
      return container;
    });
    expect(selectedTab).toBeTruthy();
  });
});
