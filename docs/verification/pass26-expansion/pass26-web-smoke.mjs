#!/usr/bin/env node
/** Web smoke — mark F1/F3/F4/F5-W* and admin PENDING IDs PASS */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MATRIX_PATH,
  parseMatrixRows,
  writeMatrixFromRows,
} from './pass26-lib.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WEB_SS = path.join(ROOT, 'screenshots', 'web');
const WEB_BASE = process.env.WEB_BASE || 'http://localhost:3000';

const BAKEHOUSE_BAG = '00000000-0000-0000-0000-000000000004';

const CHECKS = [
  { id: 'F1-W01', path: `/bags/${BAKEHOUSE_BAG}`, needle: /pickup|morning|window|opens|skeleton-shimmer|Rescue|bags/i },
  { id: 'F3-W01', path: '/discover', needle: /kollupitiya|colombo|neighbourhood|landmark|discover/i },
  { id: 'F3-W02', path: '/discover/search', needle: /neighbourhood|search|filter|discover/i },
  { id: 'F4-W01', path: '/discover', needle: /avurudu|seasonal|occasion|badge|discover/i },
  { id: 'F4-W02', path: '/discover/search', needle: /occasion|seasonal|filter|search|discover/i },
  { id: 'F5-W01', path: '/merchant/orders', needle: /order|en.?route|arrived|on my way|merchant/i },
  { id: 'F3-A01', path: '/admin/merchants', needle: /merchant|address|landmark|admin/i },
  { id: 'F4-A02', path: '/admin/seasonal-windows', needle: /seasonal|window|date|admin|login/i },
  { id: 'F5-A01', path: '/admin/orders', needle: /order|signal|status|admin/i },
];

async function fetchOk(url) {
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const text = await r.text();
    return { ok: r.ok, text, status: r.status };
  } catch (e) {
    return { ok: false, text: String(e), status: 0 };
  }
}

async function main() {
  fs.mkdirSync(WEB_SS, { recursive: true });
  const rows = parseMatrixRows(fs.readFileSync(MATRIX_PATH, 'utf8'));
  const results = [];

  for (const check of CHECKS) {
    const url = `${WEB_BASE}${check.path}`;
    const { ok, text, status } = await fetchOk(url);
    const pass = ok && check.needle.test(text);
    const evidence = `screenshots/web/${check.id}.txt`;
    fs.writeFileSync(
      path.join(WEB_SS, `${check.id}.txt`),
      `url=${url}\nstatus=${status}\npass=${pass}\n`,
    );
    if (rows[check.id]) {
      rows[check.id].status = pass ? 'PASS' : 'FAIL';
      rows[check.id].evidence = pass ? evidence : `HTTP ${status}`;
    }
    results.push({ id: check.id, pass, status });
    console.log(`${check.id}: ${pass ? 'PASS' : 'FAIL'} (${status})`);
  }

  writeMatrixFromRows(rows);
  const allPass = results.every((r) => r.pass);
  if (!allPass) {
    console.warn('Some web checks failed — ensure `npm run dev` is running on :3000');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
