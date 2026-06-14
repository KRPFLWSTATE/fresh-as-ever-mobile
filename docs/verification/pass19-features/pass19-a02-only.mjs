#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const SS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots', 'pass19', 'pass3');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const dl = (u) => { execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' }); return new Promise((r) => setTimeout(r, 4000)); };

const d = await remote({
  hostname: '127.0.0.1', port: 4723,
  capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': 'com.freshasever.mobile', 'appium:noReset': true },
});
try {
  await dl('freshasever://login?portal=customer');
  await d.pause(3000);
  const emailMode = await d.$('-ios predicate string:label == "Use email & password instead"');
  if (await emailMode.isDisplayed().catch(() => false)) {
    await emailMode.click();
    await d.pause(1500);
  }
  const fields = await d.$$('-ios class chain:**/XCUIElementTypeTextField');
  const secure = await d.$$('-ios class chain:**/XCUIElementTypeSecureTextField');
  console.log('fields', fields.length, 'secure', secure.length);
  if (fields[0]) { await fields[0].click(); await fields[0].setValue('qa.customer@freshasever.test'); }
  await d.pause(500);
  if (secure[0]) { await secure[0].click(); await secure[0].setValue('TempCustomer#12345'); }
  await d.pause(500);
  try { await d.hideKeyboard(); } catch {}
  try { await d.execute('mobile: hideKeyboard', {}); } catch {}
  await d.pause(800);
  const signIn = await d.$('-ios predicate string:label == "Sign in"');
  console.log('signIn', await signIn.isDisplayed().catch(() => false));
  if (await signIn.isDisplayed().catch(() => false)) await signIn.click();
  await d.pause(8000);
  await dl('freshasever://impact');
  await d.pause(4000);
  try { await d.execute('mobile: swipe', { direction: 'down', velocity: 2500 }); } catch {}
  await d.pause(3000);
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, 'A-02-impact-streak.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
  const src = await d.getPageSource();
  console.log('signed in?', !src.includes('Sign in to see your rescue footprint'));
  console.log('2/3?', /2\s*\/\s*3/.test(src));
} finally { await d.deleteSession(); }
