import FirebaseService from "./firebase-service";
import { ClientProfile } from '../types';
import { LatLngTuple } from "leaflet";
import { Time, TimeUtils } from "../utils/timeUtils";
import { retry } from '../utils/retry';
import { ServiceError, formatServiceError } from '../utils/serviceError';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit as fbLimit,
  startAfter
} from "firebase/firestore";
import { validateClientProfile } from '../utils/firestoreValidation';

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
import { validateClientProfile } from '../utils/firestoreValidation';
   */
  public async getClientById(uid: string): Promise<ClientProfile | null> {
    try {
      const docSnap = await retry(async () => {
        return await getDoc(doc(this.db, this.clientsCollection, uid));
      });
      console.log('[ClientService] getClientById docSnap:', docSnap);
      if (docSnap.exists()) {
        const data = docSnap.data() as ClientProfile;
        console.log('[ClientService] getClientById data:', data);
        return validateClientProfile(data) ? data : null;
      }
      return null;
    } catch (error) {
      throw formatServiceError(error, 'Failed to get client by ID');
    }
  }

  /**
   * Get all clients with pagination support
   * @param pageSize Number of clients per page
   * @param lastDoc Last document from previous page (for pagination)
   */
  public async getAllClients(pageSize = 50, lastDoc?: any): Promise<{ clients: ClientProfile[]; lastDoc?: any }> {
    try {
      return await retry(async () => {
        let q = query(collection(this.db, this.clientsCollection), orderBy("uid"), fbLimit(pageSize));
        if (lastDoc) {
          q = query(q, startAfter(lastDoc));
        }
        const snapshot = await getDocs(q);
        const clients = snapshot.docs
          .map((doc) => doc.data())
          .filter(validateClientProfile);
        return { clients, lastDoc: snapshot.docs[snapshot.docs.length - 1] };
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get all clients');
    }
  }

  /**
   * Create a new client
   */

  public async createClient(client: ClientProfile): Promise<string> {
    console.log('[ClientService] createClient called', client);
    try {
      await retry(async () => {
        await setDoc(doc(this.db, this.clientsCollection, client.uid), {
          ...client,
          createdAt: Time.Firebase.toTimestamp(TimeUtils.now()),
          updatedAt: Time.Firebase.toTimestamp(TimeUtils.now()),
        });
      });
      return client.uid;
    } catch (error) {
      throw formatServiceError(error, 'Failed to create client');
    }
  }

  /**
   * Subscribe to all clients (real-time updates)
   */
  public subscribeToAllClients(
    onData: (clients: ClientProfile[]) => void,
    onError?: (error: ServiceError) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      collection(this.db, this.clientsCollection),
      (snapshot) => {
        const clients = snapshot.docs.map((doc) => ({
          ...(doc.data() as ClientProfile),
          uid: doc.id,
        }));
        onData(clients);
      },
      (error) => {
        if (onError) onError(formatServiceError(error, 'Real-time clients listener error'));
      }
    );
    return unsubscribe;
  }

  /**
   * Update an existing client
   */
  public async updateClient(uid: string, data: Partial<ClientProfile>): Promise<void> {
    console.log('[ClientService] updateClient called', uid, data);
    try {
      await retry(async () => {
        await updateDoc(doc(this.db, this.clientsCollection, uid), {
          ...data,
          updatedAt: Time.Firebase.toTimestamp(TimeUtils.now()),
        });
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to update client');
    }
  }

  /**
   * Delete a client
   */
  public async deleteClient(uid: string): Promise<void> {
    try {
      await retry(async () => {
        await deleteDoc(doc(this.db, this.clientsCollection, uid));
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to delete client');
    }
  }

  /**
   * Get all tags
   */
  public async getAllTags(): Promise<string[]> {
    try {
      return await retry(async () => {
        const tagsDoc = await getDoc(doc(this.db, this.tagsCollection, this.tagsDocId));
        if (tagsDoc.exists()) {
          return tagsDoc.data().tags || [];
        }
        return [];
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get tags');
    }
  }

  /**
   * Update tags
   */
  public async updateTags(tags: string[]): Promise<void> {
    console.log('[ClientService] updateTags called', tags);
    try {
      await retry(async () => {
        const sortedTags = [...tags].sort((a, b) => a.localeCompare(b));
        await setDoc(
          doc(this.db, this.tagsCollection, this.tagsDocId),
          { tags: sortedTags },
          { merge: true }
        );
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to update tags');
    }
  }

  /**
   * Update client's cluster ID
   */
  public async updateClientCluster(uid: string, clusterId: string): Promise<void> {
    console.log('[ClientService] updateClientCluster called', uid, clusterId);
    try {
      await retry(async () => {
        await setDoc(doc(this.db, this.clientsCollection, uid), { clusterID: clusterId }, { merge: true });
      });
    } catch (error) {
      throw formatServiceError(error, `Failed to update cluster for client ${uid}`);
    }
  }

  /**
   * Update the coordinates for a specific client
   */
  public async updateClientCoordinates(clientId: string, coordinates: LatLngTuple): Promise<void> {
    console.log('[ClientService] updateClientCoordinates called', clientId, coordinates);
    if (!clientId) {
      throw new ServiceError("Client ID is required to update coordinates.", "invalid-argument");
    }
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      throw new ServiceError("Invalid coordinates format provided.", "invalid-argument");
    }
    const clientRef = doc(this.db, this.clientsCollection, clientId);
    try {
      await retry(async () => {
        await updateDoc(clientRef, {
          coordinates: coordinates,
          updatedAt: Time.Firebase.toTimestamp(TimeUtils.now())
        });
      });
    } catch (error) {
      throw formatServiceError(error, `Failed to update coordinates for client ${clientId}`);
    }
  }
}

export default ClientService; 