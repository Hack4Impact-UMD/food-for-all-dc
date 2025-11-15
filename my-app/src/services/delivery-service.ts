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
import { db } from "../auth/firebaseConfig";
import { DeliveryEvent } from "../types/calendar-types";
import { validateDeliveryEvent } from '../utils/firestoreValidation';
import { Time, TimeUtils } from "../utils/timeUtils";
import { retry } from '../utils/retry';
import { ServiceError, formatServiceError } from '../utils/serviceError';
import dataSources from '../config/dataSources';
import { deliveryDate } from "../utils/deliveryDate";

/**
 * Delivery Service - Handles all delivery-related operations with Firebase
 */
class DeliveryService {
  /**
   * Delete all delivery events for a client
   */
  public async deleteEventsByClientId(clientId: string): Promise<void> {
    try {
      const q = query(
        collection(this.db, this.eventsCollection),
        where("clientId", "==", clientId)
      );
      const querySnapshot = await getDocs(q);
      const batchDeletes = querySnapshot.docs.map(docSnap => deleteDoc(doc(this.db, this.eventsCollection, docSnap.id)));
      await Promise.all(batchDeletes);
    } catch (error) {
      throw formatServiceError(error, 'Failed to delete deliveries for client');
    }
  }
  private static instance: DeliveryService;
  private db = db;
  private eventsCollection = dataSources.firebase.calendarCollection;
  private dailyLimitsCollection = "dailyLimits";
  private limitsCollection = dataSources.firebase.limitsCollection;
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
        const events = snapshot.docs
          .map((doc) => {
            const raw = doc.data();
            const normalizedDate = deliveryDate.toJSDate(Time.Firebase.fromTimestamp(raw.deliveryDate).toJSDate());
            const data = { id: doc.id, ...raw, deliveryDate: normalizedDate };
            return validateDeliveryEvent(data) ? data : undefined;
          })
          .filter((event) => event !== undefined) as DeliveryEvent[];
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
  // Use start of day for startDate and start of day for endDate (exclusive)
  const startDateTime = TimeUtils.fromJSDate(startDate).startOf('day');
  const endDateTime = TimeUtils.fromJSDate(endDate).startOf('day');
  const startTimestamp = Time.Firebase.toTimestamp(startDateTime);
  const endTimestamp = Time.Firebase.toTimestamp(endDateTime);
        // ...existing code...
        const q = query(
          collection(this.db, this.eventsCollection),
          where("deliveryDate", ">=", startTimestamp),
          where("deliveryDate", "<", endTimestamp),
          orderBy("deliveryDate", "asc")
        );
        const querySnapshot = await getDocs(q);
        const events = querySnapshot.docs
          .map((doc) => {
            const raw = doc.data();
            // ...existing code...
            const normalizedDate = deliveryDate.toJSDate(Time.Firebase.fromTimestamp(raw.deliveryDate).toJSDate());
            const data = { id: doc.id, ...raw, deliveryDate: normalizedDate };
            return validateDeliveryEvent(data) ? data : undefined;
          })
          .filter((event) => event !== undefined) as DeliveryEvent[];
        // ...existing code...
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
    // Convert undefined fields to null
    const cleanEvent = Object.fromEntries(
      Object.entries(event).map(([k, v]) => [k, v === undefined ? null : v])
    );
    if (cleanEvent.deliveryDate) {
      cleanEvent.deliveryDate = deliveryDate.toJSDate(cleanEvent.deliveryDate as any);
    }
    try {
      return await retry(async () => {
        const docRef = await addDoc(collection(this.db, this.eventsCollection), cleanEvent);
        // Invalidate cache for this client's recurring deliveries
        if (event.clientId && event.recurrence) {
          this.invalidateCacheForClient(event.clientId, event.recurrence);
        }
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
    // Convert undefined fields to null
    const cleanData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === undefined ? null : v])
    );
    if (cleanData.deliveryDate) {
      cleanData.deliveryDate = deliveryDate.toJSDate(cleanData.deliveryDate as any);
    }
    try {
      await retry(async () => {
        await updateDoc(doc(this.db, this.eventsCollection, id), cleanData);
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

  // Cache for recurring delivery date ranges to avoid repeated queries
  private dateRangeCache = new Map<string, { earliest: Date; latest: Date; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get recurring delivery date range for a client (optimized with caching)
   */
  public async getRecurringDeliveryDateRange(
    clientId: string, 
    recurrenceType: string
  ): Promise<{ earliest: Date | null; latest: Date | null }> {
    if (recurrenceType === 'None') {
      return { earliest: null, latest: null };
    }

    const cacheKey = `${clientId}-${recurrenceType}`;
    const cached = this.dateRangeCache.get(cacheKey);
    
    // Return cached result if it's still fresh
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return { earliest: cached.earliest, latest: cached.latest };
    }

    try {
      return await retry(async () => {
        // Optimized query: only get deliveryDate field for matching client and recurrence
        const q = query(
          collection(this.db, this.eventsCollection),
          where("clientId", "==", clientId),
          where("recurrence", "==", recurrenceType)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          return { earliest: null, latest: null };
        }

        const dates = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            if (!data.deliveryDate) return null;
            const normalized = deliveryDate.toJSDate(data.deliveryDate);
            return isNaN(normalized.getTime()) ? null : normalized;
          })
          .filter((date): date is Date => date !== null);

        if (dates.length === 0) {
          return { earliest: null, latest: null };
        }

        // Find min/max dates efficiently
        const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
        const latest = new Date(Math.max(...dates.map(d => d.getTime())));
        
        // Cache the result
        this.dateRangeCache.set(cacheKey, {
          earliest,
          latest,
          timestamp: Date.now()
        });

        return { earliest, latest };
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get recurring delivery date range');
    }
  }

  /**
   * Batch get recurring delivery date ranges for multiple clients (even more optimized)
   */
  public async getBatchRecurringDeliveryDateRanges(
    requests: Array<{ clientId: string; recurrenceType: string }>
  ): Promise<Map<string, { earliest: Date | null; latest: Date | null }>> {
    const results = new Map<string, { earliest: Date | null; latest: Date | null }>();
    const uncachedRequests: Array<{ clientId: string; recurrenceType: string; cacheKey: string }> = [];
    
    // Check cache first
    for (const request of requests) {
      if (request.recurrenceType === 'None') {
        results.set(`${request.clientId}-${request.recurrenceType}`, { earliest: null, latest: null });
        continue;
      }
      
      const cacheKey = `${request.clientId}-${request.recurrenceType}`;
      const cached = this.dateRangeCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        results.set(cacheKey, { earliest: cached.earliest, latest: cached.latest });
      } else {
        uncachedRequests.push({ ...request, cacheKey });
      }
    }

    // Batch fetch uncached data
    if (uncachedRequests.length > 0) {
      try {
        // Group by recurrence type for more efficient queries
        const byRecurrence = new Map<string, string[]>();
        for (const req of uncachedRequests) {
          if (!byRecurrence.has(req.recurrenceType)) {
            byRecurrence.set(req.recurrenceType, []);
          }
          const clientIds = byRecurrence.get(req.recurrenceType);
          if (clientIds) {
            clientIds.push(req.clientId);
          }
        }

        for (const [recurrenceType, clientIds] of byRecurrence) {
          const q = query(
            collection(this.db, this.eventsCollection),
            where("recurrence", "==", recurrenceType),
            where("clientId", "in", clientIds.slice(0, 10)) // Firestore 'in' limit is 10
          );
          
          const querySnapshot = await getDocs(q);
          
          // Group results by clientId
          const clientDates = new Map<string, Date[]>();
          
          querySnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!data.deliveryDate || !data.clientId) return;
            
            const normalized = deliveryDate.toJSDate(data.deliveryDate);
            
            if (!isNaN(normalized.getTime())) {
              if (!clientDates.has(data.clientId)) {
                clientDates.set(data.clientId, []);
              }
              const dates = clientDates.get(data.clientId);
              if (dates) {
                dates.push(normalized);
              }
            }
          });

          // Calculate date ranges for each client
          for (const clientId of clientIds) {
            const dates = clientDates.get(clientId) || [];
            const cacheKey = `${clientId}-${recurrenceType}`;
            
            if (dates.length === 0) {
              const result = { earliest: null, latest: null };
              results.set(cacheKey, result);
            } else {
              const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
              const latest = new Date(Math.max(...dates.map(d => d.getTime())));
              
              const result = { earliest, latest };
              results.set(cacheKey, result);
              
              // Cache the result
              this.dateRangeCache.set(cacheKey, {
                earliest,
                latest,
                timestamp: Date.now()
              });
            }
          }
        }
      } catch (error) {
        console.error('Error in batch recurring delivery date ranges:', error);
        // Fallback: return null ranges for failed requests
        for (const req of uncachedRequests) {
          if (!results.has(req.cacheKey)) {
            results.set(req.cacheKey, { earliest: null, latest: null });
          }
        }
      }
    }

