import jsQR from 'jsqr';

/**
 * Degraded-hall-ticket QR decoder core (Feature: robust scanning).
 *
 * Multi-pass pipeline per frame, cheapest first, stop at first decode:
 *   0. raw RGBA (jsQR direct)        — an already-clear code must not be hurt
 *   1. grayscale                     — photocopy noise, mild shadows
 *   2. 3x3 median denoise            — paper texture / photocopy speckle
 *   3-5. adaptive threshold (offset 10/20/30) — water stains, uneven light:
 *      integral-image local mean (Bradley-style) so a single global threshold
 *      can't fail on half-faded codes
 *   6-7 (exhaustive): brightened / darkened median → adaptive — flash glare on
 *      wet/laminated paper vs rain-shadowed underexposure
 *   8 (exhaustive): 2x-upscaled median → adaptive — small/distant codes
 *
 * NOTE: runs synchronously on the JS thread. Callers must rate-limit (one
 * snapshot per ~700ms during escalation only — see robustScan.ts). React Native
 * has no Worker runtime; measured cost at 480px is ~4-18ms desktop-class,
 * est. 3-5x on older devices, i.e. ~10-20% duty cycle during escalation.
 *
 * Input: RGBA pixels of the snapshot (downscaled by the caller to ~480px).
 * Output: decoded text + local bounding box (for zoom guidance).
 */

export interface DecodeRequest {
  type: 'decode';
  width: number;
  height: number;
  /** RGBA bytes */
  buffer: ArrayBuffer;
}

export interface DecodeResponse {
  type: 'result';
  found: boolean;
  data?: string;
  /** decoded module box in input pixel coords */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** how many passes were needed (1 = trivial read) */
  passes: number;
  /** total processing ms for this frame */
  ms: number;
}

interface RgbaView {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function toGrayscale(src: Uint8ClampedArray, n: number): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(n);
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    gray[p] = (src[i] * 299 + src[i + 1] * 587 + src[i + 2] * 114) / 1000;
  }
  return gray;
}

/** 3x3 median filter — removes speckle while preserving QR module edges. */
function median3(gray: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length);
  const win = new Uint8Array(9);
  for (let y = 0; y < h; y++) {
    const y0 = y > 0 ? y - 1 : 0;
    const y2 = y < h - 1 ? y + 1 : h - 1;
    for (let x = 0; x < w; x++) {
      const x0 = x > 0 ? x - 1 : 0;
      const x2 = x < w - 1 ? x + 1 : w - 1;
      win[0] = gray[y0 * w + x0];
      win[1] = gray[y0 * w + x];
      win[2] = gray[y0 * w + x2];
      win[3] = gray[y * w + x0];
      win[4] = gray[y * w + x];
      win[5] = gray[y * w + x2];
      win[6] = gray[y2 * w + x0];
      win[7] = gray[y2 * w + x];
      win[8] = gray[y2 * w + x2];
      // insertion sort of 9
      for (let i = 1; i < 9; i++) {
        const v = win[i];
        let j = i - 1;
        while (j >= 0 && win[j] > v) {
          win[j + 1] = win[j];
          j--;
        }
        win[j + 1] = v;
      }
      out[y * w + x] = win[4];
    }
  }
  return out;
}

/**
 * Bradley adaptive threshold via integral image. Window = 1/8 of the smaller
 * dimension; pixel → 0 (black) when it falls `offset` below its local mean.
 * Returns RGBA (black/white) view jsQR can consume.
 */
function adaptiveThreshold(
  gray: Uint8ClampedArray,
  w: number,
  h: number,
  offset: number
): Uint8ClampedArray {
  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum;
    }
  }
  const win = Math.max(9, Math.floor(Math.min(w, h) / 8));
  const half = win >> 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(w - 1, x + half);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * iw + (x1 + 1)] -
        integral[y0 * iw + (x1 + 1)] -
        integral[(y1 + 1) * iw + x0] +
        integral[y0 * iw + x0];
      const mean = sum / count;
      const v = gray[y * w + x] < mean - offset ? 0 : 255;
      const p = (y * w + x) * 4;
      out[p] = v;
      out[p + 1] = v;
      out[p + 2] = v;
      out[p + 3] = 255;
    }
  }
  return out;
}

function grayscaleToRgba(gray: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length * 4);
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    out[i] = gray[p];
    out[i + 1] = gray[p];
    out[i + 2] = gray[p];
    out[i + 3] = 255;
  }
  return out;
}

function tryJsQr(view: RgbaView): { data: string; box: { x: number; y: number; w: number; h: number } } | null {
  const res = jsQR(view.data, view.width, view.height, { inversionAttempts: 'dontInvert' });
  if (!res) return null;
  const xs = res.location.topLeftCorner.x + res.location.topRightCorner.x + res.location.bottomLeftCorner.x + res.location.bottomRightCorner.x;
  const ys = res.location.topLeftCorner.y + res.location.topRightCorner.y + res.location.bottomLeftCorner.y + res.location.bottomRightCorner.y;
  const cx = xs / 4;
  const cy = ys / 4;
  const span = Math.max(
    Math.abs(res.location.topLeftCorner.x - res.location.bottomRightCorner.x),
    Math.abs(res.location.topLeftCorner.y - res.location.bottomRightCorner.y)
  );
  const size = Math.max(24, Math.round(span * 1.3));
  return {
    data: res.data,
    box: {
      x: Math.max(0, Math.round(cx - size / 2)),
      y: Math.max(0, Math.round(cy - size / 2)),
      w: size,
      h: size,
    },
  };
}

