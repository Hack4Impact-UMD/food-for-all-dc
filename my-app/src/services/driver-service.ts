import { validateDriver } from '../utils/firestoreValidation';
import { retry } from '../utils/retry';
import { ServiceError, formatServiceError } from '../utils/serviceError';
import { db } from "../auth/firebaseConfig";
import { Driver } from '../types';
import dataSources from '../config/dataSources';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  // setDoc, // Remove unused import
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit as fbLimit,
  startAfter
} from "firebase/firestore";

/**
 * Driver Service - Handles all driver-related operations with Firebase
 */
class DriverService {
  private static instance: DriverService;
  private db = db;
  private driversCollection = dataSources.firebase.driversCollection;

  // Private constructor to prevent direct instantiation
  // This is part of the singleton pattern
  private constructor() {
    // Intentionally empty - initialization happens with class properties
  }

  public static getInstance(): DriverService {
    if (!DriverService.instance) {
      DriverService.instance = new DriverService();
    }
    return DriverService.instance;
  }

  /**
   * Get all drivers (returns all, for compatibility)
   */
  public async getAllDrivers(): Promise<Driver[]> {
    try {
      return await retry(async () => {
        const snapshot = await getDocs(collection(this.db, this.driversCollection));
        return snapshot.docs
          .map((doc) => ({ ...(doc.data() as Omit<Driver, "id">), id: doc.id }))
          .filter(validateDriver);
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get all drivers');
    }
  }

  /**
   * Get all drivers with pagination support (new method)
   * @param pageSize Number of drivers per page
   * @param lastDoc Last document from previous page (for pagination)
   */
  public async getAllDriversPaginated(pageSize = 50, lastDoc?: unknown): Promise<{ drivers: Driver[]; lastDoc?: unknown }> {
    try {
      return await retry(async () => {
        let q = query(collection(this.db, this.driversCollection), orderBy("id"), fbLimit(pageSize));
        if (lastDoc) {
          q = query(q, startAfter(lastDoc));
        }
        const snapshot = await getDocs(q);
        const drivers = snapshot.docs
          .map((doc) => ({ ...(doc.data() as Omit<Driver, "id">), id: doc.id }))
          .filter(validateDriver);
        return { drivers, lastDoc: snapshot.docs[snapshot.docs.length - 1] };
      });
    } catch (error) {
      return { drivers: [], lastDoc: undefined };
    }
  }

  /**
   * Subscribe to all drivers (real-time updates)
   */
  public subscribeToAllDrivers(
    onData: (drivers: Driver[]) => void,
    onError?: (error: ServiceError) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      collection(this.db, this.driversCollection),
      (snapshot) => {
        const drivers = snapshot.docs
          .map((doc) => ({ ...(doc.data() as Omit<Driver, "id">), id: doc.id }))
          .filter(validateDriver);
        onData(drivers);
      },
      (error) => {
        if (onError) onError(formatServiceError(error, 'Real-time drivers listener error'));
      }
    );
    return unsubscribe;
  }

  /**
   * Get a driver by ID
   */
  public async getDriverById(id: string): Promise<Driver | null> {
    try {
      return await retry(async () => {
        const driverDoc = await getDoc(doc(this.db, this.driversCollection, id));
        if (driverDoc.exists()) {
          const data = { ...(driverDoc.data() as Omit<Driver, "id">), id: driverDoc.id };
          return validateDriver(data) ? data : null;
        }
        return null;
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get driver by ID');
    }
  }


  /**
   * Subscribe to a driver by ID (real-time updates)
   */
  public subscribeToDriverById(
    id: string,
    onData: (driver: Driver | null) => void,
    onError?: (error: ServiceError) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      doc(this.db, this.driversCollection, id),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = { ...(snapshot.data() as Omit<Driver, "id">), id: snapshot.id };
          onData(validateDriver(data) ? data : null);
        } else {
          onData(null);
        }
      },
      (error) => {
        if (onError) onError(formatServiceError(error, 'Real-time driver listener error'));
      }
    );
    return unsubscribe;
  }
  /**
   * Create a new driver
   */
  public async createDriver(driver: Omit<Driver, "id">): Promise<string> {
    try {
      return await retry(async () => {
        const docRef = await addDoc(collection(this.db, this.driversCollection), driver);
        return docRef.id;
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to create driver');
    }
  }

  /**
   * Update an existing driver
   */
  public async updateDriver(id: string, data: Partial<Driver>): Promise<void> {
    try {
      await retry(async () => {
        await updateDoc(doc(this.db, this.driversCollection, id), data);
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to update driver');
    }
  }

  /**
   * Delete a driver
   */
  public async deleteDriver(id: string): Promise<void> {
    try {
      await retry(async () => {
        await deleteDoc(doc(this.db, this.driversCollection, id));
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to delete driver');
    }
  }
}

export default DriverService; 