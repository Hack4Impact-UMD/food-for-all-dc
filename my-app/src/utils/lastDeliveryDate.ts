import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
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

const FIRESTORE_IN_QUERY_LIMIT = 10;

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
  clientIds: string[]
): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  const uniqueClientIds = Array.from(new Set(clientIds.filter(Boolean)));

  if (uniqueClientIds.length === 0) return result;

  try {
    const eventsRef = collection(db, dataSources.firebase.calendarCollection);
    const clientEventsMap = new Map<string, EventWithDeliveryDate[]>();

    for (let i = 0; i < uniqueClientIds.length; i += FIRESTORE_IN_QUERY_LIMIT) {
      const chunk = uniqueClientIds.slice(i, i + FIRESTORE_IN_QUERY_LIMIT);
      const q = query(eventsRef, where("clientId", "in", chunk), orderBy("deliveryDate", "desc"));
      const querySnapshot = await getDocs(q);

      querySnapshot.forEach((doc) => {
        const eventData = doc.data() as EventData;
        if (!clientEventsMap.has(eventData.clientId)) {
          clientEventsMap.set(eventData.clientId, []);
        }
        const clientEvents = clientEventsMap.get(eventData.clientId);
        if (clientEvents && eventData.deliveryDate) {
          clientEvents.push({ deliveryDate: eventData.deliveryDate });
        }
      });
    }

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
    const chunks: string[][] = [];

    for (let i = 0; i < uniqueClientIds.length; i += FIRESTORE_IN_QUERY_LIMIT) {
      chunks.push(uniqueClientIds.slice(i, i + FIRESTORE_IN_QUERY_LIMIT));
    }

    const snapshots = await Promise.all(
      chunks.map((chunk) =>
        getDocs(query(eventsRef, where("clientId", "in", chunk), orderBy("deliveryDate", "desc")))
      )
    );

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
