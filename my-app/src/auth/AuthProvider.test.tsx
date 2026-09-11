import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { AuthProvider, resetUserRoleCache, useAuth } from "./AuthProvider";

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

const ErrorProbe = () => {
  const { error } = useAuth();
  return (
    <div data-testid="auth-error">{error ? `${error.code}|${error.message}` : "no-error"}</div>
  );
};

const renderAuth = () =>
  render(
    <AuthProvider>
      <AuthProbe />
      <ErrorProbe />
    </AuthProvider>
  );

const authErrorText = () => screen.getByTestId("auth-error").textContent;

describe("AuthProvider", () => {
  beforeEach(() => {
    // The role cache is module state shared by every test in this file.
    resetUserRoleCache();
    mockAuthStateCallback = undefined;
    mockSignOut.mockReset();
    // The real firebase signOut notifies onAuthStateChanged with a null user
    // BEFORE its promise resolves. Mocking it as an inert resolve hides every
    // interaction between the sign-out and the listener that triggered it.
    mockSignOut.mockImplementation(async () => {
      await mockAuthStateCallback?.(null);
    });
    mockGetDoc.mockReset();
  });

  it.each([
    [
      "a profile without a valid role",
      () =>
        mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: "Test User" }) }),
      "auth/missing-role",
    ],
    [
      "a failed profile lookup",
      () => mockGetDoc.mockRejectedValue(new Error("Firestore unavailable")),
      "auth/profile-unavailable",
    ],
  ])(
    "signs out, clears the session and reports the reason for %s",
    async (_scenario, arrangeProfile, expectedCode) => {
      arrangeProfile();
      renderAuth();

      await act(async () => {
        await mockAuthStateCallback?.(firebaseUser(_scenario));
      });

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(screen.getByText("anonymous:no-name:no-role:no-token")).toBeTruthy();
      // The sign-out re-enters the listener with a null user. The reason the
      // session was rejected must survive that, or the login page shows nothing.
      expect(authErrorText()).toContain(expectedCode);
    }
  );

  it("retries a transient profile lookup before rejecting the session", async () => {
    mockGetDoc.mockRejectedValue(new Error("Firestore unavailable"));
    renderAuth();

    await act(async () => {
      await mockAuthStateCallback?.(firebaseUser("flaky-user"));
    });

    expect(mockGetDoc.mock.calls.length).toBeGreaterThan(1);
  });

  it("recovers when a retried profile lookup succeeds", async () => {
    mockGetDoc.mockRejectedValueOnce(new Error("Firestore unavailable")).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ name: "Flaky User", role: "Admin" }),
    });
    renderAuth();

    await act(async () => {
      await mockAuthStateCallback?.(firebaseUser("flaky-user"));
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByText("flaky-user:Flaky User:Admin:token")).toBeTruthy();
    expect(authErrorText()).toBe("no-error");
  });

  it("reports no error for an ordinary sign-out", async () => {
    renderAuth();

    await act(async () => {
      await mockAuthStateCallback?.(null);
    });

    expect(authErrorText()).toBe("no-error");
  });

  it("hydrates the complete session for a valid profile", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ name: "Valid User", role: " manager " }),
    });
    renderAuth();

    await act(async () => {
      await mockAuthStateCallback?.(firebaseUser("valid-user"));
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByText("valid-user:Valid User:Manager:token")).toBeTruthy();
    expect(authErrorText()).toBe("no-error");
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
    renderAuth();

    await act(async () => {
      await mockAuthStateCallback?.(firebaseUser("corrected-user"));
      await mockAuthStateCallback?.(firebaseUser("corrected-user"));
    });

    expect(mockGetDoc).toHaveBeenCalledTimes(2);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(screen.getByText("corrected-user:Corrected User:Admin:token")).toBeTruthy();
    expect(authErrorText()).toBe("no-error");
  });

  it("keeps the rejection reason when the null-user event lands after signOut resolves", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: "Late User" }) });
    // Firebase notifies observers on a deferred task, so the null-user event can
    // arrive after signOut() has resolved and the reason has already been applied.
    mockSignOut.mockImplementation(async () => {
      setTimeout(() => {
        void mockAuthStateCallback?.(null);
      }, 0);
    });
    renderAuth();

    await act(async () => {
      await mockAuthStateCallback?.(firebaseUser("late-null-user"));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText("anonymous:no-name:no-role:no-token")).toBeTruthy();
    expect(authErrorText()).toContain("auth/missing-role");
  });

  it("retries a transient token refresh instead of ejecting a valid session", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ name: "Token User", role: "Admin" }),
    });
    let tokenAttempts = 0;
    const flakyTokenUser = {
      ...firebaseUser("token-user"),
      getIdTokenResult: async () => {
        tokenAttempts += 1;
        if (tokenAttempts === 1) {
          throw Object.assign(new Error("network"), { code: "auth/network-request-failed" });
        }
        return { token: "token" };
      },
    };
    renderAuth();

    await act(async () => {
      await mockAuthStateCallback?.(flakyTokenUser);
    });

    expect(tokenAttempts).toBe(2);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByText("token-user:Token User:Admin:token")).toBeTruthy();
  });

  it("does not retry a permission failure or report it as a connection problem", async () => {
    mockGetDoc.mockRejectedValue(Object.assign(new Error("denied"), { code: "permission-denied" }));
    renderAuth();

    await act(async () => {
      await mockAuthStateCallback?.(firebaseUser("denied-user"));
    });

    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(authErrorText()).toContain("auth/profile-unavailable");
    expect(authErrorText()).toContain("contact an administrator");
  });

  it("ignores an older profile lookup that completes after a newer login", async () => {
    let resolveFirstProfile: ((document: MockUserDocument) => void) | undefined;
    const firstProfile = new Promise<MockUserDocument>((resolve) => {
      resolveFirstProfile = resolve;
    });
    mockGetDoc.mockReturnValueOnce(firstProfile).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ name: "User B", role: "Admin" }),
    });
    renderAuth();

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
