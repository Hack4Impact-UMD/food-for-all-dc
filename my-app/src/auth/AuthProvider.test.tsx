import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { AuthProvider, useAuth } from "./AuthProvider";

let mockAuthStateCallback: ((user: any) => Promise<void>) | undefined;
const mockSignOut = jest.fn<Promise<void>, unknown[]>();
interface MockUserDocument {
  exists: () => boolean;
  data: () => { name: string };
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
  const { loading, user, userRole } = useAuth();
  return <div>{loading ? "loading" : `${user?.uid ?? "anonymous"}:${userRole ?? "no-role"}`}</div>;
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
    expect(screen.getByText("anonymous:no-role")).toBeTruthy();
  });
});