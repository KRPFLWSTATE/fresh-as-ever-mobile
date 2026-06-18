#!/usr/bin/env node
/** F7-R02 — Pass25 customer profile smoke */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SHOT = path.join(ROOT, 'screenshots/f6', 'F7-R02.png');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  execSync(`xcrun simctl openurl ${UDID} "freshasever://profile"`, { stdio: 'pipe' });
  await wait(5000);

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
    const src = await driver.getPageSource();
    const pass = /ProfileScreen|Your Impact|Account Details|tab\.profile.*selected/i.test(src) && !/discover\.list-feed|Welcome Back/i.test(src);
    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    try {
      fs.writeFileSync(SHOT, Buffer.from(await driver.takeScreenshot(), 'base64'));
    } catch {}
    console.log(JSON.stringify({ id: 'F7-R02', pass, shot: SHOT, detail: 'profile regression', sample: src.slice(0, 300) }));
    process.exit(pass ? 0 : 1);
  } finally {
    await driver.deleteSession().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
