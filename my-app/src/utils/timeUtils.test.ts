
import { DateTime } from 'luxon';
import { Timestamp } from 'firebase/firestore';
import TimeUtils, { Time } from './timeUtils';

describe('TimeUtils', () => {
  describe('fromFirebaseTimestamp', () => {
    it('should convert a Timestamp to a DateTime', () => {
      const date = new Date('2025-07-26T12:00:00Z');
      const mockTimestamp = Timestamp.fromDate(date);
      const result = TimeUtils.fromFirebaseTimestamp(mockTimestamp);
      expect(result).toBeInstanceOf(DateTime);
      expect(result.toJSDate()).toEqual(date);
    });
  });

  describe('fromAny', () => {
    it('should handle DateTime input', () => {
      const dt = DateTime.now();
      expect(TimeUtils.fromAny(dt)).toBe(dt);
    });
    it('should handle Date input', () => {
      const date = new Date('2025-07-26T12:00:00Z');
      const dt = TimeUtils.fromAny(date);
      expect(dt).toBeInstanceOf(DateTime);
      expect(dt.toJSDate()).toEqual(date);
    });
    it('should handle Timestamp input', () => {
      const date = new Date('2025-07-26T12:00:00Z');
      const ts = Timestamp.fromDate(date);
      const dt = TimeUtils.fromAny(ts);
      expect(dt).toBeInstanceOf(DateTime);
      expect(dt.toJSDate()).toEqual(date);
    });
    it('should handle ISO string input', () => {
      const iso = '2025-07-26T12:00:00Z';
      const dt = TimeUtils.fromAny(iso);
      expect(dt).toBeInstanceOf(DateTime);
      // Compare UTC milliseconds instead of ISO string to avoid timezone issues
      expect(dt.toMillis()).toBe(DateTime.fromISO(iso).toMillis());
    });
  });

  describe('toDateString', () => {
    it('should format DateTime as YYYY-MM-DD', () => {
      const dt = DateTime.fromISO('2025-07-26T12:00:00Z');
      expect(TimeUtils.toDateString(dt)).toBe('2025-07-26');
    });
  });

  describe('add/subtract', () => {
    it('should add days', () => {
      const dt = DateTime.fromISO('2025-07-26');
      expect(TimeUtils.add(dt, { days: 2 }).toISODate()).toBe('2025-07-28');
    });
    it('should subtract days', () => {
      const dt = DateTime.fromISO('2025-07-26');
      expect(TimeUtils.subtract(dt, { days: 2 }).toISODate()).toBe('2025-07-24');
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      const today = TimeUtils.today();
      expect(TimeUtils.isToday(today)).toBe(true);
    });
    it('should return false for another day', () => {
      const notToday = TimeUtils.add(TimeUtils.today(), { days: 1 });
      expect(TimeUtils.isToday(notToday)).toBe(false);
    });
  });

  describe('calculateAge', () => {
    it('should calculate age in years', () => {
      const dob = DateTime.fromISO('2000-01-01');
      // Use the Time namespace for calculateAge
      const age = Time.Firebase.calculateAge(dob);
      expect(typeof age).toBe('number');
      expect(age).toBeGreaterThanOrEqual(0);
    });
  });
});
