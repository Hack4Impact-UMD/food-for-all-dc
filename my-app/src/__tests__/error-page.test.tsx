jest.mock('firebase/firestore');
// Mock onAuthStateChanged to always call back with a user
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (auth: any, callback: any) => {
    callback({ uid: "test-uid", email: "test@example.com" });
    return () => {};
  },
  getAuth: () => ({})
}));
// Mock auth to always return a user for onAuthStateChanged
jest.mock("../auth/firebaseConfig", () => ({
  auth: {
    // Simulate Firebase Auth instance
  },
}));
// Mock the services barrel so DeliveryService.getInstance returns a mock
jest.mock('../services', () => ({
  DeliveryService: class {
    static getInstance() {
      return {
        getWeeklyLimits: async () => ({
          sunday: 60,
          monday: 60,
          tuesday: 60,
          wednesday: 60,
          thursday: 90,
          friday: 90,
          saturday: 60,
        })
      };
    }
  }
}));
// Mock DeliveryService singleton pattern
jest.mock('../services/delivery-service', () => {
  return {
    __esModule: true,
    default: {}, // for default import compatibility
    DeliveryService: class {
      static getInstance() {
        return {
          getWeeklyLimits: async () => ({
            sunday: 60,
            monday: 60,
            tuesday: 60,
            wednesday: 60,
            thursday: 90,
            friday: 90,
            saturday: 60,
          })
        };
      }
    }
  };
});
// Mock AuthProvider to force loading=false so App transitions out of loading state
jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    userRole: "Admin",
    user: { uid: "test-uid", email: "test@example.com" },
    token: "mock-token",
    loading: false,
    error: null,
    logout: jest.fn(),
    setUser: jest.fn(),
    setToken: jest.fn(),
    setUserRole: jest.fn(),
    setError: jest.fn(),
  })
}));

// ...existing code...
// ...existing code...
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import App from "../App";
import NotFoundPage from "../components/NotFoundPage";

describe("Error Page Tests", () => {
  let consoleWarnSpy: jest.SpyInstance;
  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });
  it("renders 404 page for unknown route", async () => {
    render(
      <MemoryRouter initialEntries={["/unknown"]}>
        <Routes>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    );
    // Use findBy* for async rendering
    expect(await screen.findByText(/404/i)).toBeInTheDocument();
    expect(await screen.findByText(/page not found/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /go home/i })).toBeInTheDocument();
  });

  it("renders main app content for unknown route after loading", async () => {
    window.history.pushState({}, "", "/clients");
    render(<App />);
    // Wait for loading indicator to disappear
    await waitFor(() => expect(screen.queryByText(/initializing app/i)).not.toBeInTheDocument());
    // Use findBy* for robust async rendering
    const clientsElements = await screen.findAllByText(/clients/i);
    expect(clientsElements.length).toBeGreaterThan(0);
    expect(await screen.findByAltText(/logo/i)).toBeInTheDocument();
  });
});
