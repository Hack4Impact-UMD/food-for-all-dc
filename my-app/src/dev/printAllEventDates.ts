import { getDocs, collection } from "firebase/firestore";
import { db } from "../services/firebase";
import { Time } from "../utils/timeUtils";
import dataSources from '../config/dataSources';

// Script to print all event deliveryDates in Firestore
export async function printAllEventDates() {
  const snapshot = await getDocs(collection(db, dataSources.firebase.calendarCollection));
  console.log(`[printAllEventDates] Found ${snapshot.docs.length} events`);
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const deliveryDate = data.deliveryDate;
    let dateString: string;
    if (deliveryDate && deliveryDate.toDate) {
      dateString = Time.Firebase.fromTimestamp(deliveryDate).toISO() || "(invalid date)";
    } else if (deliveryDate) {
      dateString = deliveryDate.toString();
    } else {
      dateString = "(no deliveryDate)";
    }
    console.log(`[printAllEventDates] id: ${doc.id}, deliveryDate: ${dateString}`);
  });
}

// To run this, import and call printAllEventDates() from a dev page or use in a test/dev script.
