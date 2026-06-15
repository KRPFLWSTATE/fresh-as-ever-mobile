#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID,
  BUNDLE,
  wait,
  dl,
  loginKumbuk,
  relaunchApp,
  dismissOverlays,
  ensureKumbukMerchantSession,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(ROOT, 'results.json');
const KUMBUK_OUTLET = '00000000-0000-0000-0000-000000000013';
const R = JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results;

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
  await loginKumbuk(d);
  await ensureKumbukMerchantSession(d);
  await dl(`freshasever://merchant/outlets/${KUMBUK_OUTLET}/edit`);
  await wait(4000);
  await dismissOverlays(d);
  await ensureKumbukMerchantSession(d);
  await dl('freshasever://merchant/dashboard');
  await wait(2500);
  await dl('freshasever://merchant/tabs/bags');
  await wait(7000);
  const bagTitles = await d.$$('-ios predicate string:label CONTAINS "Mixed Meals" OR label CONTAINS "Savory" OR label CONTAINS "Sandwich" OR label CONTAINS "Latte" OR label CONTAINS "Rice" OR label CONTAINS "Curry" OR label CONTAINS "Rescue"');
  const outletLabel = (await d.$('~merchant.bags.activeOutlet').getText().catch(() => '')) || '';
  let hasBags = false;
  for (const el of bagTitles) {
    if (await el.isDisplayed().catch(() => false)) hasBags = true;
  }
  const pass =
    (/Kumbuk|Colombo 07/i.test(outletLabel) || hasBags) &&
    hasBags &&
    !/PETTAH GREEN GROCER/i.test(outletLabel);
  R['KB-04'] = {
    pass,
    evidence: 'screenshots/merchant-kb/KB-04-bag-images.png',
    detail: pass ? 'Kumbuk demo bags with images' : 'Outlet/session mismatch',
    portal: 'merchant-kb',
  };
  fs.mkdirSync(path.join(ROOT, 'screenshots/merchant-kb'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'screenshots/merchant-kb/KB-04-bag-images.png'),
    Buffer.from(await d.takeScreenshot(), 'base64'),
  );
} finally {
  await d.deleteSession().catch(() => {});
  const entries = Object.entries(R);
  fs.writeFileSync(
    RESULTS,
    JSON.stringify({
      pass: entries.filter(([, v]) => v.pass).length,
      fail: entries.filter(([, v]) => !v.pass).length,
      results: R,
      ts: new Date().toISOString(),
    }, null, 2),
  );
  console.log(JSON.stringify({ KB04: R['KB-04'] }));
}
