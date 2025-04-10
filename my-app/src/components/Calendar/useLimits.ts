// CUSTOM HOOK TO GET DATES
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../auth/firebaseConfig";



const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const useLimits = () => {
  const [limits, setLimits] = useState<number[]>([60, 60, 60, 60, 90, 90, 60]);

  useEffect(() => {
    const limitsDocRef = doc(db, 'limits', 'weekly');
    const unsubscribe = onSnapshot(limitsDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const newLimits = DAYS.map(day => data[day] || 60);
        setLimits(newLimits); // React re-render
      }
    });

    return () => unsubscribe();
  }, []);

  return limits;
};