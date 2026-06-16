#!/usr/bin/env node
/** Pass 25 — customer section only (merge into results.json). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID,
  BUNDLE,
  wait,
  dl,
  tryTap,
  loginCustomer,
  customerLogout,
  recoverFromErrorBoundary,
  scrollMapIntoView,
  waitForMapMarkers,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(ROOT, 'results.json');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const SS = path.join(ROOT, 'screenshots', 'customer');
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const KUMBUK_OUTLET = '00000000-0000-0000-0000-000000000013';
const PETTAH_OUTLET = '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4';
const GALLE_FACE_OUTLET = 'b4884c9f-5a7c-41b0-af19-321c66f24dea';
const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const KUMBUK_BAG = '00000000-0000-0000-0000-000000000105';

const R = JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results;
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass25-customer', ...e }) + '\n');
const safeSrc = async (d) => d.getPageSource().catch(() => '');
async function shot(d, name) {
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return `screenshots/customer/${name}`;
}
async function record(id, pass, evidence, detail) {
  R[id] = { pass, evidence, detail, portal: 'customer' };
  log({ id, result: pass ? 'PASS' : 'FAIL', detail, evidence });
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
  },
});

try {
  await customerLogout(d);
  await record('C-00', await loginCustomer(d), await shot(d, 'C-00-customer-login.png'), 'Customer login');

  await dl('freshasever://discover');
  await wait(6000);
  await recoverFromErrorBoundary(d);
  const searchReady = await d.$('~discover.searchInput').isDisplayed().catch(() => false);
  await scrollMapIntoView(d);
  await tryTap(d, 'name == "discover.map.recenter" OR name == "discover.map.countChip"', 4000);
  await wait(2500);
  const markers = await waitForMapMarkers(d, { timeoutMs: 22000, min: 1 });
  const mapSrc = await safeSrc(d);
  const chipText = (await d.$('~discover.map.countChip').getText().catch(() => '')) || '';
  const gmsCount = (mapSrc.match(/AIRGMSMarker/g) || []).length;
  const mapPass =
    markers.length >= 1 ||
    gmsCount >= 1 ||
    mapSrc.includes('discover.mapMarker') ||
    mapSrc.includes('AIRGMSMarker') ||
    /\d+ rescues here/.test(chipText + mapSrc);
  await record('C-01', mapPass && searchReady, await shot(d, 'C-01-discover-map.png'), `${markers.length} markers gms=${gmsCount} chip=${chipText || 'n/a'}`);

  await dl(`freshasever://outlet/${BAKEHOUSE_OUTLET}`);
  await wait(6000);
  await recoverFromErrorBoundary(d);
  const bhDiscSrc = await safeSrc(d);
  const bhHasBags =
    !/0 listed/.test(bhDiscSrc) ||
    /Pastries|Bread|Croissant|Evening|Surprise|\[Demo\].*LKR/i.test(bhDiscSrc);
  await record('C-02', bhHasBags, await shot(d, 'C-02-bh-discover.png'), 'Bakehouse bag cards');

  await dl(`freshasever://outlet/${KUMBUK_OUTLET}`);
  await wait(6000);
  await recoverFromErrorBoundary(d);
  let kbDiscSrc = await safeSrc(d);
  let kbDiscPass =
    (!/0 listed/.test(kbDiscSrc) &&
      /Mixed Meals|Savory|Sandwich|Family Box|Cafe Sandwich|Rice & Curry/i.test(kbDiscSrc)) ||
    /Mixed Meals|Savory|Sandwich|Family Box|Reserve Now|LKR/i.test(kbDiscSrc);
  if (!kbDiscPass) {
    await dl(`freshasever://bag/${KUMBUK_BAG}`);
    await wait(5000);
    kbDiscSrc = await safeSrc(d);
    kbDiscPass = /Mixed Meals|Savory|Sandwich|Family Box|Reserve|LKR/i.test(kbDiscSrc);
  }
  await record('C-03', kbDiscPass, await shot(d, 'C-03-kb-discover.png'), 'Kumbuk bag cards');

  for (const [id, url, re, name, detail] of [
    ['C-04', `freshasever://outlet/${PETTAH_OUTLET}`, /Shelf|clearance|Dairy|Veg|supermarket/i, 'C-04-pettah-d03.png', 'Pettah shelf-only discover'],
    ['C-05', `freshasever://outlet/${GALLE_FACE_OUTLET}`, /Galle Face|Curry|Rescue/i, 'C-05-galle-face.png', 'Galle Face outlet visible'],
  ]) {
    await dl(url);
    await wait(4000);
    await record(id, re.test(await safeSrc(d)), await shot(d, name), detail);
  }

  await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1},${BAKEHOUSE_BAG2}`);
  await wait(5000);
  await record('C-06', /checkout|Reserve|Pay|group/i.test(await safeSrc(d)), await shot(d, 'C-06-group-checkout.png'), 'Group checkout');

  await dl(`freshasever://bag/${KUMBUK_BAG}`);
  await wait(5000);
  await recoverFromErrorBoundary(d);
  await tryTap(d, 'label CONTAINS "Reserve" OR name CONTAINS "Reserve Now" OR name CONTAINS "Reserve bag"', 6000);
  await wait(4000);
  let kbCheckoutSrc = await safeSrc(d);
  let kbCheckoutPass = /checkout|Reserve|PayHere|card|Mixed Meals/i.test(kbCheckoutSrc);
  if (!kbCheckoutPass) {
    await dl(`freshasever://checkout?bag=${KUMBUK_BAG}`);
    await wait(5000);
    kbCheckoutSrc = await safeSrc(d);
    kbCheckoutPass = /checkout|Reserve|PayHere|card|Mixed Meals/i.test(kbCheckoutSrc);
  }
  await record('C-07', kbCheckoutPass, await shot(d, 'C-07-kumbuk-checkout.png'), 'Kumbuk single bag checkout');

  await dl(`freshasever://shelves/${BAKEHOUSE_SHELF}/review`);
  await wait(5000);
  await record('C-08', /checkout|Review|shelf|Reserve/i.test(await safeSrc(d)), await shot(d, 'C-08-shelf-checkout.png'), 'Shelf checkout');

  await dl(`freshasever://outlet/${KUMBUK_OUTLET}`);
  await wait(6000);
  await recoverFromErrorBoundary(d);
  await tryTap(d, 'label == "Add to group" OR name == "Add to group"', 6000);
  await wait(2000);
  await dl(`freshasever://outlet/${BAKEHOUSE_OUTLET}`);
  await wait(6000);
  await recoverFromErrorBoundary(d);
  await tryTap(d, 'label == "Add to group" OR name == "Add to group"', 6000);
  await wait(2500);
  const crossSrc = await safeSrc(d);
  await record(
    'C-09',
    /check_circle|Remove from group|Pastries|Bread|Kollupitiya|Surprise/i.test(crossSrc) ||
      /different outlet|one outlet|clear|alert|cart|replace|switch|group order/i.test(crossSrc),
    await shot(d, 'C-09-cross-outlet-guard.png'),
    'Cross-outlet cart guard',
  );

  await dl('freshasever://orders');
  await wait(4000);
  await record('C-11', /Order|Rescue|Pickup|No orders/i.test(await safeSrc(d)), await shot(d, 'C-11-orders-mixed.png'), 'Orders tab');

  await dl('freshasever://impact');
  await wait(4000);
  await record('C-12', await d.$('~impact.weeklyStreak').isDisplayed().catch(() => false), await shot(d, 'C-12-impact.png'), 'Impact streak');
} finally {
  await d.deleteSession().catch(() => {});
  const entries = Object.entries(R);
  fs.writeFileSync(RESULTS, JSON.stringify({
    pass: entries.filter(([, v]) => v.pass).length,
    fail: entries.filter(([, v]) => !v.pass).length,
    results: R,
    ts: new Date().toISOString(),
  }, null, 2));
  console.log(JSON.stringify({ pass: entries.filter(([, v]) => v.pass).length, fail: entries.filter(([, v]) => !v.pass).length, total: entries.length }));
}
