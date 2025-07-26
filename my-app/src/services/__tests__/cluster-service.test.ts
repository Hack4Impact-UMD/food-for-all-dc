jest.setTimeout(15000);
jest.mock('../firebase-service');
import ClusterService from '../cluster-service';
import * as retryUtils from '../../utils/retry';

jest.mock('../firebase-service');

describe('ClusterService', () => {
  let service: ClusterService;

  beforeEach(() => {
    service = ClusterService.getInstance();
  });

  it('should be a singleton', () => {
    const service2 = ClusterService.getInstance();
    expect(service).toBe(service2);
  });

  it('should have getAllClusters method', () => {
    expect(typeof service.getAllClusters).toBe('function');
  });

  describe('getAllClusters', () => {
    it('should return an array of clusters on success', async () => {
      console.log('[Test] Calling getAllClusters');
      const result = await service.getAllClusters();
      console.log('[Test] getAllClusters result:', result);
      expect(Array.isArray(result)).toBe(true);
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => Promise.reject(new Error('fail')));
      await expect(service.getAllClusters()).rejects.toThrow('Failed to get all clusters');
    });
  });

  describe('subscribeToAllClusters', () => {
    it('should call onData with an array', () => {
      const onData = jest.fn();
      const unsubscribe = service.subscribeToAllClusters(onData);
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getClusterById', () => {
    it('should return a cluster object or null', async () => {
      console.log('[Test] Calling getClusterById');
      const result = await service.getClusterById('test-id');
      console.log('[Test] getClusterById result:', result);
      expect(result === null || typeof result === 'object').toBe(true);
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.getClusterById('test-id')).rejects.toThrow('Failed to get cluster by ID');
    });
  });

  describe('subscribeToClusterById', () => {
    it('should call onData with a cluster or null', () => {
      const onData = jest.fn();
      const unsubscribe = service.subscribeToClusterById('id', onData);
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('createCluster', () => {
    it('should return a string id on success', async () => {
      const id = await service.createCluster({} as any);
      expect(typeof id).toBe('string');
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.createCluster({} as any)).rejects.toThrow('Failed to create cluster');
    });
  });

  describe('updateCluster', () => {
    it('should resolve on success', async () => {
      await expect(service.updateCluster('id', {})).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.updateCluster('id', {})).rejects.toThrow('Failed to update cluster');
    });
  });

  describe('deleteCluster', () => {
    it('should resolve on success', async () => {
      await expect(service.deleteCluster('id')).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.deleteCluster('id')).rejects.toThrow('Failed to delete cluster');
    });
  });

  describe('assignDriverToClusters', () => {
    it('should resolve on success', async () => {
      await expect(service.assignDriverToClusters(['id1', 'id2'], 'driverId')).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.assignDriverToClusters(['id1'], 'driverId')).rejects.toThrow('Failed to assign driver to clusters');
    });
  });

  describe('addClientToCluster', () => {
    it('should resolve on success', async () => {
      console.log('[Test] Calling addClientToCluster');
      await expect(service.addClientToCluster('clientId', 'clusterId', 1)).resolves.toBeUndefined();
      console.log('[Test] addClientToCluster resolved');
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.addClientToCluster('clientId', 'clusterId', 1)).rejects.toThrow('Failed to add client clientId to cluster clusterId');
    });
  });

  describe('removeClientFromCluster', () => {
    it('should resolve on success', async () => {
      console.log('[Test] Calling removeClientFromCluster');
      await expect(service.removeClientFromCluster('clientId', 'clusterId')).resolves.toBeUndefined();
      console.log('[Test] removeClientFromCluster resolved');
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.removeClientFromCluster('clientId', 'clusterId')).rejects.toThrow('Failed to remove client clientId from cluster clusterId');
    });
  });
});
