import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";

export const getLastDeliveryDateForClient = async (clientId: string): Promise<string | null> => {
  try {
    const eventsRef = collection(db, "events");
    const q = query(
      eventsRef,
      where("clientId", "==", clientId),
      orderBy("deliveryDate", "desc")
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const seriesMap = new Map<string, any[]>();

      querySnapshot.forEach((doc) => {
        const eventData = doc.data();
        const recurrenceId = eventData.recurrenceId || 'single-' + doc.id;

        if (!seriesMap.has(recurrenceId)) {
          seriesMap.set(recurrenceId, []);
        }
        seriesMap.get(recurrenceId)!.push({...eventData, docId: doc.id});
      });

      let mostRecentSeriesEndDate: string | null = null;
      let mostRecentSeriesStartDate: string | null = null;

      for (const [recurrenceId, events] of seriesMap.entries()) {
        const firstEvent = events[0];

        let seriesStartDate: string | null = null;
        if (firstEvent.seriesStartDate) {
          seriesStartDate = firstEvent.seriesStartDate;
        } else if (firstEvent.deliveryDate) {
          const deliveryDate = firstEvent.deliveryDate.toDate();
          if (!isNaN(deliveryDate.getTime())) {
            seriesStartDate = deliveryDate.toISOString().split("T")[0];
          }
        }

        if (seriesStartDate) {
          if (!mostRecentSeriesStartDate || seriesStartDate > mostRecentSeriesStartDate) {
            mostRecentSeriesStartDate = seriesStartDate;

            if (firstEvent.repeatsEndDate) {
              const endDate = new Date(firstEvent.repeatsEndDate);
              if (!isNaN(endDate.getTime())) {
                mostRecentSeriesEndDate = endDate.toISOString().split("T")[0];
              }
            } else if (firstEvent.recurrence === "None" && firstEvent.deliveryDate) {
              const deliveryDate = firstEvent.deliveryDate.toDate();
              if (!isNaN(deliveryDate.getTime())) {
                mostRecentSeriesEndDate = deliveryDate.toISOString().split("T")[0];
              }
            }
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

export const batchGetLastDeliveryDates = async (clientIds: string[]): Promise<Map<string, string>> => {
  const result = new Map<string, string>();

  if (clientIds.length === 0) return result;

  try {
    const eventsRef = collection(db, "events");
    const q = query(
      eventsRef,
      where("clientId", "in", clientIds),
      orderBy("deliveryDate", "desc")
    );
    const querySnapshot = await getDocs(q);

    const clientSeriesMap = new Map<string, Map<string, any[]>>();

    querySnapshot.forEach((doc) => {
      const eventData = doc.data();
      const clientId = eventData.clientId;

      if (!clientSeriesMap.has(clientId)) {
        clientSeriesMap.set(clientId, new Map());
      }

      const seriesMap = clientSeriesMap.get(clientId)!;
      const recurrenceId = eventData.recurrenceId || 'single-' + doc.id;

      if (!seriesMap.has(recurrenceId)) {
        seriesMap.set(recurrenceId, []);
      }
      seriesMap.get(recurrenceId)!.push({...eventData, docId: doc.id});
    });

    for (const [clientId, seriesMap] of clientSeriesMap.entries()) {
      let mostRecentSeriesEndDate: string | null = null;
      let mostRecentSeriesStartDate: string | null = null;

      for (const [recurrenceId, events] of seriesMap.entries()) {
        const firstEvent = events[0];

        let seriesStartDate: string | null = null;
        if (firstEvent.seriesStartDate) {
          seriesStartDate = firstEvent.seriesStartDate;
        } else if (firstEvent.deliveryDate) {
          const deliveryDate = firstEvent.deliveryDate.toDate();
          if (!isNaN(deliveryDate.getTime())) {
            seriesStartDate = deliveryDate.toISOString().split("T")[0];
          }
        }

        if (seriesStartDate) {
          if (!mostRecentSeriesStartDate || seriesStartDate > mostRecentSeriesStartDate) {
            mostRecentSeriesStartDate = seriesStartDate;

            if (firstEvent.repeatsEndDate) {
              const endDate = new Date(firstEvent.repeatsEndDate);
              if (!isNaN(endDate.getTime())) {
                mostRecentSeriesEndDate = endDate.toISOString().split("T")[0];
              }
            } else if (firstEvent.recurrence === "None" && firstEvent.deliveryDate) {
              const deliveryDate = firstEvent.deliveryDate.toDate();
              if (!isNaN(deliveryDate.getTime())) {
                mostRecentSeriesEndDate = deliveryDate.toISOString().split("T")[0];
              }
            }
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
