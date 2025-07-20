
jest.mock('firebase/firestore');
import React from "react";
import { render, screen } from "@testing-library/react";
import App from "../App";

jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ loading: true })
}));

describe("Loading State Tests", () => {
  it("shows loading indicator when app is initializing", () => {
    render(<App />);
    expect(screen.getByText(/initializing app\.{0,3}/i)).toBeInTheDocument();
  });
});
