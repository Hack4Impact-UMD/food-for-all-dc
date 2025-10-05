import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";

export const deleteDeliveriesAfterEndDate = async (clientId: string, newEndDate: string): Promise<void> => {
  const eventsRef = collection(db, "events");
  const q = query(eventsRef, where("clientId", "==", clientId));
  const querySnapshot = await getDocs(q);

  const deletionPromises: Promise<void>[] = [];
  const newEndDateTime = new Date(newEndDate);

  querySnapshot.forEach((docSnapshot) => {
    const eventData = docSnapshot.data();
    if (eventData.deliveryDate) {
      const deliveryDate = eventData.deliveryDate.toDate();
      const deliveryDateStr = deliveryDate.toISOString().split('T')[0];
      const endDateStr = newEndDateTime.toISOString().split('T')[0];

      if (deliveryDateStr > endDateStr) {
        deletionPromises.push(deleteDoc(doc(db, "events", docSnapshot.id)));
      }
    }
  });

  await Promise.all(deletionPromises);
};
