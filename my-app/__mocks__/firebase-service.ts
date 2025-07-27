// __mocks__/firebase-service.ts
import { jest } from '@jest/globals';

const mockFirestore = {};
const mockAuth = {};


// Jest mock for FirebaseService singleton pattern
class FirebaseServiceMock {
  static instance: FirebaseServiceMock;
  static getInstance() {
    if (!FirebaseServiceMock.instance) {
      FirebaseServiceMock.instance = new FirebaseServiceMock();
    }
    return FirebaseServiceMock.instance;
  }
  getFirestore() {
    // Return a mock Firestore object with all methods used in services
    return {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          onSnapshot: jest.fn(),
        })),
        get: jest.fn(),
        add: jest.fn(),
        where: jest.fn(),
        orderBy: jest.fn(),
        limit: jest.fn(),
        onSnapshot: jest.fn(),
      })),
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        onSnapshot: jest.fn(),
      })),
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      onSnapshot: jest.fn(),
    };
  }
  getAuth() {
    return {};
  }
  getApp() {
    return {};
  }
}

// Export both default and named for compatibility
export { FirebaseServiceMock };
export default FirebaseServiceMock;
