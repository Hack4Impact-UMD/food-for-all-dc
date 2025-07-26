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
import { validateDeliveryEvent } from '../utils/firestoreValidation';
import { Time, TimeUtils } from "../utils/timeUtils";
import { retry } from '../utils/retry';
import { ServiceError, formatServiceError } from '../utils/serviceError';

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
      return await retry(async () => {
        const snapshot = await getDocs(collection(this.db, this.eventsCollection));
        console.log('[DeliveryService] getAllEvents snapshot:', snapshot);
        const events = snapshot.docs
          .map((doc) => {
            const raw = doc.data();
            const data = { id: doc.id, ...raw, deliveryDate: Time.Firebase.fromTimestamp(raw.deliveryDate).toJSDate() };
            return validateDeliveryEvent(data) ? data : undefined;
          })
          .filter((event) => event !== undefined) as DeliveryEvent[];
        console.log('[DeliveryService] getAllEvents events:', events);
        return events;
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get all events');
    }
  }

  /**
   * Get delivery events by date range
   */
  public async getEventsByDateRange(startDate: Date, endDate: Date): Promise<DeliveryEvent[]> {
    try {
      return await retry(async () => {
        const startTimestamp = Time.Firebase.toTimestamp(TimeUtils.fromJSDate(startDate));
        const endTimestamp = Time.Firebase.toTimestamp(TimeUtils.fromJSDate(endDate));
        console.log('[DeliveryService] getEventsByDateRange params:', { startDate, endDate, startTimestamp, endTimestamp });
        const q = query(
          collection(this.db, this.eventsCollection),
          where("deliveryDate", ">=", startTimestamp),
          where("deliveryDate", "<", endTimestamp)
        );
        console.log('[DeliveryService] getEventsByDateRange Firestore query:', q);
        const querySnapshot = await getDocs(q);
        const events = querySnapshot.docs
          .map((doc) => {
            const raw = doc.data();
            const data = { id: doc.id, ...raw, deliveryDate: Time.Firebase.fromTimestamp(raw.deliveryDate).toJSDate() };
            return validateDeliveryEvent(data) ? data : undefined;
          })
          .filter((event) => event !== undefined) as DeliveryEvent[];
        return events;
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get events by date range');
    }
  }

  /**
   * Create a new delivery event
   */
  public async createEvent(event: Partial<DeliveryEvent>): Promise<string> {
    try {
      return await retry(async () => {
        const docRef = await addDoc(collection(this.db, this.eventsCollection), event);
        return docRef.id;
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to create event');
    }
  }

  /**
   * Update an existing delivery event
   */
  public async updateEvent(id: string, data: Partial<DeliveryEvent>): Promise<void> {
    try {
      await retry(async () => {
        await updateDoc(doc(this.db, this.eventsCollection, id), data);
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to update event');
    }
  }

  /**
   * Delete a delivery event
   */
  public async deleteEvent(id: string): Promise<void> {
    try {
      if (!id) {
        throw new ServiceError("Invalid event ID provided for deletion");
      }
      await retry(async () => {
        await deleteDoc(doc(this.db, this.eventsCollection, id));
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to delete event');
    }
  }

  /**
   * Get events by client ID
   */
  public async getEventsByClientId(clientId: string): Promise<DeliveryEvent[]> {
    try {
      return await retry(async () => {
         console.log('[DeliveryService] getEventsByClientId param:', clientId);
         const q = query(
           collection(this.db, this.eventsCollection),
           where("clientId", "==", clientId)
         );
         console.log('[DeliveryService] getEventsByClientId Firestore query:', q);
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs
          .map((doc) => {
            const data = doc.data();
            if (!data.deliveryDate) {
              console.warn(`Document ${doc.id} is missing deliveryDate property`);
              return null;
            }
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
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get events by client ID');
    }
  }

  /**
   * Get daily delivery limits
   */
  public async getDailyLimits(): Promise<{ id: string; date: string; limit: number }[]> {
    try {
      return await retry(async () => {
        const snapshot = await getDocs(collection(this.db, this.dailyLimitsCollection));
        return snapshot.docs.map((doc) => doc.data() as { id: string; date: string; limit: number });
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get daily limits');
    }
  }

  /**
   * Set daily delivery limit
   */
  public async setDailyLimit(dateKey: string, limit: number): Promise<void> {
    try {
      await retry(async () => {
        const docRef = doc(this.db, this.dailyLimitsCollection, dateKey);
        await setDoc(docRef, { date: dateKey, limit });
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to set daily limit');
    }
  }

  /**
   * Get weekly delivery limits
   */
  public async getWeeklyLimits(): Promise<Record<string, number>> {
    try {
      return await retry(async () => {
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
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get weekly limits');
    }
  }

  /**
   * Update weekly delivery limits
   */
  public async updateWeeklyLimits(limits: Record<string, number>): Promise<void> {
    try {
      await retry(async () => {
        const docRef = doc(this.db, this.limitsCollection, this.limitsDocId);
        await setDoc(docRef, limits);
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to update weekly limits');
    }
  }

  /**
   * Get the previous 5 deliveries for a client
   */
  public async getPreviousDeliveries(clientId: string): Promise<DeliveryEvent[]> {
    try {
      return await retry(async () => {
        console.log('[DeliveryService] getPreviousDeliveries param:', clientId);
        const todayDateTime = TimeUtils.today();
        if (!todayDateTime.isValid) {
          throw new ServiceError("Invalid date object");
        }
        const today = Time.Firebase.toTimestamp(todayDateTime);
        const pastQuery = query(
           collection(this.db, this.eventsCollection),
           where("clientId", "==", clientId),
           where("deliveryDate", "<", today),
           orderBy("deliveryDate", "desc"),
           limit(5)
         );
        console.log('[DeliveryService] getPreviousDeliveries Firestore query:', pastQuery);
        const pastSnapshot = await getDocs(pastQuery);
        return pastSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            deliveryDate: data.deliveryDate.toDate ? Time.Firebase.fromTimestamp(data.deliveryDate).toJSDate() : TimeUtils.fromAny(data.deliveryDate).toJSDate(),
          } as DeliveryEvent;
        });
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get previous deliveries');
    }
  }

  /**
   * Get the next 5 deliveries for a client
   */
  public async getNextDeliveries(clientId: string): Promise<DeliveryEvent[]> {
    try {
      return await retry(async () => {
        console.log('[DeliveryService] getNextDeliveries param:', clientId);
        const todayDateTime = TimeUtils.today();
        if (!todayDateTime.isValid) {
          throw new ServiceError("Invalid date object");
        }
        const today = Time.Firebase.toTimestamp(todayDateTime);
        const futureQuery = query(
           collection(this.db, this.eventsCollection),
           where("clientId", "==", clientId),
           where("deliveryDate", ">=", today),
           orderBy("deliveryDate", "asc"),
           limit(5)
         );
        console.log('[DeliveryService] getNextDeliveries Firestore query:', futureQuery);
        const futureSnapshot = await getDocs(futureQuery);
        return futureSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            deliveryDate: data.deliveryDate.toDate ? Time.Firebase.fromTimestamp(data.deliveryDate).toJSDate() : TimeUtils.fromAny(data.deliveryDate).toJSDate(),
          } as DeliveryEvent;
        });
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get next deliveries');
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
      return await retry(async () => {
        const [pastDeliveries, futureDeliveries] = await Promise.all([
          this.getPreviousDeliveries(clientId),
          this.getNextDeliveries(clientId),
        ]);
        return { pastDeliveries, futureDeliveries };
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get client delivery history');
    }
  }
}

export default DeliveryService;

