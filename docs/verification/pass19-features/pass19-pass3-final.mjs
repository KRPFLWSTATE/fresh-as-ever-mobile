#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const SS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots', 'pass19', 'pass3');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const dl = (u) => { execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' }); return new Promise((r) => setTimeout(r, 3500)); };

const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': 'com.freshasever.mobile', 'appium:noReset': true } });
try {
  await dl('freshasever://login?portal=customer');
  await d.pause(3000);
  const emailMode = await d.$('-ios predicate string:label == "Use email & password instead"');
  if (await emailMode.isDisplayed().catch(() => false)) { await emailMode.click(); await d.pause(1200); }
  const email = await d.$('-ios predicate string:placeholderValue CONTAINS "@" OR label == "Email"');
  const fields = await d.$$('-ios class chain:**/XCUIElementTypeTextField');
  if (fields[0]) { await fields[0].click(); await fields[0].setValue('qa.customer@freshasever.test'); }
  await d.pause(400);
  const secure = await d.$$('-ios class chain:**/XCUIElementTypeSecureTextField');
  if (secure[0]) {
    await secure[0].click();
    await secure[0].addValue('TempCustomer#12345');
  } else {
    await d.performActions([{ type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value: 'TempCustomer#12345' }, { type: 'keyUp', value: 'TempCustomer#12345' }] }]);
  }
  await d.pause(500);
  try { await d.hideKeyboard(); } catch {}
  const signIn = await d.$('-ios predicate string:label == "Sign in" AND type == "XCUIElementTypeButton"');
  await signIn.click();
  await d.pause(8000);
  await dl('freshasever://impact');
  await d.pause(4000);
  try { await d.execute('mobile: swipe', { direction: 'down', velocity: 2500 }); } catch {}
  await d.pause(2500);
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, 'A-02-impact-streak.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
  const src = await d.getPageSource();
  console.log('logged in', !src.includes('Sign in to see your rescue footprint'));
  console.log('2/3', /2\s*\/\s*3/.test(src));

  inject();
  await dl('freshasever://checkout?group=00000000-0000-0000-0000-000000000004,00000000-0000-0000-0000-000000000014');
  await d.pause(5000);
  fs.writeFileSync(path.join(SS, 'B-07-overlap-error.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
  console.log('overlap', /different pickup windows/i.test(await d.getPageSource()));
} finally { await d.deleteSession(); }

function inject() {
  const c = execSync(`xcrun simctl get_app_container ${UDID} com.freshasever.mobile data`, { encoding: 'utf8' }).trim();
  const mp = path.join(c, 'Library', 'Application Support', 'RCTAsyncLocalStorage_V1', 'manifest.json');
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  m['fae.reservationCart.v1'] = JSON.stringify({ outletId: '00000000-0000-0000-0000-000000000003', bagIds: ['00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000014'], bags: [] });
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  fs.writeFileSync(mp, JSON.stringify(m));
}
