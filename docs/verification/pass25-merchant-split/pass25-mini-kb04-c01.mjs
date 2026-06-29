#!/usr/bin/env node
/** Minimal KB-04 + C-01 validation. */
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
  loginKumbuk,
  loginCustomer,
  merchantLogout,
  customerLogout,
  dismissOverlays,
  ensureKumbukMerchantSession,
  ensureCustomerDiscover,
  recoverFromErrorBoundary,
  scrollMapIntoView,
  assessDiscoverMap,
  waitForMapMarkers,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const KUMBUK_OUTLET = '00000000-0000-0000-0000-000000000013';
const safeSrc = async (d) => d.getPageSource().catch(() => '');

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

const out = {};
try {
  await merchantLogout(d).catch(() => {});
  await wait(1500);
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
  const bagsSrc = await safeSrc(d);
  out.KB04 = {
    pass:
      /Kumbuk|Colombo 07/i.test(bagsSrc) &&
      /Mixed Meals|Savory|Sandwich|Latte|Rice|Curry/i.test(bagsSrc) &&
      !/PETTAH GREEN GROCER/i.test(bagsSrc),
    snippet: bagsSrc.slice(0, 500),
  };

  await merchantLogout(d).catch(() => {});
  await customerLogout(d).catch(() => {});
  await wait(2000);
  await loginCustomer(d);
  await ensureCustomerDiscover(d);
  await recoverFromErrorBoundary(d);
  await scrollMapIntoView(d);
  await tryTap(d, 'name == "discover.map.recenter" OR name == "discover.map.countChip"', 4000);
  await wait(2500);
  await waitForMapMarkers(d, { timeoutMs: 10000, min: 1 }).catch(() => []);
  out.C01 = await assessDiscoverMap(d);
} finally {
  await d.deleteSession().catch(() => {});
  console.log(JSON.stringify(out, null, 2));
}
