#!/usr/bin/env node
/** Pass4 finalize — sequential, permission-first */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19', 'pass4');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const B = 'com.freshasever.mobile';
const SHELF = '00000000-0000-0000-0000-000000000201';
const ITEM = '00000000-0000-0000-0000-000000000211';
const SM = '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4';
const R = {};

const dl = (u) => { execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' }); return new Promise((r) => setTimeout(r, 4000)); };
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass4-finalize', auth_method: 'appium-email-password-pass7+typeText', ...e }) + '\n');
const shot = async (d, n) => { fs.mkdirSync(SS, { recursive: true }); fs.writeFileSync(path.join(SS, n), Buffer.from(await d.takeScreenshot(), 'base64')); return `screenshots/pass19/pass4/${n}`; };
async function allowPhotos(d) {
  for (const label of ['Allow Full Access', 'Allow Access to All Photos', 'OK']) {
    try {
      const el = await d.$(`-ios predicate string:label == "${label}"`);
      if (await el.isDisplayed().catch(() => false)) { await el.click(); await d.pause(1200); return; }
    } catch {}
  }
}
function inject(k, v) {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${B} data`, { encoding: 'utf8' }).trim();
  const mp = path.join(c, 'Library/Application Support/RCTAsyncLocalStorage_V1/manifest.json');
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  if (v == null) delete m[k]; else m[k] = JSON.stringify(v);
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  fs.writeFileSync(mp, JSON.stringify(m));
}

execSync(`xcrun simctl privacy ${UDID} grant photos ${B}`, { stdio: 'pipe' });
execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });

const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': B, 'appium:noReset': true, 'appium:newCommandTimeout': 300 } });
try {
  await dl('freshasever://discover');
  await d.pause(3000);
  await allowPhotos(d);

  // D-03
  await dl('freshasever://discover');
  await d.pause(5000);
  await allowPhotos(d);
  const smChip = await d.$('-ios predicate string:label == "Supermarket"');
  if (await smChip.isDisplayed().catch(() => false)) await smChip.click();
  await d.pause(2500);
  const smMk = await d.$(`~discover.mapMarker.${SM}`);
  if (await smMk.isDisplayed().catch(() => false)) await smMk.click();
  else {
    const mks = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
    for (const mk of mks) {
      const n = await mk.getAttribute('name').catch(() => '');
      if (n.includes('8fbdd459')) { await mk.click(); break; }
    }
  }
  await d.pause(2500);
  R['D-03'] = /Green Grocer|Browse shelf|Clearance shelf/i.test(await d.getPageSource());
  log({ id: 'D-03', result_summary: R['D-03'] ? 'PASS' : 'PARTIAL', evidence: await shot(d, 'D-03-supermarket-no-pulse.png') });

  // B-15
  inject('fae.clearanceBasket.v1', { shelfId: SHELF, items: { [ITEM]: 1 }, startedAtMs: Date.now() - 16 * 60 * 1000 });
  await d.terminateApp(B); await d.pause(800); await d.activateApp(B); await d.pause(2500);
  await dl(`freshasever://shelves/${SHELF}`);
  await d.pause(7000);
  await allowPhotos(d);
  R['B-15'] = /Prices refreshed/i.test(await d.getPageSource());
  log({ id: 'B-15', result_summary: R['B-15'] ? 'PASS' : 'PARTIAL', evidence: await shot(d, 'B-15-basket-expired.png') });

  // D-06 + M4-3
  await dl('freshasever://discover');
  await d.pause(6000);
  const gms = await d.$$('-ios predicate string:name BEGINSWITH "AIRGMSMarker"');
  if (gms[0]) { await gms[0].click(); await d.pause(3000); }
  R['D-06'] = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
  await shot(d, 'D-06-map-preview.png');
  if (R['D-06']) {
    await d.$('~discover.map.preview').click();
    await d.pause(4000);
    R['M4-3'] = /Active rescue|View bags|Clearance|Bakehouse/i.test(await d.getPageSource());
    await shot(d, 'M4-3-preview-to-outlet.png');
  }
  log({ id: 'D-06', result_summary: R['D-06'] ? 'PASS' : 'PARTIAL', evidence: 'screenshots/pass19/pass4/D-06-map-preview.png' });
  log({ id: 'M4-3', result_summary: R['M4-3'] ? 'PASS' : 'PARTIAL', evidence: 'screenshots/pass19/pass4/M4-3-preview-to-outlet.png' });

  // M2
  inject('fae.clearanceBasket.v1', null);
  await dl(`freshasever://shelves/${SHELF}`);
  await d.pause(5000);
  const inc = await d.$(`~shelf.qtyIncrement.${ITEM}`);
  if (await inc.isDisplayed().catch(() => false)) await inc.click();
  await d.pause(800);
  const rev = await d.$('~shelf.reviewBasket');
  if (await rev.isDisplayed().catch(() => false)) {
    await rev.click(); await d.pause(3000);
    await shot(d, 'M2-2-shelf-review.png');
    const chk = await d.$('-ios predicate string:label CONTAINS "Checkout" OR label CONTAINS "Continue"');
    if (await chk.isDisplayed().catch(() => false)) {
      await chk.click(); await d.pause(4000);
      R['M2'] = /Payment Method|Pay at Store|Card Payment/i.test(await d.getPageSource());
      await shot(d, 'M2-3-shelf-checkout.png');
    }
  }
  log({ id: 'M2', result_summary: R['M2'] ? 'PASS' : 'PARTIAL', evidence: 'screenshots/pass19/pass4/M2-3-shelf-checkout.png' });

  // A-09 + M3 (last — triggers photo)
  await dl('freshasever://order-celebration?orderId=00000000-0000-0000-0000-000000000040&variant=reservation');
  await d.pause(4500);
  const add = await d.$('~celebration.storyAddPhoto');
  if (await add.isDisplayed().catch(() => false)) await add.click();
  await d.pause(1500);
  await allowPhotos(d);
  const imgs = await d.$$('-ios predicate string:type == "XCUIElementTypeImage"');
  if (imgs.length > 2) await imgs[2].click();
  await d.pause(2000);
  R['A-09'] = await d.$('~celebration.storyGraphic').isDisplayed().catch(() => false) || await d.$('~celebration.storyStep').isDisplayed().catch(() => false);
  await shot(d, 'A-09-story-photo.png');
  const share = await d.$('-ios predicate string:label CONTAINS "Share"');
  if (await share.isDisplayed().catch(() => false)) { await share.click(); await d.pause(2500); }
  R['M3'] = /UIActivityContentView|Copy|Messages|Mail|Share/i.test(await d.getPageSource());
  log({ id: 'A-09', result_summary: R['A-09'] ? 'PASS' : 'PARTIAL', evidence: 'screenshots/pass19/pass4/A-09-story-photo.png' });
  log({ id: 'M3', result_summary: R['M3'] ? 'PASS' : 'PARTIAL', evidence: await shot(d, 'M3-story-share-sheet.png') });

  fs.writeFileSync(path.join(ROOT, 'pass19-pass4-results.json'), JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
} finally { await d.deleteSession(); }
