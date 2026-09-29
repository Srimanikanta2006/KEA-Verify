/** Firestore data model — matches the spec in README / project brief. */

export interface Centre {
  centreId: string;
  name: string;
  pincode: string;
  lat: number;
  lng: number;
  allowedRadiusMeters: number;
  /** Display code, e.g. AN0081 */
  code?: string;
  district?: string;
}

export type VerifierRole = 'invigilator' | 'nodal_officer' | 'admin';

export interface Verifier {
  verifierId: string;
  name: string;
  /** Firebase Auth identifier: email (Google oAuth) */
  authProviderId: string;
  assignedCentreId: string;
  role: VerifierRole;
  employeeCode?: string;
  gate?: string;
}

export interface Candidate {
  candidateId: string;
  rollNo: string;
  name: string;
  photoUrl: string;
  allottedCentreId: string;
  allottedRoom: string;
  /** Desk/seat within the room, e.g. "Seat 18" (display only) */
  allottedSeat?: string;
  examType: string;
  session: string;
  hallTicketQrPayload: string;
}

export type ScanResult =
  | 'matched'
  | 'manual_review'
  | 'rejected_centre_mismatch'
  | 'rejected_duplicate'
  | 'rejected_impersonation';

export interface ScanLog {
  scanId: string;
  candidateId: string;
  verifierId: string;
  timestamp: number;
  deviceLat: number | null;
  deviceLng: number | null;
  result: ScanResult;
  faceMatchScore: number | null;
  /** how the candidate identity entered the pipeline (audit signal for fallback stats) */
  entryMethod?: 'qr' | 'manual';
  notes?: string;
  /** Client-generated id (crypto UUID) used as the Firestore doc id for idempotent offline sync. */
  clientScanId: string;
  /** true until the queue has pushed it to Firestore */
  pendingSync?: boolean;
}

export interface VerifierSession {
  verifierId: string;
  name: string;
  authProviderId: string;
  role: VerifierRole;
  assignedCentreId: string;
  centre: Centre;
  loginAt: number;
  /** 'demo' sessions bypass Firebase Auth (used before Firebase keys are configured) */
  mode: 'google' | 'demo';
}
