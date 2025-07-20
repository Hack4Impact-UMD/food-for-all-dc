import React from "react";
import { render, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthProvider";

// Mock children component to consume context
const TestConsumer = () => {
  const { user, loading, error, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? user.email : "none"}</span>
      <span data-testid="loading">{loading ? "loading" : "done"}</span>
      <span data-testid="error">{error ? error.message : "none"}</span>
      <button data-testid="logout" onClick={logout}>Logout</button>
    </div>
  );
};

describe("AuthProvider", () => {
  it("renders without crashing and provides default context", async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(getByTestId("user").textContent).toBe("none");
    expect(getByTestId("loading").textContent).toBe("loading");
    expect(getByTestId("error").textContent).toBe("none");
  });

  it("logout function does not throw when called with default context", async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await waitFor(() => {
      getByTestId("logout").click();
    });
    // No error expected
  });
});
