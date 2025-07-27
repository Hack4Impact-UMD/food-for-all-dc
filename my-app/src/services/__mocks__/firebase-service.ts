// Jest manual mock for FirebaseService singleton
const mockFirestore = {};

const FirebaseService = {
  getInstance: jest.fn(() => ({
    getFirestore: jest.fn(() => mockFirestore),
    getAuth: jest.fn(() => ({
      currentUser: { uid: 'test-uid', email: 'test@example.com' },
      onAuthStateChanged: jest.fn((cb) => {
        cb({ uid: 'test-uid', email: 'test@example.com' });
        return jest.fn(); // unsubscribe mock
      }),
      signInWithEmailAndPassword: jest.fn(),
      signOut: jest.fn(),
    })),
  })),
};

export default FirebaseService;
