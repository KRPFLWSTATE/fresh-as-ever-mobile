#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID,
  BUNDLE,
  wait,
  tryTap,
  loginCustomer,
  customerLogout,
  ensureCustomerDiscover,
  recoverFromErrorBoundary,
  scrollMapIntoView,
  assessDiscoverMap,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(ROOT, 'results.json');
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
  },
});

try {
  await customerLogout(d).catch(() => {});
  await loginCustomer(d);
  await ensureCustomerDiscover(d);
  await recoverFromErrorBoundary(d);
  await scrollMapIntoView(d);
  await tryTap(d, 'name == "discover.map.recenter" OR name == "discover.map.countChip"', 4000);
  await wait(2500);
  const map = await assessDiscoverMap(d);
  R['C-01'] = {
    pass: map.pass,
    evidence: 'screenshots/customer/C-01-discover-map.png',
    detail: map.detail,
    portal: 'customer',
  };
  fs.mkdirSync(path.join(ROOT, 'screenshots/customer'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'screenshots/customer/C-01-discover-map.png'),
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
  console.log(JSON.stringify({ C01: R['C-01'] }));
}
