import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { AuthProvider, useAuth } from "./AuthProvider";

let mockAuthStateCallback: ((user: any) => Promise<void>) | undefined;
const mockSignOut = jest.fn<Promise<void>, unknown[]>();
interface MockUserDocument {
  exists: () => boolean;
  data: () => { name: string; role?: string };
}
const mockGetDoc = jest.fn<Promise<MockUserDocument>, unknown[]>();

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: any) => Promise<void>) => {
    mockAuthStateCallback = callback;
    return () => undefined;
  },
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock("firebase/firestore", () => ({
  doc: () => ({}),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

jest.mock("./firebaseConfig", () => ({
  getFirebaseAuth: () => ({ name: "auth" }),
  getFirebaseDb: () => ({ name: "db" }),
}));

const firebaseUser = (uid: string) => ({
  uid,
  email: `${uid}@example.com`,
  displayName: "Test User",
  photoURL: null,
  emailVerified: true,
  phoneNumber: null,
  providerId: "password",
  getIdTokenResult: async () => ({ token: "token" }),
});

const AuthProbe = () => {
  const { loading, user, name, token, userRole } = useAuth();
  return (
    <div>
      {loading
        ? "loading"
        : `${user?.uid ?? "anonymous"}:${name ?? "no-name"}:${userRole ?? "no-role"}:${token?.token ?? "no-token"}`}
    </div>
  );
};

describe("AuthProvider", () => {
  beforeEach(() => {
    mockAuthStateCallback = undefined;
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue(undefined);
    mockGetDoc.mockReset();
  });

  it.each([
    ["a profile without a valid role", () => mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: "Test User" }) })],
    ["a failed profile lookup", () => mockGetDoc.mockRejectedValue(new Error("Firestore unavailable"))],
  ])("signs out and clears the session for %s", async (_scenario, arrangeProfile) => {
    arrangeProfile();
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      await mockAuthStateCallback?.(firebaseUser(_scenario));
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(screen.getByText("anonymous:no-name:no-role:no-token")).toBeTruthy();
  });

  it("hydrates the complete session for a valid profile", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ name: "Valid User", role: " manager " }),
    });
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      await mockAuthStateCallback?.(firebaseUser("valid-user"));
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByText("valid-user:Valid User:Manager:token")).toBeTruthy();
  });

  it("refetches a corrected profile after an invalid role is rejected", async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: "Corrected User" }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: "Corrected User", role: "Admin" }),
      });
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      await mockAuthStateCallback?.(firebaseUser("corrected-user"));
      await mockAuthStateCallback?.(firebaseUser("corrected-user"));
    });

    expect(mockGetDoc).toHaveBeenCalledTimes(2);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(screen.getByText("corrected-user:Corrected User:Admin:token")).toBeTruthy();
  });

  it("ignores an older profile lookup that completes after a newer login", async () => {
    let resolveFirstProfile: ((document: MockUserDocument) => void) | undefined;
    const firstProfile = new Promise<MockUserDocument>((resolve) => {
      resolveFirstProfile = resolve;
    });
    mockGetDoc
      .mockReturnValueOnce(firstProfile)
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: "User B", role: "Admin" }),
      });
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    const firstAuthEvent = mockAuthStateCallback?.(firebaseUser("user-a"));
    await act(async () => {
      await mockAuthStateCallback?.(firebaseUser("user-b"));
    });

    await act(async () => {
      resolveFirstProfile?.({
        exists: () => true,
        data: () => ({ name: "User A", role: "Manager" }),
      });
      await firstAuthEvent;
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByText("user-b:User B:Admin:token")).toBeTruthy();
  });
});