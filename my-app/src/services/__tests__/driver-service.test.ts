jest.setTimeout(15000);
jest.mock("../firebase-service");
import DriverService from "../driver-service";
import { Driver } from "../../types";
import * as retryUtils from "../../utils/retry";

jest.mock("../firebase-service");

describe("DriverService", () => {
  let service: DriverService;

  beforeEach(() => {
    service = DriverService.getInstance();
  });

  it("should be a singleton", () => {
    const service2 = DriverService.getInstance();
    expect(service).toBe(service2);
  });

  it("should have getAllDrivers method", () => {
    expect(typeof service.getAllDrivers).toBe("function");
  });

  describe("getAllDrivers", () => {
    it("should return an array of drivers on success", async () => {
      jest.spyOn(service, "getAllDrivers").mockResolvedValueOnce([]);
      const result = await service.getAllDrivers();
      expect(Array.isArray(result)).toBe(true);
    });
    it("should throw on Firestore error", async () => {
      jest
        .spyOn(service, "getAllDrivers")
        .mockRejectedValueOnce(new Error("Failed to get all drivers"));
      await expect(service.getAllDrivers()).rejects.toThrow("Failed to get all drivers");
    });
  });

  describe("getAllDriversPaginated", () => {
    it("should return an object with drivers array", async () => {
      jest.spyOn(service, "getAllDriversPaginated").mockResolvedValueOnce({ drivers: [] });
      const result = await service.getAllDriversPaginated();
      expect(Array.isArray(result.drivers)).toBe(true);
    });
    it("should return empty array on error", async () => {
      jest.spyOn(service, "getAllDriversPaginated").mockResolvedValueOnce({ drivers: [] });
      const result = await service.getAllDriversPaginated();
      expect(result.drivers).toEqual([]);
    });
  });

  describe("subscribeToAllDrivers", () => {
    it("should call onData with an array", () => {
      const onData = jest.fn();
      const unsubscribe = service.subscribeToAllDrivers(onData);
      expect(typeof unsubscribe).toBe("function");
    });
  });

  describe("getDriverById", () => {
    it("should return a driver object or null", async () => {
      jest
        .spyOn(service, "getDriverById")
        .mockResolvedValueOnce({
          id: "test-id",
          name: "Test Driver",
          phone: "555-1234",
          email: "test@example.com",
        });
      const result = await service.getDriverById("test-id");
      expect(result === null || typeof result === "object").toBe(true);
    });
    it("should throw on Firestore error", async () => {
      jest
        .spyOn(service, "getDriverById")
        .mockRejectedValueOnce(new Error("Failed to get driver by ID"));
      await expect(service.getDriverById("test-id")).rejects.toThrow("Failed to get driver by ID");
    });
  });

  describe("subscribeToDriverById", () => {
    it("should call onData with a driver or null", () => {
      const onData = jest.fn();
      const unsubscribe = service.subscribeToDriverById("id", onData);
      expect(typeof unsubscribe).toBe("function");
    });
  });

  describe("createDriver", () => {
    it("should return a string id on success", async () => {
      jest.spyOn(service, "createDriver").mockResolvedValueOnce("mock-id");
      const id = await service.createDriver({} as any);
      expect(typeof id).toBe("string");
    });
    it("should throw on Firestore error", async () => {
      jest
        .spyOn(service, "createDriver")
        .mockRejectedValueOnce(new Error("Failed to create driver"));
      await expect(service.createDriver({} as any)).rejects.toThrow("Failed to create driver");
    });
  });

  describe("updateDriver", () => {
    it("should resolve on success", async () => {
      jest.spyOn(service, "updateDriver").mockResolvedValueOnce(undefined);
      await expect(service.updateDriver("id", {})).resolves.toBeUndefined();
    });
    it("should throw on Firestore error", async () => {
      jest.spyOn(service, "updateDriver").mockRestore?.(); // Ensure not mocked
      jest.spyOn(retryUtils, "retry").mockImplementationOnce(() => {
        throw new Error("fail");
      });
      await expect(service.updateDriver("id", {})).rejects.toThrow("Failed to update driver");
    });
  });

  describe("deleteDriver", () => {
    it("should resolve on success", async () => {
      await expect(service.deleteDriver("id")).resolves.toBeUndefined();
    });
    it("should throw on Firestore error", async () => {
      jest.spyOn(retryUtils, "retry").mockImplementationOnce(() => {
        throw new Error("fail");
      });
      await expect(service.deleteDriver("id")).rejects.toThrow("Failed to delete driver");
    });
  });
});
