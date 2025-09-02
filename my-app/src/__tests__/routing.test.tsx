import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import App from "../App";
import ProtectedRoute from "../auth/ProtectedRoute";
import { UserType } from "../types";

// Mock AuthProvider for different user roles and loading states
jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ userRole: mockUserRole, loading: false, logout: jest.fn() }),
}));
let mockUserRole: UserType | null = null;

describe("Minimal Routing Tests", () => {
  let consoleWarnSpy: jest.SpyInstance;
  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    mockUserRole = null;
    consoleWarnSpy.mockRestore();
  });
  afterEach(() => {
    mockUserRole = null;
  });

  it("renders public routes for unauthenticated users", () => {
    render(<App />);
    // Check that at least one element with 'Login' text is present
    expect(screen.getAllByText(/login/i).length).toBeGreaterThan(0);
  });

  it("redirects unauthorized users from protected routes", () => {
    mockUserRole = UserType.Driver;
    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={[UserType.Admin]} redirectTo="/" />}>
            <Route path="users" element={<div>Users Page</div>} />
          </Route>
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/home page/i)).toBeInTheDocument();
  });

  it("renders protected routes for authorized roles", () => {
    mockUserRole = UserType.Admin;
    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={[UserType.Admin]} />}>
            <Route path="users" element={<div>Users Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/users page/i)).toBeInTheDocument();
  });

  it("renders nested routes correctly", () => {
    mockUserRole = UserType.Admin;
    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route element={<ProtectedRoute allowedRoles={[UserType.Admin]} />}>
            <Route path="users" element={<div>Users Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/users page/i)).toBeInTheDocument();
  });

  it("custom redirect path works in ProtectedRoute", () => {
    mockUserRole = UserType.Driver || "Driver";
    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route
            element={
              <ProtectedRoute allowedRoles={[UserType.Admin]} redirectTo="/custom-redirect" />
            }
          >
            <Route path="users" element={<div>Users Page</div>} />
          </Route>
          <Route path="/custom-redirect" element={<div>Custom Redirect Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/custom redirect page/i)).toBeInTheDocument();
  });
});
