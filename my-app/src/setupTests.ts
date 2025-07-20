
// Ensure matchMedia mock is set before any imports (must be first code in file)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

import '@testing-library/jest-dom';

// Mock IntersectionObserver for tests
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock ResizeObserver for tests
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Ensure matchMedia mock is set before any imports
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Mock timer functions
jest.useFakeTimers();

// Polyfill for TextEncoder/TextDecoder for Firebase Auth in Node test environment
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for ReadableStream for Firebase Auth in Node test environment
// Polyfill for setImmediate for Node test environment (needed for Firebase/gRPC)
if (typeof global.setImmediate === 'undefined') {
  // @ts-ignore: Node Immediate type mismatch is safe for test polyfill
  global.setImmediate = (fn: (...args: any[]) => void, ...args: any[]) => setTimeout(fn, 0, ...args);
}
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = class {};
}

// Global teardown to clean up timers, observers, and listeners after all tests
afterAll(() => {
  // Clear all timers
  jest.clearAllTimers();
  jest.useRealTimers();

  // Disconnect all observers if needed
  if (global.IntersectionObserver && typeof global.IntersectionObserver.prototype.disconnect === 'function') {
    try {
      global.IntersectionObserver.prototype.disconnect();
    } catch (e) {}
  }
  if (global.ResizeObserver && typeof global.ResizeObserver.prototype.disconnect === 'function') {
    try {
      global.ResizeObserver.prototype.disconnect();
    } catch (e) {}
  }

  // Remove any event listeners if you add them globally
  if (typeof window !== 'undefined' && window.removeEventListener) {
    // Example: window.removeEventListener('resize', ...)
  }
});
