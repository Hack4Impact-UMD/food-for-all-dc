// CUSTOM HOOK TO GET DATES
import { useState, useEffect } from "react";
import { DeliveryService } from "../../../services";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../auth/firebaseConfig";
import dataSources from "../../../config/dataSources";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export const useLimits = () => {
  // const [limits, setLimits] = useState<number[]>([60, 60, 60, 60, 90, 90, 60]);

  // useEffect(() => {
  //   // Get delivery service
  //   const deliveryService = DeliveryService.getInstance();

  //   // Initial fetch of limits
  //   const fetchLimits = async () => {
  //     try {
  //       const weeklyLimits = await deliveryService.getWeeklyLimits();
  //       const newLimits = DAYS.map(day => weeklyLimits[day] || 60);
  //       setLimits(newLimits);
  //     } catch (error) {
  //       console.error("Error fetching limits:", error);
  //     }
  //   };

  //   fetchLimits();

  //   // Set up a polling mechanism to check for updates every 30 seconds
  //   // This replaces the Firestore onSnapshot which we can't directly use with the service
  //   const intervalId = setInterval(fetchLimits, 5000);

  //   // Clean up interval on component unmount
  //   return () => clearInterval(intervalId);
  // }, []);

  // return limits;
  const [limits, setLimits] = useState<number[]>([60, 60, 60, 60, 90, 90, 60]);

  useEffect(() => {
    const limitsDocRef = doc(db, dataSources.firebase.limitsCollection || "limits", "weekly");
    const unsubscribe = onSnapshot(limitsDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const newLimits = DAYS.map((day) => data[day] || 60);
        setLimits(newLimits); // React re-render
      }
    });

    return () => unsubscribe();
  }, []);

  return limits;
};
