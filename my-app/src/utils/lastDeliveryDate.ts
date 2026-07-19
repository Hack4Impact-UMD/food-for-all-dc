import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import dataSources from "../config/dataSources";
import { getLatestScheduledDate } from "./recurringSeries";
import { deliveryDate } from "./deliveryDate";

type EventData = {
  clientId: string;
  deliveryDate?: Date | Timestamp | string;
};

type EventWithDeliveryDate = { deliveryDate: Date | Timestamp | string };
export type ClientDeliverySummary = {
  lastDeliveryDate: string;
  missedStrikeCount: number;
};

const FIRESTORE_IN_QUERY_LIMIT_CANDIDATES = [30, 10] as const;
const FIRESTORE_CHUNK_QUERY_CONCURRENCY = 4;

const buildClientIdChunks = (clientIds: string[], chunkSize: number): string[][] => {
  const chunks: string[][] = [];
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    chunks.push(clientIds.slice(i, i + chunkSize));
  }
  return chunks;
};

const isFirestoreInLimitError = (error: unknown): boolean => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const normalized = message.toLowerCase();

  const mentionsInOperator = normalized.includes("'in'") || normalized.includes(" in ");
  const mentionsLimitPhrase =
    normalized.includes("supports up to") || normalized.includes("maximum of");
  const mentionsComparisonCount =
    normalized.includes("comparison values") ||
    normalized.includes("elements") ||
    normalized.includes("filters support");

  return (
    mentionsInOperator && mentionsLimitPhrase && mentionsComparisonCount
  );
};

const fetchSnapshotsByClientIdChunks = async (
  eventsRef: ReturnType<typeof collection>,
  clientIds: string[],
  inLimit: number,
  onOrBefore?: Date | Timestamp | string
) => {
  const chunks = buildClientIdChunks(clientIds, inLimit);
  const snapshots: Awaited<ReturnType<typeof getDocs>>[] = [];
  const cutoffDate =
    onOrBefore instanceof Date
      ? onOrBefore
      : onOrBefore instanceof Timestamp
        ? onOrBefore.toDate()
        : onOrBefore
          ? deliveryDate.tryToDateTime(onOrBefore)?.toJSDate()
          : null;

  for (let i = 0; i < chunks.length; i += FIRESTORE_CHUNK_QUERY_CONCURRENCY) {
    const concurrentChunks = chunks.slice(i, i + FIRESTORE_CHUNK_QUERY_CONCURRENCY);
    const batchSnapshots = await Promise.all(
      concurrentChunks.map((chunk) => {
        const constraints: QueryConstraint[] = [where("clientId", "in", chunk)];
        if (cutoffDate) {
          constraints.push(
            where("deliveryDate", "<=", Timestamp.fromDate(cutoffDate))
          );
        }
        constraints.push(orderBy("deliveryDate", "desc"));
        return getDocs(query(eventsRef, ...constraints));
      })
    );
    snapshots.push(...batchSnapshots);
  }

  return snapshots;
};

const fetchSnapshotsWithAdaptiveInLimit = async (
  eventsRef: ReturnType<typeof collection>,
  clientIds: string[],
  onOrBefore?: Date | Timestamp | string
) => {
  let lastError: unknown = null;

  for (const candidateLimit of FIRESTORE_IN_QUERY_LIMIT_CANDIDATES) {
    try {
      return await fetchSnapshotsByClientIdChunks(
        eventsRef,
        clientIds,
        candidateLimit,
        onOrBefore
      );
    } catch (error) {
      lastError = error;
      if (!isFirestoreInLimitError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Unable to fetch snapshots for client IDs");
};

const hasDeliveryDate = (
  event: Pick<EventData, "deliveryDate">
): event is EventWithDeliveryDate => Boolean(event.deliveryDate);

export const getLastDeliveryDateForClient = async (clientId: string): Promise<string | null> => {
  try {
    const eventsRef = collection(db, dataSources.firebase.calendarCollection);
    const q = query(eventsRef, where("clientId", "==", clientId), orderBy("deliveryDate", "desc"));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return getLatestScheduledDate(
        querySnapshot.docs
          .map((doc) => doc.data() as Pick<EventData, "deliveryDate">)
          .filter(hasDeliveryDate)
      );
    }

    return null;
  } catch (error) {
    console.error("Error fetching last delivery date:", error);
    return null;
  }
};

export const batchGetLastDeliveryDates = async (
  clientIds: string[],
  onOrBefore?: Date | Timestamp | string
): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  const uniqueClientIds = Array.from(new Set(clientIds.filter(Boolean)));

  if (uniqueClientIds.length === 0) return result;

  try {
    const eventsRef = collection(db, dataSources.firebase.calendarCollection);
    const clientEventsMap = new Map<string, EventWithDeliveryDate[]>();
    const snapshots = await fetchSnapshotsWithAdaptiveInLimit(
      eventsRef,
      uniqueClientIds,
      onOrBefore
    );
    const cutoffDateKey = onOrBefore ? deliveryDate.tryToISODateString(onOrBefore) : null;

    snapshots.forEach((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        const eventData = doc.data() as EventData;
        const eventDateKey = deliveryDate.tryToISODateString(eventData.deliveryDate);
        if (
          cutoffDateKey &&
          eventDateKey &&
          deliveryDate.compare(eventDateKey, cutoffDateKey) > 0
        ) {
          return;
        }
        if (!clientEventsMap.has(eventData.clientId)) {
          clientEventsMap.set(eventData.clientId, []);
        }
        const clientEvents = clientEventsMap.get(eventData.clientId);
        if (clientEvents && eventData.deliveryDate) {
          clientEvents.push({ deliveryDate: eventData.deliveryDate });
        }
      });
    });

    for (const [clientId, events] of clientEventsMap.entries()) {
      const latestDate = getLatestScheduledDate(events);
      if (latestDate) {
        result.set(clientId, latestDate);
      }
    }

    return result;
  } catch (error) {
    console.error("Error batch fetching last delivery dates:", error);
    return result;
  }
};

export const batchGetClientDeliverySummaries = async (
  clientIds: string[]
): Promise<Map<string, ClientDeliverySummary>> => {
  const result = new Map<string, ClientDeliverySummary>();
  const uniqueClientIds = Array.from(new Set(clientIds.filter(Boolean)));

  if (uniqueClientIds.length === 0) return result;

  try {
    const eventsRef = collection(db, dataSources.firebase.calendarCollection);
    const snapshots = await fetchSnapshotsWithAdaptiveInLimit(eventsRef, uniqueClientIds);

    snapshots.forEach((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        const eventData = doc.data() as EventData & { deliveryStatus?: string };
        if (!eventData.clientId) {
          return;
        }

        const summary = result.get(eventData.clientId) ?? {
          lastDeliveryDate: "",
          missedStrikeCount: 0,
        };

        if (eventData.deliveryStatus === "Missed") {
          summary.missedStrikeCount += 1;
        }

        const eventDeliveryDate = deliveryDate.tryToISODateString(eventData.deliveryDate);
        if (
          eventDeliveryDate &&
          (!summary.lastDeliveryDate ||
            deliveryDate.compare(eventDeliveryDate, summary.lastDeliveryDate) > 0)
        ) {
          summary.lastDeliveryDate = eventDeliveryDate;
        }

        result.set(eventData.clientId, summary);
      });
    });

    return result;
  } catch (error) {
    console.error("Error batch fetching client delivery summaries:", error);
    throw error;
  }
};
