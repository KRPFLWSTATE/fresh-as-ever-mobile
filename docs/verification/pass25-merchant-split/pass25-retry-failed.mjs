#!/usr/bin/env node
/** Pass 25 — retry failed matrix IDs from results.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(ROOT, 'results.json');
const ids = process.argv.slice(2);

if (!ids.length && fs.existsSync(RESULTS)) {
  const { results } = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  ids.push(...Object.entries(results).filter(([, v]) => !v.pass).map(([k]) => k));
}

const priorResults = fs.existsSync(RESULTS)
  ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results || {}
  : {};

if (!ids.length) {
  console.log('No failed IDs to retry');
  process.exit(0);
}

console.log('Retry IDs:', ids.join(', '));
execSync(`ONLY_IDS="${ids.join(',')}" node ${path.join(ROOT, 'pass25-merchant-split-runner.mjs')}`, {
  stdio: 'inherit',
  env: { ...process.env, ONLY_IDS: ids.join(',') },
});
