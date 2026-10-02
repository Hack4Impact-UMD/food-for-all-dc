import { describe, expect, it, jest } from "@jest/globals";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { getDocs } from "firebase/firestore";
import type { MockedFunction } from "jest-mock";
import { loadAllReportClients } from "./reportDataLoader";

jest.mock("../../auth/firebaseConfig", () => ({ db: {} }));
jest.mock("../../config/dataSources", () => ({
  __esModule: true,
  default: { firebase: { clientsCollection: "client-profile2" } },
}));
jest.mock("firebase/firestore", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mockJest = require("@jest/globals").jest;

  return {
    collection: mockJest.fn(),
    documentId: mockJest.fn(() => "__name__"),
    getDocs: mockJest.fn(),
    limit: mockJest.fn(),
    orderBy: mockJest.fn(),
    query: mockJest.fn((...parts: unknown[]) => parts),
    startAfter: mockJest.fn(),
    Timestamp: class Timestamp {},
    where: mockJest.fn(),
  };
});

const mockedGetDocs = getDocs as MockedFunction<typeof getDocs>;

describe("reportDataLoader", () => {
  it("maps three-strikes history needed by historical summary reports", async () => {
    const docSnapshot = {
      id: "client-1",
      data: () => ({
        firstName: "Test",
        lastName: "Client",
        startDate: "2026-06-01",
        endDate: "2026-08-20",
        autoInactiveReason: "three-strikes",
        autoInactivePreviousEndDate: "2026-12-31",
        autoInactiveStrikeDate: "2026-08-20",
        tags: ["HFA"],
      }),
    } as unknown as QueryDocumentSnapshot;
    mockedGetDocs.mockResolvedValueOnce({
      docs: [docSnapshot],
      empty: false,
      size: 1,
    } as Awaited<ReturnType<typeof getDocs>>);

    await expect(loadAllReportClients()).resolves.toEqual([
      expect.objectContaining({
        uid: "client-1",
        autoInactiveReason: "three-strikes",
        autoInactivePreviousEndDate: "2026-12-31",
        autoInactiveStrikeDate: "2026-08-20",
      }),
    ]);
  });
});
