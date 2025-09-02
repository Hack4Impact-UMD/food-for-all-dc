import { AuthUserService } from "../AuthUserService";

jest.mock("../firebase-service");

describe("AuthUserService", () => {
  let service: AuthUserService;

  beforeEach(() => {
    service = AuthUserService.getInstance();
  });

  it("should be a singleton", () => {
    const service2 = AuthUserService.getInstance();
    expect(service).toBe(service2);
  });

  it("should have subscribeToAllUsers method", () => {
    expect(typeof service.subscribeToAllUsers).toBe("function");
  });
  it("should have subscribeToUserById method", () => {
    expect(typeof service.subscribeToUserById).toBe("function");
  });

  // Add more tests for auth and user methods as needed
});
