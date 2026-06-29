#!/usr/bin/env node
/**
 * Pass 26 — perfection loop orchestrator (skeleton).
 *
 * Reads results.json failures and re-invokes pass26-retry-failed.mjs until clean
 * or maxRetries exceeded. In Multitask Mode the parent spawns SA-FIX-{ID} instead;
 * this script supports local/CI loop per MULTITASK-PLAYBOOK.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(ROOT, 'results.json');
const RETRY = path.join(ROOT, 'pass26-retry-failed.mjs');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const MAX_RETRIES = Number(process.env.PASS26_MAX_RETRIES || 3);

function failedIds() {
  if (!fs.existsSync(RESULTS)) return [];
  const { results = {} } = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  return Object.entries(results).filter(([, v]) => !v.pass).map(([k]) => k);
}

function appendLog(entry) {
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass26-perfection', ...entry }) + '\n');
}

let round = 0;
while (failedIds().length && round < MAX_RETRIES) {
  round += 1;
  const failed = failedIds();
  console.log(`Perfection loop round ${round}/${MAX_RETRIES} — ${failed.length} failures`);
  appendLog({ round, failed, action: 'retry' });
  execSync(`node ${RETRY}`, { stdio: 'inherit' });
}

const remaining = failedIds();
if (remaining.length) {
  console.error('Escalate to parent — still failing:', remaining.join(', '));
  appendLog({ round, remaining, action: 'escalate' });
  process.exit(1);
}

console.log('MATRIX clean (per results.json)');
appendLog({ round, action: 'complete' });
