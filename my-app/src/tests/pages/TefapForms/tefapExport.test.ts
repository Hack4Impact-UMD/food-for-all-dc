import { describe, expect, it, jest } from "@jest/globals";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import {
  ZIP_DOCUMENT_LIMIT,
  buildExport,
  manifestToCsv,
  submissionFileName,
  uniqueFileNames,
} from "../../../pages/TefapForms/tefapExport";
import type { TefapForm, TefapSubmission } from "../../../types/tefap-types";

const actor = { uid: "u1", name: "Casey", email: "casey@example.org" };

// jsdom's Blob has no arrayBuffer(), so read it the way a browser of that era would.
const blobBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const template = async (pageCount = 1): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) doc.addPage([612, 792]);
  return doc.save();
};

const form = (over: Partial<TefapForm> = {}): TefapForm =>
  ({
    id: "f1",
    name: "FY26",
    version: 1,
    status: "active",
    storagePath: "tefap-forms/f1/form.pdf",
    fileName: "form.pdf",
    fileSize: 100,
    pageCount: 1,
    certValidityMonths: 12,
    fields: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: actor,
    updatedBy: actor,
    ...over,
  }) as TefapForm;

const submission = (over: Partial<TefapSubmission> = {}): TefapSubmission =>
  ({
    id: "s1",
    clientId: "c1",
    clientName: "Jane Doe",
    formId: "f1",
    formName: "FY26",
    formVersion: 1,
    values: [],
    submittedAt: new Date("2026-03-04T12:00:00Z"),
    submittedBy: actor,
    certExpiresOn: "2027-03-04",
    ...over,
  }) as TefapSubmission;

const rowsOf = (count: number, formOverride?: TefapForm) =>
  Array.from({ length: count }, (_, index) => ({
    submission: submission({
      id: `s${index}`,
      clientId: `c${index}`,
      clientName: `Client ${index}`,
    }),
    form: formOverride ?? form(),
  }));

describe("submissionFileName", () => {
  // sanitizeFilename collapses whitespace but keeps spaces, matching how the
  // rest of the app names exports.
  it("names a file after the client, form, and date", () => {
    expect(submissionFileName(submission())).toBe("Jane Doe_FY26_2026-03-04.pdf");
  });

  it("strips characters that are illegal in a filename", () => {
    expect(submissionFileName(submission({ clientName: "A/B:C" }))).not.toMatch(/[/:]/);
  });

  it("falls back to the client id when no name was recorded", () => {
    expect(submissionFileName(submission({ clientName: "" }))).toContain("c1");
  });
});

describe("uniqueFileNames", () => {
  // A ZIP silently drops entries whose names collide, and two clients can share
  // a name.
  it("suffixes repeats before the extension", () => {
    expect(uniqueFileNames(["a.pdf", "a.pdf", "a.pdf"])).toEqual(["a.pdf", "a_2.pdf", "a_3.pdf"]);
  });

  it("leaves distinct names alone", () => {
    expect(uniqueFileNames(["a.pdf", "b.pdf"])).toEqual(["a.pdf", "b.pdf"]);
  });

  it("handles a name with no extension", () => {
    expect(uniqueFileNames(["report", "report"])).toEqual(["report", "report_2"]);
  });
});

describe("manifestToCsv", () => {
  it("writes a header and one row per document", () => {
    const csv = manifestToCsv([
      {
        client: "Jane Doe",
        clientId: "c1",
        form: "FY26",
        formVersion: 1,
        submittedAt: "2026-03-04",
        certExpiresOn: "2027-03-04",
        submittedBy: "Casey",
        fileName: "Jane Doe_FY26_2026-03-04.pdf",
        warnings: "",
      },
    ]);

    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("Client,Client ID,Form");
  });

  it("quotes a value containing a comma", () => {
    const csv = manifestToCsv([
      {
        client: "Doe, Jane",
        clientId: "c1",
        form: "FY26",
        formVersion: 1,
        submittedAt: "",
        certExpiresOn: "",
        submittedBy: "",
        fileName: "",
        warnings: "",
      },
    ]);

    expect(csv).toContain('"Doe, Jane"');
  });
});

