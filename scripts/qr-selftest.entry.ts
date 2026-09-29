/**
 * Test logic for the degraded-QR self-test (bundled+run by qr-decode-selftest.mjs).
 * Simulates physical damage classes and reports decode rate / passes / latency,
 * including multi-frame hand-tremor recovery on crushed paper.
 */
import { decodeDegradedQr } from '../src/services/qrWorker';
import QRCode from 'qrcode';

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function qrToCanvasRgba(text: string, canvasSize: number, qrSize: number): Uint8ClampedArray {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const count: number = qr.modules.size;
  const scale = Math.max(1, Math.floor(qrSize / count));
  const dim = count * scale;
  const rgba = new Uint8ClampedArray(canvasSize * canvasSize * 4).fill(255);
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const dark = qr.modules.data[Math.floor(y / scale) * count + Math.floor(x / scale)] === 1;
      if (!dark) continue;
      const ox = Math.floor((canvasSize - dim) / 2) + x;
      const oy = Math.floor((canvasSize - dim) / 2) + y;
      const p = (oy * canvasSize + ox) * 4;
      rgba[p] = 0;
      rgba[p + 1] = 0;
      rgba[p + 2] = 0;
    }
  }
  return rgba;
}

function speckle(rgba: Uint8ClampedArray, frac: number, rand: () => number) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rand() < frac) {
      const v = rand() < 0.5 ? 0 : 255;
      rgba[i] = v;
      rgba[i + 1] = v;
      rgba[i + 2] = v;
    }
  }
}

function unevenLight(rgba: Uint8ClampedArray, minMul: number) {
  const w = Math.sqrt(rgba.length / 4);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const mul = minMul + ((1 - minMul) * x) / w;
      const p = (y * w + x) * 4;
      rgba[p] = Math.round(rgba[p] * mul);
      rgba[p + 1] = Math.round(rgba[p + 1] * mul);
      rgba[p + 2] = Math.round(rgba[p + 2] * mul);
    }
  }
}

function fadeInk(rgba: Uint8ClampedArray, lo: number, hi: number) {
  for (let i = 0; i < rgba.length; i += 4) {
    for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(lo + (rgba[i + c] / 255) * (hi - lo));
  }
}

function creaseBand(
  rgba: Uint8ClampedArray,
  w: number,
  halfWidth: number,
  value: number,
  shift = 0
) {
  // diagonal band through the code: paper fold highlight (bright) or shadow (dark);
  // 'shift' moves the band along the anti-diagonal (hand tremor between frames)
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.abs(x + y - w + shift) / 2 < halfWidth) {
        const p = (y * w + x) * 4;
        rgba[p] = value;
        rgba[p + 1] = value;
        rgba[p + 2] = value;
      }
    }
  }
}

const PAYLOAD = 'KEA|KAR-24-91000|Civil Police Constable - RPC 2026|centre_an0081|01';
const TRIALS = 10;

const conditions: Record<string, (r: Uint8ClampedArray, rand: () => number) => Uint8ClampedArray> = {
  clean: (r) => r,
  photocopy_speckle_3pct: (r, rand) => (speckle(r, 0.03, rand), r),
  water_stain_gradient_045: (r) => (unevenLight(r, 0.45), r),
  faded_ink_low_contrast: (r) => (fadeInk(r, 88, 172), r),
  small_distant_60px_in_240: (r) => r,
  abused_all_combined: (r, rand) => {
    speckle(r, 0.04, rand);
    unevenLight(r, 0.5);
    fadeInk(r, 92, 178);
    return r;
  },
  crease_highlight_6px: (r) => (creaseBand(r, 240, 3, 235), r),
  crease_shadow_10px: (r) => (creaseBand(r, 240, 5, 20), r),
  crushed_highlight_plus_speckle: (r, rand) => {
    creaseBand(r, 240, 5, 232);
    speckle(r, 0.05, rand);
    unevenLight(r, 0.55);
    return r;
  },
};

/**
 * Crushed-crease with hand tremor: the specular fold shifts a few px between
 * snapshots (AF hunting + natural wobble). The live loop gets ~11 attempts in
 * the 8s fallback window; success = any single frame decoding cleanly.
 */
function crushedWithTremor(base: Uint8ClampedArray, w: number, rand: () => number, frames: number) {
  for (let f = 0; f < frames; f++) {
    const rgba = new Uint8ClampedArray(base);
    creaseBand(rgba, w, 4 + Math.floor(rand() * 3), 230 + Math.floor(rand() * 20), Math.floor((rand() - 0.5) * 60));
    speckle(rgba, 0.02, rand);
    const res = decodeDegradedQr(rgba, w, w, { exhaustive: f % 3 === 2 });
    if (res.found && res.data === PAYLOAD) return { found: true, frames: f + 1 };
  }
  return { found: false, frames };
}

export function runSelfTest(): void {
  // Tremor simulation first: does the LIVE multi-frame loop recover crushed paper?
  let tremorOk = 0;
  let framesUsed = 0;
  const TREMOR_TRIALS = 20;
  for (let t = 0; t < TREMOR_TRIALS; t++) {
    const rand = mulberry32(7000 + t * 31);
    const base = qrToCanvasRgba(PAYLOAD, 240, 240);
    const r = crushedWithTremor(base, 240, rand, 11);
    if (r.found) {
      tremorOk++;
      framesUsed += r.frames;
    }
  }
  console.log(
    'crushed_fold_multi_frame_tremor'.padEnd(32) +
      `${String(tremorOk)}/${TREMOR_TRIALS}`.padEnd(9) +
      '-'.padEnd(12) +
      (tremorOk ? `recovered, avg ${(framesUsed / tremorOk).toFixed(1)} frames` : 'not recovered')
  );

  console.log('condition                        decoded   avg passes   avg ms');
  console.log('--------------------------------------------------------------');
  for (const [name, damage] of Object.entries(conditions)) {
    let ok = 0;
    let passesSum = 0;
    let msSum = 0;
    for (let t = 0; t < TRIALS; t++) {
      const rand = mulberry32(1000 + t * 77);
      const isSmall = name.startsWith('small');
      const rgba = qrToCanvasRgba(PAYLOAD, 240, isSmall ? 60 : 240);
      damage(rgba, rand);
      const res = decodeDegradedQr(rgba, 240, 240, { exhaustive: true });
      if (res.found) {
        ok++;
        passesSum += res.passes;
        msSum += res.ms;
      }
    }
    console.log(
      name.padEnd(32) +
        `${String(ok)}/${TRIALS}`.padEnd(9) +
        (ok ? (passesSum / ok).toFixed(1) : '-').padEnd(12) +
        (ok ? (msSum / ok).toFixed(1) : '-')
    );
  }
}

runSelfTest();
