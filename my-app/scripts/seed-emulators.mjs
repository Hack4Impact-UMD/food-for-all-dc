#!/usr/bin/env node
// Seeds the local Firebase emulators with just enough to exercise the app:
// an Admin login and a couple of client profiles.
//
// A fresh emulator has no users at all, and the app has no sign-up flow, so
// without this there is no way to get past the login screen. Talks to the
// emulators over their REST APIs so this needs no extra dependencies.
//
// Usage: npm run seed:emulators   (with the emulators already running)

const PROJECT = process.env.GCLOUD_PROJECT ?? "food-for-all-dc-caf23";
const AUTH = process.env.AUTH_EMULATOR ?? "http://localhost:9099";
const FIRESTORE = process.env.FIRESTORE_EMULATOR ?? "http://localhost:8080";

const ACCOUNTS = [
  { email: "admin@example.test", password: "password123", name: "Emulator Admin", role: "Admin" },
  {
    email: "intake@example.test",
    password: "password123",
    name: "Emulator Intake",
    role: "ClientIntake",
  },
  {
    email: "manager@example.test",
    password: "password123",
    name: "Emulator Manager",
    role: "Manager",
  },
  {
    email: "driver@example.test",
    password: "password123",
    name: "Emulator Driver",
    role: "Driver",
  },
];

const CLIENTS = [
  {
    id: "seed-client-1",
    firstName: "Jane",
    lastName: "Doe",
    address: "1810 16th St",
    address2: "Apt 4",
    quadrant: "NW",
    city: "Washington",
    state: "DC",
    zipCode: "20009",
    ward: "Ward 1",
    phone: "202-555-0134",
    email: "jane@example.test",
    adults: 2,
    children: 2,
    seniors: 0,
    total: 4,
  },
  {
    id: "seed-client-2",
    firstName: "Sam",
    lastName: "Rivera",
    address: "2400 Alabama Ave",
    address2: "",
    quadrant: "SE",
    city: "Washington",
    state: "DC",
    zipCode: "20020",
    ward: "Ward 7",
    phone: "202-555-0192",
    email: "sam@example.test",
    adults: 1,
    children: 0,
    seniors: 0,
    total: 1,
  },
];

/** Wraps a JS value in Firestore's REST value representation. */
const toFirestoreValue = (value) => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "object") {
    return { mapValue: { fields: toFirestoreFields(value) } };
  }
  return { stringValue: String(value) };
};

const toFirestoreFields = (record) =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [key, toFirestoreValue(value)]));

const request = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(
      `${options?.method ?? "GET"} ${url} -> ${response.status} ${await response.text()}`
    );
  }
  return response.json();
};

const checkRunning = async () => {
  try {
    await fetch(`${FIRESTORE}/`);
  } catch {
    throw new Error(
      `No emulator answering on ${FIRESTORE}. Start them first with: npm run emulators`
    );
  }
};

const createAccount = async (account) => {
  // The emulator accepts any API key.
  const url = `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`;

  try {
    const created = await request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        returnSecureToken: true,
      }),
    });
    return created.localId;
  } catch (error) {
    if (!String(error.message).includes("EMAIL_EXISTS")) throw error;

    const signIn = await request(
      `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: account.email,
          password: account.password,
          returnSecureToken: true,
        }),
      }
    );
    return signIn.localId;
  }
};

const writeDoc = async (collection, id, data) =>
  request(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${collection}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });

const main = async () => {
  await checkRunning();

  for (const account of ACCOUNTS) {
    const uid = await createAccount(account);
    // AuthProvider reads the role from users/{uid}.
    await writeDoc("users", uid, {
      name: account.name,
      email: account.email,
      role: account.role,
      phone: "",
    });
    console.log(`  ${account.role.padEnd(12)} ${account.email} / ${account.password}`);
  }

  for (const client of CLIENTS) {
    const { id, ...rest } = client;
    await writeDoc("client-profile2", id, {
      ...rest,
      uid: id,
      dob: "",
      gender: "Unknown",
      ethnicity: "",
      language: "English",
      notes: "",
      lifeChallenges: "",
      lifestyleGoals: "",
      tags: [],
      deliveryFreq: "Weekly",
      recurrence: "None",
      startDate: "2026-01-01",
      endDate: "2027-12-31",
      tefapCert: false,
      tefapCertDate: "",
      headOfHousehold: "Adult",
      coordinates: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`  client       ${client.firstName} ${client.lastName} (${id})`);
  }

  console.log("\nSeeded. Start the app with: npm run start:emulated");
};

main().catch((error) => {
  console.error(`\nSeeding failed: ${error.message}`);
  process.exit(1);
});