describe("buildExport", () => {
  const loadTemplate = () => template();

  it("refuses an empty selection", async () => {
    await expect(buildExport({ rows: [], format: "merged", loadTemplate })).rejects.toThrow(
      "There are no completed forms to export."
    );
  });

  it("refuses a ZIP larger than the limit", async () => {
    await expect(
      buildExport({ rows: rowsOf(ZIP_DOCUMENT_LIMIT + 1), format: "zip", loadTemplate })
    ).rejects.toThrow(/limited to/);
  });

  it("allows a merged export well past the ZIP limit", async () => {
    const result = await buildExport({
      rows: rowsOf(ZIP_DOCUMENT_LIMIT + 1),
      format: "merged",
      loadTemplate,
    });

    expect(result.documentCount).toBe(ZIP_DOCUMENT_LIMIT + 1);
  }, 60000);

  it("merges one page per client into a single PDF", async () => {
    const result = await buildExport({ rows: rowsOf(3), format: "merged", loadTemplate });
    const merged = await PDFDocument.load(await blobBytes(result.blob));

    expect(merged.getPageCount()).toBe(3);
    expect(result.fileName).toMatch(/\.pdf$/);
  });

  it("keeps every page of a multi-page template", async () => {
    const result = await buildExport({
      rows: rowsOf(2),
      format: "merged",
      loadTemplate: () => template(2),
    });
    const merged = await PDFDocument.load(await blobBytes(result.blob));

    expect(merged.getPageCount()).toBe(4);
  });

  it("puts one file per client plus a manifest in a ZIP", async () => {
    const result = await buildExport({ rows: rowsOf(2), format: "zip", loadTemplate });
    const zip = await JSZip.loadAsync(await blobBytes(result.blob));

    expect(Object.keys(zip.files)).toHaveLength(3);
    expect(zip.files["manifest.csv"]).toBeDefined();
    expect(result.fileName).toMatch(/\.zip$/);
  });

  it("fetches each template once no matter how many documents use it", async () => {
    const spy = jest.fn(async () => template());

    await buildExport({ rows: rowsOf(5), format: "merged", loadTemplate: spy });

    // The caller's cache is what makes this cheap; the export must not defeat it
    // by asking for a different form object each time.
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it("reports progress for every document", async () => {
    const seen: number[] = [];

    await buildExport({
      rows: rowsOf(3),
      format: "merged",
      loadTemplate,
      onProgress: (progress) => seen.push(progress.completed),
    });

    expect(seen).toEqual([1, 2, 3]);
  });

  // One unusable record should not cost an admin the other several hundred.
  it("skips a document that cannot be rebuilt and records it in the manifest", async () => {
    let call = 0;
    const flaky = async () => {
      call += 1;
      if (call === 2) throw new Error("template gone");
      return template();
    };

    const result = await buildExport({ rows: rowsOf(3), format: "merged", loadTemplate: flaky });

    expect(result.documentCount).toBe(2);
    expect(result.manifest).toHaveLength(3);
    expect(result.manifest[1].warnings).toContain("NOT EXPORTED");
  });

  it("fails loudly when nothing at all could be rebuilt", async () => {
    await expect(
      buildExport({
        rows: rowsOf(2),
        format: "merged",
        loadTemplate: async () => {
          throw new Error("storage down");
        },
      })
    ).rejects.toThrow("None of the selected forms could be rebuilt.");
  });

  it("names the export after the chosen form", async () => {
    const result = await buildExport({
      rows: rowsOf(1),
      format: "merged",
      loadTemplate,
      label: "FY26 Income Certification",
    });

    expect(result.fileName).toContain("FY26");
  });
});
