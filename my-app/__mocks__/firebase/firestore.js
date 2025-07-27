// Minimal Firestore query operator mocks
var where = function () { return {}; };
var orderBy = function () { return {}; };
var limit = function () { return {}; };
var query = function () { return {}; };
// Minimal onSnapshot mock
var onSnapshot = function () { return function unsubscribe() {}; };
// Minimal deleteDoc mock
var deleteDoc = function () {
  return Promise.resolve();
};

// --- Patch: Ensure global.Timestamp is set for instanceof checks ---
var Timestamp = function (date) {
  this._date = date instanceof Date ? date : new Date(date);
  this.seconds = Math.floor(this._date.getTime() / 1000);
  this.nanoseconds = (this._date.getTime() % 1000) * 1e6;
};
Timestamp.prototype.toDate = function () {
  return this._date;
};
// Ensure global.Timestamp is always set for instanceof checks
if (typeof global !== 'undefined') {
  global.Timestamp = Timestamp;
}
// Helper to always create a mock Timestamp instance
function makeTimestamp(date) {
  // Always return a real Timestamp instance for compatibility
  if (date instanceof Timestamp) return date;
  return new Timestamp(date);
}

const eventDateToday = new Date('2025-07-26T20:04:52.115Z');
const eventDateYesterday = new Date('2025-07-25T20:04:52.115Z');
const eventDateTomorrow = new Date('2025-07-27T20:04:52.115Z');

const mockEvents = [
  {
    id: 'event-id-today',
    deliveryDate: makeTimestamp(eventDateToday),
    name: 'Test Event Today',
    clientId: 'client-id',
    driverId: 'driver-id',
    status: 'scheduled',
    assignedDriverId: 'driver-id',
    assignedDriverName: 'Test Driver',
    clientName: 'Test Client',
    time: '10:00',
    recurrence: 'None',
  },
  {
    id: 'event-id-yesterday',
    deliveryDate: makeTimestamp(eventDateYesterday),
    name: 'Test Event Yesterday',
    clientId: 'client-id',
    driverId: 'driver-id',
    status: 'completed',
    assignedDriverId: 'driver-id',
    assignedDriverName: 'Test Driver',
    clientName: 'Test Client',
    time: '09:00',
    recurrence: 'None',
  },
  {
    id: 'event-id-tomorrow',
    deliveryDate: makeTimestamp(eventDateTomorrow),
    name: 'Test Event Tomorrow',
    clientId: 'client-id-2',
    driverId: 'driver-id-2',
    status: 'scheduled',
    assignedDriverId: 'driver-id-2',
    assignedDriverName: 'Test Driver 2',
    clientName: 'Client 2',
    time: '11:00',
    recurrence: 'None',
  },
];
var doc = function(firestore, path) {
  return {
    type: 'document',
    id: path || 'mockDoc',
    path: path || 'mockDoc',
    firestore: firestore || getFirestore(),
    data: function() { return {}; },
    exists: function() { return true; },
    withConverter: function() { return this; }
  };
};

// @ts-nocheck
// Minimal Jest manual mock for firebase/firestore (CommonJS, compatible)

// --- Firestore Jest mock with error/empty simulation ---
var __firestoreMockState = {
  throwError: false,
  emptyDocs: false,
  throwOnSet: false,
  throwOnUpdate: false,
  throwOnDelete: false,
  throwOnAdd: false
};


