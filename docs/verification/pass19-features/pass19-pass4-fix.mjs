#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const SS = '/Users/kawinperera/Fresh-as-Ever/fresh-as-ever-mobile/docs/verification/pass19-features/screenshots/pass19/pass4';
const LOG = '/Users/kawinperera/Fresh-as-Ever/fresh-as-ever-mobile/docs/verification/pass19-features/verify-log.jsonl';
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const B = 'com.freshasever.mobile';
const SHELF = '00000000-0000-0000-0000-000000000201';
const ITEM = '00000000-0000-0000-0000-000000000211';
const dl = (u) => { execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' }); return new Promise((r) => setTimeout(r, 4000)); };
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass4-fix', ...e }) + '\n');
const inject = (k, v) => {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${B} data`, { encoding: 'utf8' }).trim();
  const mp = path.join(c, 'Library/Application Support/RCTAsyncLocalStorage_V1/manifest.json');
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  if (v == null) delete m[k]; else m[k] = JSON.stringify(v);
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  fs.writeFileSync(mp, JSON.stringify(m));
};

execSync(`xcrun simctl privacy ${UDID} grant photos ${B}`, { stdio: 'pipe' });
const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': B, 'appium:noReset': true, 'appium:newCommandTimeout': 180 } });
try {
  inject('fae.clearanceBasket.v1', { shelfId: SHELF, items: { [ITEM]: 1 }, startedAtMs: Date.now() - 16 * 60 * 1000 });
  await d.terminateApp(B); await d.pause(800); await d.activateApp(B); await d.pause(3000);
  await dl(`freshasever://shelves/${SHELF}`);
  await d.pause(7000);
  const b15 = /Prices refreshed/i.test(await d.getPageSource());
  fs.writeFileSync(path.join(SS, 'B-15-basket-expired.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
  log({ id: 'B-15', result_summary: b15 ? 'PASS' : 'PARTIAL', evidence: 'screenshots/pass19/pass4/B-15-basket-expired.png' });
  console.log('B-15', b15);

  inject('fae.clearanceBasket.v1', null);
  await dl(`freshasever://shelves/${SHELF}`);
  await d.pause(6000);
  const inc = await d.$(`~shelf.qtyIncrement.${ITEM}`);
  if (await inc.isDisplayed().catch(() => false)) await inc.click();
  await d.pause(1000);
  const rev = await d.$('~shelf.reviewBasket');
  let m2 = false;
  if (await rev.isDisplayed().catch(() => false)) {
    await rev.click(); await d.pause(3500);
    fs.writeFileSync(path.join(SS, 'M2-2-shelf-review.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
    const chk = await d.$('-ios predicate string:label CONTAINS "Checkout" OR label CONTAINS "Continue"');
    if (await chk.isDisplayed().catch(() => false)) {
      await chk.click(); await d.pause(4000);
      fs.writeFileSync(path.join(SS, 'M2-3-shelf-checkout.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
      m2 = /Payment Method|Pay at Store|Card Payment/i.test(await d.getPageSource());
    }
  }
  log({ id: 'M2', result_summary: m2 ? 'PASS' : 'PARTIAL', evidence: 'screenshots/pass19/pass4/M2-3-shelf-checkout.png' });
  console.log('M2', m2);

  await dl('freshasever://discover'); await d.pause(7000);
  const gms = await d.$$('-ios predicate string:name BEGINSWITH "AIRGMSMarker"');
  console.log('gms', gms.length);
  let d06 = false; let m43 = false;
  if (gms[0]) {
    await gms[0].click(); await d.pause(3000);
    d06 = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
    fs.writeFileSync(path.join(SS, 'D-06-map-preview.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
    const p = await d.$('~discover.map.preview');
    if (await p.isDisplayed().catch(() => false)) {
      await p.click(); await d.pause(4000);
      m43 = /Active rescue|View bags|Clearance|Bakehouse/i.test(await d.getPageSource());
      fs.writeFileSync(path.join(SS, 'M4-3-preview-to-outlet.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
    }
  }
  log({ id: 'D-06', result_summary: String(d06), evidence: 'screenshots/pass19/pass4/D-06-map-preview.png' });
  log({ id: 'M4-3', result_summary: String(m43), evidence: 'screenshots/pass19/pass4/M4-3-preview-to-outlet.png' });
  console.log('D-06', d06, 'M4-3', m43);
} finally { await d.deleteSession(); }
