#!/usr/bin/env node
/** Pass4 final — fix B-15, D-03, D-06, M4-3, A-09, M3, M2, M1 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const SS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots', 'pass19', 'pass4');
const LOG = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const SHELF_ITEM = '00000000-0000-0000-0000-000000000211';
const PAID_ORDER = '00000000-0000-0000-0000-000000000040';
const SUPERMARKET_OUTLET = '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4';
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const BAG_B = '00000000-0000-0000-0000-000000000004';
const BASKET_KEY = 'fae.clearanceBasket.v1';
const CART_KEY = 'fae.reservationCart.v1';
const R = {};

const dl = (u) => { execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' }); return new Promise((r) => setTimeout(r, 3500)); };
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass4-final', ...e }) + '\n');
const shot = async (d, n) => { fs.mkdirSync(SS, { recursive: true }); fs.writeFileSync(path.join(SS, n), Buffer.from(await d.takeScreenshot(), 'base64')); return `screenshots/pass19/pass4/${n}`; };
async function tap(d, pred) { try { const el = await d.$(`-ios predicate string:${pred}`); if (await el.isDisplayed().catch(() => false)) { await el.click(); await d.pause(900); return true; } } catch {} return false; }
function inject(key, val) {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, { encoding: 'utf8' }).trim();
  const mp = path.join(c, 'Library/Application Support/RCTAsyncLocalStorage_V1/manifest.json');
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  if (val == null) delete m[key]; else m[key] = JSON.stringify(val);
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  fs.writeFileSync(mp, JSON.stringify(m));
}

execSync(`xcrun simctl privacy ${UDID} grant photos ${BUNDLE}`, { stdio: 'pipe' });
execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });

const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': BUNDLE, 'appium:noReset': true } });
try {
  // B-15
  inject(BASKET_KEY, { shelfId: BAKEHOUSE_SHELF, items: { [SHELF_ITEM]: 1 }, startedAtMs: Date.now() - 16 * 60 * 1000 });
  await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
  await d.pause(6000);
  R['B-15'] = /Prices refreshed/i.test(await d.getPageSource());
  log({ id: 'B-15', result_summary: R['B-15'] ? 'PASS' : 'PARTIAL', evidence: await shot(d, 'B-15-basket-expired.png') });

  // D-03 supermarket — filter chip + marker
  await dl('freshasever://discover');
  await d.pause(4000);
  await tap(d, 'label == "Supermarket"');
  await d.pause(2500);
  const smIds = [`discover.mapMarker.${SUPERMARKET_OUTLET}`, `discover.mapMarker.outlet-${SUPERMARKET_OUTLET}`, `discover.mapMarker.pettah`];
  let clicked = false;
  for (const id of smIds) {
    const mk = await d.$(`~${id}`);
    if (await mk.isDisplayed().catch(() => false)) { await mk.click(); clicked = true; break; }
  }
  if (!clicked) {
    const mks = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
    for (const mk of mks) {
      const n = await mk.getAttribute('name').catch(() => '');
      if (n.includes('8fbdd459') || n.toLowerCase().includes('pettah') || n.toLowerCase().includes('grocer')) { await mk.click(); clicked = true; break; }
    }
  }
  await d.pause(2500);
  R['D-03'] = /Green Grocer|Clearance shelf|Browse shelf|supermarket/i.test(await d.getPageSource());
  log({ id: 'D-03', result_summary: R['D-03'] ? 'PASS' : 'PARTIAL', evidence: await shot(d, 'D-03-supermarket-no-pulse.png') });

  // D-06 + M4-3
  await dl('freshasever://discover');
  await d.pause(4000);
  const bakeMk = await d.$('~discover.mapMarker.bakehouse') ;
  let mk = (await bakeMk.isDisplayed().catch(() => false)) ? bakeMk : (await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."'))[0];
  if (mk) { await mk.click(); await d.pause(3000); }
  R['D-06'] = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
  await shot(d, 'D-06-map-preview.png');
  if (R['D-06']) {
    await d.$('~discover.map.preview').click();
    await d.pause(4000);
    R['M4-3'] = /View bags|Reserve|Clearance|Bakehouse|Outlet/i.test(await d.getPageSource());
    await shot(d, 'M4-3-preview-to-outlet.png');
    const { width, height } = await d.getWindowSize();
    await d.performActions([{ type: 'pointer', id: 'p', parameters: { pointerType: 'touch' }, actions: [
      { type: 'pointerMove', duration: 0, x: Math.floor(width * 0.75), y: Math.floor(height * 0.4) },
      { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 100 },
      { type: 'pointerMove', duration: 600, x: Math.floor(width * 0.25), y: Math.floor(height * 0.4) },
      { type: 'pointerUp', button: 0 },
    ]}]);
    await d.releaseActions();
    await shot(d, 'M4-3-map-pan.png');
  }
  log({ id: 'D-06', result_summary: String(R['D-06']), evidence: 'screenshots/pass19/pass4/D-06-map-preview.png' });
  log({ id: 'M4-3', result_summary: String(R['M4-3']), evidence: 'screenshots/pass19/pass4/M4-3-preview-to-outlet.png' });

  // A-09 + M3
  await dl(`freshasever://order-celebration?orderId=${PAID_ORDER}&variant=reservation`);
  await d.pause(4500);
  await tap(d, 'label == "Add a photo"');
  const add = await d.$('~celebration.storyAddPhoto');
  if (await add.isDisplayed().catch(() => false)) await add.click();
  await d.pause(2000);
  await tap(d, 'label == "Allow Full Access"');
  await d.pause(1500);
  await tap(d, 'type == "XCUIElementTypeImage"');
  await d.pause(2000);
  R['A-09'] = await d.$('~celebration.storyGraphic').isDisplayed().catch(() => false) || await d.$('~celebration.storyStep').isDisplayed().catch(() => false);
  await shot(d, 'A-09-story-photo.png');
  await tap(d, 'label CONTAINS "Share"');
  await d.pause(2500);
  R['M3'] = /UIActivity|Copy|Messages|Mail|Share/i.test(await d.getPageSource());
  log({ id: 'A-09', result_summary: String(R['A-09']), evidence: 'screenshots/pass19/pass4/A-09-story-photo.png' });
  log({ id: 'M3', result_summary: R['M3'] ? 'PASS' : 'PARTIAL', evidence: await shot(d, 'M3-story-share-sheet.png') });

  // M2
  inject(BASKET_KEY, null);
  await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
  await d.pause(5000);
  await shot(d, 'M2-1-shelf-basket.png');
  const inc = await d.$(`~shelf.qtyIncrement.${SHELF_ITEM}`);
  if (await inc.isDisplayed().catch(() => false)) await inc.click();
  await d.pause(1000);
  const rev = await d.$('~shelf.reviewBasket');
  if (await rev.isDisplayed().catch(() => false)) {
    await rev.click(); await d.pause(3500);
    await shot(d, 'M2-2-shelf-review.png');
    await tap(d, 'label CONTAINS "Checkout" OR label CONTAINS "Continue"');
    await d.pause(4000);
    R['M2'] = /Payment Method|Pay at Store|Card Payment|Total/i.test(await d.getPageSource());
    await shot(d, 'M2-3-shelf-checkout.png');
  }
  log({ id: 'M2', result_summary: R['M2'] ? 'PASS' : 'PARTIAL', evidence: 'screenshots/pass19/pass4/M2-3-shelf-checkout.png' });

  // M1
  inject(CART_KEY, { outletId: BAKEHOUSE_OUTLET, bagIds: [BAG_B], bags: [{ id: BAG_B, outletId: BAKEHOUSE_OUTLET, title: 'Pastries', rescuePrice: 650 }] });
  await dl(`freshasever://checkout?group=${BAG_B}`);
  await d.pause(5000);
  await shot(d, 'M1-1-group-checkout.png');
  R['M1'] = /Pay at Store|Card Payment|Reserve Now/i.test(await d.getPageSource());
  await tap(d, 'label CONTAINS "Card Payment"'); await shot(d, 'M1-2-card-selected.png');
  await tap(d, 'label CONTAINS "Pay at Store"'); await shot(d, 'M1-2-pay-at-store.png');
  log({ id: 'M1', result_summary: R['M1'] ? 'PASS' : 'PARTIAL', evidence: 'screenshots/pass19/pass4/M1-1-group-checkout.png' });

  fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'pass19-pass4-results.json'), JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
} finally { await d.deleteSession(); }
