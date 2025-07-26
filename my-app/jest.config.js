module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.ts',
    '<rootDir>/jest.setup.js',
    '<rootDir>/jest.setup.console-error.js'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/build/'],
  moduleDirectories: ['node_modules', 'src'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Stub image imports for Jest
    '\\.(webp|png|jpg|jpeg|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    // Explicitly mock react-datepicker CSS
    '^react-datepicker/dist/react-datepicker.css$': 'identity-obj-proxy',
    '^src/(.*)$': '<rootDir>/src/$1',
    // Map firebase-service to the mock for all test imports (any relative path)
    '^(.*)/firebase-service$': '<rootDir>/src/services/__mocks__/firebase-service.ts',
    // Map firebaseConfig to the manual mock for all test imports (any relative path)
    '^(.*)/firebaseConfig$': '<rootDir>/src/auth/__mocks__/firebaseConfig.ts',
    // Map retry to the manual mock for all test imports (any relative path)
    '^(.*)/retry$': '<rootDir>/src/utils/__mocks__/retry.ts',
  },
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
};
