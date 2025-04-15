import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import FirebaseService from "./firebase-service";
import { Driver } from "../pages/Delivery/types/deliveryTypes";

/**
 * Driver Service - Handles all driver-related operations with Firebase
 */
class DriverService {
  private static instance: DriverService;
  private db = FirebaseService.getInstance().getFirestore();
  private driversCollection = "Drivers";

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
   * Get all drivers
   */
  public async getAllDrivers(): Promise<Driver[]> {
    try {
      const snapshot = await getDocs(collection(this.db, this.driversCollection));
      return snapshot.docs.map((doc) => ({
        ...(doc.data() as Omit<Driver, "id">),
        id: doc.id,
      }));
    } catch (error) {
      console.error("Error getting drivers:", error);
      throw error;
    }
  }

  /**
   * Get a driver by ID
   */
  public async getDriverById(id: string): Promise<Driver | null> {
    try {
      const driverDoc = await getDoc(doc(this.db, this.driversCollection, id));
      if (driverDoc.exists()) {
        return {
          ...(driverDoc.data() as Omit<Driver, "id">),
          id: driverDoc.id,
        };
      }
      return null;
    } catch (error) {
      console.error("Error getting driver:", error);
      throw error;
    }
  }

  /**
   * Create a new driver
   */
  public async createDriver(driver: Omit<Driver, "id">): Promise<string> {
    try {
      const docRef = await addDoc(collection(this.db, this.driversCollection), driver);
      return docRef.id;
    } catch (error) {
      console.error("Error creating driver:", error);
      throw error;
    }
  }

  /**
   * Update an existing driver
   */
  public async updateDriver(id: string, data: Partial<Driver>): Promise<void> {
    try {
      await updateDoc(doc(this.db, this.driversCollection, id), data);
    } catch (error) {
      console.error("Error updating driver:", error);
      throw error;
    }
  }

  /**
   * Delete a driver
   */
  public async deleteDriver(id: string): Promise<void> {
    try {
      await deleteDoc(doc(this.db, this.driversCollection, id));
    } catch (error) {
      console.error("Error deleting driver:", error);
      throw error;
    }
  }
}

export default DriverService; 