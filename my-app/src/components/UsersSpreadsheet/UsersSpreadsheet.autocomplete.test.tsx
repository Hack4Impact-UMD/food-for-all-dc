import React from "react";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import UsersSpreadsheet from "./UsersSpreadsheet";

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: { uid: string }) => void) => {
    callback({ uid: "user-1" });
    return () => undefined;
  },
}));

jest.mock("../../auth/firebaseConfig", () => ({
  auth: {},
}));

jest.mock("../../services/AuthUserService", () => ({
  authUserService: {
    getAllUsers: async () => [],
    deleteUser: async () => undefined,
  },
}));

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ userRole: "Admin" }),
}));

jest.mock("react-router-dom", () => ({
  useNavigate: () => () => undefined,
}));

jest.mock("./DeleteUserModal", () => () => null);
jest.mock("./CreateUserModal", () => () => null);

describe("UsersSpreadsheet autocomplete", () => {
  beforeEach(() => {
    jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback): number => {
        callback(0);
        return 0;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("prevents tabbing out and commits autocomplete in the users search input", async () => {
    render(<UsersSpreadsheet />);

    const input = await screen.findByPlaceholderText(
      "Search users (use ; between filters, e.g., role:admin,manager; name:jane,john; email:test@example.com)"
    );

    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "ro", selectionStart: 2, selectionEnd: 2 },
    });

    expect((input as HTMLInputElement).value).toBe("role");

    const tabEvent = createEvent.keyDown(input, { key: "Tab" });
    fireEvent(input, tabEvent);

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("role:");
    });

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
  });
});