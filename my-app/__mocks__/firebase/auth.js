// Jest manual mock for firebase/auth
module.exports = {
  getAuth: jest.fn(() => ({
    useDeviceLanguage: jest.fn(),
    currentUser: null,
  })),
  // Mock onAuthStateChanged to return an unsubscribe function
  onAuthStateChanged: jest.fn((auth, callback) => {
    // Call the callback asynchronously to simulate real Firebase behavior
    if (typeof callback === 'function') {
      setTimeout(() => callback(null), 0);
    }
    return jest.fn(); // unsubscribe handler
  }),
  Auth: jest.fn(),
};
