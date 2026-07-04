// CUSTOM HOOK TO GET DATES
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../auth/firebaseConfig";
import dataSources from "../../../config/dataSources";
import {
  DEFAULT_CALENDAR_DELIVERY_LIMIT,
  DEFAULT_WEEKLY_CALENDAR_DELIVERY_LIMITS,
} from "../../../config/calendarLimits";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export const useLimits = () => {
  const [limits, setLimits] = useState<number[]>(
    DAYS.map((day) => DEFAULT_WEEKLY_CALENDAR_DELIVERY_LIMITS[day])
  );

  useEffect(() => {
    const limitsDocRef = doc(
      db,
      dataSources.firebase.limitsCollection || "limits",
      dataSources.firebase.limitsDocId
    );
    const unsubscribe = onSnapshot(limitsDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const newLimits = DAYS.map((day) =>
          typeof data[day] === "number" ? data[day] : DEFAULT_CALENDAR_DELIVERY_LIMIT
        );
        setLimits(newLimits); // React re-render
      }
    });

    return () => unsubscribe();
  }, []);

  return limits;
};
