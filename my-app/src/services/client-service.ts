import { db } from "../auth/firebaseConfig";
import { ClientProfile } from "../types";
import type { RowData } from "../components/Spreadsheet/export";
import { LatLngTuple } from "leaflet";
import { Time, TimeUtils } from "../utils/timeUtils";
import { retry } from "../utils/retry";
import { ServiceError, formatServiceError } from "../utils/serviceError";
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
  startAfter,
} from "firebase/firestore";
import { validateClientProfile } from "../utils/firestoreValidation";
import dataSources from "../config/dataSources";

/**
 * Client Service - Handles all client-related operations with Firebase
 */
// ...existing code...
class ClientService {
  private static instance: ClientService;
  private db = db;
  private clientsCollection = dataSources.firebase.clientsCollection;
  private tagsCollection = dataSources.firebase.tagsCollection;
  private tagsDocId = dataSources.firebase.tagsDocId;

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
      const docRef = doc(this.db, this.clientsCollection, uid);
      const docSnap = await retry(async () => {
        return await getDoc(docRef);
      });
      if (docSnap.exists()) {
        const data = docSnap.data() as ClientProfile;
        return validateClientProfile(data) ? data : null;
      }
      return null;
    } catch (error) {
      throw formatServiceError(error, "Failed to get client by ID");
    }
  }

  /**
   * Get all clients with pagination support
   * @param pageSize Number of clients per page
   * @param lastDoc Last document from previous page (for pagination)
   */
  public async getAllClients(
    pageSize = 3000,
    lastDoc?: any
  ): Promise<{ clients: ClientProfile[]; lastDoc?: any }> {
    try {
      return await retry(async () => {
        let q = query(collection(this.db, this.clientsCollection), fbLimit(pageSize));
        if (lastDoc) {
          q = query(q, startAfter(lastDoc));
        }
        const snapshot = await getDocs(q);
        const clients = snapshot.docs.map((doc) => {
          const raw = doc.data() as any;
          const deliveryDetails = raw.deliveryDetails || {};
          const dietaryRestrictions = deliveryDetails.dietaryRestrictions || {};

          // Calculate activeStatus based on startDate and endDate
          const todayDate = TimeUtils.now().startOf("day");
          const startDateTime = raw.startDate
            ? TimeUtils.fromAny(raw.startDate).startOf("day")
            : null;
          const endDateTime = raw.endDate
            ? TimeUtils.fromAny(raw.endDate).startOf("day")
            : null;
          let activeStatus = false;
          if (startDateTime?.isValid && endDateTime?.isValid) {
            const todayMillis = todayDate.toMillis();
            activeStatus =
              todayMillis >= startDateTime.toMillis() && todayMillis <= endDateTime.toMillis();
          }

          const mapped: ClientProfile = {
            uid: doc.id,
            firstName: raw.firstName || "",
            lastName: raw.lastName || "",
            zipCode: raw.zipCode || "",
            address: raw.address || "",
            address2: raw.address2 || "",
            email: raw.email || "",
            city: raw.city || "",
            state: raw.state || "",
            quadrant: raw.quadrant || "",
            dob: raw.dob || "",
            deliveryFreq: raw.deliveryFreq || "",
            phone: raw.phone || "",
            alternativePhone: raw.alternativePhone || "",
            adults: raw.adults || 0,
            children: raw.children || 0,
            total: raw.total || 0,
            gender: raw.gender || "Other",
            ethnicity: raw.ethnicity || "",
            deliveryDetails: {
              deliveryInstructions: deliveryDetails.deliveryInstructions || "",
              dietaryRestrictions: {
                lowSugar: dietaryRestrictions.lowSugar || false,
                kidneyFriendly: dietaryRestrictions.kidneyFriendly || false,
                vegan: dietaryRestrictions.vegan || false,
                vegetarian: dietaryRestrictions.vegetarian || false,
                halal: dietaryRestrictions.halal || false,
                microwaveOnly: dietaryRestrictions.microwaveOnly || false,
                softFood: dietaryRestrictions.softFood || false,
                lowSodium: dietaryRestrictions.lowSodium || false,
                noCookingEquipment: dietaryRestrictions.noCookingEquipment || false,
                heartFriendly: dietaryRestrictions.heartFriendly || false,
                foodAllergens: dietaryRestrictions.foodAllergens || [],
                otherText: dietaryRestrictions.otherText || "",
                other: dietaryRestrictions.other || false,
              },
            },
            lifeChallenges: raw.lifeChallenges || "",
            notes: raw.notes || "",
            notesTimestamp: raw.notesTimestamp || null,
            deliveryInstructionsTimestamp: raw.deliveryInstructionsTimestamp || null,
            lifeChallengesTimestamp: raw.lifeChallengesTimestamp || null,
            lifestyleGoalsTimestamp: raw.lifestyleGoalsTimestamp || null,
            lifestyleGoals: raw.lifestyleGoals || "",
            language: raw.language || "",
            createdAt: raw.createdAt || null,
            updatedAt: raw.updatedAt || null,
            tags: raw.tags || [],
            ward: raw.ward || "",
            coordinates: raw.coordinates || [],
            seniors: raw.seniors || 0,
            headOfHousehold: raw.headOfHousehold || "Adult",
            referralEntity: raw.referralEntity || null,
            startDate: raw.startDate || "",
            endDate: raw.endDate || "",
            recurrence: raw.recurrence || "None",
            tefapCert: raw.tefapCert || undefined,
            clusterID: raw.clusterID || undefined,
            physicalAilments: raw.physicalAilments || "",
            physicalDisability: raw.physicalDisability || "",
            mentalHealthConditions: raw.mentalHealthConditions || "",
            activeStatus,
          };
          return mapped;
        });
        return { clients, lastDoc: snapshot.docs[snapshot.docs.length - 1] };
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get all clients");
    }
  }

  /**
   * Get multiple clients by their UIDs - optimized for calendar lazy loading
   * @param uids Array of client UIDs to fetch
   */
  public async getClientsByIds(uids: string[]): Promise<ClientProfile[]> {
    try {
      if (uids.length === 0) return [];

      // For small batches, use parallel individual fetches
      if (uids.length <= 10) {
        const promises = uids.map((uid) => this.getClientById(uid));
        const results = await Promise.all(promises);
        return results.filter((client) => client !== null) as ClientProfile[];
      }

      // For larger batches, we'd need a more sophisticated approach
      // For now, fall back to individual fetches but could be optimized with Firestore 'in' queries
      const clients: ClientProfile[] = [];
      const batchSize = 10; // Firestore 'in' query limit

      for (let i = 0; i < uids.length; i += batchSize) {
        const batch = uids.slice(i, i + batchSize);
        const promises = batch.map((uid) => this.getClientById(uid));
        const batchResults = await Promise.all(promises);
        clients.push(...(batchResults.filter((client) => client !== null) as ClientProfile[]));
      }
      return clients;
    } catch (error) {
      throw formatServiceError(error, "Failed to get clients by IDs");
    }
  }

  /**
   * Search clients by name for autocomplete (lightweight, returns minimal data)
   * @param searchTerm Name to search for
   * @param limitCount Maximum results to return
   */
  public async searchClientsByName(
    searchTerm: string,
    limitCount = 50
  ): Promise<
    Pick<ClientProfile, "uid" | "firstName" | "lastName" | "address" | "activeStatus">[]
  > {
    try {
      if (!searchTerm.trim()) {
        const emptyQuery = query(collection(this.db, this.clientsCollection), fbLimit(limitCount));
        const snapshot = await getDocs(emptyQuery);
        const mapped = snapshot.docs.map((doc) => {
          const data = doc.data() as any;
          const todayDate = TimeUtils.now().startOf("day");
          const startDateTime = data.startDate
            ? TimeUtils.fromAny(data.startDate).startOf("day")
            : null;
          const endDateTime = data.endDate
            ? TimeUtils.fromAny(data.endDate).startOf("day")
            : null;
          let activeStatus = false;
          if (startDateTime?.isValid && endDateTime?.isValid) {
            const todayMillis = todayDate.toMillis();
            activeStatus =
              todayMillis >= startDateTime.toMillis() && todayMillis <= endDateTime.toMillis();
          }
          return {
            uid: doc.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            address: data.address || "",
            activeStatus,
          };
        });

        return mapped.sort((a, b) => {
          const lastCompare = (a.lastName || "").localeCompare(b.lastName || "", undefined, {
            sensitivity: "base",
          });
          if (lastCompare !== 0) return lastCompare;
          return (a.firstName || "").localeCompare(b.firstName || "", undefined, {
            sensitivity: "base",
          });
        });
      }

      const searchLower = searchTerm.toLowerCase();
      const snapshot = await getDocs(collection(this.db, this.clientsCollection));

      const mapped = snapshot.docs
        .map((doc) => {
          const data = doc.data() as any;
          const todayDate = TimeUtils.now().startOf("day");
          const startDateTime = data.startDate
            ? TimeUtils.fromAny(data.startDate).startOf("day")
            : null;
          const endDateTime = data.endDate
            ? TimeUtils.fromAny(data.endDate).startOf("day")
            : null;
          let activeStatus = false;
          if (startDateTime?.isValid && endDateTime?.isValid) {
            const todayMillis = todayDate.toMillis();
            activeStatus =
              todayMillis >= startDateTime.toMillis() && todayMillis <= endDateTime.toMillis();
          }
          return {
            uid: doc.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            address: data.address || "",
            activeStatus,
          };
        });

      const results = mapped
        .filter((client) => {
          const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
          return fullName.includes(searchLower);
        })
        .sort((a, b) => {
          const lastCompare = (a.lastName || "").localeCompare(b.lastName || "", undefined, {
            sensitivity: "base",
          });
          if (lastCompare !== 0) return lastCompare;
          return (a.firstName || "").localeCompare(b.firstName || "", undefined, {
            sensitivity: "base",
          });
        })
        .slice(0, limitCount);

      return results;
    } catch (error) {
      throw formatServiceError(error, "Failed to search clients by name");
    }
  }

  // For Spreadsheet only: returns RowData[]
  public async getAllClientsForSpreadsheet(
    pageSize = 3000,
    lastDoc?: any
  ): Promise<{ clients: RowData[]; lastDoc?: any }> {
    try {
      return await retry(async () => {
        let q = query(collection(this.db, this.clientsCollection), fbLimit(pageSize));
        if (lastDoc) {
          q = query(q, startAfter(lastDoc));
        }
        const snapshot = await getDocs(q);
        // Fetch all delivery events
        const deliverySnapshot = await getDocs(
          collection(this.db, dataSources.firebase.calendarCollection)
        );
        const allDeliveries = deliverySnapshot.docs.map((doc) => doc.data());

        const clients = snapshot.docs.map((doc) => {
          const raw = doc.data() as any;
          // Find latest delivery date for this client
          const clientDeliveries = allDeliveries.filter(
            (d: any) => d.clientId === doc.id && d.deliveryDate
          );
          let lastDeliveryDate = "";
          if (clientDeliveries.length > 0) {
            const latest = clientDeliveries.reduce((max, curr) => {
              const currDate = curr.deliveryDate?.toDate
                ? curr.deliveryDate.toDate()
                : curr.deliveryDate;
              const maxDate = max.deliveryDate?.toDate
                ? max.deliveryDate.toDate()
                : max.deliveryDate;
              return currDate > maxDate ? curr : max;
            });
            const dateObj = latest.deliveryDate?.toDate
              ? latest.deliveryDate.toDate()
              : latest.deliveryDate;
            lastDeliveryDate = dateObj ? dateObj.toISOString().slice(0, 10) : "";
          }
          // Calculate activeStatus based on startDate and endDate
          let activeStatus = false;
          const todayDate = TimeUtils.now().startOf("day");
          const startDateTime = raw.startDate ? TimeUtils.fromAny(raw.startDate).startOf("day") : null;
          const endDateTime = raw.endDate ? TimeUtils.fromAny(raw.endDate).startOf("day") : null;
          if (startDateTime?.isValid && endDateTime?.isValid) {
            const todayMillis = todayDate.toMillis();
            activeStatus =
              todayMillis >= startDateTime.toMillis() && todayMillis <= endDateTime.toMillis();
          }
          const mapped = {
            id: doc.id,
            uid: doc.id,
            clientid: raw.clientid || doc.id,
            firstName: raw.firstName || "",
            lastName: raw.lastName || "",
            phone: raw.phone || "",
            houseNumber: raw.houseNumber || 0,
            address: raw.address || "",
            address2: raw.address2 || "",
            deliveryDetails: {
              deliveryInstructions: raw.deliveryDetails?.deliveryInstructions || "",
              dietaryRestrictions: {
                lowSugar: raw.deliveryDetails?.dietaryRestrictions?.lowSugar || false,
                kidneyFriendly: raw.deliveryDetails?.dietaryRestrictions?.kidneyFriendly || false,
                vegan: raw.deliveryDetails?.dietaryRestrictions?.vegan || false,
                vegetarian: raw.deliveryDetails?.dietaryRestrictions?.vegetarian || false,
                halal: raw.deliveryDetails?.dietaryRestrictions?.halal || false,
                microwaveOnly: raw.deliveryDetails?.dietaryRestrictions?.microwaveOnly || false,
                softFood: raw.deliveryDetails?.dietaryRestrictions?.softFood || false,
                lowSodium: raw.deliveryDetails?.dietaryRestrictions?.lowSodium || false,
                noCookingEquipment:
                  raw.deliveryDetails?.dietaryRestrictions?.noCookingEquipment || false,
                heartFriendly: raw.deliveryDetails?.dietaryRestrictions?.heartFriendly || false,
                foodAllergens: raw.deliveryDetails?.dietaryRestrictions?.foodAllergens || [],
                otherText: raw.deliveryDetails?.dietaryRestrictions?.otherText || "",
                other: raw.deliveryDetails?.dietaryRestrictions?.other || false,
                dietaryPreferences:
                  raw.deliveryDetails?.dietaryRestrictions?.dietaryPreferences || "",
              },
            },
            ethnicity: raw.ethnicity || "",
            adults: raw.adults ?? null,
            children: raw.children ?? null,
            deliveryFreq: raw.deliveryFreq ?? "",
            gender: raw.gender ?? "",
            language: raw.language ?? "",
            notes: raw.notes ?? "",
            tefapCert: raw.tefapCert ?? "",
            dob: raw.dob ?? "",
            ward: raw.ward ?? "",
            zipCode: raw.zipCode ?? "",
            tags: raw.tags ?? [],
            referralEntity: raw.referralEntity ?? undefined,
            lastDeliveryDate,
            activeStatus,
          };
          return mapped;
        });
        return { clients, lastDoc: snapshot.docs[snapshot.docs.length - 1] };
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to get all clients for spreadsheet");
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
        if (onError) onError(formatServiceError(error, "Real-time clients listener error"));
      }
    );
    return unsubscribe;
  }

  /**
   * Update an existing client
   */
  public async updateClient(uid: string, data: Partial<ClientProfile>): Promise<void> {
    // ...existing code...
    try {
      await retry(async () => {
        await updateDoc(doc(this.db, this.clientsCollection, uid), {
          ...data,
          updatedAt: Time.Firebase.toTimestamp(TimeUtils.now()),
        });
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to update client");
    }
  }

  /**
   * Delete a client
   */
  public async deleteClient(uid: string): Promise<void> {
    try {
      // Delete all deliveries for this client first
      const DeliveryService = (await import("./delivery-service")).default.getInstance();
      await DeliveryService.deleteEventsByClientId(uid);
      // Now delete the client
      await retry(async () => {
        await deleteDoc(doc(this.db, this.clientsCollection, uid));
      });
    } catch (error) {
      throw formatServiceError(error, "Failed to delete client");
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
      throw formatServiceError(error, "Failed to get tags");
    }
  }

  /**
   * Update tags
   */
  public async updateTags(tags: string[]): Promise<void> {
    // ...existing code...
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
      throw formatServiceError(error, "Failed to update tags");
    }
  }

  /**
   * Update client's cluster ID
   */
  public async updateClientCluster(uid: string, clusterId: string): Promise<void> {
    // ...existing code...
    try {
      await retry(async () => {
        await setDoc(
          doc(this.db, this.clientsCollection, uid),
          { clusterID: clusterId },
          { merge: true }
        );
      });
    } catch (error) {
      throw formatServiceError(error, `Failed to update cluster for client ${uid}`);
    }
  }

  /**
   * Update the coordinates for a specific client
   */
  public async updateClientCoordinates(clientId: string, coordinates: LatLngTuple): Promise<void> {
    // ...existing code...
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
          updatedAt: Time.Firebase.toTimestamp(TimeUtils.now()),
        });
      });
    } catch (error) {
      throw formatServiceError(error, `Failed to update coordinates for client ${clientId}`);
    }
  }
}

export const clientService = ClientService.getInstance();
