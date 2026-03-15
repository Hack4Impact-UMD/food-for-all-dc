import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import dataSources from "../config/dataSources";
import { getLatestScheduledDate } from "./recurringSeries";

type EventData = {
  clientId: string;
  deliveryDate?: Date | Timestamp | string;
};

type EventWithDeliveryDate = { deliveryDate: Date | Timestamp | string };

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

  if (clientIds.length === 0) return result;

  try {
    const eventsRef = collection(db, dataSources.firebase.calendarCollection);
    const q = query(eventsRef, where("clientId", "in", clientIds), orderBy("deliveryDate", "desc"));
    const querySnapshot = await getDocs(q);

    const clientEventsMap = new Map<string, EventWithDeliveryDate[]>();

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
