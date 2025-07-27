
// Manual mock for firebase/app that simulates a default app instance
let defaultApp = null;

module.exports = {
  initializeApp: jest.fn((config) => {
    defaultApp = { name: '[DEFAULT]', options: config };
    return defaultApp;
  }),
  getApp: jest.fn((name = '[DEFAULT]') => {
    if (!defaultApp || (name !== '[DEFAULT]' && name !== defaultApp.name)) {
      throw new Error(`Firebase: No Firebase App '${name}' has been created - call initializeApp() first (app/no-app).`);
    }
    return defaultApp;
  }),
  FirebaseOptions: jest.fn(),
  FirebaseApp: jest.fn(),
};

// Jest manual mock for firebase/app
module.exports = {
  initializeApp: jest.fn(() => ({ name: 'mockApp' })),
  getApp: jest.fn(() => ({ name: 'mockApp' })),
};
