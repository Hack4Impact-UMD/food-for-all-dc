import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import FirebaseService from "./firebase-service";
import { ClientProfile } from '../types';

/**
 * Client Service - Handles all client-related operations with Firebase
 */
class ClientService {
  private static instance: ClientService;
  private db = FirebaseService.getInstance().getFirestore();
  private clientsCollection = "clients";
  private tagsCollection = "tags";
  private tagsDocId = "oGuiR2dQQeOBXHCkhDeX";

  // Private constructor to prevent direct instantiation
  // This is part of the singleton pattern
  private constructor() {
    // Intentionally empty - initialization happens with class properties
  }

  public static getInstance(): ClientService {
    if (!ClientService.instance) {
      ClientService.instance = new ClientService();
    }
    return ClientService.instance;
  }

  /**
   * Get a client by their UID
   */
  public async getClientById(uid: string): Promise<ClientProfile | null> {
    try {
      const clientDoc = await getDoc(doc(this.db, this.clientsCollection, uid));
      if (clientDoc.exists()) {
        return clientDoc.data() as ClientProfile;
      }
      return null;
    } catch (error) {
      console.error("Error getting client:", error);
      throw error;
    }
  }

  /**
   * Get all clients
   */
  public async getAllClients(): Promise<ClientProfile[]> {
    try {
      const snapshot = await getDocs(collection(this.db, this.clientsCollection));
      return snapshot.docs.map((doc) => ({
        ...(doc.data() as ClientProfile),
        uid: doc.id,
      }));
    } catch (error) {
      console.error("Error getting clients:", error);
      throw error;
    }
  }

  /**
   * Create a new client
   */
  public async createClient(client: ClientProfile): Promise<string> {
    try {
      await setDoc(doc(this.db, this.clientsCollection, client.uid), {
        ...client,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return client.uid;
    } catch (error) {
      console.error("Error creating client:", error);
      throw error;
    }
  }

  /**
   * Update an existing client
   */
  public async updateClient(uid: string, data: Partial<ClientProfile>): Promise<void> {
    try {
      await updateDoc(doc(this.db, this.clientsCollection, uid), {
        ...data,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating client:", error);
      throw error;
    }
  }

  /**
   * Delete a client
   */
  public async deleteClient(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(this.db, this.clientsCollection, uid));
    } catch (error) {
      console.error("Error deleting client:", error);
      throw error;
    }
  }

  /**
   * Get all tags
   */
  public async getAllTags(): Promise<string[]> {
    try {
      const tagsDoc = await getDoc(doc(this.db, this.tagsCollection, this.tagsDocId));
      if (tagsDoc.exists()) {
        return tagsDoc.data().tags || [];
      }
      return [];
    } catch (error) {
      console.error("Error getting tags:", error);
      throw error;
    }
  }

  /**
   * Update tags
   */
  public async updateTags(tags: string[]): Promise<void> {
    try {
      const sortedTags = [...tags].sort((a, b) => a.localeCompare(b));
      await setDoc(
        doc(this.db, this.tagsCollection, this.tagsDocId),
        { tags: sortedTags },
        { merge: true }
      );
    } catch (error) {
      console.error("Error updating tags:", error);
      throw error;
    }
  }

  /**
   * Update client's cluster ID
   */
  public async updateClientCluster(uid: string, clusterId: string): Promise<void> {
    try {
      await setDoc(doc(this.db, this.clientsCollection, uid), { clusterID: clusterId }, { merge: true });
    } catch (error) {
      console.error(`Error updating cluster for client ${uid}:`, error);
      throw error;
    }
  }
}

export default ClientService; 