import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import dataSources from "../config/dataSources";
import { deliveryDate } from "./deliveryDate";

type EventData = {
  clientId: string;
  deliveryDate?: Date | Timestamp | string;
};

const getLatestDateKey = (events: EventData[]): string | null => {
  return events.reduce<string | null>((latestDateKey, event) => {
    const currentDateKey = event.deliveryDate
      ? deliveryDate.tryToISODateString(event.deliveryDate)
      : null;

    if (!currentDateKey) {
      return latestDateKey;
    }

    if (!latestDateKey || currentDateKey > latestDateKey) {
      return currentDateKey;
    }

    return latestDateKey;
  }, null);
};

export const getLastDeliveryDateForClient = async (clientId: string): Promise<string | null> => {
  try {
    const eventsRef = collection(db, dataSources.firebase.calendarCollection);
    const q = query(eventsRef, where("clientId", "==", clientId), orderBy("deliveryDate", "desc"));
    const querySnapshot = await getDocs(q);

    return getLatestDateKey(querySnapshot.docs.map((doc) => doc.data() as EventData));
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

  if (!uniqueClientIds.length) {
    return result;
  }

  try {
    const eventsRef = collection(db, dataSources.firebase.calendarCollection);

    for (let i = 0; i < uniqueClientIds.length; i += 10) {
      const chunk = uniqueClientIds.slice(i, i + 10);
      const q = query(eventsRef, where("clientId", "in", chunk), orderBy("deliveryDate", "desc"));
      const querySnapshot = await getDocs(q);
      const eventsByClientId = new Map<string, EventData[]>();

      querySnapshot.forEach((doc) => {
        const eventData = doc.data() as EventData;
        if (!eventData.clientId) {
          return;
        }

        if (!eventsByClientId.has(eventData.clientId)) {
          eventsByClientId.set(eventData.clientId, []);
        }
        eventsByClientId.get(eventData.clientId)?.push(eventData);
      });

      chunk.forEach((clientId) => {
        const latestDateKey = getLatestDateKey(eventsByClientId.get(clientId) || []);
        if (latestDateKey) {
          result.set(clientId, latestDateKey);
        }
      });
    }

    return result;
  } catch (error) {
    console.error("Error batch fetching last delivery dates:", error);
    return result;
  }
};
