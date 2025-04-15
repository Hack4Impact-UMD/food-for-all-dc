import { DayPilot } from "@daypilot/daypilot-lite-react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../auth/firebaseConfig";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

let firestoreLimits: number[] = [60, 60, 60, 60, 90, 90, 60];

// listener for Firestore updates
const limitsDocRef = doc(db, "limits", "weekly");
const unsubscribe = onSnapshot(limitsDocRef, (docSnapshot) => {
  if (docSnapshot.exists()) {
    const data = docSnapshot.data();
    firestoreLimits = DAYS.map((day) => data[day] || 60);
  } else {
    // Create document with default vals if doesnt exist
    const defaultLimits = DAYS.reduce(
      (acc, day, index) => ({
        ...acc,
        [day]: firestoreLimits[index],
      }),
      {}
    );
    setDoc(limitsDocRef, defaultLimits);
  }
});

export const getDefaultLimit = (date: DayPilot.Date, limits: number[]): number => {
  return limits[date.getDayOfWeek()];
};

export const setDefaultLimit = async (date: DayPilot.Date, newLimit: number): Promise<void> => {
  const dayIndex = date.getDayOfWeek();
  const dayField = DAYS[dayIndex];

  // error checking
  try {
    await updateDoc(limitsDocRef, { [dayField]: newLimit });
  } catch (error) {
    console.error("Error updating limit:", error);
    if (error instanceof Error && "code" in error && error.code === "not-found") {
      await setDoc(limitsDocRef, { [dayField]: newLimit }, { merge: true });
    }
  }
};
