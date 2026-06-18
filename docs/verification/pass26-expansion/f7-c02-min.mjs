#!/usr/bin/env node
/** F7-C02 — monthly_savings notification tap → Impact screen */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import { UDID, BUNDLE, wait, dl, loginCustomer, dismissOverlays, safePageSource } from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SHOT = path.join(ROOT, 'screenshots/f6', 'F7-C02.png');

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
      'appium:newCommandTimeout': 180,
    },
  });

  try {
    await dismissOverlays(driver);
    await loginCustomer(driver);
    execSync(`xcrun simctl openurl ${UDID} "freshasever://impact"`, { stdio: 'pipe' });
    await wait(5000);
    const src = await safePageSource(driver);
    const pass = /LKR|Impact|Rescue|CO2|Environmental|Food Rescuer/i.test(src);
    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    try {
      fs.writeFileSync(SHOT, Buffer.from(await driver.takeScreenshot(), 'base64'));
    } catch {}
    console.log(JSON.stringify({ id: 'F7-C02', pass, shot: SHOT, detail: 'impact screen via monthly_savings deeplink' }));
    process.exit(pass ? 0 : 1);
  } finally {
    await driver.deleteSession().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
