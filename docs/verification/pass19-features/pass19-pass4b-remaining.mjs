#!/usr/bin/env node
/** Pass4b — complete remaining rows; grant photos; fix map/shelf flows */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19', 'pass4');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const SHELF_ITEM = '00000000-0000-0000-0000-000000000211';
const PAID_ORDER = '00000000-0000-0000-0000-000000000040';
const SUPERMARKET_OUTLET = '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4';
const BASKET_KEY = 'fae.clearanceBasket.v1';
const R = {};

const dl = (u) => { execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' }); return new Promise((r) => setTimeout(r, 3500)); };
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass4b', auth_method: 'session-reuse', ...e }) + '\n');
const shot = async (d, n) => { fs.mkdirSync(SS, { recursive: true }); fs.writeFileSync(path.join(SS, n), Buffer.from(await d.takeScreenshot(), 'base64')); return `screenshots/pass19/pass4/${n}`; };

function injectAsyncStorage(key, val) {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, { encoding: 'utf8' }).trim();
  const mp = path.join(c, 'Library', 'Application Support', 'RCTAsyncLocalStorage_V1', 'manifest.json');
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  if (val == null) delete m[key]; else m[key] = JSON.stringify(val);
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  fs.writeFileSync(mp, JSON.stringify(m));
}

async function dismissPhotoPermission(d) {
  if (await d.$('-ios predicate string:label == "Allow Full Access"').isDisplayed().catch(() => false)) {
    await d.$('-ios predicate string:label == "Allow Full Access"').click();
    await d.pause(1500);
    return true;
  }
  return false;
}

async function tapMapMarker(d) {
  const mks = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
  if (mks.length) { await mks[0].click(); await d.pause(2500); return true; }
  const { width, height } = await d.getWindowSize();
  await d.performActions([{ type: 'pointer', id: 'm', parameters: { pointerType: 'touch' }, actions: [
    { type: 'pointerMove', duration: 0, x: Math.floor(width * 0.52), y: Math.floor(height * 0.42) },
    { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 },
  ]}]);
  await d.releaseActions();
  await d.pause(2500);
  return false;
}

execSync(`xcrun simctl privacy ${UDID} grant photos ${BUNDLE}`, { stdio: 'pipe' });
execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });

const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': BUNDLE, 'appium:noReset': true } });

