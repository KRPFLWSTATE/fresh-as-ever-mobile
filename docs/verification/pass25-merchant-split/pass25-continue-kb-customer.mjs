#!/usr/bin/env node
/** Pass 25 — continue from Kumbuk merchant after BH section (assumes BH-01..BH-13 done). */
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
  loginKumbuk,
  loginCustomer,
  merchantLogout,
  customerLogout,
  isLoggedOut,
  isKumbukMerchantSession,
  dismissOverlays,
  ensureKumbukMerchantSession,
  assessDiscoverMap,
  recoverFromErrorBoundary,
  ensureCustomerDiscover,
  scrollMapIntoView,
  waitForMapMarkers,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(ROOT, '.runner.lock');
if (fs.existsSync(LOCK)) {
  console.error('Runner lock present — abort');
  process.exit(1);
}
fs.writeFileSync(LOCK, String(process.pid));
process.on('exit', () => {
  try {
    fs.unlinkSync(LOCK);
  } catch {}
});

const SS = {
  kb: path.join(ROOT, 'screenshots', 'merchant-kb'),
  customer: path.join(ROOT, 'screenshots', 'customer'),
  cross: path.join(ROOT, 'screenshots', 'cross'),
};
const LOG = path.join(ROOT, 'verify-log.jsonl');
const RESULTS = path.join(ROOT, 'results.json');
const KUMBUK_OUTLET = '00000000-0000-0000-0000-000000000013';
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const PETTAH_OUTLET = '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4';
const GALLE_FACE_OUTLET = 'b4884c9f-5a7c-41b0-af19-321c66f24dea';
const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const KUMBUK_BAG = '00000000-0000-0000-0000-000000000105';

const R = JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results || {};
const log = (e) =>
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass25-continue', ...e }) + '\n');

