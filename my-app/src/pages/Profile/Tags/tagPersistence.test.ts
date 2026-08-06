import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  MAX_ATOMIC_TAG_RENAME_CLIENTS,
  saveTagEdit,
  TagRenameTooLargeError,
} from "./tagPersistence";

const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  doc: (_db: unknown, collectionName: string, id: string) => ({ collectionName, id }),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => args,
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  where: (...args: unknown[]) => args,
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

const buildOptions = () => ({
  db: {} as never,
  tags: ["Delivery", "Priority"],
  tagColors: { Delivery: "#257e68", Priority: "#1976d2" },
  tagColorPalette: ["#257e68", "#1976d2"],
  oldTag: "Priority",
  newTag: "Urgent",
  newColor: "#c2185b",
});

describe("saveTagEdit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      set: mockBatchSet,
      commit: mockBatchCommit,
    } as never);
    mockBatchCommit.mockResolvedValue(undefined as never);
    mockSetDoc.mockResolvedValue(undefined as never);
  });

  it("atomically renames every client tag together with the master metadata", async () => {
    const clientRef = { id: "client-1" };
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          ref: clientRef,
          data: () => ({ tags: ["Priority", "Delivery"] }),
        },
      ],
    } as never);

    await expect(saveTagEdit(buildOptions())).resolves.toEqual({
      tags: ["Delivery", "Urgent"],
      tagColors: { Delivery: "#257e68", Urgent: "#c2185b" },
    });

    expect(mockBatchUpdate).toHaveBeenCalledWith(clientRef, {
      tags: ["Urgent", "Delivery"],
    });
    expect(mockBatchSet).toHaveBeenCalledWith(
      { collectionName: "tags", id: "oGuiR2dQQeOBXHCkhDeX" },
      {
        tags: ["Delivery", "Urgent"],
        tagColors: { Delivery: "#257e68", Urgent: "#c2185b" },
        tagColorPalette: ["#257e68", "#1976d2"],
      },
      { merge: true }
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("refuses an oversized rename before creating any writes", async () => {
    mockGetDocs.mockResolvedValue({
      docs: Array.from({ length: MAX_ATOMIC_TAG_RENAME_CLIENTS + 1 }, (_, index) => ({
        ref: { id: `client-${index}` },
        data: () => ({ tags: ["Priority"] }),
      })),
    } as never);

    await expect(saveTagEdit(buildOptions())).rejects.toBeInstanceOf(TagRenameTooLargeError);

    expect(mockWriteBatch).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("updates metadata directly when only the tag color changes", async () => {
    await saveTagEdit({ ...buildOptions(), newTag: "Priority" });

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });
});
