#!/usr/bin/env node
// Exercises storage.rules against the Storage emulator.
//
// Security rules are the one part of this app that cannot be covered by the jest
// suite, and they fail silently in the worst direction - a rule that is too open
// looks exactly like one that works. Run this after any change to storage.rules,
// and before deploying them.
//
// Usage, with emulators running and seeded:
//   npm run emulators           (in one terminal)
//   npm run seed:emulators
//   npm run check:rules

import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { connectStorageEmulator, getBytes, getStorage, ref, uploadBytes } from "firebase/storage";

const app = initializeApp({
  apiKey: "emulator",
  projectId: "food-for-all-dc-caf23",
  storageBucket: "food-for-all-dc-caf23.firebasestorage.app",
});
const auth = getAuth(app);
const storage = getStorage(app);
connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
connectStorageEmulator(storage, "localhost", 9199);

const signIn = (email) => signInWithEmailAndPassword(auth, email, "password123");
const allowed = async (operation) => {
  try {
    await operation();
    return true;
  } catch {
    return false;
  }
};

const upload = (path, body, type = "application/pdf") =>
  allowed(() => uploadBytes(ref(storage, path), body, { contentType: type }));
const read = (path) => allowed(() => getBytes(ref(storage, path)));

const pdf = Buffer.from("%PDF-1.4\n%%EOF\n");
const P = "tefap-forms/testform/form.pdf";

const results = [];
await signIn("admin@example.test");
results.push(["Admin uploads a PDF template", await upload(P, pdf), true]);
results.push([
  "Admin upload of a non-PDF denied",
  await upload("tefap-forms/y/a.txt", Buffer.from("hi"), "text/plain"),
  false,
]);
results.push(["Write outside tefap-forms denied", await upload("somewhere/else.pdf", pdf), false]);

await signIn("intake@example.test");
results.push([
  "Non-admin (ClientIntake) upload denied",
  await upload("tefap-forms/x/f.pdf", pdf),
  false,
]);
results.push(["ClientIntake can read template", await read(P), true]);

await signIn("manager@example.test");
results.push(["Manager can read template", await read(P), true]);

await signIn("driver@example.test");
results.push(["Other signed-in roles cannot read", await read(P), false]);

await signOut(auth);
results.push(["Anonymous read denied", await read(P), false]);

let bad = 0;
for (const [name, actual, expected] of results) {
  const pass = actual === expected;
  if (!pass) bad++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  (allowed=${actual}, expected=${expected})`);
}
console.log(bad ? `\n${bad} rule check(s) FAILED` : "\nAll storage rule checks passed");

// Exit non-zero on failure so CI and pre-deploy `&&` chains actually stop. A
// rule that is too open otherwise looks exactly like one that works.
process.exit(bad ? 1 : 0);
