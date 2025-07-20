jest.mock("../auth/AuthProvider", () => {
  const actual = jest.requireActual("../auth/AuthProvider");
  const { UserType } = jest.requireActual("../types");
  return {
    ...actual,
    useAuth: () => ({
      loading: false,
      user: { uid: "test", email: "admin@test.com" },
      token: "mock-token",
      userRole: UserType.Admin,
      error: null,
      setUser: jest.fn(),
      setToken: jest.fn(),
      setUserRole: jest.fn(),
      setError: jest.fn(),
      logout: jest.fn(),
    }),
    AuthContext: actual.AuthContext,
  };
});
import "../setupTests";
jest.mock('firebase/firestore');
// ...existing code...
jest.setTimeout(30000);
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "../App";

// Create a mock AuthProvider that provides the mocked useAuth context
import { UserType } from "../types";
const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const AuthContext = require("../auth/AuthProvider").AuthContext;
  return (
    <AuthContext.Provider
      value={{
        loading: false,
        user: { uid: "test", email: "admin@test.com" },
        token: "mock-token",
        userRole: UserType.Admin,
        error: null,
        setUser: jest.fn(),
        setToken: jest.fn(),
        setUserRole: jest.fn(),
        setError: jest.fn(),
        logout: jest.fn(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const routesToTest = [
  { path: "/clients", text: /clients/i },
  { path: "/calendar", text: /calendar/i },
  { path: "/users", text: /users/i },
  { path: "/delivery", text: /delivery/i },
];

describe("Route Config Tests", () => {
  routesToTest.forEach(({ path, text }) => {
    it(`renders correct component for route: ${path}`, async () => {
      // ...existing code...
    });
  });
});
