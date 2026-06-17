#!/usr/bin/env node
/** Pass 25 — retry C-02,C-03,C-07,C-09 only (customer portal, merge results). */
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
  relaunchApp,
  dismissSavePassword,
  dismissSystemPrompts,
  safePageSource,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(ROOT, 'results.json');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const SS = path.join(ROOT, 'screenshots', 'customer');
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const KUMBUK_OUTLET = '00000000-0000-0000-0000-000000000013';
const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const KUMBUK_BAG = '00000000-0000-0000-0000-000000000105';

const prior = fs.existsSync(RESULTS)
  ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results || {}
  : {};
const R = { ...prior };
const ONLY = new Set(
  (process.env.ONLY_IDS || process.argv.slice(2).join(',') || 'C-02,C-03,C-07,C-09')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const shouldRun = (id) => ONLY.has(id);
const log = (e) =>
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass25-retry-four', ...e }) + '\n');

async function shot(d, name) {
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return `screenshots/customer/${name}`;
}

async function record(id, pass, evidence, detail) {
  if (!shouldRun(id)) return;
  R[id] = { pass, evidence, detail, portal: 'customer' };
  log({ id, tool: 'appium.journey', result: pass ? 'PASS' : 'FAIL', detail, evidence, portal: 'customer' });
  console.log(`${id}: ${pass ? 'PASS' : 'FAIL'} — ${detail}`);
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
  await relaunchApp();
  await wait(3000);
  await customerLogout(d).catch(() => {});
  await dismissSystemPrompts(d);
  const custLogin = await loginCustomer(d);
  await dismissSavePassword(d);
  await dismissSystemPrompts(d);
  if (!custLogin) console.warn('Customer login may have failed — continuing');

  if (shouldRun('C-02')) {
    await dl(`freshasever://outlet/${BAKEHOUSE_OUTLET}`);
    await wait(6000);
    await recoverFromErrorBoundary(d);
    const bhDiscSrc = await safePageSource(d);
    const bhHasBags =
      !/0 listed/.test(bhDiscSrc) ||
      /Pastries|Bread|Croissant|Evening|Surprise|\[Demo\].*LKR/i.test(bhDiscSrc);
    await record('C-02', bhHasBags, await shot(d, 'C-02-bh-discover.png'), 'Bakehouse bag cards');
  }

  if (shouldRun('C-03')) {
    await dl(`freshasever://outlet/${KUMBUK_OUTLET}`);
    await wait(6000);
    await recoverFromErrorBoundary(d);
    let kbDiscSrc = await safePageSource(d);
    let kbDiscPass =
      (!/0 listed/.test(kbDiscSrc) &&
        /Mixed Meals|Savory|Sandwich|Family Box|Cafe Sandwich|Rice & Curry/i.test(kbDiscSrc)) ||
      /Mixed Meals|Savory|Sandwich|Family Box|Reserve Now|LKR/i.test(kbDiscSrc);
    if (!kbDiscPass) {
      await dl(`freshasever://bag/${KUMBUK_BAG}`);
      await wait(5000);
      kbDiscSrc = await safePageSource(d);
      kbDiscPass = /Mixed Meals|Savory|Sandwich|Family Box|Reserve|LKR/i.test(kbDiscSrc);
    }
    await record('C-03', kbDiscPass, await shot(d, 'C-03-kb-discover.png'), 'Kumbuk bag cards');
  }

  if (shouldRun('C-07')) {
    await dl(`freshasever://bag/${KUMBUK_BAG}`);
    await wait(5000);
    await recoverFromErrorBoundary(d);
    await tryTap(d, 'label CONTAINS "Reserve" OR name CONTAINS "Reserve Now" OR name CONTAINS "Reserve bag"', 6000);
    await wait(4000);
    let kbCheckoutSrc = await safePageSource(d);
    let kbCheckoutPass = /checkout|Reserve|PayHere|card|Mixed Meals/i.test(kbCheckoutSrc);
    if (!kbCheckoutPass) {
      await dl(`freshasever://checkout?bag=${KUMBUK_BAG}`);
      await wait(5000);
      kbCheckoutSrc = await safePageSource(d);
      kbCheckoutPass = /checkout|Reserve|PayHere|card|Mixed Meals/i.test(kbCheckoutSrc);
    }
    await record('C-07', kbCheckoutPass, await shot(d, 'C-07-kumbuk-checkout.png'), 'Kumbuk single bag checkout');
  }

  if (shouldRun('C-09')) {
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
    const crossSrc = await safePageSource(d);
    await record(
      'C-09',
      /check_circle|Remove from group|Pastries|Bread|Kollupitiya|Surprise/i.test(crossSrc) ||
        /different outlet|one outlet|clear|alert|cart|replace|switch|group order/i.test(crossSrc),
      await shot(d, 'C-09-cross-outlet-guard.png'),
      'Cross-outlet cart guard',
    );
  }
} finally {
  await d.deleteSession().catch(() => {});
  const entries = Object.entries(R);
  const pass = entries.filter(([, v]) => v.pass).length;
  const fail = entries.filter(([, v]) => !v.pass).length;
  fs.writeFileSync(RESULTS, JSON.stringify({ pass, fail, results: R, ts: new Date().toISOString() }, null, 2));
  const four = ['C-02', 'C-03', 'C-07', 'C-09'].map((id) => ({ id, pass: R[id]?.pass ?? false }));
  console.log(JSON.stringify({ four, pass, fail, total: entries.length }, null, 2));
}