// --- Clean, single set of Firestore async mocks ---
var addDoc = function () {
  console.log('[Firestore Mock] addDoc called (debug)');
  if (typeof mockFirestoreState !== 'undefined' && mockFirestoreState.addDocError) return Promise.reject(new Error('Firestore addDoc error'));
  if (__firestoreMockState.throwOnAdd || (typeof global !== 'undefined' && global.__FIRESTORE_MOCK_ERROR__)) {
    return Promise.reject(new Error('Firestore addDoc error'));
  }
  return Promise.resolve({ id: 'mock-id' });
};
var setDoc = function () {
  console.log('[Firestore Mock] setDoc called (debug)');
  if (typeof mockFirestoreState !== 'undefined' && mockFirestoreState.setDocError) return Promise.reject(new Error('Firestore setDoc error'));
  if (__firestoreMockState.throwOnSet || (typeof global !== 'undefined' && global.__FIRESTORE_MOCK_ERROR__)) {
    return Promise.reject(new Error('Firestore setDoc error'));
  }
  return Promise.resolve();
};
var updateDoc = function () {
  console.log('[Firestore Mock] updateDoc called (debug)');
  if (typeof mockFirestoreState !== 'undefined' && mockFirestoreState.updateDocError) return Promise.reject(new Error('Firestore updateDoc error'));
  if (__firestoreMockState.throwOnUpdate || (typeof global !== 'undefined' && global.__FIRESTORE_MOCK_ERROR__)) {
    return Promise.reject(new Error('Firestore updateDoc error'));
  }
  return Promise.resolve();
};
// Only one getDocs definition, always using the exported Timestamp class
var getDocs = function (queryObj) {
  var path = queryObj && queryObj.path ? queryObj.path : '';
  var docs = [];
  var now = new Date();
  var yesterday = new Date(now.getTime() - 86400000);
  var tomorrow = new Date(now.getTime() + 86400000);
  var TS = (typeof global !== 'undefined' && global.Timestamp) ? global.Timestamp : Timestamp;
  if (path.includes('events')) {
    docs = [
      { id: 'event-id-today', data: function () {
          return {
            id: 'event-id-today',
            deliveryDate: new global.Timestamp(now),
            name: 'Test Event Today',
            clientId: 'client-id',
            driverId: 'driver-id',
            status: 'scheduled',
            assignedDriverId: 'driver-id',
            assignedDriverName: 'Test Driver',
            clientName: 'Test Client',
            time: '10:00',
            recurrence: 'None',
            recurrenceId: 'rec-id-1',
            customDates: [],
            seriesStartDate: '2025-07-01',
            isZoomingOut: false,
            isZoomingIn: false,
            hidden: false
          };
        }
      },
      { id: 'event-id-yesterday', data: function () {
          return {
            id: 'event-id-yesterday',
            deliveryDate: new global.Timestamp(yesterday),
            name: 'Test Event Yesterday',
            clientId: 'client-id',
            driverId: 'driver-id',
            status: 'completed',
            assignedDriverId: 'driver-id',
            assignedDriverName: 'Test Driver',
            clientName: 'Test Client',
            time: '09:00',
            recurrence: 'None',
            recurrenceId: 'rec-id-2',
            customDates: [],
            seriesStartDate: '2025-07-01',
            isZoomingOut: false,
            isZoomingIn: false,
            hidden: false
          };
        }
      },
      { id: 'event-id-tomorrow', data: function () {
          return {
            id: 'event-id-tomorrow',
            deliveryDate: new global.Timestamp(tomorrow),
            name: 'Test Event Tomorrow',
            clientId: 'client-id-2',
            driverId: 'driver-id-2',
            status: 'scheduled',
            assignedDriverId: 'driver-id-2',
            assignedDriverName: 'Test Driver 2',
            clientName: 'Client 2',
            time: '11:00',
            recurrence: 'None',
            recurrenceId: 'rec-id-3',
            customDates: [],
            seriesStartDate: '2025-07-01',
            isZoomingOut: false,
            isZoomingIn: false,
            hidden: false
          };
        }
      }
    ];
  } else if (path.includes('clients')) {
    docs = [
      { id: 'client-id', data: function () { return { id: 'client-id', name: 'Test Client', uid: 'client-id', email: 'test@client.com' }; } },
      { id: 'client-id-2', data: function () { return { id: 'client-id-2', name: 'Client 2', uid: 'client-id-2', email: 'client2@client.com' }; } }
    ];
  } else if (path.includes('clusters')) {
    docs = [
      { id: 'cluster-id', data: function () { return { id: 'cluster-id', name: 'Test Cluster', clientIds: ['client-id'] }; } },
      { id: 'cluster-id-2', data: function () { return { id: 'cluster-id-2', name: 'Cluster 2', clientIds: ['client-id-2'] }; } }
    ];
  } else {
    docs = [
      { id: 'mockDoc', data: function () { return { id: 'mockDoc', mockData: undefined }; } }
    ];
  }
  docs.docs = docs;
  return Promise.resolve({ docs: docs });
};

