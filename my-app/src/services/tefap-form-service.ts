// TEFAP template registry: the unfilled PDF in Storage plus the field map that
// describes how to fill it.
//
// Templates are versioned and immutable once a submission references them.
// TEFAP forms change structurally between fiscal years - FY24 carried an income
// eligibility table that FY26 replaced with self-certified income and benefit
// questions - so regenerating an old submission against a newer template would
// produce a document that does not match what the client actually signed.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db } from "../auth/firebaseConfig";
import { storage } from "./firebase-storage";
import dataSources from "../config/dataSources";
import { retry } from "../utils/retry";
import { ServiceError, formatServiceError } from "../utils/serviceError";
import { validateTefapForm } from "../utils/firestoreValidation";
import { toDateOrNull } from "../utils/dates";
import type { TefapActor, TefapForm, TefapFormField, TefapFormStatus } from "../types/tefap-types";

/** Largest template we accept. Blank government forms are well under this. */
export const MAX_TEMPLATE_BYTES = 15 * 1024 * 1024;

const DEFAULT_CERT_VALIDITY_MONTHS = 12;

const fieldsForStorage = (fields: TefapFormField[]): TefapFormField[] =>
  JSON.parse(JSON.stringify(fields)) as TefapFormField[];

const formatTemplateUploadError = (error: unknown): ServiceError => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  if (code === "storage/unauthorized") {
    return new ServiceError(
      "Firebase Storage denied the upload. Confirm that the TEFAP Storage rules are deployed " +
        'and your user record has the Admin role.',
      code,
      error
    );
  }
  if (code === "storage/bucket-not-found") {
    return new ServiceError(
      "The configured Firebase Storage bucket was not found.",
      code,
      error
    );
  }
  if (code === "storage/retry-limit-exceeded") {
    return new ServiceError(
      "The PDF upload timed out. Check your connection and try again.",
      code,
      error
    );
  }

  return formatServiceError(error, "Failed to upload the PDF.");
};

export interface CreateTefapFormInput {
  name: string;
  description?: string;
  /** The unfilled PDF. */
  file: File | Blob;
  fileName: string;
  pageCount: number;
  fields: TefapFormField[];
  certValidityMonths?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}

const toDate = (value: unknown): Date => toDateOrNull(value) ?? new Date();

const mapForm = (id: string, raw: Record<string, unknown>): TefapForm => ({
  id,
  name: (raw.name as string) ?? "",
  description: (raw.description as string) ?? undefined,
  version: (raw.version as number) ?? 1,
  status: (raw.status as TefapFormStatus) ?? "active",
  storagePath: (raw.storagePath as string) ?? "",
  fileName: (raw.fileName as string) ?? "",
  fileSize: (raw.fileSize as number) ?? 0,
  pageCount: (raw.pageCount as number) ?? 1,
  effectiveFrom: (raw.effectiveFrom as string) ?? undefined,
  effectiveTo: (raw.effectiveTo as string) ?? undefined,
  certValidityMonths: (raw.certValidityMonths as number) ?? DEFAULT_CERT_VALIDITY_MONTHS,
  fields: Array.isArray(raw.fields) ? (raw.fields as TefapFormField[]) : [],
  createdAt: toDate(raw.createdAt),
  createdBy: (raw.createdBy as TefapActor) ?? { uid: "", name: "", email: "" },
  updatedAt: toDate(raw.updatedAt),
  updatedBy: (raw.updatedBy as TefapActor) ?? { uid: "", name: "", email: "" },
});

/**
 * TEFAP Form Service - template upload, versioning, and field mapping.
 */
class TefapFormService {
  private static instance: TefapFormService;
  private db = db;
  private formsCollection = dataSources.firebase.tefapFormsCollection;
  private submissionsCollection = dataSources.firebase.tefapSubmissionsCollection;
  private storageRoot = dataSources.storage.tefapFormsPath;

  /**
   * Template bytes keyed by form id. A bulk export fills hundreds of documents
   * from one template, and re-downloading it per client would dominate the run.
   * Safe to hold indefinitely because templates are immutable.
   */
  private templateCache = new Map<string, Uint8Array>();

