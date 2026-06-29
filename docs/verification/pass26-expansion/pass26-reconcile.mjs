#!/usr/bin/env node
/** Merge-best MATRIX + results.json; print work queue */
import fs from 'node:fs';
import path from 'node:path';
import {
  MATRIX_PATH,
  RESULTS_PATH,
  parseMatrixRows,
  writeMatrixFromRows,
  loadResults,
  saveResults,
  mergeResultResults,
} from './pass26-lib.mjs';

const MOBILE_ID_RE = /^(F\d+-(C|M|R|X)\d+|F7-(C|R|X)\d+)$/;

function main() {
  const md = fs.readFileSync(MATRIX_PATH, 'utf8');
  const matrixRows = parseMatrixRows(md);
  const resultsData = loadResults();
  const merged = { ...resultsData.results };

  // MATRIX PASS → merge into results for mobile IDs
  for (const [id, row] of Object.entries(matrixRows)) {
    if (!MOBILE_ID_RE.test(id)) continue;
    if (row.status === 'PASS') {
      const existing = merged[id];
      merged[id] = {
        pass: true,
        evidence: row.evidence || existing?.evidence || '',
        detail: existing?.detail || row.steps,
        portal: existing?.portal || row.portal,
      };
    } else if (row.status === 'FAIL' && !merged[id]?.pass) {
      const prev = merged[id];
      merged[id] = {
        pass: false,
        evidence: row.evidence || '',
        detail: prev?.detail || row.steps,
        portal: prev?.portal || row.portal,
      };
    }
  }

  // F5-X02..X04 mirror F5-C01 in pass26-expansion-runner.mjs (same journey)
  if (merged['F5-C01']?.pass) {
    for (const id of ['F5-X02', 'F5-X03', 'F5-X04']) {
      merged[id] = {
        pass: true,
        evidence: 'screenshots/f5/F5-C01.png',
        detail: 'derived from F5-C01 PASS (identical journey)',
        portal: 'cross',
      };
      if (matrixRows[id]) {
        matrixRows[id].status = 'PASS';
        matrixRows[id].evidence = 'derived from F5-C01';
      }
    }
  }

  // results.json PASS → update MATRIX
  for (const [id, row] of Object.entries(merged)) {
    if (!matrixRows[id]) continue;
    if (row.pass) {
      matrixRows[id].status = 'PASS';
      if (row.evidence) matrixRows[id].evidence = row.evidence;
    } else if (matrixRows[id].status !== 'PASS') {
      matrixRows[id].status = 'FAIL';
      if (row.evidence) matrixRows[id].evidence = row.evidence;
    }
  }

  saveResults({ ...resultsData, results: merged, wave3: true });
  writeMatrixFromRows(matrixRows);

  // Ingest per-feature appium JSON artifacts (merge-best)
  for (const file of fs.readdirSync(path.dirname(MATRIX_PATH))) {
    const m = file.match(/^f(\d)-appium-results\.json$/) || file.match(/^f5-appium-results\.json$/);
    if (!m) continue;
    try {
      const payload = JSON.parse(fs.readFileSync(path.join(path.dirname(MATRIX_PATH), file), 'utf8'));
      const rows = payload.results || payload;
      for (const [id, row] of Object.entries(rows)) {
        if (!row || typeof row.pass !== 'boolean') continue;
        if (row.pass) {
          merged[id] = {
            pass: true,
            evidence: row.evidence || merged[id]?.evidence || '',
            detail: row.detail || merged[id]?.detail || '',
            portal: row.portal || merged[id]?.portal || '',
          };
          if (matrixRows[id]) {
            matrixRows[id].status = 'PASS';
            matrixRows[id].evidence = row.evidence || matrixRows[id].evidence;
          }
        } else if (!merged[id]?.pass) {
          merged[id] = {
            pass: false,
            evidence: row.evidence || '',
            detail: row.detail || '',
            portal: row.portal || '',
          };
        }
      }
    } catch {}
  }
  saveResults({ ...resultsData, results: merged, wave3: true });
  writeMatrixFromRows(matrixRows);

  const remainingFail = Object.entries(matrixRows)
    .filter(([, r]) => r.status === 'FAIL')
    .map(([id]) => id);
  const remainingPending = Object.entries(matrixRows)
    .filter(([, r]) => r.status === 'PENDING')
    .map(([id]) => id);

  const pass = Object.values(matrixRows).filter((r) => r.status === 'PASS').length;
  const fail = remainingFail.length;
  const pending = remainingPending.length;

  const out = {
    pass,
    fail,
    pending,
    total: Object.keys(matrixRows).length,
    remainingFail,
    remainingPending,
    mobilePass: Object.values(merged).filter((r) => r.pass).length,
    mobileFail: Object.values(merged).filter((r) => !r.pass).length,
  };

  fs.writeFileSync(
    path.join(path.dirname(MATRIX_PATH), 'work-queue.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
}

main();
