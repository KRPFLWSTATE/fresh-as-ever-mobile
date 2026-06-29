#!/usr/bin/env node
/** Pass 26 F3 — neighbourhood/landmark Appium smoke (C01–C05, M01–M03). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID,
  wait,
  dl,
  scrollMapIntoView,
  prepCustomerDiscover,
  dismissDiscoverSheets,
  ensureDiscoverFeedInView,
  waitForLandmarkInDiscover,
  landmarkVisibleInDiscover,
  loginCustomer,
  loginBakehouse,
  loginKumbuk,
  merchantLogout,
  dismissOverlays,
  recoverFromErrorBoundary,
  safePageSource,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'f3');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const MATRIX = path.join(ROOT, 'MATRIX.md');
const LOCK = path.join(ROOT, 'pass26-runner.lock');
const PORTAL = process.env.PORTAL || 'all';

const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const KUMBUK_OUTLET = '00000000-0000-0000-0000-000000000013';
const GALLE_FACE_OUTLET = 'b4884c9f-5a7c-41b0-af19-321c66f24dea';

const R = {};

function log(e) {
  fs.appendFileSync(
    LOG,
    `${JSON.stringify({ ts: new Date().toISOString(), wave: 'pass26-f3', ...e })}\n`,
  );
}

async function shot(d, name) {
  fs.mkdirSync(SS, { recursive: true });
  const rel = `screenshots/f3/${name}`;
  fs.writeFileSync(path.join(SS, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return rel;
}

async function record(id, pass, detail, portal, evidence = '') {
  R[id] = { pass, detail, portal, evidence };
  log({ id, tool: 'appium.f3', result: pass ? 'PASS' : 'FAIL', detail, portal });
  console.log(`${id}: ${pass ? 'PASS' : 'FAIL'} — ${detail}`);
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

async function main() {
  if (fs.existsSync(LOCK)) {
    console.error('Runner already in progress (pass26-runner.lock exists)');
    process.exit(1);
  }
  fs.writeFileSync(LOCK, String(process.pid));
  process.on('exit', () => {
    try {
      fs.unlinkSync(LOCK);
    } catch {}
  });
  fs.mkdirSync(SS, { recursive: true });
  const d = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': UDID,
      'appium:bundleId': 'com.freshasever.mobile',
      'appium:noReset': true,
      'appium:newCommandTimeout': 600,
    },
  });

  try {
    await dismissOverlays(d);
    await recoverFromErrorBoundary(d);

    let f3DiscoverPrepped = false;
    if (PORTAL === 'all' || PORTAL === 'customer') {
    const landmarks = [
      ['F3-C01', 'Kollupitiya'],
      ['F3-C02', 'Colombo 07'],
      ['F3-C03', 'Pettah'],
      ['F3-C04', 'Galle Face'],
      ['F3-C05', 'Bakehouse'],
    ];
    for (const [id, lm] of landmarks) {
      if (!f3DiscoverPrepped) {
        const ok = await prepCustomerDiscover(d, { freshSession: true });
        if (!ok) {
          const ev = await shot(d, `${id}.png`);
          await record(id, false, 'customer discover prep failed', 'customer', ev);
          continue;
        }
        f3DiscoverPrepped = true;
      } else {
        await dl('freshasever://discover');
        await wait(4000);
        await dismissDiscoverSheets(d);
        await ensureDiscoverFeedInView(d);
      }
      const pass = await waitForLandmarkInDiscover(d, lm);
      const ev = await shot(d, `${id}.png`);
      await record(id, pass, `neighbourhood subtitle ${lm}`, 'customer', ev);
    }
    }

    if (PORTAL === 'all' || PORTAL === 'bakehouse') {
    const bhOk = await loginBakehouse(d);
    if (!bhOk) {
      await record('F3-M01', false, 'bakehouse login failed', 'merchant-bh');
      await record('F3-M03', false, 'bakehouse login failed', 'merchant-bh');
    } else {
      for (const [id, outlet] of [
        ['F3-M01', BAKEHOUSE_OUTLET],
        ['F3-M03', GALLE_FACE_OUTLET],
      ]) {
        await dl(`freshasever://merchant/outlets/${outlet}/edit`);
        await wait(5000);
        const src = await safePageSource(d);
        const pass =
          /landmark|Landmark|Neighbourhood/i.test(src) &&
          /Kollupitiya|Galle/i.test(src);
        const ev = await shot(d, `${id}.png`);
        await record(id, pass, 'landmark edit surface', 'merchant-bh', ev);
      }
      await merchantLogout(d);
    }
    }

    if (PORTAL === 'all' || PORTAL === 'kumbuk') {
    const kbOk = await loginKumbuk(d);
    if (!kbOk) {
      await record('F3-M02', false, 'kumbuk login failed', 'merchant-kb');
    } else {
      await dl(`freshasever://merchant/outlets/${KUMBUK_OUTLET}/edit`);
      await wait(5000);
      const src = await safePageSource(d);
      const pass = /Colombo 07|Kumbuk|landmark|Landmark/i.test(src);
      const ev = await shot(d, 'F3-M02.png');
      await record('F3-M02', pass, 'Kumbuk landmark edit', 'merchant-kb', ev);
      await merchantLogout(d);
    }
    }
  } finally {
    await d.deleteSession().catch(() => {});
  }

  updateMatrix();
  const entries = Object.entries(R);
  const passCount = entries.filter(([, v]) => v.pass).length;
  const failCount = entries.filter(([, v]) => !v.pass).length;
  fs.writeFileSync(path.join(ROOT, 'f3-appium-results.json'), JSON.stringify({ status: failCount ? 'PARTIAL' : 'PASS', results: R }, null, 2));
  const payload = {
    status: failCount ? 'PARTIAL' : 'PASS',
    passCount,
    failCount,
    failedIds: entries.filter(([, v]) => !v.pass).map(([k]) => k),
    blockers: [],
  };
  console.log(JSON.stringify(payload));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
