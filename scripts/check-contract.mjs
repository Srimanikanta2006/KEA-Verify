#!/usr/bin/env node
/**
 * Contract sanity check: every producer of QR payloads (seed script,
 * test-QR generator, browser test bench) must emit the same `KEA|roll|exam|centre|room`
 * format the app parses, with matching roll numbers and centre IDs.
 */
import { readFileSync } from 'node:fs';

const seed = readFileSync('scripts/seed-firebase.mjs', 'utf8');
const gen = readFileSync('scripts/make-test-qr-codes.mjs', 'utf8');
const bench = readFileSync('test-qr-codes.html', 'utf8');
const qr = readFileSync('src/services/qr.ts', 'utf8');

const checks = [
  ['seed emits KEA| payload', seed.includes('KEA|')],
  ['generator emits KEA| payload', gen.includes('KEA|')],
  ['browser bench emits KEA| payload', bench.includes('KEA|')],
  ['app parser expects KEA| prefix', qr.includes("startsWith('KEA|')")],
  ['roll base consistent (91000)', seed.includes('91000') && gen.includes('91000')],
  ['roll step consistent (137)', seed.includes('137') && gen.includes('137')],
  ['centre ids consistent (centre_an0081)', seed.includes('centre_an0081') && gen.includes('centre_an0081') && bench.includes('centre_an0081')],
  // The browser bench only makes same-centre (AN0081) QRs; mismatch-test QRs
  // for BN4022 come from `npm run make:qr KAR-24-91137`.
  ['mismatch centre ids consistent (seed + generator + app data)', seed.includes('centre_bn4022') && gen.includes('centre_bn4022') && readFileSync('src/services/demoData.ts', 'utf8').includes('centre_bn4022')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failed++;
}
if (failed > 0) {
  console.error(`\n${failed} contract check(s) failed.`);
  process.exit(1);
}
console.log('\nAll QR contract checks passed.');
