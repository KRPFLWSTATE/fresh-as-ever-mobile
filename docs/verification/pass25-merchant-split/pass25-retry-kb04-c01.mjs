#!/usr/bin/env node
/** Pass 25 — focused retry for KB-04 + C-01 only. */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID,
  BUNDLE,
  wait,
  dl,
  scrollDown,
  tryTap,
  loginKumbuk,
  loginCustomer,
  merchantLogout,
  customerLogout,
  isKumbukMerchantSession,
  dismissOverlays,
  recoverFromErrorBoundary,
  relaunchApp,
  scrollMapIntoView,
  waitForMapMarkers,
  ensureKumbukMerchantSession,
  ensureCustomerDiscover,
  assessDiscoverMap,
  waitForMerchantDashboard,
  dismissSystemPrompts,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(ROOT, '.runner.lock');
const RESULTS = path.join(ROOT, 'results.json');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const KUMBUK_OUTLET = '00000000-0000-0000-0000-000000000013';

if (fs.existsSync(LOCK)) {
  console.error('Runner lock present');
  process.exit(1);
}
fs.writeFileSync(LOCK, String(process.pid));
process.on('exit', () => {
  try {
    fs.unlinkSync(LOCK);
  } catch {}
});

const R = JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results || {};
const log = (e) =>
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass25-retry', ...e }) + '\n');
const safeSrc = async (d) => d.getPageSource().catch(() => '');

async function shot(d, subdir, name) {
  const dir = path.join(ROOT, 'screenshots', subdir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return `screenshots/${subdir}/${name}`;
}

async function record(id, pass, evidence, detail, portal) {
  R[id] = { pass, evidence, detail, portal };
  log({ id, result: pass ? 'PASS' : 'FAIL', detail, evidence, portal });
}

const d = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  capabilities: {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': UDID,
    'appium:bundleId': BUNDLE,
    'appium:noReset': true,
    'appium:newCommandTimeout': 300,
    'appium:waitForIdleTimeout': 0,
    'appium:shouldWaitForQuiescence': false,
  },
});

try {
  await relaunchApp(d);
  await dismissSystemPrompts(d);
  await dismissOverlays(d);

  let kbReady = await ensureKumbukMerchantSession(d);
  if (!kbReady) {
    kbReady = await loginKumbuk(d) && (await isKumbukMerchantSession(d));
  }
  if (!kbReady) {
    await record(
      'KB-04',
      false,
      await shot(d, 'merchant-kb', 'KB-04-bag-images.png'),
      'Kumbuk login failed',
      'merchant-kb',
    );
  } else {
    await waitForMerchantDashboard(d);
    await dismissOverlays(d);
    await dl(`freshasever://merchant/outlets/${KUMBUK_OUTLET}/edit`);
    await wait(4000);
    await dismissOverlays(d);
    await ensureKumbukMerchantSession(d);
    await dl('freshasever://merchant/tabs/bags');
    await wait(7000);
    const bagsSrc = await safeSrc(d);
    const kbPass =
      /Kumbuk|Colombo 07/i.test(bagsSrc) &&
      /Mixed Meals|Savory|Sandwich|Latte|Rice|Curry/i.test(bagsSrc) &&
      !/PETTAH GREEN GROCER/i.test(bagsSrc);
    await record(
      'KB-04',
      kbPass,
      await shot(d, 'merchant-kb', 'KB-04-bag-images.png'),
      kbPass ? 'Kumbuk demo bags with images' : 'Still scoped wrong outlet',
      'merchant-kb',
    );
  }

  await dl('freshasever://discover');
  await wait(3000);
  await dismissSavePassword(d);
  await relaunchApp(d);
  await dismissSystemPrompts(d);

  let custReady = await loginCustomer(d);
  if (!custReady) custReady = await ensureCustomerDiscover(d);
  if (!custReady) {
    await record(
      'C-01',
      false,
      await shot(d, 'customer', 'C-01-discover-map.png'),
      'Customer login failed',
      'customer',
    );
  } else {
    await dismissOverlays(d);
    await ensureCustomerDiscover(d);
    await recoverFromErrorBoundary(d);
    await scrollMapIntoView(d);
    await tryTap(d, 'name == "discover.map.recenter" OR name == "discover.map.countChip"', 4000);
    await wait(2500);
    await waitForMapMarkers(d, { timeoutMs: 22000, min: 1 }).catch(() => []);
    const mapResult = await assessDiscoverMap(d);
    await record(
      'C-01',
      mapResult.pass,
      await shot(d, 'customer', 'C-01-discover-map.png'),
      mapResult.detail,
      'customer',
    );
  }
} finally {
  await d.deleteSession().catch(() => {});
  const entries = Object.entries(R);
  fs.writeFileSync(
    RESULTS,
    JSON.stringify(
      {
        pass: entries.filter(([, v]) => v.pass).length,
        fail: entries.filter(([, v]) => !v.pass).length,
        results: R,
        ts: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ KB04: R['KB-04']?.pass, C01: R['C-01']?.pass }));
}
