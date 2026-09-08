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

const AUTH='http://localhost:9099', ST='http://localhost:9199';
const BUCKET='food-for-all-dc-caf23.firebasestorage.app';

const signIn = async (email) => {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`,
    {method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({email,password:'password123',returnSecureToken:true})});
  return (await r.json()).idToken;
};

const upload = async (token, path, body, type='application/pdf') => {
  const r = await fetch(`${ST}/v0/b/${BUCKET}/o?name=${encodeURIComponent(path)}`,
    {method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':type},body});
  return r.status;
};
const read = async (token, path) => {
  const r = await fetch(`${ST}/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`,
    {headers: token?{Authorization:`Bearer ${token}`}:{}});
  return r.status;
};

const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
const admin = await signIn('admin@example.test');
const intake = await signIn('intake@example.test');
const P='tefap-forms/testform/form.pdf';

const ok = (s) => s>=200 && s<300;
const results = [
  ['Admin uploads a PDF template',            ok(await upload(admin, P, pdf)),                    true],
  ['Non-admin (ClientIntake) upload denied',  ok(await upload(intake,'tefap-forms/x/f.pdf', pdf)),false],
  ['Signed-in non-admin can read a template', ok(await read(intake, P)),                          true],
  ['Anonymous read denied',                   ok(await read(null, P)),                            false],
  ['Admin upload of a non-PDF denied',        ok(await upload(admin,'tefap-forms/y/a.txt',Buffer.from('hi'),'text/plain')), false],
  ['Write outside tefap-forms denied',        ok(await upload(admin,'somewhere/else.pdf', pdf)),  false],
];

let bad=0;
for (const [name, actual, expected] of results) {
  const pass = actual===expected;
  if(!pass) bad++;
  console.log(`${pass?'PASS':'FAIL'}  ${name}  (allowed=${actual}, expected=${expected})`);
}
console.log(bad? `\n${bad} rule check(s) FAILED` : '\nAll storage rule checks passed');

// Exit non-zero on failure so CI and pre-deploy `&&` chains actually stop. A
// rule that is too open otherwise looks exactly like one that works.
process.exit(bad ? 1 : 0);
