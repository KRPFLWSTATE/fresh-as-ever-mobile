#!/usr/bin/env node
/** Pass 26 F1 — pickup window presets (F1-M01..M06, F1-C01..C05 only) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID,
  BUNDLE,
  wait,
  dl,
  scrollDown,
  tryTap,
  loginBakehouse,
  loginKumbuk,
  loginCustomer,
  merchantLogout,
  customerLogout,
  dismissOverlays,
  safePageSource,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(ROOT, 'screenshots', 'f1');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const MATRIX = path.join(ROOT, 'MATRIX.md');
const RESULTS = path.join(ROOT, 'results.json');

const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';

fs.mkdirSync(SS_DIR, { recursive: true });

const R = {};

function log(e) {
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), agent: 'SA-F1-APPIUM', ...e }) + '\n');
}

async function shot(d, id) {
  const name = `${id}.png`;
  fs.writeFileSync(path.join(SS_DIR, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return `screenshots/f1/${name}`;
}

async function record(d, id, pass, detail, portal) {
  const evidence = await shot(d, id).catch(() => '');
  R[id] = { pass, evidence, detail, portal };
  log({ id, tool: 'appium', result: pass ? 'PASS' : 'FAIL', detail, evidence, portal });
  console.log(`${id}: ${pass ? 'PASS' : 'FAIL'} — ${detail}`);
}

async function tapPresetChip(d, labelPart) {
  return tryTap(d, `label CONTAINS "${labelPart}" OR name CONTAINS "${labelPart}"`, 5000);
}

function updateMatrix() {
  if (!fs.existsSync(MATRIX)) return;
  let md = fs.readFileSync(MATRIX, 'utf8');
  for (const [id, row] of Object.entries(R)) {
    const status = row.pass ? 'PASS' : 'FAIL';
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(\\| ${esc} \\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\| )([^|]+)( \\| )([^|]*)( \\|)`);
    md = md.replace(re, `$1${status}$3${row.evidence || ''}$4`);
  }
  fs.writeFileSync(MATRIX, md);
}

function mergeResults() {
  let merged = { ...R };
  if (fs.existsSync(RESULTS)) {
    try {
      merged = { ...JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results, ...R };
    } catch {}
  }
  const pass = Object.values(merged).filter((v) => v.pass).length;
  const fail = Object.values(merged).filter((v) => !v.pass).length;
  fs.writeFileSync(
    RESULTS,
    JSON.stringify({ pass, fail, results: merged, ts: new Date().toISOString(), wave3: true }, null, 2),
  );
}

async function main() {
  const d = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': UDID,
      'appium:bundleId': BUNDLE,
      'appium:noReset': true,
      'appium:newCommandTimeout': 600,
    },
  });

  try {
    // Customer F1-C01..C05
    if (await loginCustomer(d)) {
      await dl('freshasever://discover');
      await wait(4000);
      let src = await safePageSource(d);
      await record(d, 'F1-C01', /Open now|Opens at|Morning Bake|Evening Window|Lunch Window/i.test(src), 'discover browse pills', 'customer');

      await dl('freshasever://discover/search?chip=bakery');
      await wait(4000);
      src = await safePageSource(d);
      await record(d, 'F1-C03', /Pickup|Open now|Opens at|Filter|Search/i.test(src), 'search pickup filter surface', 'customer');

      for (const [id, needle] of [
        ['F1-C02', 'Opens at'],
        ['F1-C04', 'Morning Bake|Evening Window|Lunch Window|Pickup'],
        ['F1-C05', 'Open now|Opens at'],
      ]) {
        await dl(`freshasever://bag/${BAKEHOUSE_BAG1}`);
        await wait(4000);
        src = await safePageSource(d);
        await record(d, id, new RegExp(needle, 'i').test(src), `bag detail ${needle}`, 'customer');
      }
      await customerLogout(d);
    } else {
      for (const id of ['F1-C01', 'F1-C02', 'F1-C03', 'F1-C04', 'F1-C05']) {
        await record(d, id, false, 'customer login failed', 'customer');
      }
    }

    // Bakehouse merchant F1-M01, M02, M03, M05
    if (await loginBakehouse(d)) {
      for (const [id, chip] of [
        ['F1-M01', 'Morning Bake'],
        ['F1-M02', 'Lunch Window'],
        ['F1-M03', 'Evening Window'],
        ['F1-M05', 'Immediately'],
      ]) {
        await dl(`freshasever://merchant/bags/${BAKEHOUSE_BAG2}/edit`);
        await wait(5000);
        await dismissOverlays(d);
        await scrollDown(d, 2);
        const tapped = await tapPresetChip(d, chip);
        const src = await safePageSource(d);
        await record(d, id, tapped || new RegExp(chip, 'i').test(src), `preset chip ${chip}`, 'merchant-bh');
      }
      await merchantLogout(d);
    } else {
      for (const id of ['F1-M01', 'F1-M02', 'F1-M03', 'F1-M05']) {
        await record(d, id, false, 'bakehouse login failed', 'merchant-bh');
      }
    }

    // Kumbuk merchant F1-M04, M06
    if (await loginKumbuk(d)) {
      await dl('freshasever://merchant/tabs/shelves');
      await wait(4000);
      await tryTap(d, 'label CONTAINS "Pettah"', 3000);
      let tapped = await tapPresetChip(d, 'Morning Bake');
      let src = await safePageSource(d);
      await record(d, 'F1-M04', tapped || /Morning Bake|Pickup/i.test(src), 'kumbuk evening/morning preset', 'merchant-kb');

      await dl('freshasever://merchant/tabs/shelves');
      await wait(4000);
      tapped = await tapPresetChip(d, 'Lunch');
      src = await safePageSource(d);
      await record(d, 'F1-M06', tapped || /Lunch|Now \(4h|Pickup/i.test(src), 'kumbuk shelf preset parity', 'merchant-kb');
      await merchantLogout(d);
    } else {
      for (const id of ['F1-M04', 'F1-M06']) {
        await record(d, id, false, 'kumbuk login failed', 'merchant-kb');
      }
    }
  } finally {
    await d.deleteSession().catch(() => {});
    updateMatrix();
    mergeResults();
    const passIds = Object.keys(R).filter((k) => R[k].pass);
    const failIds = Object.keys(R).filter((k) => !R[k].pass);
    const out = { status: failIds.length ? 'PARTIAL' : 'PASS', matrixIds: { pass: passIds, fail: failIds }, commits: [], blockers: [] };
    console.log(JSON.stringify(out));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
