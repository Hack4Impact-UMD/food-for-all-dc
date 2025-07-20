
// Ultra-defensive Firestore mock

console.log('Jest Firestore manual mock loaded');
// Helper to create a Firestore-like snapshot object


// Helper to create a Firestore-like snapshot object with all expected fields
function createSnapshot(docs = [
  { id: 'mock-id-1', data: () => ({ id: 'mock-id-1', name: 'Mock Item 1' }) },
  { id: 'mock-id-2', data: () => ({ id: 'mock-id-2', name: 'Mock Item 2' }) },
]) {
  return {
    docs,
    forEach: function(cb) { docs.forEach(cb); },
    empty: docs.length === 0,
    size: docs.length,
    data: () => ({}),
    exists: true,
    get: function() { return this; },
    then: function(resolve) { resolve(this); },
    catch: function() { return this; },
    finally: function() { return this; },
  };
}

// Deeply defensive Proxy: every property and every function returns another Proxy
function deepSnapshotProxy(docs) {
  const snap = createSnapshot(docs);
  return new Proxy(snap, {
    get(target, prop) {
      if (prop in target) {
        // If it's a function, always return a function that returns a proxy
        if (typeof target[prop] === 'function') {
          return (...args) => deepSnapshotProxy(target.docs);
        }
        return target[prop];
      }
      // Defensive: always return a proxy for any property
      return deepSnapshotProxy(target.docs);
    },
    apply(target, thisArg, args) {
      return deepSnapshotProxy(target.docs);
    }
  });
}



module.exports = {
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((...args) => deepSnapshotProxy()),
  doc: jest.fn((...args) => deepSnapshotProxy()),
  getDocs: jest.fn((...args) => Promise.resolve(deepSnapshotProxy())),
  getDoc: jest.fn((...args) => Promise.resolve(deepSnapshotProxy())),
  setDoc: jest.fn(() => Promise.resolve()),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  addDoc: jest.fn(() => Promise.resolve({ id: 'mock-id' })),
  query: jest.fn((...args) => deepSnapshotProxy()),
  where: jest.fn((...args) => deepSnapshotProxy()),
  orderBy: jest.fn((...args) => deepSnapshotProxy()),
  limit: jest.fn((...args) => deepSnapshotProxy()),
  onSnapshot: jest.fn((ref, cb) => cb(deepSnapshotProxy())),
  Timestamp: { now: () => new Date() },
  serverTimestamp: jest.fn(() => new Date()),
};
