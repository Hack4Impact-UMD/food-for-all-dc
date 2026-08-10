import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TagManager from "./TagManager";

const mockSetDoc = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockTagColors = { Delivery: "#257e68" };
const mockTagColorPalette = [
  "#257e68",
  "#1976d2",
  "#7b1fa2",
  "#c2185b",
  "#d84315",
  "#f9a825",
  "#546e7a",
  "#5d4037",
];

jest.mock("firebase/firestore", () => ({
  collection: () => undefined,
  doc: () => ({ id: "tags-document" }),
  getDoc: () => undefined,
  getDocs: () => undefined,
  query: () => undefined,
  serverTimestamp: () => ({ _methodName: "serverTimestamp" }),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  where: () => undefined,
  writeBatch: () => ({
    set: (...args: unknown[]) => mockBatchSet(...args),
    update: (...args: unknown[]) => mockBatchUpdate(...args),
    commit: (...args: unknown[]) => mockBatchCommit(...args),
  }),
}));

jest.mock("../../../auth/firebaseConfig", () => ({ db: {} }));

jest.mock("../../../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { uid: "staff-1", email: "staff@example.com", displayName: "Staff Member" },
    name: "Staff Member",
  }),
}));

jest.mock("../../../context/TagColorContext", () => ({
  useTagColors: () => mockTagColors,
  useTagColorPalette: () => mockTagColorPalette,
}));

jest.mock("../../../context/ClientDataContext", () => ({
  useClientData: () => ({ renameClientTag: () => undefined }),
}));

describe("TagManager", () => {
  beforeEach(() => {
    mockSetDoc.mockReset();
    mockSetDoc.mockResolvedValue(undefined as never);
    mockBatchSet.mockReset();
    mockBatchUpdate.mockReset();
    mockBatchCommit.mockReset();
    mockBatchCommit.mockResolvedValue(undefined as never);
  });

  it("uses the saved spelling and persists palette edits for an existing tag", async () => {
    const handleTag = jest.fn((_tag: string, _options?: { persist?: boolean }) => undefined);

    render(
      <TagManager
        allTags={["Delivery"]}
        values={[]}
        handleTag={handleTag}
        setInnerPopup={jest.fn()}
        deleteMode={false}
        setTagToDelete={jest.fn()}
        clientUid="client-1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit tags" }));
    fireEvent.change(screen.getByLabelText("Select tag or type new tag"), {
      target: { value: "delivery" },
    });
    fireEvent.keyDown(screen.getByLabelText("Select tag or type new tag"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Select palette color 2" }));
    fireEvent.change(screen.getByLabelText("Custom tag color"), {
      target: { value: "#222222" },
    });
    expect(screen.getByText("delivery").getAttribute("class")).toContain("MuiChip-label");
    expect(
      getComputedStyle(screen.getByText("delivery").closest(".MuiChip-root") as HTMLElement)
        .backgroundColor
    ).toBe("rgb(34, 34, 34)");
    fireEvent.click(screen.getByRole("button", { name: "Add Tag" }));

    await waitFor(() => expect(handleTag).toHaveBeenCalledWith("Delivery", { persist: false }));
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockBatchSet).toHaveBeenLastCalledWith(
      { id: "tags-document" },
      {
        tags: ["Delivery"],
        tagColors: { Delivery: "#257e68" },
        tagColorPalette: [
          "#257e68",
          "#222222",
          "#7b1fa2",
          "#c2185b",
          "#d84315",
          "#f9a825",
          "#546e7a",
          "#5d4037",
        ],
      },
      { merge: true }
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("saves every predefined color change when adding a new tag", async () => {
    const handleTag = jest.fn((_tag: string, _options?: { persist?: boolean }) => undefined);

    render(
      <TagManager
        allTags={["Delivery"]}
        values={[]}
        handleTag={handleTag}
        setInnerPopup={jest.fn()}
        deleteMode={false}
        setTagToDelete={jest.fn()}
        clientUid="client-1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit tags" }));
    fireEvent.change(screen.getByLabelText("Select tag or type new tag"), {
      target: { value: "Urgent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Select palette color 1" }));
    fireEvent.change(screen.getByLabelText("Custom tag color"), {
      target: { value: "#111111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Select palette color 2" }));
    fireEvent.change(screen.getByLabelText("Custom tag color"), {
      target: { value: "#222222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Tag" }));

    await waitFor(() => expect(handleTag).toHaveBeenCalledWith("Urgent", { persist: false }));
    expect(mockBatchSet).toHaveBeenLastCalledWith(
      { id: "tags-document" },
      {
        tags: ["Delivery", "Urgent"],
        tagColors: { Delivery: "#257e68", Urgent: "#222222" },
        tagColorPalette: [
          "#111111",
          "#222222",
          "#7b1fa2",
          "#c2185b",
          "#d84315",
          "#f9a825",
          "#546e7a",
          "#5d4037",
        ],
      },
      { merge: true }
    );
  });

  it("does not update the client when new master metadata fails to save", async () => {
    const handleTag = jest.fn((_tag: string, _options?: { persist?: boolean }) => undefined);
    mockBatchCommit.mockRejectedValue(new Error("permission denied") as never);

    render(
      <TagManager
        allTags={["Delivery"]}
        values={[]}
        handleTag={handleTag}
        setInnerPopup={jest.fn()}
        deleteMode={false}
        setTagToDelete={jest.fn()}
        clientUid="client-1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit tags" }));
    fireEvent.change(screen.getByLabelText("Select tag or type new tag"), {
      target: { value: "Urgent" },
    });
    fireEvent.keyDown(screen.getByLabelText("Select tag or type new tag"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Add Tag" }));

    expect(await screen.findByText("The tag could not be added. Please try again.")).toBeTruthy();
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(handleTag).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