    return results;
  }

  /**
   * Clear the date range cache (useful when new deliveries are added)
   */
  public clearDateRangeCache(): void {
    this.dateRangeCache.clear();
  }

  /**
   * Invalidate cache for a specific client and recurrence type
   */
  private invalidateCacheForClient(clientId: string, recurrence?: string): void {
    if (recurrence) {
      this.dateRangeCache.delete(`${clientId}-${recurrence}`);
    } else {
      // Clear all cache entries for this client
      const keysToDelete = Array.from(this.dateRangeCache.keys())
        .filter(key => key.startsWith(`${clientId}-`));
      keysToDelete.forEach(key => this.dateRangeCache.delete(key));
    }
  }

  /**
   * Get events by client ID
   */
  public async getEventsByClientId(clientId: string): Promise<DeliveryEvent[]> {
    try {
      return await retry(async () => {
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
            const deliveryDateValue = deliveryDate.toJSDate(data.deliveryDate);
            return {
              id: doc.id,
              ...data,
              deliveryDate: deliveryDateValue,
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
        const pastSnapshot = await getDocs(pastQuery);
        return pastSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            deliveryDate: deliveryDate.toJSDate(data.deliveryDate),
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
        const futureSnapshot = await getDocs(futureQuery);
        return futureSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            deliveryDate: deliveryDate.toJSDate(data.deliveryDate),
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
