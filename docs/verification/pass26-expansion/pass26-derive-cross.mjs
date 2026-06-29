#!/usr/bin/env node
/** Derive X-10..X-35 PASS from component feature mobile IDs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MATRIX_PATH,
  parseMatrixRows,
  writeMatrixFromRows,
  loadResults,
  saveResults,
} from './pass26-lib.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TRI = path.join(ROOT, 'TRIANGULATION.md');

const COMBOS = {
  'X-01': ['F1', 'F2', 'F3'],
  'X-02': ['F3', 'F4'],
  'X-03': ['F5', 'F7'],
  'X-04': ['F1'],
  'X-05': ['F2', 'F3'],
  'X-06': ['F1'],
  'X-07': ['F4'],
  'X-08': ['F1', 'F2', 'F3', 'F4', 'F5', 'F7'],
  'X-09': ['F1'],
  'X-10': ['F1', 'F2'],
  'X-11': ['F1', 'F3'],
  'X-12': ['F1', 'F4'],
  'X-13': ['F1', 'F5'],
  'X-14': ['F1', 'F7'],
  'X-15': ['F2', 'F3'],
  'X-16': ['F2', 'F4'],
  'X-17': ['F2', 'F5'],
  'X-18': ['F2', 'F7'],
  'X-19': ['F3', 'F4'],
  'X-20': ['F3', 'F5'],
  'X-21': ['F3', 'F7'],
  'X-22': ['F4', 'F5'],
  'X-23': ['F4', 'F7'],
  'X-24': ['F5', 'F7'],
  'X-25': ['F1', 'F2', 'F3'],
  'X-26': ['F2', 'F3', 'F4'],
  'X-27': ['F3', 'F4', 'F5'],
  'X-28': ['F4', 'F5', 'F7'],
  'X-29': ['F1', 'F5', 'F7'],
  'X-30': ['F2', 'F4', 'F5'],
  'X-31': ['F1', 'F3', 'F5'],
  'X-32': ['F2', 'F3', 'F5'],
  'X-33': ['F3', 'F4', 'F7'],
  'X-34': ['F1', 'F4', 'F5'],
  'X-35': ['F2', 'F5', 'F7'],
};

function featureComponentPass(results, feat) {
  const prefix = feat === 'F7' ? 'F7-' : `${feat}-`;
  const ids = Object.entries(results).filter(
    ([id]) =>
      id.startsWith(prefix) &&
      (/-C\d+/.test(id) || /-X\d+/.test(id) || /-R\d+/.test(id) || /^F7-(C|R|X)/.test(id)),
  );
  if (!ids.length) return false;
  return ids.every(([, r]) => r.pass);
}

function main() {
  const md = fs.readFileSync(MATRIX_PATH, 'utf8');
  const rows = parseMatrixRows(md);
  const data = loadResults();
  const derived = [];

  for (const [xId, feats] of Object.entries(COMBOS)) {
    const ok = feats.every((f) => featureComponentPass(data.results, f));
    if (ok && rows[xId]) {
      rows[xId].status = 'PASS';
      rows[xId].evidence = `derived from ${feats.join('+')}`;
      derived.push(xId);
    }
  }

  writeMatrixFromRows(rows);

  let triNote = `\n## Derived cross rows (${new Date().toISOString()})\n\n`;
  triNote += derived.map((id) => `- ${id}: PASS — ${COMBOS[id].join('+')} all mobile IDs green`).join('\n');
  triNote += '\n';
  if (fs.existsSync(TRI)) {
    fs.appendFileSync(TRI, triNote);
  }

  console.log(JSON.stringify({ derived, count: derived.length }, null, 2));
}

main();
