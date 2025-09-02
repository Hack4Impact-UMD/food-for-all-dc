// All mocks must be at the very top before any imports
jest.mock("../../../services/AuthUserService", () => {
  class MockAuthUserService {
    async getAllUsers() {
      return [
        {
          uid: "1",
          id: "1",
          name: "Test User",
          role: 0,
          phone: "123-456-7890",
          email: "test@example.com",
        },
      ];
    }
  }
  return {
    __esModule: true,
    AuthUserService: MockAuthUserService,
    authUserService: new MockAuthUserService(),
  };
});
jest.mock("../../../auth/AuthProvider", () => ({
  useAuth: () => ({ userRole: 2 }), // 2 = Admin
}));
// Mock onAuthStateChanged to simulate a signed-in user and prevent redirect
jest.mock("firebase/auth", () => ({
  ...jest.requireActual("firebase/auth"),
  onAuthStateChanged: (auth, callback) => {
    // Simulate a signed-in user object
    callback({ uid: "test-uid" });
    return () => {};
  },
}));
if (typeof window !== "undefined") {
  window.matchMedia =
    window.matchMedia ||
    function (query) {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: function () {}, // Deprecated
        removeListener: function () {}, // Deprecated
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () {},
      };
    };
}

import React from "react";
import { render, screen } from "@testing-library/react";
import UsersSpreadsheet from "../UsersSpreadsheet";
import { MemoryRouter } from "react-router-dom";

describe("UsersSpreadsheet", () => {
  it("renders user spreadsheet table", async () => {
    jest.setTimeout(15000); // Increase timeout for async data
    render(
      <MemoryRouter>
        <UsersSpreadsheet />
      </MemoryRouter>
    );
    // Wait for the table to appear after async data fetch
    expect(await screen.findByRole("table", {}, { timeout: 10000 })).toBeInTheDocument();
    // Optionally check for the mocked user
    expect(await screen.findByText("Test User", {}, { timeout: 10000 })).toBeInTheDocument();
  });
});
