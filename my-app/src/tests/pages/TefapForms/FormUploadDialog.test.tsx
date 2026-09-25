import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { TefapPdfInspection } from "../../../types/tefap-types";
import FormUploadDialog from "../../../pages/TefapForms/FormUploadDialog";

const mockInspectPdf = jest.fn<Promise<TefapPdfInspection>, unknown[]>();
const mockCreateForm = jest.fn<Promise<void>, unknown[]>();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock("../../../utils/tefapPdf", () => ({
  inspectPdf: (...args: unknown[]) => mockInspectPdf(...args),
  fillPdf: async () => ({ bytes: new Uint8Array([1, 2, 3]), warnings: [] }),
}));

jest.mock("../../../services/tefap-form-service", () => ({
  MAX_TEMPLATE_BYTES: 10 * 1024 * 1024,
  tefapFormService: {
    createForm: (...args: unknown[]) => mockCreateForm(...args),
  },
}));

jest.mock("../../../services/client-service", () => ({
  clientService: { getAllClients: async () => ({ clients: [] }) },
}));

jest.mock("../../../components/NotificationProvider", () => ({
  useNotifications: () => ({ showError: mockShowError, showSuccess: mockShowSuccess }),
}));

jest.mock("../../../pages/TefapForms/FieldMapper", () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (fields: []) => void }) => (
    <button onClick={() => onChange([])}>Remove mapped fields</button>
  ),
}));

const actor = { uid: "u1", name: "Admin", email: "admin@example.test" };
const widget = { page: 1, x: 100, y: 100, width: 10, height: 10 };
const cleanInspection: TefapPdfInspection = {
  pageCount: 1,
  pageSizes: [{ page: 1, width: 612, height: 792 }],
  acroFields: [{ name: "Recipient Name", type: "text", widgets: [widget] }],
  diagnostics: [],
};

const upload = async (inspection: TefapPdfInspection) => {
  mockInspectPdf.mockResolvedValue(inspection);
  const onSaved = jest.fn();
  const { container } = render(
    <FormUploadDialog actor={actor} onStepChange={jest.fn()} onSaved={onSaved} />
  );
  const file = new File(["test PDF"], "template.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(3) });
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });
  await screen.findByRole("button", { name: "Preview" });
  return { onSaved, file };
};

