import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { TefapFormField } from "../types/tefap-types";

const mockSetDoc = jest.fn<any, any>();
const mockUpdateDoc = jest.fn<any, any>();
const mockGetDoc = jest.fn<any, any>();
const mockGetDocs = jest.fn<any, any>();
const mockGetCountFromServer = jest.fn<any, any>();
const mockUploadBytes = jest.fn<any, any>();
const mockDeleteObject = jest.fn<any, any>();
const mockGetDownloadURL = jest.fn<any, any>();
const mockBatchSet = jest.fn<any, any>();
const mockBatchUpdate = jest.fn<any, any>();
const mockBatchCommit = jest.fn<any, any>();
const mockWriteBatch = jest.fn<any, any>(() => ({
  set: mockBatchSet,
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));

let mockDocIdCounter = 0;

jest.mock("../auth/firebaseConfig", () => ({
  auth: {
    get currentUser() {
      return (globalThis as any).__tefapTestUser;
    },
  },
  db: {},
}));

jest.mock("./firebase-storage", () => ({ storage: {} }));

jest.mock("../config/dataSources", () => ({
  __esModule: true,
  default: {
    firebase: {
      tefapFormsCollection: "tefapForms",
      tefapSubmissionsCollection: "tefapSubmissions",
    },
    storage: { tefapFormsPath: "tefap-forms" },
  },
}));

jest.mock("firebase/firestore", () => ({
  collection: (..._args: unknown[]) => ({ mocked: "collection" }),
  // doc(collection) mints a new id; doc(db, path, id) addresses an existing one.
  doc: (...args: unknown[]) =>
    args.length > 1 ? { id: args[2] as string } : { id: `generated-${++mockDocIdCounter}` },
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  query: (...args: unknown[]) => ({ mocked: "query", args }),
  where: (...args: unknown[]) => ({ mocked: "where", args }),
  orderBy: (...args: unknown[]) => ({ mocked: "orderBy", args }),
  serverTimestamp: () => ({ mocked: "serverTimestamp" }),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

jest.mock("firebase/storage", () => ({
  ref: (..._args: unknown[]) => ({ mocked: "ref" }),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

import { MAX_TEMPLATE_BYTES, sanitizeStorageName, tefapFormService } from "./tefap-form-service";

const actor = { uid: "u1", name: "Casey", email: "casey@example.org" };

const field = (key: string): TefapFormField => ({
  key,
  label: key,
  type: "text",
  required: false,
  placement: { kind: "acroform", pdfFieldName: key },
  prefill: { source: "none" },
  order: 0,
});

const fakeFile = (size = 1000) => ({ size }) as File;

const existingForm = (over: Record<string, unknown> = {}) => ({
  exists: () => true,
  id: "f1",
  data: () => ({
    name: "FY26",
    version: 1,
    status: "active",
    storagePath: "tefap-forms/f1/form.pdf",
    fileName: "form.pdf",
    fileSize: 1000,
    pageCount: 2,
    certValidityMonths: 12,
    fields: [field("a")],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: actor,
    updatedBy: actor,
    ...over,
  }),
});

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as any).__tefapTestUser = { uid: "staff-1" };
  tefapFormService.clearTemplateCache();
  mockWriteBatch.mockImplementation(() => ({
    set: mockBatchSet,
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  }));
  mockBatchCommit.mockResolvedValue(undefined);
  mockUploadBytes.mockResolvedValue(undefined);
  mockSetDoc.mockResolvedValue(undefined);
  mockUpdateDoc.mockResolvedValue(undefined);
  mockDeleteObject.mockResolvedValue(undefined);
  mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });
});

describe("sanitizeStorageName", () => {
  it("replaces characters that are unsafe in a storage path", () => {
    expect(sanitizeStorageName("FY26 DC SDI Form Fillable.pdf")).toBe(
      "FY26_DC_SDI_Form_Fillable.pdf"
    );
  });

  it("collapses runs of separators and trims leading punctuation", () => {
    expect(sanitizeStorageName("../..//weird##name.pdf")).toBe("weird_name.pdf");
  });

  it("falls back to a default when nothing usable remains", () => {
    expect(sanitizeStorageName("###")).toBe("form.pdf");
  });
});

describe("createForm", () => {
  it("requires a name", async () => {
    await expect(
      tefapFormService.createForm(
        { name: "  ", file: fakeFile(), fileName: "f.pdf", pageCount: 1, fields: [] },
        actor
      )
    ).rejects.toThrow("Give the form a name before saving it.");
  });

  it("rejects a file over the size limit", async () => {
    await expect(
      tefapFormService.createForm(
        {
          name: "FY26",
          file: fakeFile(MAX_TEMPLATE_BYTES + 1),
          fileName: "f.pdf",
          pageCount: 1,
          fields: [],
        },
        actor
      )
    ).rejects.toThrow("larger than");

    expect(mockUploadBytes).not.toHaveBeenCalled();
  });

  it("stores the PDF under a path namespaced by the new form id", async () => {
    const created = await tefapFormService.createForm(
      {
        name: "FY26",
        file: fakeFile(),
        fileName: "My Form.pdf",
        pageCount: 2,
        fields: [field("a")],
      },
      actor
    );

    const written = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(written.storagePath).toBe(`tefap-forms/${created.id}/My_Form.pdf`);
    expect(written.version).toBe(1);
    expect(written.status).toBe("active");
  });

  it("omits undefined optional field properties before writing to Firestore", async () => {
    const mappedField = {
      ...field("choice"),
      type: "radio" as const,
      options: ["Yes", "No"],
      radioOptions: undefined,
      prefill: { source: "none" as const, clientKey: undefined },
    };

    await tefapFormService.createForm(
      {
        name: "FY26",
        file: fakeFile(),
        fileName: "f.pdf",
        pageCount: 1,
        fields: [mappedField],
      },
      actor
    );

    const written = mockSetDoc.mock.calls[0][1] as { fields: Record<string, unknown>[] };
    expect(written.fields[0]).not.toHaveProperty("radioOptions");
    expect(written.fields[0].prefill).toEqual({ source: "none" });
  });

  // An uploaded PDF that no document points at is invisible and unreclaimable.
  it("deletes the uploaded PDF when the document write fails", async () => {
    mockSetDoc.mockRejectedValue(new Error("permission denied"));

    await expect(
      tefapFormService.createForm(
        { name: "FY26", file: fakeFile(), fileName: "f.pdf", pageCount: 1, fields: [] },
        actor
      )
    ).rejects.toThrow("Failed to save the TEFAP form.");

    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
  });

  it("does not write a document when the upload itself fails", async () => {
    mockUploadBytes.mockRejectedValue(new Error("network"));

    await expect(
      tefapFormService.createForm(
        { name: "FY26", file: fakeFile(), fileName: "f.pdf", pageCount: 1, fields: [] },
        actor
      )
    ).rejects.toThrow("Failed to upload the PDF.");

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("explains when Storage rules reject the upload", async () => {
    mockUploadBytes.mockRejectedValue({ code: "storage/unauthorized" });

    await expect(
      tefapFormService.createForm(
        { name: "FY26", file: fakeFile(), fileName: "f.pdf", pageCount: 1, fields: [] },
        actor
      )
    ).rejects.toThrow("Confirm that the TEFAP Storage rules are deployed");

    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

describe("saveFieldMap", () => {
  beforeEach(() => {
    mockGetDoc.mockResolvedValue(existingForm());
  });

  it("edits in place while the template has no submissions", async () => {
    const result = await tefapFormService.saveFieldMap("f1", [field("b")], actor);

    expect(result.createdNewVersion).toBe(false);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // Changing where a value lands would alter documents clients already signed,
  // so an edit becomes a new version and the old one is archived intact.
  it("creates a new version once submissions reference the template", async () => {
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 3 }) });

    const result = await tefapFormService.saveFieldMap("f1", [field("b")], actor);

    expect(result.createdNewVersion).toBe(true);
    expect(result.form.version).toBe(2);
    expect(result.form.id).not.toBe("f1");
  });

  it("points the new version at the same PDF rather than re-uploading", async () => {
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 1 }) });

    const result = await tefapFormService.saveFieldMap("f1", [field("b")], actor);

    expect(result.form.storagePath).toBe("tefap-forms/f1/form.pdf");
    expect(mockUploadBytes).not.toHaveBeenCalled();
  });

  it("archives the superseded version", async () => {
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 1 }) });

    await tefapFormService.saveFieldMap("f1", [field("b")], actor);

    const archived = mockBatchUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(archived.status).toBe("archived");
  });

  // Two separate writes would leave both versions active if the second failed,
  // while telling the caller nothing had been saved at all.
  it("writes the new version and archives the old one in one batch", async () => {
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 1 }) });

    await tefapFormService.saveFieldMap("f1", [field("b")], actor);

    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("reports a failed version write without committing a partial one", async () => {
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 1 }) });
    mockBatchCommit.mockRejectedValueOnce(new Error("offline"));

    await expect(tefapFormService.saveFieldMap("f1", [field("b")], actor)).rejects.toThrow(
      "Failed to save the new form version."
    );
  });

  it("fails clearly when the form has been removed", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    await expect(tefapFormService.saveFieldMap("gone", [], actor)).rejects.toThrow(
      "That TEFAP form no longer exists."
    );
  });
});

