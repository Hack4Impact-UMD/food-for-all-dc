import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import dataSources from "../config/dataSources";
import { deliveryDate } from "./deliveryDate";

export const deleteDeliveriesAfterEndDate = async (
  clientId: string,
  newEndDate: string
): Promise<void> => {
  if (!clientId || !newEndDate) {
    console.error("Invalid parameters for deleteDeliveriesAfterEndDate");
    return;
  }

  const eventsRef = collection(db, dataSources.firebase.calendarCollection);
  const q = query(eventsRef, where("clientId", "==", clientId));
  const querySnapshot = await getDocs(q);

  const deletionPromises: Promise<void>[] = [];
  const endDateStr = deliveryDate.tryToISODateString(newEndDate);
  if (!endDateStr) {
    return;
  }

  querySnapshot.forEach((docSnapshot) => {
    const eventData = docSnapshot.data();
    if (!eventData.deliveryDate) {
      return;
    }

    const deliveryDateStr = deliveryDate.tryToISODateString(eventData.deliveryDate);

    if (deliveryDateStr && deliveryDateStr > endDateStr) {
      deletionPromises.push(
        deleteDoc(doc(db, dataSources.firebase.calendarCollection, docSnapshot.id))
      );
    }
  });

  if (deletionPromises.length > 0) {
    await Promise.all(deletionPromises);
  }
};
