import { decodeDegradedQr } from './qrWorker';

/**
 * Layered robust-scanning runtime.
 *
 * Layer 1 (native): barcode scanner keeps decoding the live feed continuously.
 * Layer 2 (this module): grab snapshot frame and run multi-pass preprocessed decode.
 * Layer 4: each frame is analysed to coach guidance.
 */

export interface ScanGuidance {
  code: 'locked' | 'searching' | 'closer' | 'glare' | 'dark' | 'contrast' | 'crease' | 'steady';
  message: string;
}

export interface EscalationHandle {
  stop: () => void;
}

export const MANUAL_FALLBACK_MS = 8000;

async function snapshotToRgba(
  uri: string
): Promise<{ rgba: Uint8ClampedArray; width: number; height: number }> {
  const skia = await import('@shopify/react-native-skia');
  const { Skia, ColorType, AlphaType } = skia;
  const res = await fetch(uri);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
  if (!image) throw new Error('snapshot decode failed');
  const w = image.width();
  const h = image.height();
  const pixels = image.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) throw new Error('snapshot pixel read failed');
  // readPixels yields Uint8Array (RGBA_8888) — copy into a clamped view.
  const rgba = new Uint8ClampedArray(pixels as unknown as Uint8Array);
  return { rgba, width: w, height: h };
}

/** Frame-quality heuristics → the specific coaching message. */
export function analyzeFrame(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  found: boolean
): ScanGuidance {
  if (found) return { code: 'locked', message: 'QR DECODED' };
  const n = width * height;
  let sum = 0;
  let sumSq = 0;
  let bright = 0;
  let sampled = 0;
  for (let p = 0; p < n; p += 4) {
    const g = (rgba[p * 4] * 299 + rgba[p * 4 + 1] * 587 + rgba[p * 4 + 2] * 114) / 1000;
    sum += g;
    sumSq += g * g;
    if (g > 242) bright++;
    sampled++;
  }
  const mean = sum / sampled;
  const std = Math.sqrt(Math.max(0, sumSq / sampled - mean * mean));
  const brightFrac = bright / sampled;

  if (brightFrac > 0.22) {
    return { code: 'glare', message: 'Glare detected — tilt the ticket slightly' };
  }
  // A localized bright patch (~2-20% of frame) = light glinting off a fold /
  // crease. Coaching a small tilt moves the glint off the QR pattern.
  if (brightFrac > 0.02) {
    return { code: 'crease', message: 'Light on a fold — tilt the ticket slightly' };
  }
  if (mean < 55) {
    return { code: 'dark', message: 'Too dark — move to better light (or use torch)' };
  }
  if (std < 26) {
    return { code: 'contrast', message: 'Low contrast — move closer, flat and steady' };
  }
  return { code: 'closer', message: 'Move closer / center the QR in the frame' };
}

/**
 * Starts the escalation loop. Returns a stop function. `takeSnapshot` should
 * resolve to a fresh camera frame URI (or null while busy).
 */
export function startQrEscalation(opts: {
  takeSnapshot: () => Promise<{ uri: string } | null>;
  onDecode: (data: string) => void;
  onGuidance: (g: ScanGuidance) => void;
  intervalMs?: number;
}): EscalationHandle {
  let stopped = false;
  let busy = false;
  let attempts = 0;

  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      const shot = await opts.takeSnapshot();
      if (!shot?.uri || stopped) return;
      const { rgba, width, height } = await snapshotToRgba(shot.uri);
      // Every 3rd frame runs the exhaustive ladder (exposure + upscale passes).
      const exhaustive = attempts % 3 === 2;
      const res = decodeDegradedQr(rgba, width, height, { exhaustive });
      attempts++;
      opts.onGuidance(analyzeFrame(rgba, width, height, res.found));
      if (res.found && res.data) opts.onDecode(res.data);
    } catch {
      // snapshot/decode failure — guidance stays on last known state
    } finally {
      busy = false;
    }
  };

  void tick();
  const id = setInterval(() => void tick(), opts.intervalMs ?? 700);
  return {
    stop: () => {
      stopped = true;
      clearInterval(id);
    },
  };
}
