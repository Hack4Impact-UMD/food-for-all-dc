import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { UserType } from "../types";
import { authUserService } from "./AuthUserService";

const mockCallable = jest.fn<
  Promise<{ data: Record<string, unknown> }>,
  [Record<string, unknown>]
>();
const mockHttpsCallable = jest.fn<
  typeof mockCallable,
  [unknown, "createUserAccount" | "deleteUserAccount"]
>(() => mockCallable);

jest.mock("firebase/functions", () => ({
  httpsCallable: (...args: [unknown, "createUserAccount" | "deleteUserAccount"]) =>
    mockHttpsCallable(...args),
}));

jest.mock("firebase/firestore", () => ({
  collection: () => ({}),
  getDocs: () => Promise.resolve({ forEach: () => undefined }),
  doc: () => ({}),
  setDoc: () => Promise.resolve(),
  onSnapshot: () => () => undefined,
  writeBatch: () => ({
    set: () => undefined,
    commit: () => Promise.resolve(),
  }),
}));

jest.mock("../auth/firebaseConfig", () => ({
  db: {},
  functions: {},
}));

describe("AuthUserService synchronized user mutations", () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockHttpsCallable.mockReset();
    mockHttpsCallable.mockImplementation(() => mockCallable);
  });

  it("creates users through the server callable without changing client auth state", async () => {
    mockCallable.mockResolvedValue({ data: { uid: "new-user-uid" } });

    const uid = await authUserService.createUser(
      {
        name: " Test User ",
        email: " TEST@example.com ",
        phone: "202-555-0100",
        role: UserType.ClientIntake,
      },
      "test-password"
    );

    expect(uid).toBe("new-user-uid");
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), "createUserAccount");
    expect(mockCallable).toHaveBeenCalledTimes(1);
    expect(mockCallable).toHaveBeenCalledWith({
      name: "Test User",
      email: "TEST@example.com",
      phone: "(202) 555-0100",
      role: "Client Intake",
      password: "test-password",
    });
  });

  it("preserves the email-in-use message returned by the callable", async () => {
    mockCallable.mockRejectedValue({
      code: "functions/already-exists",
      message: "already exists",
    });

    await expect(
      authUserService.createUser(
        {
          name: "Test User",
          email: "test@example.com",
          role: UserType.ClientIntake,
        },
        "test-password"
      )
    ).rejects.toMatchObject({
      message: "Email already in use. Please use a different email.",
      code: "functions/already-exists",
    });
    expect(mockCallable).toHaveBeenCalledTimes(1);
  });

  it("uses the idempotent deletion callable once per user action", async () => {
    mockCallable.mockResolvedValue({ data: { status: "success" } });

    await authUserService.deleteUser("deleted-user-uid");

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), "deleteUserAccount");
    expect(mockCallable).toHaveBeenCalledTimes(1);
    expect(mockCallable).toHaveBeenCalledWith({ uid: "deleted-user-uid" });
  });
});
