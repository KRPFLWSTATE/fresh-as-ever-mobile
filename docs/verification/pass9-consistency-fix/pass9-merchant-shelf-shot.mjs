#!/usr/bin/env node
/** Pass9 merchant shelf editor screenshot — one-shot Appium capture */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const SHELF_ID = 'c1a5d13b-e10d-4788-aab8-50867430a1cb';

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 2500));
};

async function dismissKeyboard(d) {
  try { await d.hideKeyboard(); } catch {}
  try { await d.execute('mobile: hideKeyboard', {}); } catch {}
  await d.pause(400);
}

async function merchantLogin(d) {
  await dl('freshasever://login?portal=merchant');
  await d.pause(2000);
  const fields = await d.$$('-ios class chain:**/XCUIElementTypeTextField');
  const secure = await d.$$('-ios class chain:**/XCUIElementTypeSecureTextField');
  if (fields[0]) await fields[0].setValue('qa.merchant@freshasever.test');
  await dismissKeyboard(d);
  if (secure[0]) await secure[0].setValue('TempMerchant#12345');
  await dismissKeyboard(d);
  const signIn = await d.$('-ios predicate string:name CONTAINS "Sign in as merchant"');
  await signIn.waitForDisplayed({ timeout: 15000 });
  await signIn.click();
  await d.pause(5000);
  return d.getPageSource();
}

async function main() {
  fs.mkdirSync(SS, { recursive: true });
  const d = await remote({
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
    let src = await merchantLogin(d);
    const loggedIn = src.includes("Today's Summary") || src.includes('tab.merchant.shelves');
    if (!loggedIn) {
      console.log('BLOCKED: merchant login did not reach dashboard');
      fs.writeFileSync(path.join(SS, '12-merchant-login-blocked.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
      process.exitCode = 2;
      return;
    }
    await dl(`freshasever://merchant/shelves/${SHELF_ID}/edit`);
    await d.pause(3500);
    src = await d.getPageSource();
    const onEditor = src.includes('Publish') || src.includes('Save draft') || src.includes('Shelf editor');
    fs.writeFileSync(
      path.join(SS, onEditor ? '12-merchant-shelf-editor-after-fix.png' : '12-merchant-shelf-editor-blocked.png'),
      Buffer.from(await d.takeScreenshot(), 'base64'),
    );
    console.log(onEditor ? 'PASS: merchant shelf editor screenshot captured' : 'PARTIAL: screenshot captured but editor not confirmed');
  } finally {
    await d.deleteSession();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
