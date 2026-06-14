#!/usr/bin/env node
/** B-15 only — warm path + basketExpired=1 after shelf loads */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19', 'pass7');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const OUTLET = '00000000-0000-0000-0000-000000000003';
const SHELF = '00000000-0000-0000-0000-000000000201';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const dl = (u) => execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });

async function login(d) {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  dl('freshasever://discover');
  await wait(5000);
  if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  dl('freshasever://login?portal=customer');
  await wait(3000);
  const ue = await d.$('~login.useEmailPassword');
  if (await ue.isDisplayed().catch(() => false)) await ue.click();
  await wait(800);
  await d.$('~login.email').setValue('qa.customer@freshasever.test');
  await d.$('~login.password').setValue('TempCustomer#12345');
  await d.$('~login.signIn').click();
  for (let i = 0; i < 24; i++) {
    await wait(1500);
    if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  }
  return false;
}

async function warmOpenShelf(d) {
  dl(`freshasever://outlet/${OUTLET}`);
  await wait(7000);
  const card = await d.$('-ios predicate string:label CONTAINS "clearance shelf"');
  if (await card.isDisplayed().catch(() => false)) await card.click();
  else dl(`freshasever://shelves/${SHELF}`);
  await wait(12000);
}

async function waitContent(d) {
  for (let i = 0; i < 40; i++) {
    if (await d.$('~shelf.content').isDisplayed().catch(() => false)) return true;
    const src = await d.getPageSource().catch(() => '');
    if (src.includes("Today's clearance shelf") && !src.includes('Loading shelf')) return true;
    await wait(1000);
  }
  return false;
}

async function bannerVisible(d) {
  const src = await d.getPageSource().catch(() => '');
  if (/Prices refreshed/i.test(src)) return true;
  if (await d.$('~shelf.basketExpiredBanner').isDisplayed().catch(() => false)) return true;
  return false;
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
  },
});

try {
  if (!(await login(d))) throw new Error('auth failed');
  await warmOpenShelf(d);
  if (!(await waitContent(d))) throw new Error('shelf timeout');
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, 'B-15-before-seed.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
  dl(`freshasever://shelves/${SHELF}?basketExpired=1`);
  await wait(8000);
  await waitContent(d);
  await wait(2000);
  const pass = await bannerVisible(d);
  fs.writeFileSync(path.join(SS, 'B-15-after-seed.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
  console.log(JSON.stringify({ pass, banner: pass }));
} finally {
  await d.deleteSession().catch(() => {});
}
