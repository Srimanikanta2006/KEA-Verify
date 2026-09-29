#!/usr/bin/env node
/**
 * Prints scannable QR codes for the seeded candidates (same payload format the
 * app parses). Perfect for Feature 2 testing: display one on another screen or
 * print it, then point the app's camera at it.
 *
 * Usage:  node scripts/make-test-qr-codes.mjs KAR-24-91000 KAR-24-91137
 *         node scripts/make-test-qr-codes.mjs          (first 5 by default)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config();

const QRCode = require('qrcode');

const FIRST = [
  'Ananya', 'Mohammed', 'Priyanka', 'Rahul', 'Sneha', 'Karthik', 'Divya', 'Arjun',
  'Kavya', 'Vikram', 'Pooja', 'Santhosh', 'Meghana', 'Ravi', 'Nandini', 'Ganesh',
  'Harsha', 'Bhavana', 'Manjunath', 'Chaitra', 'Prakash', 'Shwetha', 'Naveen', 'Ashwini',
];
const LAST = [
  'Shetty', 'Zeyan', 'K. V.', 'Gowda', 'Hegde', 'Rao', 'Iyer', 'Naik',
  'Reddy', 'Patil', 'S.', 'Bhat', 'Murthy', 'Kulkarni', 'Joshi', 'Achar',
];
const EXAM = 'Civil Police Constable - RPC 2026';
const ROLL_BASE = 91000;
const ROLL_STEP = 137;
const TOTAL = FIRST.length;

function rollFor(i) {
  return `KAR-24-${ROLL_BASE + i * ROLL_STEP}`;
}

function payloadFor(i) {
  const centre = i < 10 ? 'centre_an0081' : i < 18 ? 'centre_bn4022' : 'centre_ct1190';
  const room = String((i % 8) + 1).padStart(2, '0');
  return `KEA|${rollFor(i)}|${EXAM}|${centre}|Room ${room}`;
}

function indexFromArg(arg) {
  const roll = Number(arg.startsWith('KAR-24-') ? arg.split('-').pop() : arg);
  const idx = (roll - ROLL_BASE) / ROLL_STEP;
  if (!Number.isInteger(idx) || idx < 0 || idx >= TOTAL) {
    console.error(
      `Unknown roll "${arg}" — expected KAR-24-${ROLL_BASE} … KAR-24-${ROLL_BASE + (TOTAL - 1) * ROLL_STEP}`
    );
    process.exit(1);
  }
  return idx;
}

const args = process.argv.slice(2);
const indexes = args.length ? args.map(indexFromArg) : [0, 1, 2, 3, 4];

for (const i of indexes) {
  const name = `${FIRST[i]} ${LAST[i % LAST.length]}`.toUpperCase();
  const payload = payloadFor(i);
  console.log(`\n=== ${name} · ${rollFor(i)} ===`);
  const str = await QRCode.toString(payload, { type: 'terminal', small: true });
  console.log(str);
}
