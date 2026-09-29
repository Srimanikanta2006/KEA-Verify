import {
  loadTensorflowModel,
  type TfliteModel,
} from 'react-native-fast-tflite';
import { Asset } from 'expo-asset';
import * as FaceDetector from 'expo-face-detector';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Feature 5 — fully on-device face pipeline (zero cloud calls, permanently free):
 *   1. Liveness gate: ML Kit face detection on the captured photo (a real,
 *      roughly frontal face must be present).
 *   2. Embedding: MobileFaceNet TFLite (bundled at assets/models) produces a
 *      192-d embedding from the live capture and the candidate's reference photo.
 *   3. Score: cosine similarity → ≥ 0.75 = matched, else manual_review.
 *
 * Degradation contract (demo-safe): if the model can't load, or no face is
 * found, callers receive `mode: 'manual_only'` and the UI routes to the
 * manual-verification screen — the flow never dead-ends on stage.
 */

export const FACE_MATCH_THRESHOLD = 0.75;

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rollAngle?: number;
  yawAngle?: number;
}

export interface LiveCheckResult {
  /** true when the liveness gate passed */
  facePresent: boolean;
  box?: FaceBox;
  reason?: string;
}

export type MatchMode = 'embedding' | 'manual_only';

export interface FaceMatchOutcome {
  mode: MatchMode;
  /** null when mode is manual_only */
  score: number | null;
  facePresent: boolean;
  reason?: string;
}

let modelPromise: Promise<TfliteModel | null> | null = null;

/** Lazily load the bundled MobileFaceNet model (null → manual-only mode). */
export async function loadFaceModel(): Promise<TfliteModel | null> {
  if (!modelPromise) {
    modelPromise = (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const asset = Asset.fromModule(require('../../assets/models/mobilefacenet.tflite'));
        await asset.downloadAsync();
        // CPU delegate ([]) — most reliable on demo devices.
        return await loadTensorflowModel({ url: asset.localUri ?? asset.uri }, []);
      } catch {
        return null;
      }
    })();
  }
  return modelPromise;
}

/** Liveness gate: is there a real, roughly frontal face in this image? */
export async function checkLiveFace(uri: string): Promise<LiveCheckResult> {
  try {
    const detection = await FaceDetector.detectFacesAsync(uri, {
      mode: FaceDetector.FaceDetectorMode.accurate,
      detectLandmarks: FaceDetector.FaceDetectorLandmarks.none,
      runClassifications: FaceDetector.FaceDetectorClassifications.none,
      minDetectionInterval: 400,
    });
    if (detection.faces.length === 0) {
      return { facePresent: false, reason: 'No face detected in the capture.' };
    }
    const face = detection.faces[0];
    const yaw = Math.abs(face.yawAngle ?? 0);
    if (yaw > 35) {
      return { facePresent: false, reason: 'Face too angled — look straight at the camera.' };
    }
    return {
      facePresent: true,
      box: {
        x: face.bounds.origin.x,
        y: face.bounds.origin.y,
        width: face.bounds.size.width,
        height: face.bounds.size.height,
        rollAngle: face.rollAngle,
        yawAngle: face.yawAngle,
      },
    };
  } catch (err) {
    return {
      facePresent: false,
      reason: err instanceof Error ? err.message : 'Face detection failed.',
    };
  }
}

export function l2Normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum);
  if (norm === 0) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

/** Cosine similarity of two L2-normalized vectors — range [-1, 1]. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot; // vectors are pre-normalized
}

/** Crop (face box +20% padding) → resize 112x112 → PNG, for tensor decoding. */
async function prepareModelInputImage(uri: string, box?: FaceBox): Promise<string> {
  const actions: ImageManipulator.Action[] = [{ resize: { width: 112, height: 112 } }];
  if (box) {
    const padX = box.width * 0.2;
    const padY = box.height * 0.2;
    actions.unshift({
      crop: {
        originX: Math.max(0, Math.round(box.x - padX)),
        originY: Math.max(0, Math.round(box.y - padY)),
        width: Math.round(box.width + padX * 2),
        height: Math.round(box.height + padY * 2),
      },
    });
  }
  const out = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 1,
    format: ImageManipulator.SaveFormat.PNG,
  });
  return out.uri;
}

/** Decode PNG/JPEG → nearest-neighbour resample to 112x112 RGB in [-1,1]. */
async function decodeToModelTensor(uri: string): Promise<Float32Array> {
  const skia = await import('@shopify/react-native-skia');
  const { Skia } = skia;
  const { ColorType, AlphaType } = skia;
  const res = await fetch(uri);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const data = Skia.Data.fromBytes(bytes);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Skia image decode failed');
  const sw = image.width();
  const sh = image.height();
  const pixels = image.readPixels(0, 0, {
    width: sw,
    height: sh,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) throw new Error('Skia pixel read failed');

  const W = 112;
  const H = 112;
  const out = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / H));
    for (let x = 0; x < W; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / W));
      const si = (sy * sw + sx) * 4;
      const di = (y * W + x) * 3;
      out[di] = pixels[si] / 127.5 - 1;
      out[di + 1] = pixels[si + 1] / 127.5 - 1;
      out[di + 2] = pixels[si + 2] / 127.5 - 1;
    }
  }
  return out;
}

async function runEmbeddingModel(uri: string, box?: FaceBox): Promise<Float32Array | null> {
  const model = await loadFaceModel();
  if (!model) return null;
  try {
    const prepared = await prepareModelInputImage(uri, box);
    const tensor = await decodeToModelTensor(prepared);
    const inputBuffer = tensor.buffer.slice(
      tensor.byteOffset,
      tensor.byteOffset + tensor.byteLength
    ) as ArrayBuffer;
    const outputs = await model.run([inputBuffer]);
    const out = outputs[0];
    if (!out) return null;
    const embedding = new Float32Array(out);
    return l2Normalize(embedding);
  } catch {
    return null;
  }
}

/**
 * Full pipeline for one image URI: liveness gate → crop to face → embed.
 * `reference` skips the yaw check (hall-ticket photos are assumed frontal).
 */
export async function embedFromUri(
  uri: string,
  opts?: { reference?: boolean }
): Promise<{ embedding: Float32Array | null; live: LiveCheckResult }> {
  const live = await checkLiveFace(uri);
  if (!live.facePresent) {
    return { embedding: null, live };
  }
  const embedding = await runEmbeddingModel(uri, live.box);
  return { embedding, live };
}

/** Convenience: compare a live capture against a reference photo URI. */
export async function compareLiveToReference(
  liveUri: string,
  referenceUri: string
): Promise<FaceMatchOutcome> {
  const liveResult = await embedFromUri(liveUri);
  if (!liveResult.live.facePresent) {
    return {
      mode: 'manual_only',
      score: null,
      facePresent: false,
      reason: liveResult.live.reason,
    };
  }
  const liveEmb = liveResult.embedding;
  const refResult = await embedFromUri(referenceUri, { reference: true });
  const refEmb = refResult.embedding;

  if (!liveEmb || !refEmb) {
    return {
      mode: 'manual_only',
      score: null,
      facePresent: true,
      reason: 'Embedding model unavailable — route to manual check.',
    };
  }
  const score = cosineSimilarity(liveEmb, refEmb);
  return {
    mode: 'embedding',
    score,
    facePresent: true,
    reason: score >= FACE_MATCH_THRESHOLD ? 'match' : 'below_threshold',
  };
}
