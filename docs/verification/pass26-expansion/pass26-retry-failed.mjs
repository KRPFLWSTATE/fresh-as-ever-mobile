#!/usr/bin/env node
/** Pass 26 — retry failed matrix IDs from results.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(ROOT, 'results.json');
const RUNNER = path.join(ROOT, 'pass26-expansion-runner.mjs');
const ids = process.argv.slice(2);

if (!ids.length && fs.existsSync(RESULTS)) {
  const parsed = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  const results = parsed.results || parsed;
  ids.push(...Object.entries(results).filter(([, v]) => !v.pass).map(([k]) => k));
}

if (!ids.length) {
  console.log('No failed IDs to retry');
  process.exit(0);
}

console.log('Pass 26 retry IDs:', ids.join(', '));

const priorResults = fs.existsSync(RESULTS)
  ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results || {}
  : {};

execSync(`node ${RUNNER}`, {
  stdio: 'inherit',
  env: { ...process.env, ONLY_IDS: ids.join(',') },
});

// Merge prior passing rows when partial retry (pass25 pattern)
if (fs.existsSync(RESULTS)) {
  const next = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  next.results = { ...priorResults, ...next.results };
  fs.writeFileSync(RESULTS, JSON.stringify(next, null, 2));
}
