import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DeleteUserModal from "../DeleteUserModal";

describe("DeleteUserModal", () => {
  it("calls onDelete when delete is clicked", () => {
    const onDelete = jest.fn();
    render(
      <DeleteUserModal
        open={true}
        handleClose={jest.fn()}
        handleDelete={onDelete}
        userName="Test User"
      />
    );
    fireEvent.click(screen.getByText(/delete user/i));
    expect(onDelete).toHaveBeenCalled();
  });
});
