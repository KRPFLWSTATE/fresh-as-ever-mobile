#!/usr/bin/env node
/** F7-R02 — Pass25 customer profile smoke */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID, BUNDLE, wait, loginCustomer, merchantLogout, dismissOverlays, safePageSource, isMerchantLoggedIn,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SHOT = path.join(ROOT, 'screenshots/f6', 'F7-R02.png');

async function main() {
  const driver = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': UDID,
      'appium:bundleId': BUNDLE,
      'appium:noReset': true,
      'appium:newCommandTimeout': 240,
    },
  });

  try {
    await dismissOverlays(driver);
    if (await isMerchantLoggedIn(driver)) await merchantLogout(driver);
    const logged = await loginCustomer(driver);
    if (!logged) {
      console.log(JSON.stringify({ id: 'F7-R02', pass: false, detail: 'customer login failed' }));
      process.exit(1);
    }
    execSync(`xcrun simctl openurl ${UDID} "freshasever://profile"`, { stdio: 'pipe' });
    await wait(6000);
    const src = await safePageSource(driver);
    const pass = /Profile|QA Customer|Notifications|Food Rescuer/i.test(src);
    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    try {
      fs.writeFileSync(SHOT, Buffer.from(await driver.takeScreenshot(), 'base64'));
    } catch {}
    console.log(JSON.stringify({ id: 'F7-R02', pass, shot: SHOT, detail: 'profile regression' }));
    process.exit(pass ? 0 : 1);
  } finally {
    await driver.deleteSession().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
