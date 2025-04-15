import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  DocumentReference,
} from "firebase/firestore";
import FirebaseService from "./firebase-service";
import { Cluster } from "../pages/Delivery/types/deliveryTypes";
import ClientService from "./client-service";

/**
 * Cluster Service - Handles all cluster-related operations with Firebase
 */
class ClusterService {
  private static instance: ClusterService;
  private db = FirebaseService.getInstance().getFirestore();
  private clustersCollection = "clusters";
  private clientService = ClientService.getInstance();

  private constructor() {}

  public static getInstance(): ClusterService {
    if (!ClusterService.instance) {
      ClusterService.instance = new ClusterService();
    }
    return ClusterService.instance;
  }

  /**
   * Get all clusters
   */
  public async getAllClusters(): Promise<Cluster[]> {
    try {
      const clustersCollectionRef = collection(this.db, this.clustersCollection);
      const snapshot = await getDocs(clustersCollectionRef);
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          docId: doc.id,
          id: data.id,
          time: data.time || "",
          driver: data.driver || null,
          deliveries: data.deliveries || [],
        };
      });
    } catch (error) {
      console.error("Error getting clusters:", error);
      throw error;
    }
  }

  /**
   * Get a cluster by ID
   */
  public async getClusterById(id: string): Promise<Cluster | null> {
    try {
      const clusterDoc = await getDoc(doc(this.db, this.clustersCollection, id));
      if (clusterDoc.exists()) {
        const data = clusterDoc.data();
        return {
          docId: clusterDoc.id,
          id: data.id,
          time: data.time || "",
          driver: data.driver || null,
          deliveries: data.deliveries || [],
        };
      }
      return null;
    } catch (error) {
      console.error("Error getting cluster:", error);
      throw error;
    }
  }

  /**
   * Create a new cluster
   */
  public async createCluster(cluster: Omit<Cluster, "docId">): Promise<string> {
    try {
      const docRef = await addDoc(collection(this.db, this.clustersCollection), cluster);
      return docRef.id;
    } catch (error) {
      console.error("Error creating cluster:", error);
      throw error;
    }
  }

  /**
   * Update an existing cluster
   */
  public async updateCluster(docId: string, data: Partial<Omit<Cluster, "docId">>): Promise<void> {
    try {
      await updateDoc(doc(this.db, this.clustersCollection, docId), data);
    } catch (error) {
      console.error("Error updating cluster:", error);
      throw error;
    }
  }

  /**
   * Delete a cluster
   */
  public async deleteCluster(docId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.db, this.clustersCollection, docId));
    } catch (error) {
      console.error("Error deleting cluster:", error);
      throw error;
    }
  }

  /**
   * Assign driver to clusters
   */
  public async assignDriverToClusters(clusterIds: string[], driverId: string): Promise<void> {
    try {
      const driverRef = doc(this.db, "Drivers", driverId);
      
      const updatePromises = clusterIds.map(async (clusterId) => {
        const clusterRef = doc(this.db, this.clustersCollection, clusterId);
        await updateDoc(clusterRef, { driver: driverRef });
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Error assigning driver to clusters:", error);
      throw error;
    }
  }

  /**
   * Add a client to a cluster and update the client's clusterID
   */
  public async addClientToCluster(clientId: string, clusterId: string, clusterId_number: number): Promise<void> {
    try {
      // Update the client's clusterID
      await this.clientService.updateClientCluster(clientId, clusterId_number.toString());
      
      // Get the cluster
      const clusterDoc = await getDoc(doc(this.db, this.clustersCollection, clusterId));
      if (clusterDoc.exists()) {
        const clusterData = clusterDoc.data();
        const deliveries = clusterData.deliveries || [];
        
        // Add the client to the cluster's deliveries if not already there
        if (!deliveries.some((delivery: any) => delivery.clientId === clientId)) {
          deliveries.push({ clientId });
          await updateDoc(doc(this.db, this.clustersCollection, clusterId), { deliveries });
        }
      }
    } catch (error) {
      console.error(`Error adding client ${clientId} to cluster ${clusterId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a client from a cluster and clear the client's clusterID
   */
  public async removeClientFromCluster(clientId: string, clusterId: string): Promise<void> {
    try {
      // Clear the client's clusterID
      await this.clientService.updateClientCluster(clientId, "");
      
      // Get the cluster
      const clusterDoc = await getDoc(doc(this.db, this.clustersCollection, clusterId));
      if (clusterDoc.exists()) {
        const clusterData = clusterDoc.data();
        let deliveries = clusterData.deliveries || [];
        
        // Remove the client from the cluster's deliveries
        deliveries = deliveries.filter((delivery: any) => delivery.clientId !== clientId);
        await updateDoc(doc(this.db, this.clustersCollection, clusterId), { deliveries });
      }
    } catch (error) {
      console.error(`Error removing client ${clientId} from cluster ${clusterId}:`, error);
      throw error;
    }
  }
}

export default ClusterService; 