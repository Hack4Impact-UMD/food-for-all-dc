import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import EditUserModal from "./EditUserModal";
import { AuthUserRow, UserType } from "../../types";
import { PHONE_FORMAT_EXAMPLES } from "./PhoneFormatInfo";

const mockUpdateUser = jest.fn<Promise<void>, unknown[]>();

jest.mock("../../services/AuthUserService", () => ({
  authUserService: {
    updateUser: (...args: unknown[]) => mockUpdateUser(...args),
  },
}));

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ userRole: "Admin" }),
}));

const user: AuthUserRow = {
  id: "user-1",
  uid: "user-1",
  name: "Original Name",
  email: "locked@example.com",
  phone: "202-555-0100",
  role: UserType.Manager,
};

describe("EditUserModal", () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockUpdateUser.mockResolvedValue(undefined);
  });

  it("locks credentials and submits only editable user fields", async () => {
    const handleClose = jest.fn();
    render(<EditUserModal open user={user} handleClose={handleClose} />);

    const emailInput = screen.getByLabelText("Email Address") as HTMLInputElement;
    expect(emailInput.disabled).toBe(true);
    expect(screen.queryByLabelText("Password")).toBeNull();

    fireEvent.mouseOver(screen.getByRole("button", { name: "Show allowed phone number formats" }));
    expect(await screen.findByText("Allowed formats:")).toBeTruthy();
    PHONE_FORMAT_EXAMPLES.forEach((example) => {
      expect(screen.getByText(example)).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Full Name/), {
      target: { value: "Updated Name" },
    });
    fireEvent.change(screen.getByLabelText("Phone Number (Optional)"), {
      target: { value: "2025550199" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith("user-1", {
        name: "Updated Name",
        phone: "(202) 555-0199",
        role: UserType.Manager,
      });
    });

    const submittedFields = mockUpdateUser.mock.calls[0][1] as Record<string, unknown>;
    expect(submittedFields.email).toBeUndefined();
    expect(submittedFields.password).toBeUndefined();
    expect(handleClose).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated Name",
        email: "locked@example.com",
        phone: "(202) 555-0199",
      })
    );
  });
});
