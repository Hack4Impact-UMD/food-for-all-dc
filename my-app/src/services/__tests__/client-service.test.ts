jest.setTimeout(15000);
jest.mock('../firebase-service');
import ClientService from '../client-service';
import { ClientProfile } from '../../types';
import * as retryUtils from '../../utils/retry';

jest.mock('../firebase-service');

// Mock Firestore and utility dependencies as needed

describe('ClientService', () => {
  let service: ClientService;

  beforeEach(() => {
    service = ClientService.getInstance();
  });

  it('should be a singleton', () => {
    const service2 = ClientService.getInstance();
    expect(service).toBe(service2);
  });

  it('should have getAllClients method', () => {
    expect(typeof service.getAllClients).toBe('function');
  });

  describe('getAllClients', () => {
    it('should return an array of clients on success', async () => {
      console.log('[Test] Calling getAllClients');
      const result = await service.getAllClients();
      console.log('[Test] getAllClients result:', result);
      expect(Array.isArray(result.clients)).toBe(true);
    });
    it('should throw on Firestore error', async () => {
      // Simulate error by mocking retry to throw
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => Promise.reject(new Error('fail')));
      await expect(service.getAllClients()).rejects.toThrow('Failed to get all clients');
    });
  });

  describe('getClientById', () => {
    it('should return a client object or null', async () => {
      console.log('[Test] Calling getClientById');
      const result = await service.getClientById('test-id');
      console.log('[Test] getClientById result:', result);
      expect(result === null || typeof result === 'object').toBe(true);
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => Promise.reject(new Error('fail')));
      await expect(service.getClientById('test-id')).rejects.toThrow('Failed to get client by ID');
    });
  });

describe('createClient', () => {
  const validClient = { uid: 'test-uid', name: 'Test User', email: 'test@example.com' } as any;
  it('should return a string id on success', async () => {
    console.log('[Test] Calling createClient');
    const id = await service.createClient(validClient);
    console.log('[Test] createClient result:', id);
    expect(typeof id).toBe('string');
  });
  it('should throw on Firestore error', async () => {
    jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
    await expect(service.createClient(validClient)).rejects.toThrow('Failed to create client');
  });
});

  describe('updateClient', () => {
    it('should resolve on success', async () => {
      console.log('[Test] Calling updateClient');
      await expect(service.updateClient('id', {})).resolves.toBeUndefined();
      console.log('[Test] updateClient resolved');
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.updateClient('id', {})).rejects.toThrow('Failed to update client');
    });
  });

  describe('deleteClient', () => {
    it('should resolve on success', async () => {
      await expect(service.deleteClient('id')).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.deleteClient('id')).rejects.toThrow('Failed to delete client');
    });
  });

  describe('subscribeToAllClients', () => {
    it('should call onData with an array', () => {
      const onData = jest.fn();
      const unsubscribe = service.subscribeToAllClients(onData);
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getAllTags', () => {
    it('should return an array of tags', async () => {
      const tags = await service.getAllTags();
      expect(Array.isArray(tags)).toBe(true);
    });
  });

  describe('updateTags', () => {
    it('should resolve on success', async () => {
      await expect(service.updateTags(['a', 'b'])).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.updateTags(['a', 'b'])).rejects.toThrow('Failed to update tags');
    });
  });

  describe('updateClientCluster', () => {
    it('should resolve on success', async () => {
      await expect(service.updateClientCluster('id', 'cluster')).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.updateClientCluster('id', 'cluster')).rejects.toThrow('Failed to update cluster for client id');
    });
  });

  describe('updateClientCoordinates', () => {
    it('should throw if clientId is missing', async () => {
      await expect(service.updateClientCoordinates('', [0, 0])).rejects.toThrow('Client ID is required');
    });
    it('should throw if coordinates are invalid', async () => {
      await expect(service.updateClientCoordinates('id', null as any)).rejects.toThrow('Invalid coordinates');
    });
    it('should resolve on success', async () => {
      console.log('[Test] Calling updateClientCoordinates');
      await expect(service.updateClientCoordinates('id', [0, 0])).resolves.toBeUndefined();
      console.log('[Test] updateClientCoordinates resolved');
    });
  });
});
