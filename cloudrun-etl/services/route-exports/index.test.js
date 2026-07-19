const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const loadHandler = () => {
  let handler;
  const queriedCollections = [];
  const sentMessages = [];

  const snapshots = {
    events: {
      empty: false,
      docs: [
        {
          id: 'event-1',
          data: () => ({ clientId: 'client-1' }),
        },
      ],
    },
    clusters: {
      empty: false,
      docs: [
        {
          data: () => ({
            clusters: [
              { id: '4', driver: { name: 'Driver One' }, time: '10:00', deliveries: ['client-1'] },
            ],
            clientOverrides: [{ clientId: 'client-1', time: '11:30' }],
          }),
        },
      ],
    },
    Drivers2: {
      docs: [
        {
          id: 'driver-1',
          data: () => ({ name: 'Driver One', email: 'driver@example.com' }),
        },
      ],
    },
  };

  const clientDocument = {
    id: 'client-1',
    exists: true,
    data: () => ({
      firstName: 'Sample',
      lastName: 'Client',
      address: '123 Main St',
      address2: 'Apt 2',
      zipCode: '20001',
      quadrant: 'NW',
      ward: '1',
      phone: '202-555-0100',
      adults: 1,
      children: 2,
      seniors: 0,
      total: 3,
      tefapCert: true,
      deliveryDetails: {
        deliveryInstructions: 'Leave at door, ring bell',
        dietaryRestrictions: {
          halal: true,
          foodAllergens: ['peanuts'],
          dietaryPreferences: 'No pork',
        },
      },
    }),
  };

  const buildQuery = (collectionName) => ({
    where() {
      return this;
    },
    limit() {
      return this;
    },
    doc(id) {
      return { collectionName, id };
    },
    async get() {
      return snapshots[collectionName];
    },
  });

  const db = {
    collection(collectionName) {
      queriedCollections.push(collectionName);
      return buildQuery(collectionName);
    },
    async getAll(...refs) {
      assert.deepEqual(refs, [{ collectionName: 'client-profile2', id: 'client-1' }]);
      return [clientDocument];
    },
  };

  const firestore = () => db;
  firestore.Timestamp = { fromDate: (date) => date };

  const sandbox = {
    Buffer,
    console,
    module: { exports: {} },
    exports: {},
    process: { env: { SENDGRID_API_KEY: 'test-key', FROM_EMAIL: 'sender@example.com' } },
    require: (moduleName) => {
      if (moduleName === '@google-cloud/functions-framework') {
        return { http: (_name, registeredHandler) => { handler = registeredHandler; } };
      }
      if (moduleName === 'firebase-admin') {
        return { initializeApp: () => undefined, firestore };
      }
      if (moduleName === '@sendgrid/mail') {
        return {
          setApiKey: () => undefined,
          send: async (message) => { sentMessages.push(message); },
        };
      }
      throw new Error(`Unexpected module: ${moduleName}`);
    },
  };

  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  vm.runInNewContext(source, sandbox, { filename: 'index.js' });

  return { handler, queriedCollections, sentMessages };
};

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  send(body) {
    this.body = body;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('exports the saved frontend route assignment from current collections', async () => {
  const { handler, queriedCollections, sentMessages } = loadHandler();
  const response = createResponse();

  await handler({ query: { deliveryDate: '2026-07-20' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.sent, 1);
  assert.deepEqual(
    new Set(queriedCollections),
    new Set(['events', 'clusters', 'Drivers2', 'client-profile2'])
  );
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].to, 'driver@example.com');
  assert.match(sentMessages[0].attachments[0].filename, /11.30 - Route 4\.csv$/);

  const csv = Buffer.from(sentMessages[0].attachments[0].content, 'base64').toString('utf8');
  assert.match(csv, /"Leave at door, ring bell"/);
  assert.match(csv, /\[halal\] ALLERGIES:peanuts/);
  assert.match(csv, /,Y,2026-07-20,4,11:30$/m);
});

test('rejects an ambiguous delivery date before reading Firestore', async () => {
  const { handler, queriedCollections, sentMessages } = loadHandler();
  const response = createResponse();

  await handler({ query: { deliveryDate: '07/20/2026' } }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(queriedCollections.length, 0);
  assert.equal(sentMessages.length, 0);
});
