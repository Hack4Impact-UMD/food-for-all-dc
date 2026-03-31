import {
  collection,
  doc,
  getDoc,
  getDocs,
  DocumentSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import { DeliveryEvent, NewDelivery } from "../types/calendar-types";
import { HouseholdSnapshot } from "../types/delivery-types";
import { validateDeliveryEvent } from "../utils/firestoreValidation";
import { Time, TimeUtils } from "../utils/timeUtils";
import { retry } from "../utils/retry";
import { ServiceError, formatServiceError } from "../utils/serviceError";
import dataSources from "../config/dataSources";
import { deliveryDate } from "../utils/deliveryDate";
import { normalizeHouseholdSnapshot } from "../utils/householdSnapshot";
import {
  buildRecurringSeriesAuditReport,
  buildSeriesSummary,
  canMutateFutureSeries,
  DeliverySeriesSummary,
  getLatestScheduledDate,
  RecurringSeriesAuditReport,
  summarizeDeliverySeries,
} from "../utils/recurringSeries";
import {
  DeliveryChangeReason,
  deliveryEventEmitter,
} from "../utils/deliveryEventEmitter";

export interface ClusterReconciliationResult {
  impactedDateKeys: string[];
  reviewRequiredDateKeys: string[];
  failedDateKeys: string[];
}

export type DeliveryMutationScope = "single" | "following";

export interface DeliverySeriesDateRange {
  earliest: Date | null;
  latest: Date | null;
}

interface SeriesResolutionResult {
  anchorEvent: DeliveryEvent;
  scopedEvents: DeliveryEvent[];
  seriesEvents: DeliveryEvent[];
  summary: DeliverySeriesSummary;
}

interface UpdateEventScopeInput {
  eventId: string;
  scope: DeliveryMutationScope;
  deliveryDate: string | Date;
  recurrence?: DeliveryEvent["recurrence"];
  repeatsEndDate?: string;
}

const MAX_BATCH_WRITE_COUNT = 500;

/**
 * Delivery Service - Handles all delivery-related operations with Firebase
 */
class DeliveryService {
  private logDeliveryDebug(operation: string, payload: Record<string, unknown>): void {
    void operation;
    void payload;
  }

  private normalizeDateKeys(dateKeys: Array<string | null | undefined>): string[] {
    return Array.from(
      new Set(
        dateKeys
          .map((dateKey) => deliveryDate.tryToISODateString(dateKey))
          .filter((dateKey): dateKey is string => !!dateKey)
      )
    );
  }

  private emitDeliveryChange(
    reason: DeliveryChangeReason,
    impactedDateKeys: string[],
    invalidationResult: ClusterReconciliationResult
  ) {
    deliveryEventEmitter.emit({
      reason,
      impactedDateKeys,
      reviewRequiredDateKeys: invalidationResult.reviewRequiredDateKeys,
      failedClusterDateKeys: invalidationResult.failedDateKeys,
    });
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }

    const normalizedValue = value.trim();
    return normalizedValue ? normalizedValue : undefined;
  }

  private async getActiveClientIdsForDateKey(dateKey: string): Promise<string[]> {
    const range = this.getClusterDateRange(dateKey);
    if (!range) {
      return [];
    }

    const eventQuery = query(
      collection(this.db, this.eventsCollection),
      where("deliveryDate", ">=", range.start),
      where("deliveryDate", "<=", range.end),
      orderBy("deliveryDate", "asc")
    );
    const snapshot = await getDocs(eventQuery);

    return Array.from(
      new Set(
        snapshot.docs
          .map((docSnapshot) => {
            const clientId = docSnapshot.data().clientId;
            return typeof clientId === "string" ? clientId.trim() : "";
          })
          .filter(Boolean)
      )
    );
  }

  private reconcileClusterState(
    docData: Record<string, any>,
    activeClientIds: string[]
  ): {
    clusters: Record<string, any>[];
    clientOverrides: Record<string, any>[];
    reviewRequired: boolean;
    changed: boolean;
  } {
    const activeClientIdSet = new Set(activeClientIds);
    const originalClusters = Array.isArray(docData.clusters) ? docData.clusters : [];
    const originalOverrides = Array.isArray(docData.clientOverrides) ? docData.clientOverrides : [];
    const assignedClientIds = new Set<string>();

    const reconciledClusters = originalClusters.reduce(
      (clusters: Record<string, any>[], cluster: any) => {
        if (!cluster || typeof cluster !== "object") {
          return clusters;
        }

        const seenClusterClientIds = new Set<string>();
        const deliveries = Array.isArray(cluster.deliveries)
          ? cluster.deliveries.reduce((clientIds: string[], clientId: unknown) => {
              if (typeof clientId !== "string") {
                return clientIds;
              }

              const normalizedClientId = clientId.trim();
              if (
                !normalizedClientId ||
                !activeClientIdSet.has(normalizedClientId) ||
                seenClusterClientIds.has(normalizedClientId) ||
                assignedClientIds.has(normalizedClientId)
              ) {
                return clientIds;
              }

              seenClusterClientIds.add(normalizedClientId);
              assignedClientIds.add(normalizedClientId);
              clientIds.push(normalizedClientId);
              return clientIds;
            }, [] as string[])
          : [];

        if (deliveries.length === 0) {
          return clusters;
        }

        clusters.push({
          ...cluster,
          deliveries,
        });
        return clusters;
      },
      [] as Record<string, any>[]
    );

    const reconciledOverrides = originalOverrides.reduce(
      (overrides: Record<string, any>[], override: any) => {
        if (!override || typeof override !== "object" || typeof override.clientId !== "string") {
          return overrides;
        }

        const clientId = override.clientId.trim();
        if (!clientId || !activeClientIdSet.has(clientId)) {
          return overrides;
        }

        const driver = this.normalizeOptionalString(override.driver);
        const time = this.normalizeOptionalString(override.time);
        if (!driver && !time) {
          return overrides;
        }

        const nextOverride: Record<string, any> = { clientId };
        if (driver) {
          nextOverride.driver = driver;
        }
        if (time) {
          nextOverride.time = time;
        }

        overrides.push(nextOverride);
        return overrides;
      },
      [] as Record<string, any>[]
    );

    const hadAssignments =
      originalClusters.some(
        (cluster) => Array.isArray(cluster?.deliveries) && cluster.deliveries.length > 0
      ) || originalOverrides.length > 0;
    const reviewRequired =
      hadAssignments && activeClientIds.some((clientId) => !assignedClientIds.has(clientId));
    const changed =
      JSON.stringify({
        clusters: originalClusters,
        clientOverrides: originalOverrides,
      }) !==
      JSON.stringify({
        clusters: reconciledClusters,
        clientOverrides: reconciledOverrides,
      });

    return {
      clusters: reconciledClusters,
      clientOverrides: reconciledOverrides,
      reviewRequired,
      changed,
    };
  }

  private normalizeEventForWrite(event: Partial<DeliveryEvent>): Partial<DeliveryEvent> {
    const cleanEvent = Object.fromEntries(
      Object.entries(event).map(([k, v]) => [k, v === undefined ? null : v])
    );

    if (cleanEvent.deliveryDate) {
      cleanEvent.deliveryDate = deliveryDate.toJSDate(cleanEvent.deliveryDate as any);
    }

    if ("householdSnapshot" in cleanEvent) {
      cleanEvent.householdSnapshot = normalizeHouseholdSnapshot(
        cleanEvent.householdSnapshot as Partial<HouseholdSnapshot> | null | undefined
      );
    }

    return cleanEvent;
  }

  private snapshotToDeliveryEvent(snapshot: DocumentSnapshot): DeliveryEvent | null {
    if (!snapshot.exists()) {
      return null;
    }

    const raw = snapshot.data() as Record<string, unknown>;
    if (!raw.deliveryDate) {
      return null;
    }

    const event = {
      id: snapshot.id,
      ...raw,
      deliveryDate: deliveryDate.toJSDate(
        raw.deliveryDate as string | Date | Timestamp | null | undefined
      ),
    } as DeliveryEvent;

    return validateDeliveryEvent(event) ? event : null;
  }

  private sortEventsByDeliveryDate(events: DeliveryEvent[]): DeliveryEvent[] {
    return [...events].sort((left, right) => {
      const leftDate = deliveryDate.toISODateString(left.deliveryDate);
      const rightDate = deliveryDate.toISODateString(right.deliveryDate);
      return leftDate.localeCompare(rightDate);
    });
  }

  private getSeriesCacheKey(event: Partial<DeliveryEvent>): string | null {
    if (event.recurrence === "None") {
      return event.id || null;
    }

    return event.recurrenceId?.trim() || null;
  }

  private invalidateSeriesCacheKeys(cacheKeys: Array<string | null | undefined>) {
    cacheKeys
      .filter((cacheKey): cacheKey is string => Boolean(cacheKey))
      .forEach((cacheKey) => this.dateRangeCache.delete(cacheKey));
  }

  private invalidateRecurringCache(events: Partial<DeliveryEvent>[]) {
    const cacheKeys = events.map((event) => this.getSeriesCacheKey(event));
    this.invalidateSeriesCacheKeys(cacheKeys);
  }

  private async getEventOrThrow(id: string): Promise<DeliveryEvent> {
    if (!id) {
      throw new ServiceError("Invalid event ID provided", "invalid-event-id");
    }

    const snapshot = await getDoc(doc(this.db, this.eventsCollection, id));
    const event = this.snapshotToDeliveryEvent(snapshot);

    if (!event) {
      throw new ServiceError("Delivery event not found", "event-not-found");
    }

    return event;
  }

  private async getEventsForRecurrenceId(
    recurrenceId: string,
    clientId?: string
  ): Promise<DeliveryEvent[]> {
    const constraints = [where("recurrenceId", "==", recurrenceId)];
    if (clientId) {
      constraints.push(where("clientId", "==", clientId));
    }

    const snapshot = await getDocs(query(collection(this.db, this.eventsCollection), ...constraints));

    return this.sortEventsByDeliveryDate(
      snapshot.docs
        .map((docSnapshot) => this.snapshotToDeliveryEvent(docSnapshot))
        .filter((event): event is DeliveryEvent => event !== null)
    );
  }

  private getSeriesMutationError(event: DeliveryEvent): ServiceError {
    if (!canMutateFutureSeries(event)) {
      return new ServiceError(
        "This recurring delivery needs repair before future changes can be applied.",
        "legacy-series-unsupported"
      );
    }

    return new ServiceError(
      "This delivery series could not be resolved safely.",
      "ambiguous-series-repair-required"
    );
  }

  private async resolveSeriesForEvent(
    eventId: string,
    scope: DeliveryMutationScope
  ): Promise<SeriesResolutionResult> {
    const anchorEvent = await this.getEventOrThrow(eventId);
    const anchorSummary = buildSeriesSummary([anchorEvent]);

    if (scope === "single" || anchorEvent.recurrence === "None") {
      if (!anchorSummary) {
        throw new ServiceError("Unable to resolve delivery event.", "event-resolution-failed");
      }

      return {
        anchorEvent,
        scopedEvents: [anchorEvent],
        seriesEvents: [anchorEvent],
        summary: anchorSummary,
      };
    }

    if (!canMutateFutureSeries(anchorEvent)) {
      throw this.getSeriesMutationError(anchorEvent);
    }

    const seriesEvents = await this.getEventsForRecurrenceId(
      anchorEvent.recurrenceId!,
      anchorEvent.clientId
    );
    const summary = buildSeriesSummary(seriesEvents);

    if (!summary || !summary.supportsFutureOperations) {
      throw this.getSeriesMutationError(anchorEvent);
    }

    const anchorDateKey = deliveryDate.toISODateString(anchorEvent.deliveryDate);
    const scopedEvents = seriesEvents.filter(
      (event) => deliveryDate.toISODateString(event.deliveryDate) >= anchorDateKey
    );

    if (!scopedEvents.some((event) => event.id === anchorEvent.id)) {
      throw new ServiceError(
        "This delivery series is inconsistent and needs repair before future changes can be applied.",
        "ambiguous-series-repair-required"
      );
    }

    return {
      anchorEvent,
      scopedEvents,
      seriesEvents,
      summary,
    };
  }

  private async writeBatchDeleteAndCreate(
    eventsToDelete: DeliveryEvent[],
    eventsToCreate: Partial<DeliveryEvent>[]
  ): Promise<void> {
    const deleteChunks: DeliveryEvent[][] = [];
    for (let i = 0; i < eventsToDelete.length; i += MAX_BATCH_WRITE_COUNT) {
      deleteChunks.push(eventsToDelete.slice(i, i + MAX_BATCH_WRITE_COUNT));
    }

    const normalizedEventsToCreate = eventsToCreate.map((event) => this.normalizeEventForWrite(event));
    const createChunks: Partial<DeliveryEvent>[][] = [];
    for (let i = 0; i < normalizedEventsToCreate.length; i += MAX_BATCH_WRITE_COUNT) {
      createChunks.push(normalizedEventsToCreate.slice(i, i + MAX_BATCH_WRITE_COUNT));
    }

    for (const chunk of deleteChunks) {
      await retry(async () => {
        const batch = writeBatch(this.db);
        chunk.forEach((event) => {
          batch.delete(doc(this.db, this.eventsCollection, event.id));
        });
        await batch.commit();
      });
    }

    for (const chunk of createChunks) {
      await retry(async () => {
        const batch = writeBatch(this.db);
        chunk.forEach((event) => {
          const eventRef = doc(collection(this.db, this.eventsCollection));
          batch.set(eventRef, event);
        });
        await batch.commit();
      });
    }
  }

  private async finalizeMutation(
    reason: DeliveryChangeReason,
    impactedDateKeys: string[],
    affectedEvents: Partial<DeliveryEvent>[]
  ): Promise<void> {
    this.invalidateRecurringCache(affectedEvents);
    const invalidationResult = await this.reconcileClusterAssignmentsForDateKeys(impactedDateKeys);
    this.emitDeliveryChange(reason, impactedDateKeys, invalidationResult);
  }

  private async createEventsInternal(
    events: Partial<DeliveryEvent>[],
    reason: DeliveryChangeReason
  ): Promise<string[]> {
    const normalizedEvents = events.map((event) => this.normalizeEventForWrite(event));
    if (!normalizedEvents.length) {
      return [];
    }

    const docRefs = normalizedEvents.map(() => doc(collection(this.db, this.eventsCollection)));
    const docIds = docRefs.map((docRef) => docRef.id);

    for (let i = 0; i < normalizedEvents.length; i += MAX_BATCH_WRITE_COUNT) {
      const chunkEvents = normalizedEvents.slice(i, i + MAX_BATCH_WRITE_COUNT);
      const chunkRefs = docRefs.slice(i, i + MAX_BATCH_WRITE_COUNT);

      await retry(async () => {
        const batch = writeBatch(this.db);
        chunkEvents.forEach((event, index) => {
          batch.set(chunkRefs[index], event);
        });
        await batch.commit();
      });
    }

    this.invalidateRecurringCache(normalizedEvents as Partial<DeliveryEvent>[]);

    const impactedDateKeys = this.normalizeDateKeys(
      normalizedEvents.map((event) =>
        event.deliveryDate ? deliveryDate.toISODateString(event.deliveryDate as any) : null
      )
    );
    const invalidationResult = await this.reconcileClusterAssignmentsForDateKeys(impactedDateKeys);
    this.emitDeliveryChange(reason, impactedDateKeys, invalidationResult);

    return docIds;
  }

  /**
   * Delete all delivery events for a client
   */
  public async deleteEventsByClientId(clientId: string): Promise<void> {
    try {
      this.logDeliveryDebug("deleteEventsByClientId:start", { clientId });
      const q = query(
        collection(this.db, this.eventsCollection),
        where("clientId", "==", clientId)
      );
      const querySnapshot = await getDocs(q);
      this.logDeliveryDebug("deleteEventsByClientId:queried", {
        clientId,
        matchedCount: querySnapshot.size,
      });
      const impactedDateKeys = this.normalizeDateKeys(
        querySnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return data.deliveryDate ? deliveryDate.toISODateString(data.deliveryDate) : null;
        })
      );
      const batchDeletes = querySnapshot.docs.map((docSnap) =>
        deleteDoc(doc(this.db, this.eventsCollection, docSnap.id))
      );
      await Promise.all(batchDeletes);
      this.clearDateRangeCache();
      const invalidationResult =
        await this.reconcileClusterAssignmentsForDateKeys(impactedDateKeys);
      this.emitDeliveryChange("schedule-batch-deleted", impactedDateKeys, invalidationResult);
      this.logDeliveryDebug("deleteEventsByClientId:completed", {
        clientId,
        deletedCount: querySnapshot.size,
        impactedDateKeys,
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to delete deliveries for client");
    }
  }

  /**
   * Delete only missed delivery events for a client
   */
  public async deleteMissedEventsByClientId(clientId: string): Promise<void> {
    const successfulImpactedDateKeys = new Set<string>();
    const reconcileSuccessfulDeletes = async () => {
      if (!successfulImpactedDateKeys.size) {
        return;
      }

      const impactedDateKeys = Array.from(successfulImpactedDateKeys);
      this.clearDateRangeCache();
      const invalidationResult =
        await this.reconcileClusterAssignmentsForDateKeys(impactedDateKeys);
      this.emitDeliveryChange("schedule-batch-deleted", impactedDateKeys, invalidationResult);
    };

    let deleteError: unknown = null;

    try {
      const q = query(
        collection(this.db, this.eventsCollection),
        where("clientId", "==", clientId)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return;
      }

      const missedDocs = querySnapshot.docs.filter(
        (docSnap) => docSnap.data()?.deliveryStatus === "Missed"
      );

      if (!missedDocs.length) {
        return;
      }

      for (let i = 0; i < missedDocs.length; i += MAX_BATCH_WRITE_COUNT) {
        const chunk = missedDocs.slice(i, i + MAX_BATCH_WRITE_COUNT);
        await retry(async () => {
          const batch = writeBatch(this.db);
          chunk.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        });

        this.normalizeDateKeys(
          chunk.map((docSnap) => {
            const data = docSnap.data();
            return data.deliveryDate ? deliveryDate.toISODateString(data.deliveryDate) : null;
          })
        ).forEach((dateKey) => successfulImpactedDateKeys.add(dateKey));
      }
    } catch (error) {
      deleteError = error;
    }

    let reconcileError: unknown = null;
    try {
      await reconcileSuccessfulDeletes();
    } catch (error) {
      reconcileError = error;
    }

    if (deleteError) {
      if (reconcileError) {
        console.error(
          "Error reconciling partially deleted missed deliveries:",
          reconcileError
        );
      }
      throw formatServiceError(deleteError, "Failed to delete missed deliveries for client");
    }

    if (reconcileError) {
      throw formatServiceError(reconcileError, "Failed to delete missed deliveries for client");
    }
  }
  private static instance: DeliveryService;
  private db = db;
  private eventsCollection = dataSources.firebase.calendarCollection;
  private clustersCollection = dataSources.firebase.clustersCollection;
  private dailyLimitsCollection = dataSources.firebase.dailyLimitsCollection;
  private limitsCollection = dataSources.firebase.limitsCollection;
  private limitsDocId = dataSources.firebase.limitsDocId;

  // Private constructor to prevent direct instantiation
  // This is part of the singleton pattern
  private constructor() {
    // Intentionally empty - initialization happens with class properties
  }

  public static getInstance(): DeliveryService {
    if (!DeliveryService.instance) {
      DeliveryService.instance = new DeliveryService();
    }
    return DeliveryService.instance;
  }

  private getClusterDateRange(dateKey: string): { start: Timestamp; end: Timestamp } | null {
    const normalizedDateKey = deliveryDate.tryToISODateString(dateKey);
    if (!normalizedDateKey) {
      return null;
    }

    const jsDate = deliveryDate.toJSDate(normalizedDateKey);
    const startDate = new Date(
      Date.UTC(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate(), 0, 0, 0, 0)
    );
    const endDate = new Date(
      Date.UTC(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate(), 23, 59, 59, 999)
    );

    return {
      start: Timestamp.fromDate(startDate),
      end: Timestamp.fromDate(endDate),
    };
  }

  /**
   * Get all delivery events
   */
  public async getAllEvents(): Promise<DeliveryEvent[]> {
    try {
      return await retry(async () => {
        const snapshot = await getDocs(collection(this.db, this.eventsCollection));
        const events = snapshot.docs
          .map((doc) => {
            const raw = doc.data();
            const normalizedDate = deliveryDate.toJSDate(
              Time.Firebase.fromTimestamp(raw.deliveryDate).toJSDate()
            );
            const data = { id: doc.id, ...raw, deliveryDate: normalizedDate };
            return validateDeliveryEvent(data) ? data : undefined;
          })
          .filter((event) => event !== undefined) as DeliveryEvent[];
        return events;
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get all events");
    }
  }

  /**
   * Get delivery events by date range
   */
  public async getEventsByDateRange(startDate: Date, endDate: Date): Promise<DeliveryEvent[]> {
    try {
      return await retry(async () => {
        // Use start of day for startDate and start of day for endDate (exclusive)
        const startDateTime = TimeUtils.fromJSDate(startDate).startOf("day");
        const endDateTime = TimeUtils.fromJSDate(endDate).startOf("day");
        const startTimestamp = Time.Firebase.toTimestamp(startDateTime);
        const endTimestamp = Time.Firebase.toTimestamp(endDateTime);
        const q = query(
          collection(this.db, this.eventsCollection),
          where("deliveryDate", ">=", startTimestamp),
          where("deliveryDate", "<", endTimestamp),
          orderBy("deliveryDate", "asc")
        );
        const querySnapshot = await getDocs(q);
        const events = querySnapshot.docs
          .map((doc) => {
            const raw = doc.data();
            const normalizedDate = deliveryDate.toJSDate(
              Time.Firebase.fromTimestamp(raw.deliveryDate).toJSDate()
            );
            const data = { id: doc.id, ...raw, deliveryDate: normalizedDate };
            return validateDeliveryEvent(data) ? data : undefined;
          })
          .filter((event) => event !== undefined) as DeliveryEvent[];
        return events;
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get events by date range");
    }
  }

  /**
   * Get delivery event counts keyed by date (yyyy-MM-dd)
   */
  public async getEventCountsForDates(dateKeys: string[]): Promise<Record<string, number>> {
    try {
      return await retry(async () => {
        const normalizedDateKeys = Array.from(
          new Set(
            dateKeys
              .map((dateKey) => deliveryDate.tryToISODateString(dateKey))
              .filter((dateKey): dateKey is string => !!dateKey)
          )
        );

        const counts = normalizedDateKeys.reduce(
          (acc, dateKey) => {
            acc[dateKey] = 0;
            return acc;
          },
          {} as Record<string, number>
        );

        if (!normalizedDateKeys.length) {
          return counts;
        }

        const sortedDateKeys = [...normalizedDateKeys].sort();
        const startDateTime = TimeUtils.fromISO(sortedDateKeys[0]).startOf("day");
        const endDateTime = TimeUtils.fromISO(sortedDateKeys[sortedDateKeys.length - 1])
          .plus({ days: 1 })
          .startOf("day");

        const startTimestamp = Time.Firebase.toTimestamp(startDateTime);
        const endTimestamp = Time.Firebase.toTimestamp(endDateTime);

        const q = query(
          collection(this.db, this.eventsCollection),
          where("deliveryDate", ">=", startTimestamp),
          where("deliveryDate", "<", endTimestamp),
          orderBy("deliveryDate", "asc")
        );

        const querySnapshot = await getDocs(q);
        querySnapshot.docs.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          if (!data.deliveryDate) return;
          const dateKey = deliveryDate.toISODateString(data.deliveryDate);
          if (counts[dateKey] !== undefined) {
            counts[dateKey] += 1;
          }
        });

        return counts;
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get event counts by date");
    }
  }

  public async reconcileClusterAssignmentsForDateKeys(
    dateKeys: string[]
  ): Promise<ClusterReconciliationResult> {
    const impactedDateKeys = this.normalizeDateKeys(dateKeys);
    const result: ClusterReconciliationResult = {
      impactedDateKeys,
      reviewRequiredDateKeys: [],
      failedDateKeys: [],
    };

    if (!impactedDateKeys.length) {
      return result;
    }

    await Promise.all(
      impactedDateKeys.map(async (dateKey) => {
        const range = this.getClusterDateRange(dateKey);
        if (!range) {
          return;
        }

        try {
          const [activeClientIds, snapshot] = await Promise.all([
            retry(async () => this.getActiveClientIdsForDateKey(dateKey)),
            retry(async () => {
              const clusterQuery = query(
                collection(this.db, this.clustersCollection),
                where("date", ">=", range.start),
                where("date", "<=", range.end),
                orderBy("date", "asc")
              );

              return getDocs(clusterQuery);
            }),
          ]);

          if (snapshot.empty) {
            return;
          }

          const reconciledState = this.reconcileClusterState(
            snapshot.docs[0].data() as Record<string, any>,
            activeClientIds
          );

          if (reconciledState.changed || snapshot.size > 1) {
            await retry(async () => {
              await Promise.all(
                snapshot.docs.map((clusterDoc) =>
                  updateDoc(clusterDoc.ref, {
                    clusters: reconciledState.clusters,
                    clientOverrides: reconciledState.clientOverrides,
                  })
                )
              );
            });
          }

          if (reconciledState.reviewRequired) {
            result.reviewRequiredDateKeys.push(dateKey);
          }
        } catch (error) {
          console.error(`Failed to reconcile cluster assignments for ${dateKey}:`, error);
          result.failedDateKeys.push(dateKey);
        }
      })
    );

    result.reviewRequiredDateKeys.sort();
    result.failedDateKeys.sort();
    return result;
  }

  /**
   * Create a new delivery event
   */
  public async createEvent(event: Partial<DeliveryEvent>): Promise<string> {
    try {
      const [docId] = await this.createEventsInternal([event], "schedule-created");
      return docId;
    } catch (error) {
      throw formatServiceError(error, "Failed to create event");
    }
  }

  public async createEventsBatch(events: Partial<DeliveryEvent>[]): Promise<string[]> {
    try {
      return await this.createEventsInternal(events, "schedule-created-batch");
    } catch (error) {
      throw formatServiceError(error, "Failed to create deliveries");
    }
  }

  private calculateDeliveryDateKeys(
    newDelivery: Pick<NewDelivery, "deliveryDate" | "recurrence" | "repeatsEndDate" | "customDates">
  ): string[] {
    if (newDelivery.recurrence === "Custom") {
      return Array.from(
        new Set(
          (newDelivery.customDates || [])
            .map((date) => deliveryDate.tryToISODateString(date))
            .filter((dateKey): dateKey is string => Boolean(dateKey))
        )
      ).sort();
    }

    const normalizedStartDate = deliveryDate.tryToISODateString(newDelivery.deliveryDate);
    if (!normalizedStartDate) {
      return [];
    }

    if (newDelivery.recurrence === "None") {
      return [normalizedStartDate];
    }

    const recurrenceDates = Time.Recurrence.calculateRecurrenceDates(
      deliveryDate.toDateTime(normalizedStartDate),
      newDelivery.recurrence,
      newDelivery.repeatsEndDate ? deliveryDate.toDateTime(newDelivery.repeatsEndDate) : undefined
    );

    return Array.from(new Set(recurrenceDates.map((date) => TimeUtils.toDateString(date)))).sort();
  }

  private buildReplacementEvent(
    template: Partial<DeliveryEvent>,
    overrides: Partial<DeliveryEvent>
  ): Partial<DeliveryEvent> {
    return {
      clientId: template.clientId || "",
      clientName: template.clientName || "",
      assignedDriverId: template.assignedDriverId || "",
      assignedDriverName: template.assignedDriverName || "",
      cluster: template.cluster ?? 0,
      time: template.time || "",
      seriesStartDate: template.seriesStartDate,
      ...template,
      ...overrides,
    };
  }

  public async getSeriesSummaryForEvent(eventId: string): Promise<DeliverySeriesSummary | null> {
    try {
      const resolution = await this.resolveSeriesForEvent(eventId, "single");
      if (resolution.anchorEvent.recurrence === "None" || !resolution.anchorEvent.recurrenceId) {
        return resolution.summary;
      }

      const seriesEvents = await this.getEventsForRecurrenceId(
        resolution.anchorEvent.recurrenceId,
        resolution.anchorEvent.clientId
      );
      return buildSeriesSummary(seriesEvents);
    } catch (error) {
      if (error instanceof ServiceError && error.code === "event-not-found") {
        return null;
      }

      throw formatServiceError(error, "Failed to get delivery series summary");
    }
  }

  public async getRecurringSeriesSummariesForClient(
    clientId: string
  ): Promise<DeliverySeriesSummary[]> {
    try {
      const events = await this.getEventsByClientId(clientId);
      return summarizeDeliverySeries(events).filter((summary) => summary.recurrence !== "None");
    } catch (error) {
      throw formatServiceError(error, "Failed to get recurring delivery series summaries");
    }
  }

  public async getLatestScheduledDateForClient(clientId: string): Promise<string | null> {
    try {
      const events = await this.getEventsByClientId(clientId);
      return getLatestScheduledDate(events);
    } catch (error) {
      throw formatServiceError(error, "Failed to get the latest scheduled delivery date");
    }
  }

  public async getScopedSeriesEvents(
    eventId: string,
    scope: DeliveryMutationScope
  ): Promise<DeliveryEvent[]> {
    try {
      const resolution = await this.resolveSeriesForEvent(eventId, scope);
      return resolution.scopedEvents;
    } catch (error) {
      throw formatServiceError(error, "Failed to resolve the delivery series");
    }
  }

  public async deleteEventByScope(
    eventId: string,
    scope: DeliveryMutationScope
  ): Promise<void> {
    try {
      this.logDeliveryDebug("deleteEventByScope:start", { eventId, scope });
      const resolution = await this.resolveSeriesForEvent(eventId, scope);
      const impactedDateKeys = this.normalizeDateKeys(
        resolution.scopedEvents.map((event) => deliveryDate.toISODateString(event.deliveryDate))
      );

      await this.writeBatchDeleteAndCreate(resolution.scopedEvents, []);
      await this.finalizeMutation(
        scope === "single" ? "schedule-deleted" : "schedule-batch-deleted",
        impactedDateKeys,
        resolution.scopedEvents
      );
      this.logDeliveryDebug("deleteEventByScope:completed", {
        eventId,
        scope,
        deletedCount: resolution.scopedEvents.length,
        impactedDateKeys,
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to delete event");
    }
  }

  public async updateEventByScope(input: UpdateEventScopeInput): Promise<void> {
    try {
      this.logDeliveryDebug("updateEventByScope:start", {
        eventId: input.eventId,
        scope: input.scope,
        recurrence: input.recurrence,
        deliveryDate: deliveryDate.tryToISODateString(input.deliveryDate),
        repeatsEndDate: input.repeatsEndDate,
      });
      const resolution = await this.resolveSeriesForEvent(input.eventId, input.scope);

      if (input.scope === "single") {
        const cleanData = this.normalizeEventForWrite({
          deliveryDate: input.deliveryDate,
        });
        const eventRef = doc(this.db, this.eventsCollection, input.eventId);

        await retry(async () => {
          await updateDoc(eventRef, cleanData);
        });

        const updatedEvent = {
          ...resolution.anchorEvent,
          deliveryDate: deliveryDate.toJSDate(input.deliveryDate),
        };
        const impactedDateKeys = this.normalizeDateKeys([
          deliveryDate.toISODateString(resolution.anchorEvent.deliveryDate),
          deliveryDate.toISODateString(updatedEvent.deliveryDate),
        ]);

        await this.finalizeMutation("schedule-updated", impactedDateKeys, [
          resolution.anchorEvent,
          updatedEvent,
        ]);
        this.logDeliveryDebug("updateEventByScope:completed-single", {
          eventId: input.eventId,
          impactedDateKeys,
        });
        return;
      }

      const nextRecurrence = input.recurrence || resolution.anchorEvent.recurrence;
      const replacementDateKeys = this.calculateDeliveryDateKeys({
        deliveryDate: deliveryDate.toISODateString(input.deliveryDate),
        recurrence: nextRecurrence,
        repeatsEndDate: input.repeatsEndDate,
      });
      const replacementEvents = replacementDateKeys.map((dateKey) =>
        this.buildReplacementEvent(resolution.anchorEvent, {
          deliveryDate: dateKey,
          recurrence: nextRecurrence,
          recurrenceId:
            nextRecurrence === "None" ? undefined : resolution.summary.recurrenceId,
          repeatsEndDate:
            nextRecurrence === "None" || nextRecurrence === "Custom"
              ? undefined
              : input.repeatsEndDate || "",
          seriesStartDate: nextRecurrence === "None" ? undefined : resolution.anchorEvent.seriesStartDate,
        })
      );
      const impactedDateKeys = this.normalizeDateKeys([
        ...resolution.scopedEvents.map((event) => deliveryDate.toISODateString(event.deliveryDate)),
        ...replacementDateKeys,
      ]);

      await this.writeBatchDeleteAndCreate(resolution.scopedEvents, replacementEvents);
      await this.finalizeMutation("schedule-batch-updated", impactedDateKeys, [
        ...resolution.scopedEvents,
        ...replacementEvents,
      ]);
      this.logDeliveryDebug("updateEventByScope:completed-following", {
        eventId: input.eventId,
        deletedCount: resolution.scopedEvents.length,
        createdCount: replacementEvents.length,
        impactedDateKeys,
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to update event");
    }
  }

  public async scheduleClientDeliveries(newDelivery: NewDelivery): Promise<void> {
    try {
      if (!newDelivery.clientId) {
        throw new ServiceError("Client is required to schedule deliveries.", "invalid-client");
      }

      this.logDeliveryDebug("scheduleClientDeliveries:start", {
        clientId: newDelivery.clientId,
        recurrence: newDelivery.recurrence,
        deliveryDate: deliveryDate.tryToISODateString(newDelivery.deliveryDate),
        repeatsEndDate: newDelivery.repeatsEndDate,
        customDates: (newDelivery.customDates || [])
          .map((date) => deliveryDate.tryToISODateString(date))
          .filter((dateKey): dateKey is string => Boolean(dateKey)),
      });

      const desiredDateKeys = this.calculateDeliveryDateKeys(newDelivery);
      if (!desiredDateKeys.length) {
        throw new ServiceError("At least one delivery date is required.", "invalid-delivery-dates");
      }

      const existingEvents = await this.getEventsByClientId(newDelivery.clientId);
      const existingDateKeys = new Set(
        existingEvents.map((event) => deliveryDate.toISODateString(event.deliveryDate))
      );

      const newDates = desiredDateKeys.filter((dateKey) => !existingDateKeys.has(dateKey));
      this.logDeliveryDebug("scheduleClientDeliveries:computed", {
        clientId: newDelivery.clientId,
        desiredDateKeys,
        existingDateKeys: Array.from(existingDateKeys).sort(),
        newDates,
      });
      if (!newDates.length) {
        this.logDeliveryDebug("scheduleClientDeliveries:no-op", {
          clientId: newDelivery.clientId,
          reason: "all-requested-dates-already-exist",
        });
        return;
      }

      const recurrenceId =
        newDelivery.recurrence === "None" ? undefined : crypto.randomUUID();
      const seriesStartDate =
        newDelivery.recurrence === "None"
          ? undefined
          : deliveryDate.tryToISODateString(newDelivery.deliveryDate) || undefined;
      const eventsToCreate = newDates.map((dateKey) =>
        this.buildReplacementEvent(
          {
            clientId: newDelivery.clientId,
            clientName: newDelivery.clientName,
            householdSnapshot: newDelivery.householdSnapshot,
            cluster: 0,
            time: "",
            assignedDriverId: "",
            assignedDriverName: "",
            seriesStartDate,
          },
          {
            deliveryDate: dateKey,
            recurrence: newDelivery.recurrence,
            recurrenceId,
            repeatsEndDate:
              newDelivery.recurrence === "Custom" ? undefined : newDelivery.repeatsEndDate || "",
            customDates:
              newDelivery.recurrence === "Custom" ? newDelivery.customDates : undefined,
          }
        )
      );

      const reason =
        eventsToCreate.length === 1 ? "schedule-created" : "schedule-created-batch";
      await this.createEventsInternal(eventsToCreate, reason);
      this.logDeliveryDebug("scheduleClientDeliveries:completed", {
        clientId: newDelivery.clientId,
        createdCount: eventsToCreate.length,
        createdDateKeys: eventsToCreate
          .map((event) =>
            event.deliveryDate ? deliveryDate.tryToISODateString(event.deliveryDate as any) : null
          )
          .filter((dateKey): dateKey is string => Boolean(dateKey))
          .sort(),
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to schedule deliveries");
    }
  }

  /**
   * Update an existing delivery event
   */
  public async updateEvent(id: string, data: Partial<DeliveryEvent>): Promise<void> {
    const cleanData = this.normalizeEventForWrite(data);
    try {
      const eventRef = doc(this.db, this.eventsCollection, id);
      const existingSnapshot = await getDoc(eventRef);
      const existingData = existingSnapshot.exists()
        ? (existingSnapshot.data() as Partial<DeliveryEvent>)
        : null;

      await retry(async () => {
        await updateDoc(eventRef, cleanData);
      });

      this.invalidateRecurringCache([
        {
          id,
          clientId: cleanData.clientId || existingData?.clientId,
          recurrence: cleanData.recurrence || existingData?.recurrence,
          recurrenceId: cleanData.recurrenceId || existingData?.recurrenceId,
        } as Partial<DeliveryEvent>,
      ]);

      const impactedDateKeys = this.normalizeDateKeys([
        existingData?.deliveryDate
          ? deliveryDate.toISODateString(existingData.deliveryDate as any)
          : null,
        cleanData.deliveryDate ? deliveryDate.toISODateString(cleanData.deliveryDate as any) : null,
      ]);
      const invalidationResult =
        await this.reconcileClusterAssignmentsForDateKeys(impactedDateKeys);
      this.emitDeliveryChange("schedule-updated", impactedDateKeys, invalidationResult);
    } catch (error) {
      throw formatServiceError(error, "Failed to update event");
    }
  }

  /**
   * Delete a delivery event
   */
  public async deleteEvent(id: string): Promise<void> {
    await this.deleteEventByScope(id, "single");
  }

  // Cache for recurring delivery date ranges to avoid repeated queries
  private dateRangeCache = new Map<string, { earliest: Date; latest: Date; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get recurring delivery date range for a specific series (optimized with caching)
   */
  public async getDeliverySeriesDateRange(seriesKey: string): Promise<DeliverySeriesDateRange> {
    if (!seriesKey) {
      return { earliest: null, latest: null };
    }

    const cached = this.dateRangeCache.get(seriesKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return { earliest: cached.earliest, latest: cached.latest };
    }

    try {
      return await retry(async () => {
        const q = query(
          collection(this.db, this.eventsCollection),
          where("recurrenceId", "==", seriesKey)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          return { earliest: null, latest: null };
        }

        const dates = querySnapshot.docs
          .map((doc) => {
            const data = doc.data();
            if (!data.deliveryDate) return null;
            const normalized = deliveryDate.toJSDate(data.deliveryDate);
            return isNaN(normalized.getTime()) ? null : normalized;
          })
          .filter((date): date is Date => date !== null);

        if (dates.length === 0) {
          return { earliest: null, latest: null };
        }

        // Find min/max dates efficiently
        const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
        const latest = new Date(Math.max(...dates.map((d) => d.getTime())));

        this.dateRangeCache.set(seriesKey, {
          earliest,
          latest,
          timestamp: Date.now(),
        });

        return { earliest, latest };
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get delivery series date range");
    }
  }

  /**
   * Batch get recurring delivery date ranges for multiple series
   */
  public async getBatchDeliverySeriesDateRanges(
    seriesKeys: string[]
  ): Promise<Map<string, DeliverySeriesDateRange>> {
    const uniqueSeriesKeys = Array.from(new Set(seriesKeys.filter(Boolean)));
    const results = new Map<string, DeliverySeriesDateRange>();
    const uncachedKeys: string[] = [];

    uniqueSeriesKeys.forEach((seriesKey) => {
      const cached = this.dateRangeCache.get(seriesKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        results.set(seriesKey, { earliest: cached.earliest, latest: cached.latest });
      } else {
        uncachedKeys.push(seriesKey);
      }
    });

    for (let i = 0; i < uncachedKeys.length; i += 10) {
      const chunk = uncachedKeys.slice(i, i + 10);
      try {
        const q = query(
          collection(this.db, this.eventsCollection),
          where("recurrenceId", "in", chunk)
        );
        const querySnapshot = await getDocs(q);
        const groupedDates = new Map<string, Date[]>();

        querySnapshot.docs.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          if (!data.recurrenceId || !data.deliveryDate) {
            return;
          }

          const normalized = deliveryDate.toJSDate(data.deliveryDate);
          if (Number.isNaN(normalized.getTime())) {
            return;
          }

          if (!groupedDates.has(data.recurrenceId)) {
            groupedDates.set(data.recurrenceId, []);
          }

          const dates = groupedDates.get(data.recurrenceId);
          if (dates) {
            dates.push(normalized);
          }
        });

        chunk.forEach((seriesKey) => {
          const dates = groupedDates.get(seriesKey) || [];
          const range =
            dates.length === 0
              ? { earliest: null, latest: null }
              : {
                  earliest: new Date(Math.min(...dates.map((date) => date.getTime()))),
                  latest: new Date(Math.max(...dates.map((date) => date.getTime()))),
                };
          results.set(seriesKey, range);
          if (range.earliest && range.latest) {
            this.dateRangeCache.set(seriesKey, {
              earliest: range.earliest,
              latest: range.latest,
              timestamp: Date.now(),
            });
          }
        });
      } catch (error) {
        console.error("Error fetching delivery series date ranges:", error);
        chunk.forEach((seriesKey) => {
          if (!results.has(seriesKey)) {
            results.set(seriesKey, { earliest: null, latest: null });
          }
        });
      }
    }

    return results;
  }

  public async auditRecurringSeriesIntegrity(): Promise<RecurringSeriesAuditReport> {
    try {
      const events = await this.getAllEvents();
      return buildRecurringSeriesAuditReport(events);
    } catch (error) {
      throw formatServiceError(error, "Failed to audit recurring delivery series integrity");
    }
  }

  public async enforceClientEndDate(
    clientId: string,
    newEndDate: string,
    previousEndDate?: string | null
  ): Promise<void> {
    const normalizedClientId = this.normalizeOptionalString(clientId);
    const normalizedNewEndDate = deliveryDate.tryToISODateString(newEndDate);
    const normalizedPreviousEndDate = previousEndDate
      ? deliveryDate.tryToISODateString(previousEndDate)
      : null;

    if (!normalizedClientId || !normalizedNewEndDate) {
      return;
    }

    if (normalizedPreviousEndDate && normalizedNewEndDate >= normalizedPreviousEndDate) {
      return;
    }

    try {
      const eventsQuery = query(
        collection(this.db, this.eventsCollection),
        where("clientId", "==", normalizedClientId)
      );
      const querySnapshot = await getDocs(eventsQuery);
      if (querySnapshot.empty) {
        return;
      }

      const todayKey = TimeUtils.today().toISODate() || deliveryDate.toISODateString(new Date());
      const mutations: Array<
        | { kind: "delete"; ref: typeof querySnapshot.docs[number]["ref"] }
        | {
            kind: "update";
            ref: typeof querySnapshot.docs[number]["ref"];
            data: { repeatsEndDate: string };
          }
      > = [];
      const deletedDateKeys: string[] = [];
      const updatedDateKeys: string[] = [];
      const cacheInvalidationEvents: Partial<DeliveryEvent>[] = [];

      querySnapshot.docs.forEach((docSnapshot) => {
        const eventData = docSnapshot.data() as Partial<DeliveryEvent>;
        const cacheEvent = { id: docSnapshot.id, ...eventData };
        const eventDateKey = eventData.deliveryDate
          ? deliveryDate.tryToISODateString(eventData.deliveryDate as any)
          : null;

        if (eventDateKey && eventDateKey > normalizedNewEndDate && eventDateKey >= todayKey) {
          mutations.push({ kind: "delete", ref: docSnapshot.ref });
          deletedDateKeys.push(eventDateKey);
          cacheInvalidationEvents.push(cacheEvent);
          return;
        }

        if (eventData.recurrence === "None" || eventData.recurrence === "Custom") {
          return;
        }

        const currentRepeatsEndDate = eventData.repeatsEndDate
          ? deliveryDate.tryToISODateString(eventData.repeatsEndDate as any)
          : null;
        const nextRepeatsEndDate =
          currentRepeatsEndDate && currentRepeatsEndDate < normalizedNewEndDate
            ? currentRepeatsEndDate
            : normalizedNewEndDate;

        if (nextRepeatsEndDate && nextRepeatsEndDate !== currentRepeatsEndDate) {
          mutations.push({
            kind: "update",
            ref: docSnapshot.ref,
            data: { repeatsEndDate: nextRepeatsEndDate },
          });
          if (eventDateKey) {
            updatedDateKeys.push(eventDateKey);
          }
          cacheInvalidationEvents.push(cacheEvent);
        }
      });

      if (!mutations.length) {
        return;
      }

      for (let i = 0; i < mutations.length; i += MAX_BATCH_WRITE_COUNT) {
        const chunk = mutations.slice(i, i + MAX_BATCH_WRITE_COUNT);
        await retry(async () => {
          const batch = writeBatch(this.db);
          chunk.forEach((mutation) => {
            if (mutation.kind === "delete") {
              batch.delete(mutation.ref);
              return;
            }

            batch.update(mutation.ref, mutation.data);
          });
          await batch.commit();
        });
      }

      this.invalidateRecurringCache(cacheInvalidationEvents);

      const normalizedDeletedDateKeys = this.normalizeDateKeys(deletedDateKeys);
      if (normalizedDeletedDateKeys.length) {
        const invalidationResult =
          await this.reconcileClusterAssignmentsForDateKeys(normalizedDeletedDateKeys);
        this.emitDeliveryChange(
          "schedule-batch-deleted",
          normalizedDeletedDateKeys,
          invalidationResult
        );
        return;
      }

      const normalizedUpdatedDateKeys = this.normalizeDateKeys(updatedDateKeys);
      if (normalizedUpdatedDateKeys.length) {
        this.emitDeliveryChange("schedule-batch-updated", normalizedUpdatedDateKeys, {
          impactedDateKeys: normalizedUpdatedDateKeys,
          reviewRequiredDateKeys: [],
          failedDateKeys: [],
        });
      }
    } catch (error) {
      throw formatServiceError(error, "Failed to enforce client end date");
    }
  }

  /**
   * Clear the date range cache (useful when new deliveries are added)
   */
  public clearDateRangeCache(): void {
    this.dateRangeCache.clear();
  }

  /**
   * Get events by client ID
   */
  public async getEventsByClientId(clientId: string): Promise<DeliveryEvent[]> {
    try {
      return await retry(async () => {
        const q = query(
          collection(this.db, this.eventsCollection),
          where("clientId", "==", clientId)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs
          .map((doc) => {
            const data = doc.data();
            if (!data.deliveryDate) {
              console.warn(`Document ${doc.id} is missing deliveryDate property`);
              return null;
            }
            const deliveryDateValue = deliveryDate.toJSDate(data.deliveryDate);
            return {
              id: doc.id,
              ...data,
              deliveryDate: deliveryDateValue,
            } as DeliveryEvent;
          })
          .filter((event): event is DeliveryEvent => event !== null);
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get events by client ID");
    }
  }

  /**
   * Reassign delivery events from a legacy client ID to a canonical client ID.
   * This is a data migration helper to keep a single source of truth for profile scheduling.
   */
  public async reassignClientEvents(sourceClientId: string, targetClientId: string): Promise<void> {
    const normalizedSource = this.normalizeOptionalString(sourceClientId);
    const normalizedTarget = this.normalizeOptionalString(targetClientId);

    if (!normalizedSource || !normalizedTarget || normalizedSource === normalizedTarget) {
      return;
    }

    try {
      this.logDeliveryDebug("reassignClientEvents:start", {
        sourceClientId: normalizedSource,
        targetClientId: normalizedTarget,
      });
      const snapshot = await retry(async () => {
        const q = query(
          collection(this.db, this.eventsCollection),
          where("clientId", "==", normalizedSource)
        );
        return getDocs(q);
      });

      if (snapshot.empty) {
        return;
      }

      const impactedDateKeys = this.normalizeDateKeys(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return data.deliveryDate ? deliveryDate.toISODateString(data.deliveryDate) : null;
        })
      );

      for (let i = 0; i < snapshot.docs.length; i += MAX_BATCH_WRITE_COUNT) {
        const chunk = snapshot.docs.slice(i, i + MAX_BATCH_WRITE_COUNT);
        await retry(async () => {
          const batch = writeBatch(this.db);
          chunk.forEach((docSnap) => {
            batch.update(docSnap.ref, {
              clientId: normalizedTarget,
            });
          });
          await batch.commit();
        });
      }

      const invalidationResult = await this.reconcileClusterAssignmentsForDateKeys(impactedDateKeys);
      this.emitDeliveryChange("schedule-batch-updated", impactedDateKeys, invalidationResult);
      this.logDeliveryDebug("reassignClientEvents:completed", {
        sourceClientId: normalizedSource,
        targetClientId: normalizedTarget,
        migratedCount: snapshot.size,
        impactedDateKeys,
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to reassign client delivery events");
    }
  }

  /**
   * Get daily delivery limits
   */
  public async getDailyLimits(): Promise<{ id: string; date: string; limit: number }[]> {
    try {
      return await retry(async () => {
        const snapshot = await getDocs(collection(this.db, this.dailyLimitsCollection));
        return snapshot.docs.map(
          (doc) => doc.data() as { id: string; date: string; limit: number }
        );
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get daily limits");
    }
  }

  /**
   * Set daily delivery limit
   */
  public async setDailyLimit(dateKey: string, limit: number): Promise<void> {
    try {
      await retry(async () => {
        const docRef = doc(this.db, this.dailyLimitsCollection, dateKey);
        await setDoc(docRef, { date: dateKey, limit });
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to set daily limit");
    }
  }

  /**
   * Get weekly delivery limits
   */
  public async getWeeklyLimits(): Promise<Record<string, number>> {
    try {
      return await retry(async () => {
        const docRef = doc(this.db, this.limitsCollection, this.limitsDocId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          // Return default weekly limits if document doesn't exist
          const defaultLimits: Record<string, number> = {
            sunday: 60,
            monday: 60,
            tuesday: 60,
            wednesday: 60,
            thursday: 90,
            friday: 90,
            saturday: 60,
          };
          // Create the document with default values
          await setDoc(docRef, defaultLimits);
          return defaultLimits;
        }
        return snapshot.data() as Record<string, number>;
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get weekly limits");
    }
  }

  /**
   * Update weekly delivery limits
   */
  public async updateWeeklyLimits(limits: Record<string, number>): Promise<void> {
    try {
      await retry(async () => {
        const docRef = doc(this.db, this.limitsCollection, this.limitsDocId);
        await setDoc(docRef, limits);
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to update weekly limits");
    }
  }

  /**
   * Get the previous 5 deliveries for a client
   */
  public async getPreviousDeliveries(clientId: string): Promise<DeliveryEvent[]> {
    try {
      return await retry(async () => {
        const todayDateTime = TimeUtils.today();
        if (!todayDateTime.isValid) {
          throw new ServiceError("Invalid date object");
        }
        const today = Time.Firebase.toTimestamp(todayDateTime);
        const pastQuery = query(
          collection(this.db, this.eventsCollection),
          where("clientId", "==", clientId),
          where("deliveryDate", "<", today),
          orderBy("deliveryDate", "desc"),
          limit(20)
        );
        const pastSnapshot = await getDocs(pastQuery);
        return pastSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            deliveryDate: deliveryDate.toJSDate(data.deliveryDate),
          } as DeliveryEvent;
        });
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get previous deliveries");
    }
  }

  /**
   * Get the next 5 deliveries for a client
   */
  public async getNextDeliveries(clientId: string): Promise<DeliveryEvent[]> {
    try {
      return await retry(async () => {
        const todayDateTime = TimeUtils.today();
        if (!todayDateTime.isValid) {
          throw new ServiceError("Invalid date object");
        }
        const today = Time.Firebase.toTimestamp(todayDateTime);
        const futureQuery = query(
          collection(this.db, this.eventsCollection),
          where("clientId", "==", clientId),
          where("deliveryDate", ">=", today),
          orderBy("deliveryDate", "asc"),
          limit(20)
        );
        const futureSnapshot = await getDocs(futureQuery);
        return futureSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            deliveryDate: deliveryDate.toJSDate(data.deliveryDate),
          } as DeliveryEvent;
        });
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get next deliveries");
    }
  }

  /**
   * Get the previous 5 and future 5 deliveries for a client
   */
  public async getClientDeliveryHistory(clientId: string): Promise<{
    pastDeliveries: DeliveryEvent[];
    futureDeliveries: DeliveryEvent[];
  }> {
    try {
      return await retry(async () => {
        const [pastDeliveries, futureDeliveries] = await Promise.all([
          this.getPreviousDeliveries(clientId),
          this.getNextDeliveries(clientId),
        ]);
        return { pastDeliveries, futureDeliveries };
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get client delivery history");
    }
  }
}

export default DeliveryService;
