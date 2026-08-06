import { describe, expect, it, jest } from "@jest/globals";
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
  it("does not rewrite global metadata when applying an existing tag", async () => {
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
      target: { value: "Delivery" },
    });
    fireEvent.click(await screen.findByRole("option", { name: "Delivery" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Tag" }));

    await waitFor(() => expect(handleTag).toHaveBeenCalledWith("Delivery"));
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
