#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';

const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  execSync(`xcrun simctl openurl ${UDID} "freshasever://profile/notifications"`, { stdio: 'pipe' });
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
    },
  });
  try {
    const src = await driver.getPageSource();
    const pass = /Monthly impact|monthly_impact|LKR|Environmental Impact/i.test(src);
    console.log(JSON.stringify({ id: 'F7-C01', pass, len: src.length }));
    process.exit(pass ? 0 : 1);
  } finally {
    await driver.deleteSession().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
