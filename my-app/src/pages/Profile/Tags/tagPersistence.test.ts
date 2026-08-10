import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  assignTagToClient,
  deleteTagGlobally,
  MAX_ATOMIC_TAG_CLIENTS,
  MAX_ATOMIC_TAG_RENAME_CLIENTS,
  removeTagMetadataIfUnused,
  saveTagEdit,
  TagDeleteTooLargeError,
  TagRenameTooLargeError,
} from "./tagPersistence";

const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  doc: (_db: unknown, collectionName: string, id: string) => ({ collectionName, id }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
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
  auditMetadata: {
    updatedAt: { _methodName: "serverTimestamp" } as never,
    updatedBy: { uid: "staff-1", name: "Staff Member" },
  },
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
      updatedAt: { _methodName: "serverTimestamp" },
      updatedBy: { uid: "staff-1", name: "Staff Member" },
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
    await saveTagEdit({
      ...buildOptions(),
      newTag: "Priority",
      tagColorPalette: ["#111111", "#222222"],
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalledWith(
      { collectionName: "tags", id: "oGuiR2dQQeOBXHCkhDeX" },
      {
        tags: ["Delivery", "Priority"],
        tagColors: { Delivery: "#257e68", Priority: "#c2185b" },
        tagColorPalette: ["#111111", "#222222"],
      },
      { merge: true }
    );
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });
});

describe("tag assignment and deletion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      set: mockBatchSet,
      commit: mockBatchCommit,
    } as never);
    mockBatchCommit.mockResolvedValue(undefined as never);
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        tags: ["Delivery", "Priority"],
        tagColors: { Delivery: "#257e68", Priority: "#1976d2" },
      }),
    } as never);
  });

  it("assigns a tag to the client together with its master metadata", async () => {
    await assignTagToClient({
      db: {} as never,
      clientUid: "client-1",
      clientTags: ["Delivery"],
      tag: "Priority",
      metadata: {
        tags: ["Delivery", "Priority"],
        tagColors: { Delivery: "#257e68", Priority: "#1976d2" },
      },
      tagColorPalette: ["#257e68", "#1976d2"],
      auditMetadata: buildOptions().auditMetadata,
    });

    expect(mockBatchSet).toHaveBeenNthCalledWith(
      1,
      { collectionName: "client-profile2", id: "client-1" },
      {
        tags: ["Delivery", "Priority"],
        ...buildOptions().auditMetadata,
      },
      { merge: true }
    );
    expect(mockBatchSet).toHaveBeenNthCalledWith(
      2,
      { collectionName: "tags", id: "oGuiR2dQQeOBXHCkhDeX" },
      {
        tags: ["Delivery", "Priority"],
        tagColors: { Delivery: "#257e68", Priority: "#1976d2" },
        tagColorPalette: ["#257e68", "#1976d2"],
      },
      { merge: true }
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("deletes a tag from clients and master metadata in one batch", async () => {
    const clientRef = { id: "client-1" };
    mockGetDocs.mockResolvedValue({
      docs: [{ ref: clientRef, data: () => ({ tags: ["Delivery", "Priority"] }) }],
    } as never);

    await expect(
      deleteTagGlobally({
        db: {} as never,
        tag: "Priority",
        tags: ["Delivery"],
        tagColors: { Delivery: "#257e68" },
        auditMetadata: buildOptions().auditMetadata,
      })
    ).resolves.toEqual({
      tags: ["Delivery"],
      tagColors: { Delivery: "#257e68" },
    });

    expect(mockBatchUpdate).toHaveBeenCalledWith(clientRef, {
      tags: ["Delivery"],
      ...buildOptions().auditMetadata,
    });
    expect(mockBatchSet).toHaveBeenCalledWith(
      { collectionName: "tags", id: "oGuiR2dQQeOBXHCkhDeX" },
      { tags: ["Delivery"], tagColors: { Delivery: "#257e68" } },
      { merge: true }
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("refuses an oversized global delete before creating any writes", async () => {
    mockGetDocs.mockResolvedValue({
      docs: Array.from({ length: MAX_ATOMIC_TAG_CLIENTS + 1 }, () => ({
        ref: {},
        data: () => ({ tags: ["Priority"] }),
      })),
    } as never);

    await expect(
      deleteTagGlobally({
        db: {} as never,
        tag: "Priority",
        tags: ["Priority"],
        tagColors: { Priority: "#1976d2" },
        auditMetadata: buildOptions().auditMetadata,
      })
    ).rejects.toBeInstanceOf(TagDeleteTooLargeError);

    expect(mockWriteBatch).not.toHaveBeenCalled();
  });
});

describe("removeTagMetadataIfUnused", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetDoc.mockResolvedValue(undefined as never);
  });

  it("keeps master metadata while another profile still uses the tag", async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: "client-2" }], empty: false } as never);

    await expect(removeTagMetadataIfUnused({} as never, "Priority")).resolves.toBeNull();

    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("removes the tag name and color after its last profile usage is removed", async () => {
    mockGetDocs.mockResolvedValue({ docs: [], empty: true } as never);
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        tags: ["Delivery", "Priority"],
        tagColors: { Delivery: "#257e68", Priority: "#1976d2" },
      }),
    } as never);

    await expect(removeTagMetadataIfUnused({} as never, "Priority")).resolves.toEqual({
      tags: ["Delivery"],
      tagColors: { Delivery: "#257e68" },
    });
    expect(mockSetDoc).toHaveBeenCalledWith(
      { collectionName: "tags", id: "oGuiR2dQQeOBXHCkhDeX" },
      {
        tags: ["Delivery"],
        tagColors: { Delivery: "#257e68" },
      },
      { merge: true }
    );
  });
});
