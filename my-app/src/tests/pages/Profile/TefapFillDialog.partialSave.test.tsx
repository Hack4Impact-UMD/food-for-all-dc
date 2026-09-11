import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { TefapForm } from "../../../types/tefap-types";

// Saving a TEFAP form is two writes: an append-only submission, then the
// client's certification date. When the second fails, the dialog keeps the
// submission id so a retry does not record the certification twice. These tests
// cover the consequence of holding that id: the answers behind it can no longer
// change, so the dialog must stop offering to edit them.

const mockCreateSubmission = jest.fn<Promise<{ id: string }>, unknown[]>();
const mockUpdateClient = jest.fn<Promise<void>, unknown[]>();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

const mockForm: TefapForm = {
  id: "form-1",
  name: "TEFAP 2026",
  version: 1,
  status: "active",
  storagePath: "tefap-forms/form-1/form.pdf",
  fileName: "form.pdf",
  fileSize: 1024,
  pageCount: 1,
  certValidityMonths: 12,
  fields: [
    {
      key: "f1",
      label: "Household size",
      type: "text",
      required: true,
      placement: { kind: "acroform", pdfFieldName: "household" },
      prefill: { source: "none" },
      order: 0,
    },
  ],
  createdAt: new Date("2026-01-01T00:00:00Z"),
  createdBy: { uid: "u1", name: "Admin", email: "admin@example.test" },
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  updatedBy: { uid: "u1", name: "Admin", email: "admin@example.test" },
};

jest.mock("file-saver", () => ({ saveAs: () => undefined }));

jest.mock("../../../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", email: "admin@example.test" }, name: "Admin" }),
}));

jest.mock("../../../components/NotificationProvider", () => ({
  useNotifications: () => ({ showError: mockShowError, showSuccess: mockShowSuccess }),
}));

jest.mock("../../../services/client-service", () => ({
  clientService: { updateClient: (...args: unknown[]) => mockUpdateClient(...args) },
}));

jest.mock("../../../utils/tefapPdf", () => ({
  fillPdf: async () => ({ bytes: new Uint8Array([1, 2, 3]), warnings: [] }),
}));

jest.mock("../../../services/tefap-form-service", () => ({
  tefapFormService: {
    listForms: async () => [mockForm],
    getTemplateBytes: async () => new Uint8Array([0]),
  },
}));

jest.mock("../../../services/tefap-submission-service", () => ({
  defaultCertExpiry: () => "2027-01-01",
  tefapSubmissionService: {
    listForClient: async () => [],
    createSubmission: (...args: unknown[]) => mockCreateSubmission(...args),
  },
}));

import TefapFillDialog from "../../../pages/Profile/components/TefapFillDialog";

const client = { firstName: "Ada", lastName: "Lovelace" } as never;

const onSubmitted = jest.fn();

const renderDialog = () =>
  render(
    <TefapFillDialog
      open
      clientId="c1"
      client={client}
      onClose={jest.fn()}
      onSubmitted={onSubmitted}
    />
  );

/** Drives the dialog to the review step with `answer` in its one text field. */
const reachReviewStep = async (answer: string) => {
  fireEvent.click(await screen.findByText("TEFAP 2026"));

  fireEvent.change(await screen.findByLabelText(/Household size/), { target: { value: answer } });

  fireEvent.click(screen.getByRole("button", { name: "Review" }));
  await screen.findByRole("button", { name: "Save" });
};

/** Saves once with the profile write rejecting, leaving the submission stranded. */
const saveWithFailingProfileWrite = async () => {
  mockUpdateClient.mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mockShowError).toHaveBeenCalled());
};

describe("TefapFillDialog partial save", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => "blob:preview");
    URL.revokeObjectURL = jest.fn();
    mockCreateSubmission.mockResolvedValue({ id: "sub-1" });
    mockUpdateClient.mockResolvedValue(undefined);
  });

  it("locks the answers once the submission is recorded and the profile write fails", async () => {
    renderDialog();
    await reachReviewStep("4");
    await saveWithFailingProfileWrite();

    // The submission is committed, so there is no route back to the answers.
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.getByText(/answers can no longer be changed/i)).toBeTruthy();
    expect((screen.getByLabelText(/Certification valid until/) as HTMLInputElement).disabled).toBe(
      true
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();

    // Nothing was reported as saved.
    expect(mockShowSuccess).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it("retries only the profile write and never records the submission twice", async () => {
    renderDialog();
    await reachReviewStep("4");
    await saveWithFailingProfileWrite();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mockShowSuccess).toHaveBeenCalledWith("TEFAP form saved."));

    expect(mockCreateSubmission).toHaveBeenCalledTimes(1);
    expect(mockUpdateClient).toHaveBeenCalledTimes(2);
    expect(mockUpdateClient).toHaveBeenLastCalledWith("c1", {
      tefapCert: true,
      tefapCertDate: "2027-01-01",
    });
  });

  it("reports the certification date that was actually recorded", async () => {
    renderDialog();
    await reachReviewStep("4");
    await saveWithFailingProfileWrite();

    const recorded = mockCreateSubmission.mock.calls[0][0] as {
      values: { field: string; value: string | boolean }[];
      certExpiresOn: string;
    };
    expect(recorded.values).toEqual([{ field: "f1", value: "4" }]);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(recorded.certExpiresOn));
  });
});
