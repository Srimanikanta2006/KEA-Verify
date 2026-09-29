import type { Candidate, Centre, Verifier } from '@/types/models';

/**
 * Bundled demo roster — mirrors exactly what scripts/seed-firebase.mjs writes to
 * Firestore. Used before Firebase is configured, and as an offline fallback.
 *
 * Centres are real-ish coordinates in Bengaluru so Feature 3 (geofencing) can be
 * demoed: set your device location near one of these to test.
 */

export const DEMO_CENTRES: (Centre & { code: string; district: string })[] = [
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

export const DEMO_VERIFIERS: Verifier[] = [
  {
    verifierId: 'EMP-44910',
    name: 'Srimanikanta (Lead Invigilator)',
    authProviderId: 'otherpsmk@gmail.com',
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

const EXAM = 'Civil Police Constable - RPC 2026';
const SESSION = 'Morning Session (10:30 AM - 12:30 PM)';

const FIRST = [
  'Ananya', 'Mohammed', 'Priyanka', 'Rahul', 'Sneha', 'Karthik', 'Divya', 'Arjun',
  'Kavya', 'Vikram', 'Pooja', 'Santhosh', 'Meghana', 'Ravi', 'Nandini', 'Ganesh',
  'Harsha', 'Bhavana', 'Manjunath', 'Chaitra', 'Prakash', 'Shwetha', 'Naveen', 'Ashwini',
];
const LAST = [
  'Shetty', 'Zeyan', 'K. V.', 'Gowda', 'Hegde', 'Rao', 'Iyer', 'Naik',
  'Reddy', 'Patil', 'S.', 'Bhat', 'Murthy', 'Kulkarni', 'Joshi', 'Achar',
];

function avatarFor(i: number): string {
  // Free, keyless placeholder portraits (thispersondoesnotexist-style service is
  // unreliable; these stable initial-avatars keep the demo fully offline-safe).
  const hues = [12, 152, 210, 280, 45, 330];
  const h = hues[i % hues.length];
  const initials = `${FIRST[i % FIRST.length][0]}${LAST[i % LAST.length][0]}`;
  return `https://placehold.co/200x200/hsl(${h},45%,88%)/hsl(${h},55%,28%)?text=${initials}`;
}

export const DEMO_CANDIDATES: Candidate[] = FIRST.map((first, i) => {
  const roll = `KAR-24-${91000 + i * 137}`;
  const centre = i < 10 ? 'centre_an0081' : i < 18 ? 'centre_bn4022' : 'centre_ct1190';
  const room = `0${(i % 8) + 1}`;
  return {
    candidateId: `CAND-${String(i + 1).padStart(4, '0')}`,
    rollNo: roll,
    name: `${first} ${LAST[i % LAST.length]}`.toUpperCase(),
    photoUrl: avatarFor(i),
    allottedCentreId: centre,
    allottedRoom: `Room ${room}`,
    allottedSeat: `Seat ${((i * 7) % 24) + 1}`,
    examType: EXAM,
    session: SESSION,
    hallTicketQrPayload: `KEA|${roll}|${EXAM}|${centre}|${room}`,
  };
});

export function getCentreById(centreId: string): Centre | null {
  return DEMO_CENTRES.find((x) => x.centreId === centreId) ?? null;
}
