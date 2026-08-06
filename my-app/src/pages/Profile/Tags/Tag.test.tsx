import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import Tag from "./Tag";

const renderTag = () => {
  const handleTag = jest.fn();
  const onEdit = jest.fn();

  render(
    <Tag
      text="Priority"
      color="#1976d2"
      handleTag={handleTag}
      onEdit={onEdit}
      setInnerPopup={jest.fn()}
      values={["Priority"]}
      createTag={false}
      deleteMode={false}
      setTagToDelete={jest.fn()}
    />
  );

  return { handleTag, onEdit };
};

describe("Tag actions", () => {
  it("offers editing before changing an existing tag", () => {
    const { onEdit } = renderTag();

    const tagButton = screen.getByRole("button", { name: "Manage Priority tag" });
    expect(tagButton.tagName).toBe("BUTTON");
    expect(tagButton.tabIndex).toBe(0);
    expect(tagButton.firstElementChild?.tagName).toBe("SPAN");

    fireEvent.click(tagButton);
    expect(screen.getByText("Manage Tag")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit tag" }));
    expect(onEdit).toHaveBeenCalledWith("Priority");
  });

  it("exposes the edit-tags control as a native button", () => {
    const setInnerPopup = jest.fn();

    render(
      <Tag
        text=""
        handleTag={jest.fn()}
        onEdit={jest.fn()}
        setInnerPopup={setInnerPopup}
        values={[]}
        createTag
        deleteMode={false}
        setTagToDelete={jest.fn()}
      />
    );

    const editTagsButton = screen.getByRole("button", { name: "Edit tags" });
    expect(editTagsButton.tagName).toBe("BUTTON");
    expect(editTagsButton.tabIndex).toBe(0);

    fireEvent.click(editTagsButton);
    expect(setInnerPopup).toHaveBeenCalledWith(true);
  });

  it("keeps removal behind the existing confirmation", () => {
    const { handleTag } = renderTag();

    fireEvent.click(screen.getByText("Priority"));
    fireEvent.click(screen.getByRole("button", { name: "Remove from profile" }));

    expect(screen.getByText("Remove Tag?")).toBeTruthy();
    expect(handleTag).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(handleTag).toHaveBeenCalledWith("Priority");
  });
});
