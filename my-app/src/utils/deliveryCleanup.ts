import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import dataSources from '../config/dataSources';

export const deleteDeliveriesAfterEndDate = async (clientId: string, newEndDate: string): Promise<void> => {
  if (!clientId || !newEndDate) {
    console.error("Invalid parameters for deleteDeliveriesAfterEndDate");
    return;
  }

  const eventsRef = collection(db, dataSources.firebase.calendarCollection);
  const q = query(eventsRef, where("clientId", "==", clientId));
  const querySnapshot = await getDocs(q);

  const deletionPromises: Promise<void>[] = [];
  const endDateStr = new Date(newEndDate).toISOString().split('T')[0];

  querySnapshot.forEach((docSnapshot) => {
    const eventData = docSnapshot.data();
    if (eventData.deliveryDate) {
      const deliveryDate = eventData.deliveryDate.toDate();
      const deliveryDateStr = deliveryDate.toISOString().split('T')[0];

      if (deliveryDateStr > endDateStr) {
  deletionPromises.push(deleteDoc(doc(db, dataSources.firebase.calendarCollection, docSnapshot.id)));
      }
    }
  });

  if (deletionPromises.length > 0) {
    await Promise.all(deletionPromises);
  }
};