/**
 * Stripe repair: separable 9-wide majority filter on a binarized frame.
 * Kills thin bright/dark stripes (paper creases, specular folds) while
 * preserving QR modules (8-10px wide at typical snapshot scale): any module
 * sliced by a stripe is still majority-its-own-color in a 9px window.
 */
function repairThinStripes(bin: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const tmp = new Uint8ClampedArray(bin.length);
  const R = 4; // 9-wide window
  // vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let blacks = 0;
      let count = 0;
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        count++;
        if (bin[yy * w + x] === 0) blacks++;
      }
      tmp[y * w + x] = blacks * 2 >= count ? 0 : 255;
    }
  }
  // horizontal pass
  const out = new Uint8ClampedArray(bin.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let blacks = 0;
      let count = 0;
      for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        count++;
        if (tmp[y * w + xx] === 0) blacks++;
      }
      out[y * w + x] = blacks * 2 >= count ? 0 : 255;
    }
  }
  return out;
}

/** Run the full multi-pass decode on one RGBA frame. */
export function decodeDegradedQr(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  opts?: { exhaustive?: boolean }
): Omit<DecodeResponse, 'type'> {
  const started = Date.now();
  const exhaustive = opts?.exhaustive ?? false;
  const n = width * height;

  // Pass 0: raw frame — never let preprocessing hurt a clear code
  let passes = 0;
  passes++;
  const g0 = tryJsQr({ data: rgba, width, height });
  if (g0) return { found: true, data: g0.data, ...g0.box, passes, ms: Date.now() - started };

  const gray = toGrayscale(rgba, n);

  // Pass 1: plain grayscale
  passes++;
  const g1 = tryJsQr({ data: grayscaleToRgba(gray), width, height });
  if (g1) return { found: true, data: g1.data, ...g1.box, passes, ms: Date.now() - started };

  // Pass 2: median denoise
  passes++;
  const med = median3(gray, width, height);
  const g2 = tryJsQr({ data: grayscaleToRgba(med), width, height });
  if (g2) return { found: true, data: g2.data, ...g2.box, passes, ms: Date.now() - started };

  // Passes 3-5: adaptive thresholds, gentle → aggressive
  let lastBin: Uint8ClampedArray | null = null;
  for (const offset of [10, 20, 30]) {
    passes++;
    const bin = adaptiveThreshold(med, width, height, offset);
    lastBin = bin;
    const g3 = tryJsQr({ data: bin, width, height });
    if (g3) return { found: true, data: g3.data, ...g3.box, passes, ms: Date.now() - started };
  }

  if (exhaustive) {
    // Pass 6: stripe repair (creased/crushed paper) on the best binarization
    if (lastBin) {
      passes++;
      const repaired = repairThinStripes(lastBin, width, height);
      const g6 = tryJsQr({ data: repaired, width, height });
      if (g6) return { found: true, data: g6.data, ...g6.box, passes, ms: Date.now() - started };
    }

    // Pass 7-8: simulated exposure variants (glare vs shadow recovery)
    for (const mul of [1.45, 0.6]) {
      passes++;
      const exposed = new Uint8ClampedArray(n);
      for (let p = 0; p < n; p++) exposed[p] = med[p] * mul;
      const bin = adaptiveThreshold(exposed, width, height, 20);
      const g4 = tryJsQr({ data: bin, width, height });
      if (g4) return { found: true, data: g4.data, ...g4.box, passes, ms: Date.now() - started };
    }

    // Pass 9: 2x upscale retry for small/distant codes (center crop keeps cost bounded)
    passes++;
    const cropped = cropCenter(med, width, height, 0.7);
    const up = upscale2x(cropped.gray, cropped.width, cropped.height);
    const bin = adaptiveThreshold(up, cropped.width * 2, cropped.height * 2, 20);
    const g5 = tryJsQr({ data: bin, width: cropped.width * 2, height: cropped.height * 2 });
    if (g5) return { found: true, data: g5.data, ...g5.box, passes, ms: Date.now() - started };
  }

  return { found: false, passes, ms: Date.now() - started };
}

function cropCenter(
  gray: Uint8ClampedArray,
  w: number,
  h: number,
  frac: number
): { gray: Uint8ClampedArray; width: number; height: number } {
  const cw = Math.floor(w * frac);
  const ch = Math.floor(h * frac);
  const x0 = Math.floor((w - cw) / 2);
  const y0 = Math.floor((h - ch) / 2);
  const out = new Uint8ClampedArray(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) out[y * cw + x] = gray[(y0 + y) * w + (x0 + x)];
  }
  return { gray: out, width: cw, height: ch };
}

function upscale2x(gray: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h * 2; y++) {
    const sy = y >> 1;
    for (let x = 0; x < w * 2; x++) {
      out[y * w * 2 + x] = gray[sy * w + (x >> 1)];
    }
  }
  return out;
}