var getDoc = function (docRef) {
  // Return realistic data based on collection
  var id = docRef && docRef.id ? docRef.id : 'mockDoc';
  var path = docRef && docRef.path ? docRef.path : '';
  if (path.includes('clients')) {
    return Promise.resolve({
      id: id,
      data: function () { return { id: 'client-id', name: 'Test Client', uid: 'client-id', email: 'test@client.com' }; },
      exists: function () { return true; }
    });
  }
  if (path.includes('clusters')) {
    return Promise.resolve({
      id: id,
      data: function () { return { id: 'cluster-id', name: 'Test Cluster', clientIds: ['client-id'] }; },
      exists: function () { return true; }
    });
  }
  // Default
  return Promise.resolve({
    id: id,
    data: function () { return { id: id, mockData: undefined }; },
    exists: function () { return true; }
  });
};
var getDocs = function (queryObj) {
  // Return realistic data for events, clients, clusters
  var path = queryObj && queryObj.path ? queryObj.path : '';
  var docs = [];
  if (path.includes('events')) {
    docs = [
      { id: 'event-id-today', data: function () { return { id: 'event-id-today', deliveryDate: makeTimestamp(new Date()), name: 'Test Event Today', clientId: 'client-id', driverId: 'driver-id', status: 'scheduled', assignedDriverId: 'driver-id', assignedDriverName: 'Test Driver', clientName: 'Test Client', time: '10:00', recurrence: 'None' }; } },
      { id: 'event-id-yesterday', data: function () { return { id: 'event-id-yesterday', deliveryDate: makeTimestamp(new Date(Date.now() - 86400000)), name: 'Test Event Yesterday', clientId: 'client-id', driverId: 'driver-id', status: 'completed', assignedDriverId: 'driver-id', assignedDriverName: 'Test Driver', clientName: 'Test Client', time: '09:00', recurrence: 'None' }; } },
      { id: 'event-id-tomorrow', data: function () { return { id: 'event-id-tomorrow', deliveryDate: makeTimestamp(new Date(Date.now() + 86400000)), name: 'Test Event Tomorrow', clientId: 'client-id-2', driverId: 'driver-id-2', status: 'scheduled', assignedDriverId: 'driver-id-2', assignedDriverName: 'Test Driver 2', clientName: 'Client 2', time: '11:00', recurrence: 'None' }; } }
    ];
  } else if (path.includes('clients')) {
    docs = [
      { id: 'client-id', data: function () { return { id: 'client-id', name: 'Test Client', uid: 'client-id', email: 'test@client.com' }; } },
      { id: 'client-id-2', data: function () { return { id: 'client-id-2', name: 'Client 2', uid: 'client-id-2', email: 'client2@client.com' }; } }
    ];
  } else if (path.includes('clusters')) {
    docs = [
      { id: 'cluster-id', data: function () { return { id: 'cluster-id', name: 'Test Cluster', clientIds: ['client-id'] }; } },
      { id: 'cluster-id-2', data: function () { return { id: 'cluster-id-2', name: 'Cluster 2', clientIds: ['client-id-2'] }; } }
    ];
  } else {
    docs = [
      { id: 'mockDoc', data: function () { return { id: 'mockDoc', mockData: undefined }; } }
    ];
  }
  docs.docs = docs;
  return Promise.resolve({ docs: docs });
};
var query = function(ref) {
  var out = Object.assign({}, ref);
  out.path = ref && ref.path ? ref.path : '';
  for (var i = 1; i < arguments.length; i++) {
    var arg = arguments[i];
    if (arg && arg.type === 'where') {
      out.__where = (out.__where || []).concat([[arg.field, arg.op, arg.value]]);
    }
    if (arg && arg.type === 'orderBy') {
      out.__orderBy = arg.field;
    }
    if (arg && arg.type === 'limit') {
      out.__limit = arg.value;
    }
  }
  return out;
};
var orderBy = function(field) { return { type: 'orderBy', field: field }; };
var limit = function(value) { return { type: 'limit', value: value }; };
var startAfter = function() { return { type: 'startAfter' }; };


// Minimal Firestore instance mock for TS compatibility
var getFirestore = function() {
  return {
    type: 'firestore',
    app: { name: 'mockApp' },
    toJSON: function() { return {}; }
  };
};

