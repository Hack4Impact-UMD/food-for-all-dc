import { canCreateUserType, UserType } from "../../types";

describe("canCreateUserType", () => {
  it("Admin can create all user types", () => {
    expect(canCreateUserType(UserType.Admin, UserType.Admin)).toBe(true);
    expect(canCreateUserType(UserType.Admin, UserType.Manager)).toBe(true);
    expect(canCreateUserType(UserType.Admin, UserType.ClientIntake)).toBe(true);
  });

  it("Manager can only create ClientIntake", () => {
    expect(canCreateUserType(UserType.Manager, UserType.ClientIntake)).toBe(true);
    expect(canCreateUserType(UserType.Manager, UserType.Admin)).toBe(false);
    expect(canCreateUserType(UserType.Manager, UserType.Manager)).toBe(false);
  });

  it("Other types cannot create any user", () => {
    expect(canCreateUserType(UserType.ClientIntake, UserType.Admin)).toBe(false);
    expect(canCreateUserType(UserType.ClientIntake, UserType.Manager)).toBe(false);
    expect(canCreateUserType(UserType.ClientIntake, UserType.ClientIntake)).toBe(false);
  });
});

// Add more tests for CRUD operations if service logic is not just Firebase wrappers.
