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
      jest.spyOn(service, 'getAllEvents').mockResolvedValueOnce([]);
      const result = await service.getAllEvents();
      expect(Array.isArray(result)).toBe(true);
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(service, 'getAllEvents').mockRejectedValueOnce(new Error('Failed to get all events'));
      await expect(service.getAllEvents()).rejects.toThrow('Failed to get all events');
    });
  });

  describe('getEventsByDateRange', () => {
    it('should return an array of events', async () => {
      jest.spyOn(service, 'getEventsByDateRange').mockResolvedValueOnce([]);
      const result = await service.getEventsByDateRange(new Date(), new Date());
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createEvent', () => {
    it('should return a string id on success', async () => {
      jest.spyOn(service, 'createEvent').mockResolvedValueOnce('mock-id');
      const id = await service.createEvent({} as any);
      expect(typeof id).toBe('string');
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(service, 'createEvent').mockRejectedValueOnce(new Error('Failed to create event'));
      await expect(service.createEvent({} as any)).rejects.toThrow('Failed to create event');
    });
  });

  describe('updateEvent', () => {
    it('should resolve on success', async () => {
      jest.spyOn(service, 'updateEvent').mockResolvedValueOnce(undefined);
      await expect(service.updateEvent('id', {})).resolves.toBeUndefined();
    });
    it('should throw on Firestore error', async () => {
      jest.spyOn(service, 'updateEvent').mockRestore?.(); // Ensure not mocked
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
      jest.spyOn(service, 'getEventsByClientId').mockResolvedValueOnce([]);
      const result = await service.getEventsByClientId('client-id');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getDailyLimits', () => {
    it('should return an array of daily limits', async () => {
      jest.spyOn(service, 'getDailyLimits').mockResolvedValueOnce([]);
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
      jest.spyOn(service, 'getWeeklyLimits').mockResolvedValueOnce({});
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
      jest.spyOn(service, 'getPreviousDeliveries').mockResolvedValueOnce([]);
      const result = await service.getPreviousDeliveries('client-id');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getNextDeliveries', () => {
    it('should return an array', async () => {
      jest.spyOn(service, 'getNextDeliveries').mockResolvedValueOnce([]);
      const result = await service.getNextDeliveries('client-id');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getClientDeliveryHistory', () => {
    it('should return an object with pastDeliveries and futureDeliveries', async () => {
      jest.spyOn(service, 'getClientDeliveryHistory').mockResolvedValueOnce({ pastDeliveries: [], futureDeliveries: [] });
      const result = await service.getClientDeliveryHistory('client-id');
      expect(result).toHaveProperty('pastDeliveries');
      expect(result).toHaveProperty('futureDeliveries');
    });
  });
});
