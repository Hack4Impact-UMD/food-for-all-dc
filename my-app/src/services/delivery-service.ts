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
  orderBy,
  limit,
} from "firebase/firestore";
import FirebaseService from "./firebase-service";
import { DeliveryEvent } from "../types/calendar-types";
import { Time, TimeUtils } from "../utils/timeUtils";

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
          deliveryDate: Time.Firebase.fromTimestamp(data.deliveryDate).toJSDate(),
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
      const startTimestamp = Time.Firebase.toTimestamp(TimeUtils.fromJSDate(startDate));
      const endTimestamp = Time.Firebase.toTimestamp(TimeUtils.fromJSDate(endDate));
      
      const q = query(
        collection(this.db, this.eventsCollection),
        where("deliveryDate", ">=", startTimestamp),
        where("deliveryDate", "<", endTimestamp)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        const deliveryDate = Time.Firebase.fromTimestamp(data.deliveryDate).toJSDate();

        return {
          id: doc.id,
          ...data,
          deliveryDate, // Use the JS Date
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
      if (!id) {
        throw new Error("Invalid event ID provided for deletion");
      }

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
        return querySnapshot.docs
            .map((doc) => {
                const data = doc.data();
                if (!data.deliveryDate) {
                    console.warn(`Document ${doc.id} is missing deliveryDate property`);
                    return null;
                }

                // Convert to Date object using Time utilities
                const deliveryDate = data.deliveryDate.toDate
                    ? Time.Firebase.fromTimestamp(data.deliveryDate).toJSDate()
                    : TimeUtils.fromAny(data.deliveryDate).toJSDate();

                return {
                    id: doc.id,
                    ...data,
                    deliveryDate,
                } as DeliveryEvent;
            })
            .filter((event): event is DeliveryEvent => event !== null);
    } catch (error) {
        console.error("Error fetching events by client ID:", error);
        throw error;
    }
  }

  /**
   * Get daily delivery limits
   */
  public async getDailyLimits(): Promise<{ id: string; date: string; limit: number }[]> {
    try {
      const snapshot = await getDocs(collection(this.db, this.dailyLimitsCollection));
      return snapshot.docs.map((doc) => doc.data() as { id: string; date: string; limit: number });
    } catch (error) {
      console.error("Error fetching daily limits:", error);
      throw error;
    }
  }

  /**
   * Set daily delivery limit
   */
  public async setDailyLimit(dateKey: string, limit: number): Promise<void> {
    try {
      const docRef = doc(this.db, this.dailyLimitsCollection, dateKey);
      await setDoc(docRef, { date: dateKey, limit });
    } catch (error) {
      console.error("Error setting daily limit:", error);
      throw error;
    }
  }

  /**
   * Get weekly delivery limits
   */
  public async getWeeklyLimits(): Promise<Record<string, number>> {
    try {
      const docRef = doc(this.db, this.limitsCollection, this.limitsDocId);
      const snapshot = await getDoc(docRef);
      
      if (!snapshot.exists()) {
        // Return default weekly limits if document doesn't exist
        const defaultLimits: Record<string, number> = {
          sunday: 60,
          monday: 60,
          tuesday: 60,
          wednesday: 60,
          thursday: 90,
          friday: 90,
          saturday: 60,
        };
        
        // Create the document with default values
        await setDoc(docRef, defaultLimits);
        return defaultLimits;
      }
      
      return snapshot.data() as Record<string, number>;
    } catch (error) {
      console.error("Error fetching weekly limits:", error);
      throw error;
    }
  }

  /**
   * Update weekly delivery limits
   */
  public async updateWeeklyLimits(limits: Record<string, number>): Promise<void> {
    try {
      const docRef = doc(this.db, this.limitsCollection, this.limitsDocId);
      await setDoc(docRef, limits);
    } catch (error) {
      console.error("Error updating weekly limits:", error);
      throw error;
    }
  }

  /**
   * Get the previous 5 deliveries for a client
   */
  public async getPreviousDeliveries(clientId: string): Promise<DeliveryEvent[]> {
    try {
      const todayDateTime = TimeUtils.today();
      if (!todayDateTime.isValid) {
        throw new Error("Invalid date object");
      }
      const today = Time.Firebase.toTimestamp(todayDateTime);

      const pastQuery = query(
        collection(this.db, this.eventsCollection),
        where("clientId", "==", clientId),
        where("deliveryDate", "<", today),
        orderBy("deliveryDate", "desc"),
        limit(5)
      );

      const pastSnapshot = await getDocs(pastQuery);
      return pastSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id, // Ensure the document ID is included
          ...data,
          deliveryDate: data.deliveryDate.toDate ? Time.Firebase.fromTimestamp(data.deliveryDate).toJSDate() : TimeUtils.fromAny(data.deliveryDate).toJSDate(),
        } as DeliveryEvent;
      });
    } catch (error) {
      console.error("Error fetching previous deliveries:", error);
      throw error;
    }
  }

  /**
   * Get the next 5 deliveries for a client
   */
  public async getNextDeliveries(clientId: string): Promise<DeliveryEvent[]> {
    try {
      const todayDateTime = TimeUtils.today();
      if (!todayDateTime.isValid) {
        throw new Error("Invalid date object");
      }
      const today = Time.Firebase.toTimestamp(todayDateTime);

      const futureQuery = query(
        collection(this.db, this.eventsCollection),
        where("clientId", "==", clientId),
        where("deliveryDate", ">=", today),
        orderBy("deliveryDate", "asc"),
        limit(5)
      );

      const futureSnapshot = await getDocs(futureQuery);
      return futureSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id, // Ensure the document ID is included
          ...data,
          deliveryDate: data.deliveryDate.toDate ? Time.Firebase.fromTimestamp(data.deliveryDate).toJSDate() : TimeUtils.fromAny(data.deliveryDate).toJSDate(),
        } as DeliveryEvent;
      });
    } catch (error) {
      console.error("Error fetching future deliveries:", error);
      throw error;
    }
  }

  /**
   * Get the previous 5 and future 5 deliveries for a client
   */
  public async getClientDeliveryHistory(clientId: string): Promise<{
    pastDeliveries: DeliveryEvent[];
    futureDeliveries: DeliveryEvent[];
  }> {
    try {
      const [pastDeliveries, futureDeliveries] = await Promise.all([
        this.getPreviousDeliveries(clientId),
        this.getNextDeliveries(clientId),
      ]);

      return { pastDeliveries, futureDeliveries };
    } catch (error) {
      console.error("Error fetching client delivery history:", error);
      throw error;
    }
  }
}

export default DeliveryService;

