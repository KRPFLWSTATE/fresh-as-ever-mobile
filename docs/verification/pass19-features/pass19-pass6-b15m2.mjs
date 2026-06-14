#!/usr/bin/env node
/** B-15 pass4-style inject + terminate + shelves deeplink */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19', 'pass6');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const SHELF = '00000000-0000-0000-0000-000000000201';
const ITEM = '00000000-0000-0000-0000-000000000211';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass6', ...e }) + '\n');
const shot = async (d, n) => {
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, n), Buffer.from(await d.takeScreenshot(), 'base64'));
  return `screenshots/pass19/pass6/${n}`;
};

function inject() {
  execSync(`node ${path.join(ROOT, 'pass19-pass5-inject.mjs')}`, { stdio: 'inherit' });
}

const d = await remote({
  hostname: '127.0.0.1', port: 4723,
  capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': BUNDLE, 'appium:noReset': true },
});

try {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  execSync(`xcrun simctl openurl ${UDID} "freshasever://discover"`, { stdio: 'pipe' });
  await wait(3000);
  if (!(await d.$('~discover.searchInput').isDisplayed().catch(() => false))) {
    execSync(`xcrun simctl openurl ${UDID} "freshasever://login?portal=customer"`, { stdio: 'pipe' });
    await wait(3000);
    try {
      const ue = await d.$('~login.useEmailPassword');
      if (await ue.isDisplayed().catch(() => false)) await ue.click();
      await wait(800);
      await d.$('~login.email').setValue('qa.customer@freshasever.test');
      await d.$('~login.password').setValue('TempCustomer#12345');
      await d.$('~login.signIn').click();
    } catch {}
    for (let i = 0; i < 20; i++) {
      await wait(1500);
      try { const n = await d.$('~Not Now'); if (await n.isDisplayed().catch(() => false)) await n.click(); } catch {}
      if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) break;
    }
  }
  if (!(await d.$('~discover.searchInput').isDisplayed().catch(() => false))) {
    console.log('NOT LOGGED IN');
    process.exit(1);
  }
  log({ id: 'auth', tool: 'appium.journey', result_summary: 'true', evidence: await shot(d, 'auth-logged-in.png') });

  for (let a = 1; a <= 3; a++) {
    inject();
    await d.terminateApp(BUNDLE);
    await wait(800);
    await d.activateApp(BUNDLE);
    await wait(3000);
    execSync(`xcrun simctl openurl ${UDID} "freshasever://shelves/${SHELF}"`, { stdio: 'pipe' });
    await wait(8000);
    const ev = await shot(d, `B-15-attempt${a}-shelf.png`);
    const src = await d.getPageSource().catch(() => '');
    const pass = /Prices refreshed/i.test(src) || (await d.$('~shelf.basketTimer').isDisplayed().catch(() => false));
    log({ id: 'B-15', attempt: a, tool: 'appium.journey', args_summary: 'pass4 inject+terminate+shelves', result_summary: pass ? 'PASS — Prices refreshed / shelf.basketTimer' : 'PARTIAL', evidence: ev });
    if (pass) { console.log('B-15 PASS'); break; }
    execSync(`xcrun simctl openurl ${UDID} "freshasever://discover"`, { stdio: 'pipe' });
    await wait(2000);
  }

  // M2
  execSync(`xcrun simctl openurl ${UDID} "freshasever://discover"`, { stdio: 'pipe' });
  await wait(2000);
  await d.startRecordingScreen({ videoType: 'libx264', videoQuality: 'medium', videoFps: 10 }).catch(() => {});
  execSync(`xcrun simctl openurl ${UDID} "freshasever://shelves/${SHELF}"`, { stdio: 'pipe' });
  await wait(8000);
  await shot(d, 'M2-1-shelf-content.png');
  for (const id of [ITEM, '00000000-0000-0000-0000-000000000212']) {
    const inc = await d.$(`~shelf.qtyIncrement.${id}`);
    if (await inc.isDisplayed().catch(() => false)) { await inc.click(); await wait(500); await inc.click(); break; }
  }
  await shot(d, 'M2-2-shelf-qty-added.png');
  const rev = await d.$('~shelf.reviewBasket');
  let m2 = false;
  if (await rev.isDisplayed().catch(() => false)) {
    await rev.click();
    await wait(4000);
    await shot(d, 'M2-3-shelf-review.png');
    const co = await d.$('-ios predicate string:label CONTAINS "Checkout" OR label CONTAINS "Proceed"');
    if (await co.isDisplayed().catch(() => false)) await co.click();
    await wait(4000);
    await shot(d, 'M2-4-checkout.png');
    const src = await d.getPageSource().catch(() => '');
    m2 = /Pay at Store|Card Payment|checkout\./i.test(src);
  }
  log({ id: 'M2', tool: 'appium.journey', result_summary: m2 ? 'PASS — full macro' : 'PARTIAL', evidence: 'screenshots/pass19/pass6/M2-4-checkout.png' });
  try {
    const b64 = await d.stopRecordingScreen();
    fs.writeFileSync(path.join(SS, 'M2-shelf-checkout-journey.mp4'), Buffer.from(b64, 'base64'));
  } catch {}
  console.log('M2', m2);
} finally {
  await d.deleteSession().catch(() => {});
}
