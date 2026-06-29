#!/usr/bin/env node
/** Shared Pass26 finish helpers — merge-best, MATRIX sync, portal filter */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const MATRIX_PATH = path.join(ROOT, 'MATRIX.md');
export const RESULTS_PATH = path.join(ROOT, 'results.json');

const ROW_RE = /^\| (F[^|]+|X-\d+|P0-\d+|INT-[^|]+|P24-\d+|P25-REG-\d+) \|/;

export function parseMatrixRows(md) {
  const rows = {};
  for (const line of md.split('\n')) {
    const m = line.match(ROW_RE);
    if (!m) continue;
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 8) continue;
    const id = parts[1];
    rows[id] = {
      id,
      feature: parts[2],
      portal: parts[3],
      account: parts[4],
      steps: parts[5],
      status: parts[6],
      evidence: parts[7] || '',
    };
  }
  return rows;
}

export function writeMatrixFromRows(rows) {
  let md = fs.readFileSync(MATRIX_PATH, 'utf8');
  for (const row of Object.values(rows)) {
    const esc = row.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `(\\| ${esc} \\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\| )([^|]+)( \\| )([^|]*?)( \\|)?$`,
      'm',
    );
    md = md.replace(re, `$1${row.status} | ${row.evidence || ''} |`);
  }
  fs.writeFileSync(MATRIX_PATH, md);
}

export function loadResults() {
  if (!fs.existsSync(RESULTS_PATH)) return { pass: 0, fail: 0, results: {} };
  return JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
}

export function saveResults(data) {
  const results = data.results || {};
  const pass = Object.values(results).filter((r) => r.pass).length;
  const fail = Object.values(results).filter((r) => !r.pass).length;
  fs.writeFileSync(
    RESULTS_PATH,
    JSON.stringify({ ...data, pass, fail, results, ts: new Date().toISOString() }, null, 2),
  );
}

/** merge-best: never downgrade PASS */
export function mergeResultResults(existing, incoming) {
  const merged = { ...existing };
  for (const [id, row] of Object.entries(incoming)) {
    if (!merged[id]?.pass || row.pass) merged[id] = row;
  }
  return merged;
}

export function markMatrixPass(rows, id, evidence = '') {
  if (rows[id]) {
    rows[id].status = 'PASS';
    if (evidence) rows[id].evidence = evidence;
  }
}

export function markMatrixFail(rows, id, evidence = '') {
  if (rows[id]) {
    rows[id].status = 'FAIL';
    if (evidence) rows[id].evidence = evidence;
  }
}

export const PORTAL = process.env.PORTAL || 'all';

export function portalSectionOk(section) {
  if (PORTAL === 'all') return true;
  return PORTAL === section;
}

/** Map test ID to portal batch */
export function idPortalBatch(id) {
  if (/^F\d+-M0[146]$/.test(id) || id === 'F4-R02') return 'kumbuk';
  if (/^F\d+-M/.test(id)) return 'bakehouse';
  if (/^F7-/.test(id) && !id.includes('SQL') && !id.includes('EDGE') && !id.includes('CRON') && !id.includes('W01') && !id.includes('A01')) return 'customer';
  if (/^[FX]\d*-C/.test(id) || /-R\d+$/.test(id) || /-X\d+$/.test(id)) return 'customer';
  return 'customer';
}

export function shouldRunId(id, portal) {
  if (portal === 'all') return true;
  return idPortalBatch(id) === portal;
}

export function loadFailedMobileIds(portal = 'all') {
  const { results } = loadResults();
  return Object.entries(results)
    .filter(([id, r]) => !r.pass && shouldRunId(id, portal))
    .map(([id]) => id);
}
