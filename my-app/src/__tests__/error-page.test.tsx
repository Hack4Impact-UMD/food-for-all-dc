jest.mock('firebase/firestore');
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
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import App from "../App";
import NotFoundPage from "../components/NotFoundPage";

describe("Error Page Tests", () => {
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
    render(<App />);
    // Wait for loading indicator to disappear
    await waitFor(() => expect(screen.queryByText(/initializing app/i)).not.toBeInTheDocument());
    // Use findBy* for robust async rendering
    expect(await screen.findByText(/clients/i)).toBeInTheDocument();
    expect(await screen.findByAltText(/logo/i)).toBeInTheDocument();
  });
});
