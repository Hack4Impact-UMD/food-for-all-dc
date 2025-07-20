// Polyfill for TextEncoder/TextDecoder for Firebase Auth in Node test environment (must be first)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for ReadableStream for Firebase Auth in Node test environment
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = class {};
}

// Ensure matchMedia mock is set before any imports
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: function(query) {
      // Simulate mobile for 'max-width: 600px' queries, otherwise desktop
      const isMobile = /max-width:\s*600px/.test(query);
      return {
        matches: isMobile,
        media: query,
        onchange: null,
        addListener: function() {}, // Deprecated
        removeListener: function() {}, // Deprecated
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() {},
      };
    },
  });
}

import '@testing-library/jest-dom';

// Mock IntersectionObserver for tests
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() { return null; }
  disconnect() { return null; }
  unobserve() { return null; }
};

// Mock ResizeObserver for tests
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() { return null; }
  disconnect() { return null; }
  unobserve() { return null; }
};

// Mock timer functions
jest.useFakeTimers();