  private constructor() {
    // Intentionally empty - initialization happens with class properties.
  }

  public static getInstance(): TefapFormService {
    if (!TefapFormService.instance) {
      TefapFormService.instance = new TefapFormService();
    }
    return TefapFormService.instance;
  }

  /** Every template, newest first. Archived ones are excluded by default. */
  public async listForms(includeArchived = false): Promise<TefapForm[]> {
    try {
      return await retry(async () => {
        const snapshot = await getDocs(
          query(collection(this.db, this.formsCollection), orderBy("createdAt", "desc"))
        );

        return snapshot.docs
          .map((entry) => mapForm(entry.id, entry.data()))
          .filter((form) => includeArchived || form.status === "active");
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to load TEFAP forms.");
    }
  }

  public async getForm(formId: string): Promise<TefapForm | null> {
    try {
      const snapshot = await retry(() => getDoc(doc(this.db, this.formsCollection, formId)));
      if (!snapshot.exists()) return null;

      return mapForm(snapshot.id, snapshot.data());
    } catch (error) {
      throw formatServiceError(error, "Failed to load the TEFAP form.");
    }
  }

  /**
   * Uploads a new template and registers it.
   *
   * Always creates a new document. Replacing an existing template in place
   * would silently change what past submissions regenerate as.
   */
  public async createForm(input: CreateTefapFormInput, actor: TefapActor): Promise<TefapForm> {
    if (!input.name.trim()) {
      throw new ServiceError("Give the form a name before saving it.", "tefap/missing-name");
    }
    if (input.file.size > MAX_TEMPLATE_BYTES) {
      throw new ServiceError(
        `That PDF is larger than the ${Math.round(MAX_TEMPLATE_BYTES / 1024 / 1024)}MB limit.`,
        "tefap/file-too-large"
      );
    }

    const formRef = doc(collection(this.db, this.formsCollection));
    const storagePath = `${this.storageRoot}/${formRef.id}/${sanitizeStorageName(input.fileName)}`;

    try {
      await uploadBytes(ref(storage, storagePath), input.file, {
        contentType: "application/pdf",
      });
    } catch (error) {
      throw formatTemplateUploadError(error);
    }

    const record = {
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      version: 1,
      status: "active" as TefapFormStatus,
      storagePath,
      fileName: input.fileName,
      fileSize: input.file.size,
      pageCount: input.pageCount,
      effectiveFrom: input.effectiveFrom ?? "",
      effectiveTo: input.effectiveTo ?? "",
      certValidityMonths: input.certValidityMonths ?? DEFAULT_CERT_VALIDITY_MONTHS,
      fields: fieldsForStorage(input.fields),
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    };

    try {
      await setDoc(formRef, record);
    } catch (error) {
      // Do not leave an uploaded PDF behind that no document points at.
      await deleteObject(ref(storage, storagePath)).catch(() => undefined);
      throw formatServiceError(error, "Failed to save the TEFAP form.");
    }

    return mapForm(formRef.id, { ...record, createdAt: new Date(), updatedAt: new Date() });
  }

  /**
   * Saves an edited field map.
   *
   * Once a template has submissions its mapping is frozen: changing where a
   * value lands would alter documents clients have already certified. The edit
   * is preserved as a new version pointing at the same PDF, which callers
   * should surface rather than treating as a silent no-op.
   */
  public async saveFieldMap(
    formId: string,
    fields: TefapFormField[],
    actor: TefapActor
  ): Promise<{ form: TefapForm; createdNewVersion: boolean }> {
    const existing = await this.getForm(formId);
    if (!existing) {
      throw new ServiceError("That TEFAP form no longer exists.", "tefap/form-missing");
    }

    const submissionCount = await this.countSubmissions(formId);

    if (submissionCount === 0) {
      try {
        await updateDoc(doc(this.db, this.formsCollection, formId), {
          fields: fieldsForStorage(fields),
          updatedAt: serverTimestamp(),
          updatedBy: actor,
        });
      } catch (error) {
        throw formatServiceError(error, "Failed to save the field mapping.");
      }

      return {
        form: { ...existing, fields, updatedAt: new Date(), updatedBy: actor },
        createdNewVersion: false,
      };
    }

    // Same PDF, new version, new field map. The old version stays readable so
    // its submissions still regenerate exactly as signed.
    const versionRef = doc(collection(this.db, this.formsCollection));
    const record = {
      name: existing.name,
      description: existing.description ?? "",
      version: existing.version + 1,
      status: "active" as TefapFormStatus,
      storagePath: existing.storagePath,
      fileName: existing.fileName,
      fileSize: existing.fileSize,
      pageCount: existing.pageCount,
      effectiveFrom: existing.effectiveFrom ?? "",
      effectiveTo: existing.effectiveTo ?? "",
      certValidityMonths: existing.certValidityMonths,
      fields: fieldsForStorage(fields),
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    };

    // Batched: writing the new version and archiving the old one have to land
    // together. Separately, a failure on the second leaves two active versions
    // of the same form - identical in name, description and PDF, so an admin
    // cannot tell them apart - while the caller is told nothing was saved.
    try {
      const batch = writeBatch(this.db);
      batch.set(versionRef, record);
      batch.update(doc(this.db, this.formsCollection, formId), {
        status: "archived" as TefapFormStatus,
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      });
      await batch.commit();
    } catch (error) {
      throw formatServiceError(error, "Failed to save the new form version.");
    }

    return {
      form: mapForm(versionRef.id, { ...record, createdAt: new Date(), updatedAt: new Date() }),
      createdNewVersion: true,
    };
  }

  public async setStatus(
    formId: string,
    status: TefapFormStatus,
    actor: TefapActor
  ): Promise<void> {
    try {
      await updateDoc(doc(this.db, this.formsCollection, formId), {
        status,
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to update the form's status.");
    }
  }

  /** How many submissions reference this template. */
  public async countSubmissions(formId: string): Promise<number> {
    try {
      const snapshot = await getCountFromServer(
        query(collection(this.db, this.submissionsCollection), where("formId", "==", formId))
      );
      return snapshot.data().count;
    } catch (error) {
      throw formatServiceError(error, "Failed to count submissions for this form.");
    }
  }

  /** A URL for previewing the unfilled template in the browser. */
  public async getTemplateUrl(form: Pick<TefapForm, "storagePath">): Promise<string> {
    try {
      return await getDownloadURL(ref(storage, form.storagePath));
    } catch (error) {
      throw formatServiceError(error, "Failed to open the form PDF.");
    }
  }

  /**
   * The template's bytes, for filling. Cached per form id, so a bulk export
   * downloads each template once no matter how many documents it produces.
   */
  public async getTemplateBytes(form: Pick<TefapForm, "id" | "storagePath">): Promise<Uint8Array> {
    const cached = this.templateCache.get(form.id);
    if (cached) return cached;

    try {
      const url = await getDownloadURL(ref(storage, form.storagePath));
      const response = await retry(async () => {
        const result = await fetch(url);
        if (!result.ok) {
          throw new ServiceError(
            `Downloading the form PDF failed (${result.status}).`,
            "tefap/template-fetch-failed"
          );
        }
        return result;
      });

      const bytes = new Uint8Array(await response.arrayBuffer());
      this.templateCache.set(form.id, bytes);
      return bytes;
    } catch (error) {
      throw formatServiceError(error, "Failed to download the form PDF.");
    }
  }

  /** Drops cached template bytes. Exposed mainly for tests and logout. */
  public clearTemplateCache(): void {
    this.templateCache.clear();
  }

  /** Reads a stored form document, checking it still looks like one. */
  public async requireForm(formId: string): Promise<TefapForm> {
    const form = await this.getForm(formId);

    if (!form || !validateTefapForm(form)) {
      throw new ServiceError("That TEFAP form could not be loaded.", "tefap/form-missing");
    }
    return form;
  }
}

/** Keeps uploaded filenames safe for a Storage path. */
export const sanitizeStorageName = (fileName: string): string => {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+/, "")
    .slice(-120);

  return cleaned || "form.pdf";
};

export const tefapFormService = TefapFormService.getInstance();
export default TefapFormService;
