#!/usr/bin/env node
/** Run remaining FAIL IDs in portal batches — no full marathon */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WQ = path.join(ROOT, 'work-queue.json');

function run(cmd, env = {}) {
  console.log(`\n>>> ${cmd}`);
  const r = spawnSync(cmd, {
    shell: true,
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  spawnSync('node', ['pass26-reconcile.mjs'], { cwd: ROOT, stdio: 'inherit' });
  return r.status === 0;
}

const fail = fs.existsSync(WQ)
  ? JSON.parse(fs.readFileSync(WQ, 'utf8')).remainingFail || []
  : [];

const customer = fail.filter(
  (id) => /^F[1-7]-(C|X|R)/.test(id) && !/^F[1-7]-M/.test(id),
);
const bakehouse = fail.filter((id) =>
  ['F1-M02', 'F1-M03', 'F1-M05', 'F4-M01', 'F4-M02'].includes(id),
);
const kumbuk = fail.filter((id) => id === 'F4-M03');

spawnSync('node', ['reset-f5-order.mjs'], { cwd: ROOT, stdio: 'inherit' });

if (customer.length) {
  run(`ONLY_IDS=${customer.join(',')} node pass26-expansion-runner.mjs`);
}

if (bakehouse.length) {
  run(`PORTAL=bakehouse node pass26-f1-appium.mjs`);
  run(`PORTAL=bakehouse node pass26-f4-appium.mjs`);
}

if (kumbuk.length) {
  run(`PORTAL=kumbuk node pass26-f4-appium.mjs`);
}

const f5cross = fail.filter((id) => /^F5-(X|R)/.test(id));
if (f5cross.length) {
  spawnSync('node', ['reset-f5-order.mjs'], { cwd: ROOT, stdio: 'inherit' });
  run(`ONLY_IDS=${f5cross.join(',')} node pass26-expansion-runner.mjs`);
}

spawnSync('node', ['pass26-reconcile.mjs'], { cwd: ROOT, stdio: 'inherit' });