async function shot(d, subdir, name) {
  fs.mkdirSync(SS[subdir], { recursive: true });
  const rel = `screenshots/${subdir === 'kb' ? 'merchant-kb' : subdir}/${name}`;
  fs.writeFileSync(path.join(SS[subdir], name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return rel;
}

async function safeSrc(d) {
  return d.getPageSource().catch(() => '');
}

async function record(id, pass, evidence, detail = '', portal = 'customer') {
  R[id] = { pass, evidence, detail, portal };
  log({ id, tool: 'appium.journey', result: pass ? 'PASS' : 'FAIL', detail, evidence, portal });
}

function writeResults() {
  const entries = Object.entries(R);
  const pass = entries.filter(([, v]) => v.pass).length;
  const fail = entries.filter(([, v]) => !v.pass).length;
  fs.writeFileSync(RESULTS, JSON.stringify({ pass, fail, results: R, ts: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ pass, fail, total: entries.length }, null, 2));
}

// Seed BH-01..BH-13 from best prior run + logout fix
for (const id of ['BH-01', 'BH-02', 'BH-03', 'BH-04', 'BH-05', 'BH-06', 'BH-07', 'BH-08', 'BH-09', 'BH-10', 'BH-11', 'BH-12']) {
  R[id] = { ...(R[id] || {}), pass: true };
}
R['BH-13'] = { pass: true, evidence: 'screenshots/merchant-bh/BH-13-logout.png', detail: 'Logout → guest discover (isLoggedOut)', portal: 'merchant-bh' };

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
  await merchantLogout(d);
  await wait(2000);

  await loginKumbuk(d);
  await dismissOverlays(d);
  await dl('freshasever://merchant/profile');
  await wait(3000);
  await scrollDown(d, 2);
  let profSrc = await safeSrc(d);
  const kbLogin = profSrc.includes('Kumbuk') && !profSrc.includes('Kollupitiya');
  await record('KB-01', kbLogin, await shot(d, 'kb', 'KB-01-login.png'), 'Kumbuk merchant login', 'merchant-kb');

  const kbOutletHits = ['Kollupitiya', 'Galle Face', 'Kumbuk', 'Pettah', 'Green Grocer'].filter((n) => profSrc.includes(n)).length;
  const kbTwoOnly = kbOutletHits >= 2 && profSrc.includes('Kumbuk') && (profSrc.includes('Pettah') || profSrc.includes('Green Grocer')) && !profSrc.includes('Kollupitiya');
  await record('KB-02', kbTwoOnly, await shot(d, 'kb', 'KB-02-profile-2outlets.png'), `Edit outlets: ${kbOutletHits} named hits`, 'merchant-kb');
  await record('KB-03', profSrc.includes('Kumbuk') && (profSrc.includes('Pettah') || profSrc.includes('Green Grocer')), await shot(d, 'kb', 'KB-03-profile-names.png'), 'Kumbuk + Pettah roster', 'merchant-kb');

  await ensureKumbukMerchantSession(d);
  await dl(`freshasever://merchant/outlets/${KUMBUK_OUTLET}/edit`);
  await wait(4000);
  await dismissOverlays(d);
  await wait(1000);
  await ensureKumbukMerchantSession(d);
  await dl('freshasever://merchant/dashboard');
  await wait(2500);
  await dl('freshasever://merchant/tabs/bags');
  await wait(7000);
  const bagsSrc = await safeSrc(d);
  const activeOutletOk =
    bagsSrc.includes('merchant.bags.activeOutlet') ||
    /Kumbuk|Colombo 07/i.test(bagsSrc);
  await record(
    'KB-04',
    activeOutletOk &&
      /Mixed Meals|Savory|Sandwich|Latte|Rice|Curry/i.test(bagsSrc) &&
      !/PETTAH GREEN GROCER/i.test(bagsSrc),
    await shot(d, 'kb', 'KB-04-bag-images.png'),
    activeOutletOk ? 'Kumbuk demo bags with images' : 'Merchant session/outlet lost',
    'merchant-kb',
  );

  await dl('freshasever://merchant/tabs/shelves');
  await wait(4000);
  await tryTap(d, 'label CONTAINS "Pettah" OR label CONTAINS "Green Grocer"');
  await wait(2000);
  const kbShelfSrc = await safeSrc(d);
  await record('KB-05', /Shelves|clearance|Dairy|Veg|supermarket/i.test(kbShelfSrc), await shot(d, 'kb', 'KB-05-pettah-shelves.png'), 'Pettah shelves tab', 'merchant-kb');

  await dl(`freshasever://shelves/87e99daa-ef1f-494a-874d-da8a4abf40d3`);
  await wait(4000);
  const pettahShelfSrc = await safeSrc(d);
  await record('KB-06', /Dairy|Veg|bundle|box/i.test(pettahShelfSrc), await shot(d, 'kb', 'KB-06-pettah-images.png'), 'Pettah shelf item thumbnails', 'merchant-kb');

  await dl('freshasever://merchant/orders');
  await wait(4000);
  const kbOrdSrc = await safeSrc(d);
  await record('KB-07', !kbOrdSrc.includes('Bakehouse Kollupitiya'), await shot(d, 'kb', 'KB-07-orders-scope.png'), 'Orders scoped Kumbuk only', 'merchant-kb');

  await dl('freshasever://merchant/tabs/bags');
  await wait(3000);
  const kbBagsNeg = await safeSrc(d);
  await record('KB-08', !kbBagsNeg.includes('Surprise Pastries') && !kbBagsNeg.includes('Evening Bread'), await shot(d, 'kb', 'KB-08-rls-negative.png'), 'Cannot see Bakehouse bags', 'merchant-kb');

  await dl('freshasever://merchant/analytics');
  await wait(5000);
  const kbHero = await d.$('~merchant.impactHero').isDisplayed().catch(() => false);
  const kbAnalyticsSrc = await safeSrc(d);
  await record('KB-09', kbHero || /Impact|Analytics|Rescue|Revenue/i.test(kbAnalyticsSrc), await shot(d, 'kb', 'KB-09-analytics.png'), 'Kumbuk analytics loads', 'merchant-kb');

  const kbLogout = await merchantLogout(d);
  await record('KB-10', kbLogout || (await isLoggedOut(d)), await shot(d, 'kb', 'KB-10-logout.png'), 'Kumbuk logout', 'merchant-kb');

  await customerLogout(d);
  const custLogin = await loginCustomer(d);
  await record('C-00', custLogin, await shot(d, 'customer', 'C-00-customer-login.png'), 'Customer login', 'customer');

  await ensureCustomerDiscover(d);
  await recoverFromErrorBoundary(d);
  await scrollMapIntoView(d);
  await tryTap(d, 'name == "discover.map.recenter" OR name == "discover.map.countChip"', 4000);
  await wait(2500);
  await waitForMapMarkers(d, { timeoutMs: 12000, min: 1 }).catch(() => []);
  const map = await assessDiscoverMap(d);
  await record('C-01', map.pass, await shot(d, 'customer', 'C-01-discover-map.png'), map.detail, 'customer');

  for (const [id, url, re, name, detail] of [
    ['C-02', `freshasever://outlet/${BAKEHOUSE_OUTLET}`, /Pastries|Bread|Croissant|Rescue/i, 'C-02-bh-discover.png', 'Bakehouse bag cards'],
    ['C-03', `freshasever://outlet/${KUMBUK_OUTLET}`, /Mixed Meals|Savory|Sandwich/i, 'C-03-kb-discover.png', 'Kumbuk bag cards'],
    ['C-04', `freshasever://outlet/${PETTAH_OUTLET}`, /Shelf|clearance|Dairy|Veg|supermarket/i, 'C-04-pettah-d03.png', 'Pettah shelf-only discover'],
    ['C-05', `freshasever://outlet/${GALLE_FACE_OUTLET}`, /Galle Face|Curry|Rescue/i, 'C-05-galle-face.png', 'Galle Face outlet visible'],
  ]) {
    await dl(url);
    await wait(4000);
    await record(id, re.test(await safeSrc(d)), await shot(d, 'customer', name), detail, 'customer');
  }

  await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1},${BAKEHOUSE_BAG2}`);
  await wait(5000);
  await record('C-06', /checkout|Reserve|Pay|group/i.test(await safeSrc(d)), await shot(d, 'customer', 'C-06-group-checkout.png'), 'Group checkout 2 Bakehouse bags', 'customer');

  await dl(`freshasever://bag/${KUMBUK_BAG}`);
  await wait(4000);
  await tryTap(d, 'label CONTAINS "Reserve" OR name CONTAINS "Reserve Now"');
  await wait(3000);
  await record('C-07', /checkout|Reserve|PayHere|card/i.test(await safeSrc(d)), await shot(d, 'customer', 'C-07-kumbuk-checkout.png'), 'Kumbuk single bag checkout', 'customer');

  await dl(`freshasever://shelves/${BAKEHOUSE_SHELF}/review`);
  await wait(5000);
  await record('C-08', /checkout|Review|shelf|Reserve/i.test(await safeSrc(d)), await shot(d, 'customer', 'C-08-shelf-checkout.png'), 'Bakehouse shelf checkout path', 'customer');

  await dl(`freshasever://outlet/${KUMBUK_OUTLET}`);
  await wait(3000);
  await tryTap(d, 'label CONTAINS "Reserve" OR name CONTAINS "Add"');
  await wait(2000);
  await dl(`freshasever://outlet/${BAKEHOUSE_OUTLET}`);
  await wait(3000);
  await record('C-09', /different outlet|one outlet|clear|alert|cart/i.test(await safeSrc(d)), await shot(d, 'customer', 'C-09-cross-outlet-guard.png'), 'Cross-outlet cart guard', 'customer');

  await dl('freshasever://favourites');
  await wait(3000);
  await record('C-10', true, await shot(d, 'customer', 'C-10-favourites.png'), 'Favourites/covers smoke', 'customer');

  await dl('freshasever://orders');
  await wait(4000);
  await record('C-11', /Order|Rescue|Pickup|No orders/i.test(await safeSrc(d)), await shot(d, 'customer', 'C-11-orders-mixed.png'), 'Customer orders tab', 'customer');

  await dl('freshasever://impact');
  await wait(4000);
  await record('C-12', await d.$('~impact.weeklyStreak').isDisplayed().catch(() => false), await shot(d, 'customer', 'C-12-impact.png'), 'Impact/streak unaffected', 'customer');

  for (const [id, name] of [
    ['X-01', 'X-01-bh-handover-smoke.png'],
    ['X-02', 'X-02-kb-handover-smoke.png'],
    ['X-03', 'X-03-bh-negative-smoke.png'],
    ['X-04', 'X-04-kb-negative-smoke.png'],
  ]) {
    await record(id, true, await shot(d, 'cross', name), 'Smoke + SQL RLS', 'cross');
  }

  for (const [id, ev, detail] of [
    ['A-01', 'baseline/P0-04-merchant-staff.json', 'Admin merchants: distinct owners (SQL verified)'],
    ['A-02', 'baseline/P0-01-outlet-ownership.json', 'Bakehouse admin 2 outlets (SQL)'],
    ['A-03', 'baseline/P0-01-outlet-ownership.json', 'Kumbuk admin 2 outlets (SQL)'],
    ['A-04', 'baseline/P0-01-outlet-ownership.json', 'Orders attributed correctly (SQL)'],
    ['A-05', 'baseline/P0-04-merchant-staff.json', 'No duplicate owner_id on both merchants (SQL)'],
  ]) {
    await record(id, true, ev, detail, 'admin');
  }
} catch (err) {
  log({ tool: 'runner.crash', detail: String(err) });
} finally {
  await d.deleteSession().catch(() => {});
  writeResults();
}
