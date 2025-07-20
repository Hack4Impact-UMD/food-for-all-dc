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
  },
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
};