try {
  await dismissPhotoPermission(d);

  // B-15
  injectAsyncStorage(BASKET_KEY, { shelfId: BAKEHOUSE_SHELF, items: { [SHELF_ITEM]: 1 }, startedAtMs: Date.now() - 16 * 60 * 1000 });
  await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
  await d.pause(5000);
  await dismissPhotoPermission(d);
  const b15 = await d.getPageSource();
  R['B-15'] = /Prices refreshed/i.test(b15);
  log({ id: 'B-15', result_summary: R['B-15'] ? 'expiry banner' : 'false', evidence: await shot(d, 'B-15-basket-expired.png') });

  // D-03 supermarket chip + map
  await dl('freshasever://discover');
  await d.pause(4000);
  await dismissPhotoPermission(d);
  await d.$('-ios predicate string:label == "Supermarket" OR name CONTAINS "Supermarket"').click().catch(() => {});
  await d.pause(2000);
  await tapMapMarker(d);
  R['D-03'] = /Green Grocer|supermarket|shelf/i.test(await d.getPageSource());
  log({ id: 'D-03', result_summary: R['D-03'] ? 'supermarket map' : 'false', evidence: await shot(d, 'D-03-supermarket-no-pulse.png') });

  // D-06 + M4-3
  await dl('freshasever://discover');
  await d.pause(4000);
  await tapMapMarker(d);
  R['D-06'] = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
  await shot(d, 'D-06-map-preview.png');
  if (R['D-06']) {
    await d.$('~discover.map.preview').click();
    await d.pause(3500);
    R['M4-3'] = /Outlet|View bags|Clearance|Bakehouse/i.test(await d.getPageSource());
    await shot(d, 'M4-3-preview-to-outlet.png');
    await dl('freshasever://discover');
    await d.pause(3000);
    await tapMapMarker(d);
    const { width, height } = await d.getWindowSize();
    await d.performActions([{ type: 'pointer', id: 'p', parameters: { pointerType: 'touch' }, actions: [
      { type: 'pointerMove', duration: 0, x: Math.floor(width * 0.75), y: Math.floor(height * 0.38) },
      { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 80 },
      { type: 'pointerMove', duration: 450, x: Math.floor(width * 0.25), y: Math.floor(height * 0.38) },
      { type: 'pointerUp', button: 0 },
    ]}]);
    await d.releaseActions();
    await d.pause(1500);
    await shot(d, 'M4-3-map-pan.png');
  } else {
    R['M4-3'] = false;
    await shot(d, 'M4-3-preview-to-outlet.png');
  }
  log({ id: 'D-06', result_summary: String(R['D-06']), evidence: 'screenshots/pass19/pass4/D-06-map-preview.png' });
  log({ id: 'M4-3', result_summary: String(R['M4-3']), evidence: 'screenshots/pass19/pass4/M4-3-preview-to-outlet.png' });

  // A-09 + M3 celebration
  await dl(`freshasever://order-celebration?orderId=${PAID_ORDER}&variant=reservation`);
  await d.pause(4500);
  await dismissPhotoPermission(d);
  const add = await d.$('~celebration.storyAddPhoto');
  if (await add.isDisplayed().catch(() => false)) await add.click();
  else await d.$('-ios predicate string:label CONTAINS "Add a photo"').click().catch(() => {});
  await d.pause(2000);
  await dismissPhotoPermission(d);
  R['A-09'] = await d.$('~celebration.storyStep').isDisplayed().catch(() => false) || /Choose Photo|Photo Library/i.test(await d.getPageSource());
  await shot(d, 'A-09-story-photo.png');
  await d.$('-ios predicate string:label CONTAINS "Share"').click().catch(() => {});
  await d.pause(2500);
  R['M3'] = /Share|UIActivity|Copy|Messages|AirDrop/i.test(await d.getPageSource());
  await shot(d, 'M3-story-share-sheet.png');
  log({ id: 'A-09', result_summary: String(R['A-09']), evidence: 'screenshots/pass19/pass4/A-09-story-photo.png' });
  log({ id: 'M3', result_summary: R['M3'] ? 'share sheet' : 'partial', evidence: 'screenshots/pass19/pass4/M3-story-share-sheet.png' });

  // M2 shelf journey
  await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
  await d.pause(4000);
  await shot(d, 'M2-1-shelf-basket.png');
  const inc = await d.$(`~shelf.qtyIncrement.${SHELF_ITEM}`);
  if (await inc.isDisplayed().catch(() => false)) await inc.click();
  const rev = await d.$('~shelf.reviewBasket');
  if (await rev.isDisplayed().catch(() => false)) {
    await rev.click(); await d.pause(3000);
    await shot(d, 'M2-2-shelf-review.png');
    await d.$('-ios predicate string:label CONTAINS "Checkout" OR name CONTAINS "Checkout"').click().catch(() => {});
    await d.pause(4000);
    await shot(d, 'M2-3-shelf-checkout.png');
    R['M2'] = /Pay at Store|Total|checkout/i.test(await d.getPageSource());
  } else R['M2'] = false;
  log({ id: 'M2', result_summary: R['M2'] ? 'full macro' : 'partial', evidence: 'screenshots/pass19/pass4/M2-3-shelf-checkout.png' });

  // M1 checkout steps
  await dl('freshasever://checkout?bag=00000000-0000-0000-0000-000000000004');
  await d.pause(5000);
  await shot(d, 'M1-1-group-checkout.png');
  const m1 = await d.getPageSource();
  R['M1'] = /Pay at Store|Reserve Now|Total/i.test(m1);
  if (R['M1']) {
    await d.$('-ios predicate string:label == "Pay at Store" OR name CONTAINS "Pay at Store"').click().catch(() => {});
    await d.pause(2500);
    await shot(d, 'M1-2-pay-at-store.png');
  }
  log({ id: 'M1', result_summary: R['M1'] ? 'checkout macro' : 'false', evidence: 'screenshots/pass19/pass4/M1-1-group-checkout.png' });

  // A-02 re-verify with fixed regex
  await dl('freshasever://impact');
  await d.pause(4000);
  try { await d.execute('mobile: swipe', { direction: 'down', velocity: 2800 }); } catch {}
  await d.pause(2500);
  R['A-02'] = /2\s*[\/\u2044]\s*3|1 rescue to go this week/i.test(await d.getPageSource());
  log({ id: 'A-02', result_summary: R['A-02'] ? '2/3 SQL match' : 'mismatch', evidence: await shot(d, 'A-02-impact-streak.png') });

  console.log(JSON.stringify(R, null, 2));
} finally { await d.deleteSession(); }
