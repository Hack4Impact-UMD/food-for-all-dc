// src/test-matchMedia.js
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: function(query) {
      return {
        matches: false,
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
