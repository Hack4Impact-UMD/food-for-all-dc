import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";

/**
 * Shared utility function to get the last delivery date for a client
 * This ensures both the profile page and modal use identical logic
 */
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
      // Group events by series to find the most recently created delivery series
      const seriesMap = new Map<string, any[]>();
      
      querySnapshot.forEach((doc) => {
        const eventData = doc.data();
        const recurrenceId = eventData.recurrenceId || 'single-' + doc.id;
        
        if (!seriesMap.has(recurrenceId)) {
          seriesMap.set(recurrenceId, []);
        }
        seriesMap.get(recurrenceId)!.push({...eventData, docId: doc.id});
      });

      // Find the most recently created delivery series based on seriesStartDate
      let mostRecentSeriesEndDate: string | null = null;
      let mostRecentSeriesStartDate: string | null = null;

      for (const [recurrenceId, events] of seriesMap.entries()) {
        const firstEvent = events[0];
        
        // Get the series start date to determine which series is most recent
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
          // If this series is more recent than our current most recent, use it
          if (!mostRecentSeriesStartDate || seriesStartDate > mostRecentSeriesStartDate) {
            mostRecentSeriesStartDate = seriesStartDate;
            
            // For this series, get the end date
            if (firstEvent.repeatsEndDate) {
              const endDate = new Date(firstEvent.repeatsEndDate);
              if (!isNaN(endDate.getTime())) {
                mostRecentSeriesEndDate = endDate.toISOString().split("T")[0];
              }
            } else if (firstEvent.recurrence === "None" && firstEvent.deliveryDate) {
              // For single deliveries, the end date is the delivery date itself
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