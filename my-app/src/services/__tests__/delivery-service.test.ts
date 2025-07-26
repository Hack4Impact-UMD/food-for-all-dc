jest.setTimeout(15000);
jest.mock('../firebase-service');
import DeliveryService from '../delivery-service';
import * as retryUtils from '../../utils/retry';

jest.mock('../firebase-service');

describe('DeliveryService', () => {
  let service: DeliveryService;

  beforeEach(() => {
    service = DeliveryService.getInstance();
  });

  it('should be a singleton', () => {
    const service2 = DeliveryService.getInstance();
    expect(service).toBe(service2);
  });

  it('should have getAllEvents method', () => {
    expect(typeof service.getAllEvents).toBe('function');
  });
  it('should have getEventsByClientId method', () => {
    expect(typeof service.getEventsByClientId).toBe('function');
  });

  describe('getAllEvents', () => {
    it('should return an array of events on success', async () => {
      console.log('[Test] Calling getAllEvents');
      const result = await service.getAllEvents();
      console.log('[Test] getAllEvents result:', result);
      expect(Array.isArray(result)).toBe(true);
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => Promise.reject(new Error('fail')));
      await expect(service.getAllEvents()).rejects.toThrow('Failed to get all events');
    });
  });

  describe('getEventsByDateRange', () => {
    it('should return an array of events', async () => {
      console.log('[Test] Calling getEventsByDateRange');
      const result = await service.getEventsByDateRange(new Date(), new Date());
      console.log('[Test] getEventsByDateRange result:', result);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createEvent', () => {
    it('should return a string id on success', async () => {
      const id = await service.createEvent({} as any);
      expect(typeof id).toBe('string');
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.createEvent({} as any)).rejects.toThrow('Failed to create event');
    });
  });

  describe('updateEvent', () => {
    it('should resolve on success', async () => {
      await expect(service.updateEvent('id', {})).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.updateEvent('id', {})).rejects.toThrow('Failed to update event');
    });
  });

  describe('deleteEvent', () => {
    it('should resolve on success', async () => {
      await expect(service.deleteEvent('id')).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.deleteEvent('id')).rejects.toThrow('Failed to delete event');
    });
  });

  describe('getEventsByClientId', () => {
    it('should return an array of events', async () => {
      console.log('[Test] Calling getEventsByClientId');
      const result = await service.getEventsByClientId('client-id');
      console.log('[Test] getEventsByClientId result:', result);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getDailyLimits', () => {
    it('should return an array of daily limits', async () => {
      const result = await service.getDailyLimits();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('setDailyLimit', () => {
    it('should resolve on success', async () => {
      await expect(service.setDailyLimit('2024-01-01', 10)).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.setDailyLimit('2024-01-01', 10)).rejects.toThrow('Failed to set daily limit');
    });
  });

  describe('getWeeklyLimits', () => {
    it('should return an object', async () => {
      const result = await service.getWeeklyLimits();
      expect(typeof result).toBe('object');
    });
  });

  describe('updateWeeklyLimits', () => {
    it('should resolve on success', async () => {
      await expect(service.updateWeeklyLimits({})).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(retryUtils, 'retry').mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.updateWeeklyLimits({})).rejects.toThrow('Failed to update weekly limits');
    });
  });

  describe('getPreviousDeliveries', () => {
    it('should return an array', async () => {
      console.log('[Test] Calling getPreviousDeliveries');
      const result = await service.getPreviousDeliveries('client-id');
      console.log('[Test] getPreviousDeliveries result:', result);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getNextDeliveries', () => {
    it('should return an array', async () => {
      console.log('[Test] Calling getNextDeliveries');
      const result = await service.getNextDeliveries('client-id');
      console.log('[Test] getNextDeliveries result:', result);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getClientDeliveryHistory', () => {
    it('should return an object with pastDeliveries and futureDeliveries', async () => {
      console.log('[Test] Calling getClientDeliveryHistory');
      const result = await service.getClientDeliveryHistory('client-id');
      console.log('[Test] getClientDeliveryHistory result:', result);
      expect(result).toHaveProperty('pastDeliveries');
      expect(result).toHaveProperty('futureDeliveries');
    });
  });
});
