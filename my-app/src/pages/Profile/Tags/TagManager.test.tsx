import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TagManager from "./TagManager";

const mockSetDoc = jest.fn();
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
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  where: () => undefined,
  writeBatch: () => undefined,
}));

jest.mock("../../../auth/firebaseConfig", () => ({ db: {} }));

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
  });

  it("uses the saved spelling and skips metadata writes for an existing tag", async () => {
    const handleTag = jest.fn();

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
    fireEvent.click(screen.getByRole("button", { name: "Add Tag" }));

    await waitFor(() => expect(handleTag).toHaveBeenCalledWith("Delivery"));
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("saves every predefined color change when adding a new tag", async () => {
    const handleTag = jest.fn();

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

    await waitFor(() => expect(handleTag).toHaveBeenCalledWith("Urgent"));
    expect(mockSetDoc).toHaveBeenCalledWith(
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
    const handleTag = jest.fn();
    mockSetDoc.mockRejectedValue(new Error("permission denied") as never);

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
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(handleTag).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
