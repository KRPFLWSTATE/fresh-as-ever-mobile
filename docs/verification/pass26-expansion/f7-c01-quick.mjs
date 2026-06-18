#!/usr/bin/env node
/** F7-C01 quick — assumes customer session; no login loop */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import { UDID, BUNDLE, wait, dismissOverlays, safePageSource, dl } from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SHOT = path.join(ROOT, 'screenshots/f7', 'F7-C01.png');

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
      'appium:newCommandTimeout': 120,
    },
  });
  try {
    await dismissOverlays(driver);
    await dl('freshasever://profile/notifications');
    await wait(5000);
    const src = await safePageSource(driver);
    const pass = /Monthly impact|monthly_impact|LKR|Environmental Impact/i.test(src);
    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    try {
      await driver.saveScreenshot(SHOT);
    } catch {
      // screenshot optional when session is flaky
    }
    console.log(JSON.stringify({ id: 'F7-C01', pass, shot: SHOT }));
    process.exit(pass ? 0 : 1);
  } finally {
    await driver.deleteSession().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
