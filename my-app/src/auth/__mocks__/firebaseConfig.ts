
// Jest manual mock for firebaseConfig.ts
const mockApp = { name: 'mockApp' };
const mockDb = { name: 'mockDb' };
const mockAuth = {
  useDeviceLanguage: jest.fn(),
  currentUser: null,
};
const mockFunctions = { name: 'mockFunctions' };

export const getFirebaseDb = jest.fn(() => mockDb);
export const getFirebaseAuth = jest.fn(() => mockAuth);
export const getFirebaseFunctions = jest.fn(() => mockFunctions);
export const db = mockDb;
export const auth = mockAuth;
export const functions = mockFunctions;
export const firebaseConfig = {};
export const app = mockApp;
