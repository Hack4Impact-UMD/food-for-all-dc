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
  Timestamp,
} from "firebase/firestore";
import FirebaseService from "./firebase-service";
import { DeliveryEvent } from "../types/calendar-types";

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
        where("deliveryDate", "<", endDate)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        const deliveryDate = data.deliveryDate.toDate(); // Use JS Date directly

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

                // Convert to Date object
                const deliveryDate = data.deliveryDate.toDate
                    ? data.deliveryDate.toDate()
                    : new Date(data.deliveryDate);

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
      const now = new Date();
      if (isNaN(now.getTime())) {
        throw new Error("Invalid date object");
      }
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
          deliveryDate: data.deliveryDate.toDate ? data.deliveryDate.toDate() : new Date(data.deliveryDate),
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
      const now = new Date();
      if (isNaN(now.getTime())) {
        throw new Error("Invalid date object");
      }
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
          deliveryDate: data.deliveryDate.toDate ? data.deliveryDate.toDate() : new Date(data.deliveryDate),
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

const chipStyle = (deliveryId: string, hidden = false) => {
        if (hidden) {
            return {
                opacity: 0,
                transform: "scale(0.8)", // Slightly shrink before disappearing
                transition: "opacity 0.3s ease, transform 0.3s ease", // Smooth transition
            };
        }
        return {
            opacity: 1,
            transform: "scale(1)",
            transition: "opacity 0.3s ease, transform 0.3s ease", // Default smooth transition
        };
    };