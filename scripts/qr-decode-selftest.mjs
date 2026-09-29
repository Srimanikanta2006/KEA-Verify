#!/usr/bin/env node
/**
 * Decode-rate self-test harness. Test logic: scripts/qr-selftest.entry.ts
 * (bundled with esbuild, then executed). Run: npm run test:qr
 */
import { build } from 'esbuild';
import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outfile = '.qr-selftest-bundle.mjs';
await build({
  entryPoints: ['scripts/qr-selftest.entry.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
  external: ['qrcode'],
});
try {
  await import(pathToFileURL(resolve(process.cwd(), outfile)).href);
} finally {
  try {
    unlinkSync(outfile);
  } catch {
    // best effort cleanup
  }
}
