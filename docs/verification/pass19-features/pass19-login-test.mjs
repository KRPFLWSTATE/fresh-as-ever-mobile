#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19', 'pass3');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const dl = (u) => { execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' }); return new Promise((r) => setTimeout(r, 3500)); };

const d = await remote({
  hostname: '127.0.0.1', port: 4723,
  capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': BUNDLE, 'appium:noReset': true },
});
try {
  await dl('freshasever://discover');
  const cta = await d.$('~discover.guestSignInCta');
  console.log('guest cta', await cta.isDisplayed().catch(() => false));
  if (await cta.isDisplayed().catch(() => false)) await cta.click();
  else {
    const tab = await d.$('-ios predicate string:label == "Profile"');
    if (await tab.isDisplayed().catch(() => false)) { await tab.click(); await d.pause(2000); }
    const pSign = await d.$('~profile.guestSignIn');
    console.log('profile sign', await pSign.isDisplayed().catch(() => false));
    if (await pSign.isDisplayed().catch(() => false)) await pSign.click();
  }
  await d.pause(3000);
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, 'login-screen.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
  const src = await d.getPageSource();
  const hasEmail = src.includes('Email') || src.includes('TextField');
  console.log('on login screen', hasEmail);
  const fields = await d.$$('-ios class chain:**/XCUIElementTypeTextField');
  const secure = await d.$$('-ios class chain:**/XCUIElementTypeSecureTextField');
  console.log('fields', fields.length, 'secure', secure.length);
} finally { await d.deleteSession(); }
