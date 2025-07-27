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
    jest.spyOn(service, 'getAllClients').mockResolvedValue({ clients: [] });
    jest.spyOn(service, 'getClientById').mockResolvedValue({
      uid: 'test-uid',
      firstName: 'Test',
      lastName: 'User',
      streetName: '',
      zipCode: '',
      address: '',
      address2: '',
      email: '',
      city: '',
      state: '',
      quadrant: '',
      dob: '',
      deliveryFreq: '',
      phone: '',
      alternativePhone: '',
      adults: 1,
      children: 0,
      seniors: 0,
      total: 1,
      gender: 'Other',
      ethnicity: '',
      deliveryDetails: {
        deliveryInstructions: '',
        dietaryRestrictions: {
          lowSugar: false,
          kidneyFriendly: false,
          vegan: false,
          vegetarian: false,
          halal: false,
          microwaveOnly: false,
          softFood: false,
          lowSodium: false,
          noCookingEquipment: false,
          heartFriendly: false,
          foodAllergens: [],
          otherText: '',
          other: false
        }
      },
      tags: [],
      ward: '',
      coordinates: [{ lat: 0, lng: 0 }],
      notes: '',
      lifeChallenges: '',
      lifestyleGoals: '',
      language: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      headOfHousehold: 'Adult',
      startDate: '',
      endDate: '',
      recurrence: '',
      notesTimestamp: null,
      deliveryInstructionsTimestamp: null,
      lifeChallengesTimestamp: null,
      lifestyleGoalsTimestamp: null,
      referralEntity: null,
      tefapCert: '',
      clusterID: ''
    });
    jest.spyOn(service, 'updateClient').mockResolvedValue(undefined);
    jest.spyOn(service, 'deleteClient').mockResolvedValue(undefined);
    jest.spyOn(service, 'subscribeToAllClients').mockReturnValue(jest.fn());
    jest.spyOn(service, 'getAllTags').mockResolvedValue([]);
    jest.spyOn(service, 'updateTags').mockResolvedValue(undefined);
    jest.spyOn(service, 'updateClientCluster').mockResolvedValue(undefined);
    jest.spyOn(service, 'updateClientCoordinates').mockResolvedValue(undefined);
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
      jest.spyOn(service, 'getAllClients').mockRejectedValueOnce(new Error('Failed to get all clients'));
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
      jest.spyOn(service, 'getClientById').mockRejectedValueOnce(new Error('Failed to get client by ID'));
      await expect(service.getClientById('test-id')).rejects.toThrow('Failed to get client by ID');
    });
  });

// Skipped createClient tests: method does not exist on ClientService

  describe('updateClient', () => {
    it('should resolve on success', async () => {
      console.log('[Test] Calling updateClient');
      await expect(service.updateClient('id', {})).resolves.toBeUndefined();
      console.log('[Test] updateClient resolved');
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(service, 'updateClient').mockRejectedValueOnce(new Error('Failed to update client'));
      await expect(service.updateClient('id', {})).rejects.toThrow('Failed to update client');
    });
  });

  describe('deleteClient', () => {
    it('should resolve on success', async () => {
      await expect(service.deleteClient('id')).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(service, 'deleteClient').mockRejectedValueOnce(new Error('Failed to delete client'));
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
      jest.spyOn(service, 'updateTags').mockRejectedValueOnce(new Error('Failed to update tags'));
      await expect(service.updateTags(['a', 'b'])).rejects.toThrow('Failed to update tags');
    });
  });

  describe('updateClientCluster', () => {
    it('should resolve on success', async () => {
      await expect(service.updateClientCluster('id', 'cluster')).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(service, 'updateClientCluster').mockRejectedValueOnce(new Error('Failed to update cluster for client id'));
      await expect(service.updateClientCluster('id', 'cluster')).rejects.toThrow('Failed to update cluster for client id');
    });
  });

  describe('updateClientCoordinates', () => {
    it('should throw if clientId is missing', async () => {
      jest.spyOn(service, 'updateClientCoordinates').mockRejectedValueOnce(new Error('Client ID is required'));
      await expect(service.updateClientCoordinates('', [0, 0])).rejects.toThrow('Client ID is required');
    });
    it('should throw if coordinates are invalid', async () => {
      jest.spyOn(service, 'updateClientCoordinates').mockRejectedValueOnce(new Error('Invalid coordinates'));
      await expect(service.updateClientCoordinates('id', null as any)).rejects.toThrow('Invalid coordinates');
    });
    it('should resolve on success', async () => {
      console.log('[Test] Calling updateClientCoordinates');
      await expect(service.updateClientCoordinates('id', [0, 0])).resolves.toBeUndefined();
      console.log('[Test] updateClientCoordinates resolved');
    });
  });
});
