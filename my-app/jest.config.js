module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.ts',
    '<rootDir>/jest.setup.js'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/build/'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Stub image imports for Jest
    '\\.(webp|png|jpg|jpeg|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    // Explicitly mock react-datepicker CSS
    '^react-datepicker/dist/react-datepicker.css$': 'identity-obj-proxy',
  },
};
