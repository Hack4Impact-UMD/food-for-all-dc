// TEFAP submissions: the append-only record of a client certifying eligibility
// on a given template.
//
// Only the answers are stored, never a filled PDF. The document is regenerated
// on demand from (template bytes + field map + answers), which keeps Storage
// holding nothing but the handful of blank templates.
//
// Submissions are never edited. A correction is a new submission carrying
// supersedesId, so the record of what was certified, when, and by whom stays
// intact - these back a federal eligibility determination.

import {
  type QueryConstraint,
  Timestamp,
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import dataSources from "../config/dataSources";
import { retry } from "../utils/retry";
import { ServiceError, formatServiceError } from "../utils/serviceError";
import { toDateOrNull } from "../utils/dates";
import { deliveryDate } from "../utils/deliveryDate";
import type { TefapActor, TefapFieldValue, TefapForm, TefapSubmission } from "../types/tefap-types";

export interface CreateTefapSubmissionInput {
  clientId: string;
  clientName: string;
  form: Pick<TefapForm, "id" | "name" | "version">;
  values: TefapFieldValue[];
  /** ISO date the resulting certification lapses on. */
  certExpiresOn?: string;
  supersedesId?: string;
}

export interface TefapSubmissionQuery {
  formId?: string;
  clientId?: string;
  /** Inclusive ISO date bounds on submittedAt. */
  from?: string;
  to?: string;
  /** Keep only each client's most recent submission. */
  latestPerClient?: boolean;
}

const mapSubmission = (id: string, raw: Record<string, unknown>): TefapSubmission => ({
  id,
  clientId: (raw.clientId as string) ?? "",
  clientName: (raw.clientName as string) ?? "",
  formId: (raw.formId as string) ?? "",
  formName: (raw.formName as string) ?? "",
  formVersion: (raw.formVersion as number) ?? 1,
  values: Array.isArray(raw.values) ? (raw.values as TefapFieldValue[]) : [],
  submittedAt: toDateOrNull(raw.submittedAt) ?? new Date(),
  submittedBy: (raw.submittedBy as TefapActor) ?? { uid: "", name: "", email: "" },
  certExpiresOn: (raw.certExpiresOn as string) || undefined,
  supersedesId: (raw.supersedesId as string) || undefined,
});

/**
 * Default expiry for a certification made today, given a template's validity
 * window. Exported so the fill dialog can show the same date it will save.
 */
export const defaultCertExpiry = (certValidityMonths: number, from = new Date()): string => {
  const expiry = new Date(from.getTime());
  expiry.setMonth(expiry.getMonth() + certValidityMonths);

  return deliveryDate.toISODateString(expiry);
};

/**
 * TEFAP Submission Service - append-only certification records.
 */
class TefapSubmissionService {
  private static instance: TefapSubmissionService;
  private db = db;
  private submissionsCollection = dataSources.firebase.tefapSubmissionsCollection;

  private constructor() {
    // Intentionally empty - initialization happens with class properties.
  }

  public static getInstance(): TefapSubmissionService {
    if (!TefapSubmissionService.instance) {
      TefapSubmissionService.instance = new TefapSubmissionService();
    }
    return TefapSubmissionService.instance;
  }

  public async createSubmission(
    input: CreateTefapSubmissionInput,
    actor: TefapActor
  ): Promise<TefapSubmission> {
    if (!input.clientId) {
      throw new ServiceError("A TEFAP form must be attached to a client.", "tefap/missing-client");
    }
    if (!input.form.id) {
      throw new ServiceError("Choose a TEFAP form before saving.", "tefap/missing-form");
    }

    const record = {
      clientId: input.clientId,
      clientName: input.clientName,
      formId: input.form.id,
      formName: input.form.name,
      formVersion: input.form.version,
      values: input.values,
      certExpiresOn: input.certExpiresOn ?? "",
      ...(input.supersedesId ? { supersedesId: input.supersedesId } : {}),
      submittedAt: serverTimestamp(),
      submittedBy: actor,
    };

    try {
      const created = await addDoc(collection(this.db, this.submissionsCollection), record);
      return mapSubmission(created.id, { ...record, submittedAt: new Date() });
    } catch (error) {
      throw formatServiceError(error, "Failed to save the TEFAP form.");
    }
  }

  /**
   * Submissions matching a filter, newest first.
   *
   * Firestore is asked for the narrowest indexed slice it can serve - one
   * equality plus the submittedAt range - and any remaining narrowing happens
   * in memory, so this needs only the two composite indexes rather than one
   * per combination of filters.
   */
  public async listSubmissions(filter: TefapSubmissionQuery = {}): Promise<TefapSubmission[]> {
    try {
      const constraints: QueryConstraint[] = [];

      if (filter.formId) {
        constraints.push(where("formId", "==", filter.formId));
      } else if (filter.clientId) {
        constraints.push(where("clientId", "==", filter.clientId));
      }

      if (filter.from) {
        // Bound by the start of the day. tryToJSDate normalises to Eastern
        // midday, so using it directly would drop every submission made in the
        // morning of the start date, silently and without a count discrepancy.
        const parsed = deliveryDate.tryToJSDate(filter.from);
        if (parsed) {
          const start = deliveryDate.getDayBounds(parsed).start;
          constraints.push(where("submittedAt", ">=", Timestamp.fromDate(start.toJSDate())));
        }
      }

      if (filter.to) {
        // Inclusive of the end date, so bound by the start of the next day.
        const bounds = deliveryDate.getDayBounds(filter.to);
        constraints.push(
          where("submittedAt", "<", Timestamp.fromDate(bounds.endExclusive.toJSDate()))
        );
      }

      const snapshot = await retry(() =>
        getDocs(
          query(
            collection(this.db, this.submissionsCollection),
            ...constraints,
            orderBy("submittedAt", "desc")
          )
        )
      );

      let submissions = snapshot.docs.map((entry) => mapSubmission(entry.id, entry.data()));

      // Whichever equality the query could not use is applied here.
      if (filter.formId && filter.clientId) {
        submissions = submissions.filter((entry) => entry.clientId === filter.clientId);
      }

      return filter.latestPerClient ? keepLatestPerClient(submissions) : submissions;
    } catch (error) {
      throw formatServiceError(error, "Failed to load TEFAP submissions.");
    }
  }

  /** Every submission a client has made, newest first. */
  public listForClient(clientId: string): Promise<TefapSubmission[]> {
    return this.listSubmissions({ clientId });
  }
}

/**
 * Keeps each client's most recent submission. Relies on the caller's ordering
 * being newest-first, which every query here guarantees.
 */
export const keepLatestPerClient = (submissions: TefapSubmission[]): TefapSubmission[] => {
  const seen = new Set<string>();

  return submissions.filter((submission) => {
    if (seen.has(submission.clientId)) return false;
    seen.add(submission.clientId);
    return true;
  });
};

export const tefapSubmissionService = TefapSubmissionService.getInstance();
export default TefapSubmissionService;
