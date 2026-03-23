import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import dataSources from "../config/dataSources";
import TimeUtils from "./timeUtils";
import { deliveryDate } from "./deliveryDate";

type EventData = {
  clientId: string;
  deliveryDate?: Date | Timestamp | string;
};

type EventWithDeliveryDate = { deliveryDate: Date | Timestamp | string };

const hasDeliveryDate = (
  event: Pick<EventData, "deliveryDate">
): event is EventWithDeliveryDate => Boolean(event.deliveryDate);

export const getLatestPastDeliveryDate = (
  events: Array<Pick<EventData, "deliveryDate">>,
  today = TimeUtils.now().startOf("day")
): string | null => {
  const cutoffDate = today.toISODate();

  if (!cutoffDate) {
    return null;
  }

  let latestDate: string | null = null;

  events.forEach((event) => {
    const normalizedDate = deliveryDate.tryToISODateString(event.deliveryDate);
    if (!normalizedDate || normalizedDate > cutoffDate) {
      return;
    }

    if (!latestDate || normalizedDate > latestDate) {
      latestDate = normalizedDate;
    }
  });

  return latestDate;
};

export const getLatestPastDeliveryDateForClient = async (
  clientId: string,
  today = TimeUtils.now().startOf("day")
): Promise<string | null> => {
  try {
    const eventsRef = collection(db, dataSources.firebase.calendarCollection);
    const q = query(eventsRef, where("clientId", "==", clientId), orderBy("deliveryDate", "desc"));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return getLatestPastDeliveryDate(
        querySnapshot.docs
          .map((doc) => doc.data() as Pick<EventData, "deliveryDate">)
          .filter(hasDeliveryDate),
        today
      );
    }

    return null;
  } catch (error) {
    console.error("Error fetching last delivery date:", error);
    return null;
  }
};

export const batchGetLatestPastDeliveryDates = async (
  clientIds: string[],
  today = TimeUtils.now().startOf("day")
): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  const uniqueClientIds = Array.from(new Set(clientIds.filter(Boolean)));

  if (uniqueClientIds.length === 0) return result;

  try {
    const eventsRef = collection(db, dataSources.firebase.calendarCollection);
    const clientEventsMap = new Map<string, EventWithDeliveryDate[]>();

    for (let i = 0; i < uniqueClientIds.length; i += 10) {
      const chunk = uniqueClientIds.slice(i, i + 10);
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
      const latestDate = getLatestPastDeliveryDate(events, today);
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
