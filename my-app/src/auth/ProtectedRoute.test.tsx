import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { UserType } from "../types";

const mockUseAuth = jest.fn();

jest.mock("./AuthProvider", () => ({
  useAuth: () => mockUseAuth(),
}));

const renderProtectedRoute = () =>
  render(
    <MemoryRouter
      initialEntries={["/clients"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<div>Login</div>} />
        <Route
          path="/clients"
          element={
            <ProtectedRoute
              allowedRoles={[UserType.Admin, UserType.Manager, UserType.ClientIntake]}
            >
              <div>Clients</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("redirects an authenticated Firebase session without an application role", () => {
    mockUseAuth.mockReturnValue({ loading: false, userRole: null });

    renderProtectedRoute();

    expect(screen.getByText("Login")).toBeTruthy();
    expect(screen.queryByText("Clients")).toBeNull();
  });

  it("renders protected content for a recognized application role", () => {
    mockUseAuth.mockReturnValue({ loading: false, userRole: UserType.ClientIntake });

    renderProtectedRoute();

    expect(screen.getByText("Clients")).toBeTruthy();
  });

  it("does not render protected content while authentication is loading", () => {
    mockUseAuth.mockReturnValue({ loading: true, userRole: null });

    renderProtectedRoute();

    expect(screen.queryByText("Clients")).toBeNull();
    expect(screen.queryByText("Login")).toBeNull();
  });
});