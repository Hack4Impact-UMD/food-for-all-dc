import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import FirebaseService from "./firebase-service";
import { DeliveryEvent } from "../components/Calendar/types";

/**
 * Delivery Service - Handles all delivery-related operations with Firebase
 */
class DeliveryService {
  private static instance: DeliveryService;
  private db = FirebaseService.getInstance().getFirestore();
  private eventsCollection = "events";
  private dailyLimitsCollection = "dailyLimits";
  private limitsCollection = "limits";
  private limitsDocId = "weekly";

  // Private constructor to prevent direct instantiation
  // This is part of the singleton pattern
  private constructor() {
    // Intentionally empty - initialization happens with class properties
  }

  public static getInstance(): DeliveryService {
    if (!DeliveryService.instance) {
      DeliveryService.instance = new DeliveryService();
    }
    return DeliveryService.instance;
  }

  /**
   * Get all delivery events
   */
  public async getAllEvents(): Promise<DeliveryEvent[]> {
    try {
      const snapshot = await getDocs(collection(this.db, this.eventsCollection));
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          deliveryDate: data.deliveryDate.toDate(), // Convert Timestamp to Date
        } as DeliveryEvent;
      });
    } catch (error) {
      console.error("Error getting events:", error);
      throw error;
    }
  }

  /**
   * Get delivery events by date range
   */
  public async getEventsByDateRange(startDate: Date, endDate: Date): Promise<DeliveryEvent[]> {
    try {
      const q = query(
        collection(this.db, this.eventsCollection),
        where("deliveryDate", ">=", startDate),
        where("deliveryDate", "<=", endDate)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        const deliveryDateUTC = data.deliveryDate.toDate(); // Get UTC date
        const deliveryDateLocal = new Date(
          deliveryDateUTC.getTime() + deliveryDateUTC.getTimezoneOffset() * 60000
        ); // Convert to local time

        return {
          id: doc.id,
          ...data,
          deliveryDate: deliveryDateLocal, // Use the normalized local date
        } as DeliveryEvent;
      });
    } catch (error) {
      console.error("Error fetching events:", error);
      throw error;
    }
  }

  /**
   * Create a new delivery event
   */
  public async createEvent(event: Partial<DeliveryEvent>): Promise<string> {
    try {
      const docRef = await addDoc(collection(this.db, this.eventsCollection), event);
      return docRef.id;
    } catch (error) {
      console.error("Error adding event:", error);
      throw error;
    }
  }

  /**
   * Update an existing delivery event
   */
  public async updateEvent(id: string, data: Partial<DeliveryEvent>): Promise<void> {
    try {
      await updateDoc(doc(this.db, this.eventsCollection, id), data);
    } catch (error) {
      console.error("Error updating event:", error);
      throw error;
    }
  }

  /**
   * Delete a delivery event
   */
  public async deleteEvent(id: string): Promise<void> {
    try {
      await deleteDoc(doc(this.db, this.eventsCollection, id));
    } catch (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
  }

  /**
   * Get events by client ID
   */
  public async getEventsByClientId(clientId: string): Promise<DeliveryEvent[]> {
    try {
      const q = query(
        collection(this.db, this.eventsCollection),
        where("clientId", "==", clientId)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          deliveryDate: data.deliveryDate.toDate(), // Convert Timestamp to Date
        } as DeliveryEvent;
      });
    } catch (error) {
      console.error("Error fetching events for client:", error);
      throw error;
    }
  }

  /**
   * Get events by recurrence ID
   */
  public async getEventsByRecurrence(recurrenceId: string): Promise<DeliveryEvent[]> {
    try {
      const q = query(
        collection(this.db, this.eventsCollection),
        where("recurrence", "==", recurrenceId)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          deliveryDate: data.deliveryDate.toDate(), // Convert Timestamp to Date
        } as DeliveryEvent;
      });
    } catch (error) {
      console.error("Error fetching events by recurrence:", error);
      throw error;
    }
  }

  /**
   * Set daily delivery limit
   */
  public async setDailyLimit(dateKey: string, limit: number): Promise<void> {
    try {
      const docRef = doc(this.db, this.dailyLimitsCollection, dateKey);
      await setDoc(
        docRef,
        {
          limit,
          date: dateKey,
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error setting daily limit:", error);
      throw error;
    }
  }

  /**
   * Get daily delivery limits
   */
  public async getDailyLimits(): Promise<{ id: string; date: string; limit: number }[]> {
    try {
      const snapshot = await getDocs(collection(this.db, this.dailyLimitsCollection));
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        date: doc.data().date,
        limit: doc.data().limit,
      }));
    } catch (error) {
      console.error("Error getting daily limits:", error);
      throw error;
    }
  }

  /**
   * Get weekly delivery limits
   */
  public async getWeeklyLimits(): Promise<Record<string, number>> {
    try {
      const docRef = doc(this.db, this.limitsCollection, this.limitsDocId);
      const docSnapshot = await getDoc(docRef);
      
      if (docSnapshot.exists()) {
        return docSnapshot.data() as Record<string, number>;
      }
      
      // Default values if doc doesn't exist
      const defaultLimits = {
        sunday: 60,
        monday: 60,
        tuesday: 60,
        wednesday: 60,
        thursday: 90,
        friday: 90,
        saturday: 60,
      };
      
      await setDoc(docRef, defaultLimits);
      return defaultLimits;
    } catch (error) {
      console.error("Error getting weekly limits:", error);
      throw error;
    }
  }

  /**
   * Update weekly delivery limits
   */
  public async updateWeeklyLimits(limits: Record<string, number>): Promise<void> {
    try {
      const docRef = doc(this.db, this.limitsCollection, this.limitsDocId);
      await setDoc(docRef, limits, { merge: true });
    } catch (error) {
      console.error("Error updating weekly limits:", error);
      throw error;
    }
  }
}

export default DeliveryService; 