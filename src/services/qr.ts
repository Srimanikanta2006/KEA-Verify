/** QR payload contract shared with the seed script / hall tickets. */

export interface QrPayload {
  /** System candidateId, e.g. CAND-0001 */
  candidateId: string;
  rollNo: string;
  examType?: string;
  allottedCentreId?: string;
  allottedRoom?: string;
}

/** Detects `KEA|<rollNo>` or `KEA|<rollNo>|<examType>|<centreId>|<room>` */
export function parseKeaQr(raw: string): QrPayload | null {
  const text = raw.trim();
  if (!text.startsWith('KEA|')) return null;
  const [prefix, rollNo, examType, allottedCentreId, allottedRoom] = text.split('|');
  if (prefix !== 'KEA' || !rollNo) return null;
  return {
    candidateId: rollNo,
    rollNo,
    examType: examType || undefined,
    allottedCentreId: allottedCentreId || undefined,
    allottedRoom: allottedRoom || undefined,
  };
}

export function qrPayloadToString(p: QrPayload): string {
  return ['KEA', p.rollNo, p.examType ?? '', p.allottedCentreId ?? '', p.allottedRoom ?? ''].join('|');
}