// Minimal collection mock
var collection = function(firestore, path) {
  return {
    type: 'collection',
    id: path || 'mockCollection',
    path: path || 'mockCollection',
    firestore: firestore || getFirestore(),
    parent: null,
    withConverter: function() { return this; }
  };
};

  for (var i = 1; i < arguments.length; i++) {
// Minimal Jest manual mock for firebase/firestore (CommonJS, compatible)
// Clean, minimal, working version for all service tests

var __firestoreMockState = {
  throwError: false,
  emptyDocs: false,
  throwOnSet: false,
  throwOnUpdate: false,
  throwOnDelete: false,
  throwOnAdd: false
};

var Timestamp = function (date) {
  this._date = date instanceof Date ? date : new Date(date);
  this.seconds = Math.floor(this._date.getTime() / 1000);
  this.nanoseconds = (this._date.getTime() % 1000) * 1e6;
};
Timestamp.prototype.toDate = function () {
  return this._date;
};
};
Timestamp.prototype.toDate = function() { return this._date; };
// Add static fromDate method for compatibility with Firestore utils
Timestamp.fromDate = function(date) {
  if (!(date instanceof Date)) {
    throw new Error('fromDate expects a Date');
  }
  return new Timestamp(date);
};
var mockTimestamp = function(date) { return new Timestamp(date); };

var now = new Date();
var yesterday = new Date(now.getTime() - 86400000);
var tomorrow = new Date(now.getTime() + 86400000);
var allClients = [
  { id: 'client-id', data: function() { return { id: 'client-id', name: 'Test Client', uid: 'client-id', email: 'test@client.com' }; } },
  { id: 'client-id-2', data: function() { return { id: 'client-id-2', name: 'Client 2', uid: 'client-id-2', email: 'client2@client.com' }; } }
];
var now = new Date();
var yesterday = new Date(now.getTime() - 86400000);
var tomorrow = new Date(now.getTime() + 86400000);
var allClusters = [
  { id: 'cluster-id', data: function() { return { docId: 'cluster-id', id: 1, driver: 'driver-id', time: '10:00', deliveries: [] }; } },
  { id: 'cluster-id-2', data: function() { return { docId: 'cluster-id-2', id: 2, driver: 'driver-id-2', time: '11:00', deliveries: [] }; } }
];
var allEvents = [
  { id: 'event-id-today', data: function() { return { id: 'event-id-today', deliveryDate: new Timestamp(now), name: 'Test Event Today', clientId: 'client-id', driverId: 'driver-id', status: 'scheduled', assignedDriverId: 'driver-id', assignedDriverName: 'Test Driver', clientName: 'Test Client', time: '10:00', recurrence: 'None' }; } },
  { id: 'event-id-yesterday', data: function() { return { id: 'event-id-yesterday', deliveryDate: new Timestamp(yesterday), name: 'Test Event Yesterday', clientId: 'client-id', driverId: 'driver-id', status: 'completed', assignedDriverId: 'driver-id', assignedDriverName: 'Test Driver', clientName: 'Test Client', time: '09:00', recurrence: 'None' }; } },
  { id: 'event-id-tomorrow', data: function() { return { id: 'event-id-tomorrow', deliveryDate: new Timestamp(tomorrow), name: 'Test Event Tomorrow', clientId: 'client-id-2', driverId: 'driver-id-2', status: 'scheduled', assignedDriverId: 'driver-id-2', assignedDriverName: 'Test Driver 2', clientName: 'Client 2', time: '11:00', recurrence: 'None' }; } }
];

module.exports = {
  getFirestore: getFirestore,
  enableNetwork: function () {},
  disableNetwork: function () {},
  collection: collection,
  doc: doc,
  getDoc: getDoc,
  getDocs: getDocs,
  setDoc: setDoc,
  updateDoc: updateDoc,
  deleteDoc: deleteDoc,
  addDoc: addDoc,
  onSnapshot: onSnapshot,
  query: query,
  where: where,
  orderBy: orderBy,
  limit: limit,
  startAfter: startAfter,
  mockTimestamp: mockTimestamp,
  Timestamp: Timestamp,
  __firestoreMockState: __firestoreMockState
};