describe("FormUploadDialog warnings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateForm.mockResolvedValue(undefined);
    URL.createObjectURL = jest.fn(() => "blob:template-preview");
    URL.revokeObjectURL = jest.fn();
  });

  const cases: { title: string; inspection: TefapPdfInspection; detail: string }[] = [
    {
      title: "Check how many answers each question allows",
      inspection: {
        ...cleanInspection,
        acroFields: [{
          name: "undefined",
          type: "radio",
          options: ["No", "No_2"],
          widgets: [widget, { ...widget, y: 120 }],
        }],
        diagnostics: [{ code: "uninformative-name", fieldNames: ["undefined"], message: "Unclear" }],
      },
      detail: "PDF field to check: undefined: No, No_2",
    },
    {
      title: "Check boxes that share one answer",
      inspection: {
        ...cleanInspection,
        acroFields: [{ name: "Assistance", type: "checkbox", widgets: [widget, widget] }],
        diagnostics: [{ code: "shared-widgets", fieldNames: ["Assistance"], message: "Shared" }],
      },
      detail: "Affected fields: Assistance",
    },
    {
      title: "Check unclear PDF field names",
      inspection: {
        ...cleanInspection,
        acroFields: [{ name: "Text1", type: "text", widgets: [widget] }],
        diagnostics: [{ code: "uninformative-name", fieldNames: ["Text1"], message: "Unclear" }],
      },
      detail: "Affected fields: Text1",
    },
    {
      title: "This PDF is not fillable",
      inspection: {
        ...cleanInspection,
        acroFields: [],
        diagnostics: [{ code: "no-acroform-fields", fieldNames: [], message: "Flat PDF" }],
      },
      detail: "This PDF is not fillable",
    },
  ];

  it.each(cases)("shows '$title' through preview without blocking save", async ({ title, inspection, detail }) => {
    const { onSaved, file } = await upload(inspection);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(detail)).toBeTruthy();
    expect(screen.getByText(/Problems with the PDF must be fixed in the original file/)).toBeTruthy();
    expect(screen.getByText(/Changing labels here does not repair the PDF itself/)).toBeTruthy();
    expect(screen.getByText(/Warnings only. You can still upload and save./)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove mapped fields" }));
    expect(screen.getByText(title)).toBeTruthy();
    const preview = screen.getByRole("button", { name: "Preview" }) as HTMLButtonElement;
    expect(preview.disabled).toBe(false);
    fireEvent.click(preview);

    const save = await screen.findByRole("button", { name: "Save template" }) as HTMLButtonElement;
    expect(screen.getByText(title)).toBeTruthy();
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mockCreateForm).toHaveBeenCalledWith(expect.objectContaining({ file, name: "template" }), actor);
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it("does not warn for a clearly named text-only PDF", async () => {
    await upload(cleanInspection);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("asks users to compare allowed selections with the PDF instructions without declaring a defect", async () => {
    await upload(cases[0].inspection);
    expect(screen.getByText(/Some questions allow one answer; others allow several/)).toBeTruthy();
    expect(screen.getByText(/without changing a different question/)).toBeTruthy();
    expect(screen.getByText(/Ask whoever supplied the form to fix the original PDF/)).toBeTruthy();
    expect(screen.getByText(/This check does not mean the form is broken/)).toBeTruthy();
    expect(screen.getByText(cases[0].title).closest('[role="alert"]')?.className).toContain("MuiAlert-standardWarning");
    const details = screen.getByText("Details for the person fixing the form").closest("details")!;
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByText("Details for the person fixing the form"));
    expect(details.open).toBe(true);
    expect(screen.getByText(cases[0].detail)).toBeTruthy();
    expect(screen.getByText("The PDF allows one selection among these choices.")).toBeTruthy();
  });

  it("does not warn about unflagged single-choice options", async () => {
    await upload({
      ...cleanInspection,
      acroFields: [{
        name: "Preferred delivery time",
        type: "radio",
        options: ["Morning", "Afternoon", "Evening"],
        widgets: [widget, { ...widget, y: 120 }, { ...widget, y: 140 }],
      }],
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Warnings only/)).toBeNull();
  });

  it("recognizes independent boxes without treating multiple selections as a defect", async () => {
    await upload({
      ...cleanInspection,
      acroFields: [
        { name: "Rice", type: "checkbox", widgets: [widget] },
        { name: "Beans", type: "checkbox", widgets: [{ ...widget, y: 120 }] },
      ],
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lists only flagged choices when the PDF also contains unflagged choices", async () => {
    await upload({
      ...cases[0].inspection,
      acroFields: [
        ...cases[0].inspection.acroFields,
        { name: "Delivery time", type: "radio", options: ["Morning", "Evening"], widgets: [widget, { ...widget, y: 120 }] },
        { name: "Rice", type: "checkbox", widgets: [widget] },
        { name: "Beans", type: "checkbox", widgets: [{ ...widget, y: 140 }] },
      ],
    });
    expect(screen.getByText(cases[0].detail)).toBeTruthy();
    expect(screen.queryByText(/PDF field to check: Delivery time/)).toBeNull();
    expect(screen.queryByText(/PDF field to check: Rice/)).toBeNull();
    expect(screen.queryByText(/PDF field to check: Beans/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    await screen.findByRole("button", { name: "Save template" });
    expect(screen.getByText(cases[0].detail)).toBeTruthy();
    expect(screen.getAllByText(/PDF field to check:/)).toHaveLength(1);
  });

  it("does not add a choice warning when only a text field is flagged", async () => {
    await upload({
      ...cases[2].inspection,
      acroFields: [
        ...cases[2].inspection.acroFields,
        { name: "Delivery time", type: "radio", options: ["Morning", "Evening"], widgets: [widget, { ...widget, y: 120 }] },
      ],
    });
    expect(screen.getByText(cases[2].detail)).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText(cases[0].title)).toBeNull();
  });

  it("warns about boxes changing together without assuming they belong to different questions", async () => {
    await upload(cases[1].inspection);
    expect(screen.getByText(/If these boxes should be selected separately/)).toBeTruthy();
    expect(screen.getByText("The PDF makes 2 boxes change together.")).toBeTruthy();
    expect(screen.getByText(cases[1].title).closest('[role="alert"]')?.className).toContain("MuiAlert-standardWarning");
  });

  it("removes the previous PDF's warnings when a new file is chosen", async () => {
    await upload(cases[0].inspection);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    mockInspectPdf.mockResolvedValue(cleanInspection);
    const replacement = new File(["corrected PDF"], "corrected.pdf", { type: "application/pdf" });
    Object.defineProperty(replacement, "arrayBuffer", { value: async () => new ArrayBuffer(3) });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [replacement] },
    });
    await screen.findByRole("button", { name: "Preview" });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});