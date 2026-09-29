/**
 * Web implementation of Face Matching.
 * Fast-TFLite and native ML Kit Face Detection are native C++ / mobile APIs.
 * On web, we safely return `mode: 'manual_only'` following the degradation
 * contract so the verification flow continues smoothly without native crash.
 */

export const FACE_MATCH_THRESHOLD = 0.75;

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceMatchResult {
  score: number | null;
  matched: boolean;
  box: FaceBox | null;
  mode: 'matched' | 'manual_review' | 'manual_only';
  reason?: string;
}

export async function compareLiveToReference(
  _livePhotoUri: string,
  _referencePhotoUri: string
): Promise<FaceMatchResult> {
  return {
    score: null,
    matched: false,
    box: null,
    mode: 'manual_only',
    reason: 'On-device TFLite face matching runs on native devices (Android/iOS). Browser routes to manual verification.',
  };
}
