#!/usr/bin/env node
/**
 * KEA Verify — Firestore seed script (Feature 1).
 *
 * Writes 3 centres, 3 verifiers, and 24 candidates using the Firebase JS SDK
 * with REST fallback (no firebase-admin, no service account JSON needed).
 * If FIREBASE_SERVICE_ACCOUNT is set, use it as ADMIN (bypasses rules);
 * otherwise an ID token from the Firebase Auth REST API must be provided.
 *
 * Usage:
 *   1) Create .env from .env.example
 *   2) Create a test user in Firebase console (Auth → Add user, email+password)
 *      and paste its UID into firestore.rules (isAdmin).
 *   3) Run:
 *        FIREBASE_API_KEY=... FIREBASE_AUTH_UID=... node scripts/seed-firebase.mjs
 *      or
 *        FIREBASE_SERVICE_ACCOUNT='{"project_id":...}' node scripts/seed-firebase.mjs
 *
 * Free-tier friendly: no paid APIs, no expired trials.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
require('dotenv').config();

const {
  EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_AUTH_EMAIL,
  FIREBASE_AUTH_PASSWORD,
  FIREBASE_AUTH_UID,
} = process.env;

const PROJECT_ID = EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'kea-verify';
const API_KEY = EXPO_PUBLIC_FIREBASE_API_KEY;
const API_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const EXAM = 'Civil Police Constable - RPC 2026';
const SESSION_NAME = 'Morning Session (10:30 AM - 12:30 PM)';

const centres = [
  {
    centreId: 'centre_an0081',
    code: 'AN0081',
    name: 'Govt SHVNM Girls PU College',
    pincode: '560001',
    district: 'Bengaluru Urban',
    lat: 12.9716,
    lng: 77.5946,
    allowedRadiusMeters: 300,
  },
  {
    centreId: 'centre_bn4022',
    code: 'BN4022',
    name: 'Sri Chaitanya PU Science College',
    pincode: '560037',
    district: 'Bengaluru Urban',
    lat: 12.9352,
    lng: 77.6245,
    allowedRadiusMeters: 250,
  },
  {
    centreId: 'centre_ct1190',
    code: 'CT1190',
    name: 'KLE Society PU College',
    pincode: '580001',
    district: 'Dharwad',
    lat: 15.3647,
    lng: 75.124,
    allowedRadiusMeters: 300,
  },
];

// Authorized verifiers for the centres
const verifiers = [
  {
    verifierId: 'EMP-44910',
    name: 'Darshan S Kalburgi',
    authProviderId: 'nodal.kalburgi@kea.kar.nic.in',
    assignedCentreId: 'centre_an0081',
    role: 'invigilator',
    employeeCode: 'EMP-44910',
    gate: 'Gate 04',
  },
  {
    verifierId: 'EMP-44911',
    name: 'Venkatesh Murthy',
    authProviderId: 'venkatesh.verifier@gmail.com',
    assignedCentreId: 'centre_an0081',
    role: 'nodal_officer',
    employeeCode: 'EMP-44911',
    gate: 'Control Room',
  },
  {
    verifierId: 'EMP-45207',
    name: 'Lakshmi Narayan',
    authProviderId: 'lakshmi.verifier@gmail.com',
    assignedCentreId: 'centre_bn4022',
    role: 'invigilator',
    employeeCode: 'EMP-45207',
    gate: 'Gate 01',
  },
];

const FIRST = [
  'Ananya', 'Mohammed', 'Priyanka', 'Rahul', 'Sneha', 'Karthik', 'Divya', 'Arjun',
  'Kavya', 'Vikram', 'Pooja', 'Santhosh', 'Meghana', 'Ravi', 'Nandini', 'Ganesh',
  'Harsha', 'Bhavana', 'Manjunath', 'Chaitra', 'Prakash', 'Shwetha', 'Naveen', 'Ashwini',
];
const LAST = [
  'Shetty', 'Zeyan', 'K. V.', 'Gowda', 'Hegde', 'Rao', 'Iyer', 'Naik',
  'Reddy', 'Patil', 'S.', 'Bhat', 'Murthy', 'Kulkarni', 'Joshi', 'Achar',
];

const candidates = FIRST.map((first, i) => {
  const roll = `KAR-24-${91000 + i * 137}`;
  const centre =
    i < 10 ? 'centre_an0081' : i < 18 ? 'centre_bn4022' : 'centre_ct1190';
  const room = String((i % 8) + 1).padStart(2, '0');
  const initials = `${first[0]}${LAST[i % LAST.length][0]}`;
  return {
    candidateId: `CAND-${String(i + 1).padStart(4, '0')}`,
    rollNo: roll,
    name: `${first} ${LAST[i % LAST.length]}`.toUpperCase(),
    // Keyless placeholder portrait service (free, no API key). For the hackathon
    // demo this is fine; Feature 5 will swap in real-ish photos if provided.
    photoUrl: `https://placehold.co/200x200/hsl(${(i * 47) % 360},45%,88%)/hsl(${(i * 47) % 360},55%,28%)?text=${initials}`,
    allottedCentreId: centre,
    allottedRoom: `Room ${room}`,
    allottedSeat: `Seat ${((i * 7) % 24) + 1}`,
    examType: EXAM,
    session: SESSION_NAME,
    hallTicketQrPayload: `KEA|${roll}|${EXAM}|${centre}|Room ${room}`,
  };
});

// ---------- Firestore REST helpers ----------

async function getAccessToken() {
  let sa = FIREBASE_SERVICE_ACCOUNT;
  if (!sa && fs.existsSync('./serviceAccountKey.json')) {
    sa = fs.readFileSync('./serviceAccountKey.json', 'utf8');
  }
  if (sa) {
    const parsed = typeof sa === 'string' ? JSON.parse(sa) : sa;
    const { JWT } = await import('google-auth-library');
    const client = new JWT({
      keyFile: undefined,
      key: parsed.private_key,
      email: parsed.client_email,
      scopes: ['https://www.googleapis.com/auth/datastore'],
    });
    await client.authorize();
    return { token: client.credentials.access_token, mode: 'admin' };
  }
  if (API_KEY && FIREBASE_AUTH_EMAIL && FIREBASE_AUTH_PASSWORD) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: FIREBASE_AUTH_EMAIL, password: FIREBASE_AUTH_PASSWORD }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(`Auth failed: ${json.error?.message ?? res.status}`);
    return { token: json.idToken, mode: 'user' };
  }
  throw new Error(
    'No credentials. Set FIREBASE_SERVICE_ACCOUNT, or FIREBASE_API_KEY + FIREBASE_AUTH_EMAIL + FIREBASE_AUTH_PASSWORD.'
  );
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val);
    return { mapValue: { fields } };
  }
  throw new Error(`Unsupported type: ${typeof v}`);
}

async function writeDoc(token, collection, docId, data) {
  const url = `${API_BASE}/${collection}/${docId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, toFirestoreValue(v)])
    ) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to write ${collection}/${docId}: ${res.status} ${text}`);
  }
}

async function main() {
  console.log(`Seeding Firestore project "${PROJECT_ID}"...`);
  const { token, mode } = await getAccessToken();
  console.log(`Authenticated (${mode} mode).`);

  for (const centre of centres) {
    const { centreId, ...data } = centre;
    await writeDoc(token, 'centres', centreId, data);
  }
  console.log(`✔ centres: ${centres.length}`);

  for (const verifier of verifiers) {
    const { verifierId, ...data } = verifier;
    await writeDoc(token, 'verifiers', verifier.authProviderId.toLowerCase(), data);
  }
  console.log(`✔ verifiers: ${verifiers.length}`);

  for (const candidate of candidates) {
    await writeDoc(token, 'candidates', candidate.candidateId, candidate);
  }
  console.log(`✔ candidates: ${candidates.length}`);

  console.log('\nNext: copy firestore.rules into the Firebase console (Firestore → Rules) and publish.');
  console.log('Then sign in on the app with one of the verifier emails above.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