describe("listForms", () => {
  it("hides archived forms unless asked for them", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: "a", data: () => ({ name: "Active", status: "active" }) },
        { id: "b", data: () => ({ name: "Old", status: "archived" }) },
      ],
    });

    expect((await tefapFormService.listForms()).map((f) => f.id)).toEqual(["a"]);
    expect((await tefapFormService.listForms(true)).map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("treats a form with no stored status as active", async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: "a", data: () => ({ name: "A" }) }] });

    expect(await tefapFormService.listForms()).toHaveLength(1);
  });
});

describe("getTemplateBytes", () => {
  const form = { id: "f1", storagePath: "tefap-forms/f1/form.pdf" };

  beforeEach(() => {
    mockGetDownloadURL.mockResolvedValue("https://example.test/form.pdf");
    global.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    })) as any;
  });

  // A bulk export fills one template hundreds of times; re-downloading it per
  // client would dominate the run.
  it("downloads a template once and serves later calls from cache", async () => {
    await tefapFormService.getTemplateBytes(form);
    await tefapFormService.getTemplateBytes(form);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("downloads again after the cache is cleared", async () => {
    await tefapFormService.getTemplateBytes(form);
    tefapFormService.clearTemplateCache();
    await tefapFormService.getTemplateBytes(form);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not share cached template bytes between signed-in users", async () => {
    await tefapFormService.getTemplateBytes(form);
    (globalThis as any).__tefapTestUser = { uid: "staff-2" };
    await tefapFormService.getTemplateBytes(form);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not serve cached template bytes after sign-out", async () => {
    await tefapFormService.getTemplateBytes(form);
    (globalThis as any).__tefapTestUser = null;

    await expect(tefapFormService.getTemplateBytes(form)).rejects.toThrow(
      "Sign in before opening a TEFAP template."
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // formatServiceError passes an existing ServiceError through untouched, so the
  // status code survives to the user instead of a generic message.
  it("surfaces the HTTP status when the download is rejected", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 403 })) as any;

    await expect(tefapFormService.getTemplateBytes(form)).rejects.toThrow(
      "Downloading the form PDF failed (403)."
    );
  });

  it("wraps an unexpected failure in a friendly message", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as any;

    await expect(tefapFormService.getTemplateBytes(form)).rejects.toThrow(
      "Failed to download the form PDF."
    );
  });

  it("does not cache a template whose download failed", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500 })) as any;
    await expect(tefapFormService.getTemplateBytes(form)).rejects.toThrow();

    global.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([9]).buffer,
    })) as any;

    expect(await tefapFormService.getTemplateBytes(form)).toEqual(new Uint8Array([9]));
  });
});
