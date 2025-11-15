import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import { retry } from '../utils/retry';
import { ServiceError, formatServiceError } from '../utils/serviceError';
import { Cluster } from "../pages/Delivery/types/deliveryTypes";
import { validateCluster } from '../utils/firestoreValidation';
import { clientService } from "./client-service";
import dataSources from '../config/dataSources';

/**
 * Cluster Service - Handles all cluster-related operations with Firebase
 */
class ClusterService {
  private static instance: ClusterService;
  private db = db;
  private clustersCollection = dataSources.firebase.clustersCollection;
  private clientService = clientService;

  // Empty constructor for singleton pattern
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {
  }

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
      return await retry(async () => {
        const clustersCollectionRef = collection(this.db, this.clustersCollection);
        const snapshot = await getDocs(clustersCollectionRef);
        const clusters = snapshot.docs
          .map((doc) => {
            const data = { docId: doc.id, ...doc.data() };
            return validateCluster(data) ? data : undefined;
          })
          .filter((cluster): cluster is Cluster => cluster !== undefined);
        return clusters;
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get all clusters');
    }
  }

  /**
   * Subscribe to all clusters (real-time updates)
   */
  public subscribeToAllClusters(
    onData: (clusters: Cluster[]) => void,
    onError?: (error: ServiceError) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      collection(this.db, this.clustersCollection),
      (snapshot) => {
        const clusters = snapshot.docs
          .map((doc) => {
            const data = { docId: doc.id, ...doc.data() };
            return validateCluster(data) ? data : undefined;
          })
          .filter((cluster): cluster is Cluster => cluster !== undefined);
        onData(clusters);
      },
      (error) => {
        if (onError) onError(formatServiceError(error, 'Real-time clusters listener error'));
      }
    );
    return unsubscribe;
  }

  /**
   * Get a cluster by ID
   */
  public async getClusterById(id: string): Promise<Cluster | null> {
    try {
      return await retry(async () => {
        const clusterDoc = await getDoc(doc(this.db, this.clustersCollection, id));
        if (clusterDoc.exists()) {
          const data = { docId: clusterDoc.id, ...clusterDoc.data() };
          return validateCluster(data) ? data : null;
        }
        return null;
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to get cluster by ID');
    }
  }

  /**
   * Subscribe to a cluster by ID (real-time updates)
   */
  public subscribeToClusterById(
    id: string,
    onData: (cluster: Cluster | null) => void,
    onError?: (error: ServiceError) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      doc(this.db, this.clustersCollection, id),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          onData({
            docId: snapshot.id,
            id: data.id,
            time: data.time || "",
            driver: data.driver || null,
            deliveries: data.deliveries || [],
          });
        } else {
          onData(null);
        }
      },
      (error) => {
        if (onError) onError(formatServiceError(error, 'Real-time cluster listener error'));
      }
    );
    return unsubscribe;
  }

  /**
   * Create a new cluster
   */
  public async createCluster(cluster: Omit<Cluster, "docId">): Promise<string> {
    try {
      return await retry(async () => {
        const docRef = await addDoc(collection(this.db, this.clustersCollection), cluster);
        return docRef.id;
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to create cluster');
    }
  }

  /**
   * Update an existing cluster
   */
  public async updateCluster(docId: string, data: Partial<Omit<Cluster, "docId">>): Promise<void> {
    try {
      await retry(async () => {
        await updateDoc(doc(this.db, this.clustersCollection, docId), data);
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to update cluster');
    }
  }

  /**
   * Delete a cluster
   */
  public async deleteCluster(docId: string): Promise<void> {
    try {
      await retry(async () => {
        await deleteDoc(doc(this.db, this.clustersCollection, docId));
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to delete cluster');
    }
  }

  /**
   * Assign driver to clusters
   */
  public async assignDriverToClusters(clusterIds: string[], driverId: string): Promise<void> {
    try {
      await retry(async () => {
  const driverRef = doc(this.db, dataSources.firebase.driversCollection, driverId);
        const updatePromises = clusterIds.map(async (clusterId) => {
          const clusterRef = doc(this.db, this.clustersCollection, clusterId);
          await updateDoc(clusterRef, { driver: driverRef });
        });
        await Promise.all(updatePromises);
      });
    } catch (error) {
      throw formatServiceError(error, 'Failed to assign driver to clusters');
    }
  }

  /**
   * Add a client to a cluster and update the client's clusterID
   */
  public async addClientToCluster(clientId: string, clusterId: string, clusterId_number: number): Promise<void> {
    try {
      await retry(async () => {
        await this.clientService.updateClient(clientId, { clusterID: clusterId_number.toString() });
        const clusterDoc = await getDoc(doc(this.db, this.clustersCollection, clusterId));
        if (clusterDoc.exists()) {
          const clusterData = clusterDoc.data();
          const deliveries = clusterData.deliveries || [];
          if (!deliveries.some((delivery: { clientId: string }) => delivery.clientId === clientId)) {
            deliveries.push({ clientId });
            await updateDoc(doc(this.db, this.clustersCollection, clusterId), { deliveries });
          }
        }
      });
    } catch (error) {
      throw formatServiceError(error, `Failed to add client ${clientId} to cluster ${clusterId}`);
    }
  }

  /**
   * Remove a client from a cluster and clear the client's clusterID
   */
  public async removeClientFromCluster(clientId: string, clusterId: string): Promise<void> {
    try {
      await retry(async () => {
        await this.clientService.updateClient(clientId, { clusterID: "" });
        const clusterDoc = await getDoc(doc(this.db, this.clustersCollection, clusterId));
        if (clusterDoc.exists()) {
          const clusterData = clusterDoc.data();
          let deliveries = clusterData.deliveries || [];
          deliveries = deliveries.filter((delivery: { clientId: string }) => delivery.clientId !== clientId);
          await updateDoc(doc(this.db, this.clustersCollection, clusterId), { deliveries });
        }
      });
    } catch (error) {
      throw formatServiceError(error, `Failed to remove client ${clientId} from cluster ${clusterId}`);
    }
  }
}

export default ClusterService; 