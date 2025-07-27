// __mocks__/firebase-service.js

const mockFirestore = {};
const mockAuth = {};

const FirebaseService = {
  getInstance: jest.fn(() => ({
    getFirestore: jest.fn(() => mockFirestore),
    getAuth: jest.fn(() => mockAuth),
  })),
};

export default FirebaseService;
