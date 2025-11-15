import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import dataSources from "../config/dataSources";
import { deliveryDate } from "./deliveryDate";

type EventData = {
  clientId: string;
  deliveryDate?: Date | Timestamp | string;
  recurrenceId?: string;
  docId?: string;
  repeatsEndDate?: string;
  recurrence?: string;
};

const toISODate = (value?: Date | Timestamp | string): string | null => {
  if (!value) {
    return null;
  }
  return deliveryDate.tryToISODateString(value);
};

export const getLastDeliveryDateForClient = async (clientId: string): Promise<string | null> => {
  try {
    const eventsRef = collection(db, dataSources.firebase.calendarCollection);
    const q = query(eventsRef, where("clientId", "==", clientId), orderBy("deliveryDate", "desc"));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const seriesMap = new Map<string, EventData[]>();

      querySnapshot.forEach((doc) => {
        const eventData = doc.data() as EventData;
        const recurrenceId = eventData.recurrenceId || "single-" + doc.id;
        if (!seriesMap.has(recurrenceId)) {
          seriesMap.set(recurrenceId, []);
        }
        const arr = seriesMap.get(recurrenceId);
        if (arr) arr.push({ ...eventData, docId: doc.id });
      });

      let mostRecentSeriesEndDate: string | null = null;

      for (const [, events] of seriesMap.entries()) {
        const firstEvent = events.length > 0 ? events[0] : undefined;
        if (!firstEvent) continue;

        let seriesEndDate: string | null = null;
        if (firstEvent.repeatsEndDate) {
          seriesEndDate = toISODate(firstEvent.repeatsEndDate);
        } else if (firstEvent.recurrence === "None" && firstEvent.deliveryDate) {
          seriesEndDate = toISODate(firstEvent.deliveryDate);
        }

        if (seriesEndDate) {
          if (!mostRecentSeriesEndDate || seriesEndDate > mostRecentSeriesEndDate) {
            mostRecentSeriesEndDate = seriesEndDate;
          }
        }
      }

      return mostRecentSeriesEndDate;
    }

    return null;
  } catch (error) {
    console.error("Error fetching last delivery date:", error);
    return null;
  }
};

export const batchGetLastDeliveryDates = async (
  clientIds: string[]
): Promise<Map<string, string>> => {
  const result = new Map<string, string>();

  if (clientIds.length === 0) return result;

  try {
    const eventsRef = collection(db, dataSources.firebase.calendarCollection);
    const q = query(eventsRef, where("clientId", "in", clientIds), orderBy("deliveryDate", "desc"));
    const querySnapshot = await getDocs(q);

    // (imports and types already declared at top)
    const clientSeriesMap = new Map<string, Map<string, EventData[]>>();

    querySnapshot.forEach((doc) => {
      const eventData = doc.data() as EventData;
      const clientId = eventData.clientId;
      if (!clientSeriesMap.has(clientId)) {
        clientSeriesMap.set(clientId, new Map<string, EventData[]>());
      }
      const seriesMap = clientSeriesMap.get(clientId);
      if (!seriesMap) return;
      const recurrenceId = eventData.recurrenceId || "single-" + doc.id;
      if (!seriesMap.has(recurrenceId)) {
        seriesMap.set(recurrenceId, []);
      }
      const arr = seriesMap.get(recurrenceId);
      if (arr) arr.push({ ...eventData, docId: doc.id });
    });

    for (const [clientId, seriesMap] of clientSeriesMap.entries()) {
      let mostRecentSeriesEndDate: string | null = null;

      for (const [, events] of seriesMap.entries()) {
        const firstEvent = events.length > 0 ? events[0] : undefined;
        if (!firstEvent) continue;

        let seriesEndDate: string | null = null;
        if (firstEvent.repeatsEndDate) {
          seriesEndDate = toISODate(firstEvent.repeatsEndDate);
        } else if (firstEvent.recurrence === "None" && firstEvent.deliveryDate) {
          seriesEndDate = toISODate(firstEvent.deliveryDate);
        }

        if (seriesEndDate) {
          if (!mostRecentSeriesEndDate || seriesEndDate > mostRecentSeriesEndDate) {
            mostRecentSeriesEndDate = seriesEndDate;
          }
        }
      }

      if (mostRecentSeriesEndDate) {
        result.set(clientId, mostRecentSeriesEndDate);
      }
    }

    return result;
  } catch (error) {
    console.error("Error batch fetching last delivery dates:", error);
    return result;
  }
};
