#!/usr/bin/env node
/** Pass 25 — C-00 customer login smoke only (gate for pass26 marathon). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import { UDID, BUNDLE, loginCustomer } from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'customer');

async function shot(d, name) {
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, name), Buffer.from(await d.takeScreenshot(), 'base64'));
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
  const ok = await loginCustomer(d);
  const searchVisible = await d.$('~discover.searchInput').isDisplayed().catch(() => false);
  const profileLogOut = await d.$('~profile.logOut').isDisplayed().catch(() => false);
  const pass = ok;
  await shot(d, 'C-00-customer-login.png');
  console.log(JSON.stringify({ id: 'C-00', pass, searchVisible, profileLogOut, loginCustomer: ok }));
  process.exitCode = pass ? 0 : 1;
} finally {
  await d.deleteSession().catch(() => {});
}
