#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const SS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots', 'pass19', 'pass4');
const LOG = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const SHELF = '00000000-0000-0000-0000-000000000201';
const ITEM = '00000000-0000-0000-0000-000000000211';

const log = (id, summary, ev) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass4c', id, result_summary: summary, evidence: ev }) + '\n');
const shot = async (d, n) => { fs.mkdirSync(SS, { recursive: true }); fs.writeFileSync(path.join(SS, n), Buffer.from(await d.takeScreenshot(), 'base64')); return `screenshots/pass19/pass4/${n}`; };
const dl = (u) => { execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' }); return new Promise((r) => setTimeout(r, 3500)); };

execSync(`xcrun simctl privacy ${UDID} grant photos ${BUNDLE}`, { stdio: 'pipe' });

function injectBasket() {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, { encoding: 'utf8' }).trim();
  const mp = path.join(c, 'Library', 'Application Support', 'RCTAsyncLocalStorage_V1', 'manifest.json');
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  m['fae.clearanceBasket.v1'] = JSON.stringify({ shelfId: SHELF, items: { [ITEM]: 2 }, startedAtMs: Date.now() - 20 * 60 * 1000 });
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  fs.writeFileSync(mp, JSON.stringify(m));
}

const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': BUNDLE, 'appium:noReset': true } });
try {
  // dismiss any photo alert
  const allow = await d.$('-ios predicate string:label == "Allow Full Access"');
  if (await allow.isDisplayed().catch(() => false)) await allow.click();

  // B-15
  injectBasket();
  await d.terminateApp(BUNDLE); await d.pause(800); await d.activateApp(BUNDLE); await d.pause(2000);
  await dl(`freshasever://clearance-shelf/${SHELF}`);
  await d.pause(6000);
  const b15src = await d.getPageSource();
  const b15ok = /Prices refreshed/i.test(b15src);
  log('B-15', b15ok ? 'expiry banner PASS' : 'false', await shot(d, 'B-15-basket-expired.png'));

  // D-06 + M4-3 — tap croissant marker coords from map
  await dl('freshasever://discover');
  await d.pause(5000);
  const { width, height } = await d.getWindowSize();
  await d.performActions([{ type: 'pointer', id: 't', parameters: { pointerType: 'touch' }, actions: [
    { type: 'pointerMove', duration: 0, x: Math.floor(width * 0.58), y: Math.floor(height * 0.38) },
    { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 },
  ]}]);
  await d.releaseActions();
  await d.pause(3000);
  const d06 = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
  await shot(d, 'D-06-map-preview.png');
  let m43 = false;
  if (d06) {
    await d.$('~discover.map.preview').click();
    await d.pause(4000);
    m43 = /Outlet|Bakehouse|View bags|Clearance/i.test(await d.getPageSource());
    await shot(d, 'M4-3-preview-to-outlet.png');
    await dl('freshasever://discover'); await d.pause(3000);
    await d.performActions([{ type: 'pointer', id: 'p', parameters: { pointerType: 'touch' }, actions: [
      { type: 'pointerMove', duration: 0, x: Math.floor(width * 0.7), y: Math.floor(height * 0.35) },
      { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 80 },
      { type: 'pointerMove', duration: 500, x: Math.floor(width * 0.25), y: Math.floor(height * 0.35) },
      { type: 'pointerUp', button: 0 },
    ]}]);
    await d.releaseActions();
    await shot(d, 'M4-3-map-pan.png');
  } else {
    await shot(d, 'M4-3-preview-to-outlet.png');
  }
  log('D-06', String(d06), 'screenshots/pass19/pass4/D-06-map-preview.png');
  log('M4-3', String(m43), 'screenshots/pass19/pass4/M4-3-preview-to-outlet.png');

  // M2 full macro
  await dl(`freshasever://clearance-shelf/${SHELF}`);
  await d.pause(4000);
  await shot(d, 'M2-1-shelf-basket.png');
  const inc = await d.$(`~shelf.qtyIncrement.${ITEM}`);
  if (await inc.isDisplayed().catch(() => false)) { await inc.click(); await d.pause(500); await inc.click(); }
  const rev = await d.$('~shelf.reviewBasket');
  let m2 = false;
  if (await rev.isDisplayed().catch(() => false)) {
    await rev.click(); await d.pause(3000);
    await shot(d, 'M2-2-shelf-review.png');
    await d.$('-ios predicate string:label CONTAINS "Checkout"').click().catch(() => {});
    await d.pause(4000);
    await shot(d, 'M2-3-shelf-checkout.png');
    m2 = /Pay at Store|Total|Reserve/i.test(await d.getPageSource());
  }
  log('M2', m2 ? 'full macro PASS' : 'partial', 'screenshots/pass19/pass4/M2-3-shelf-checkout.png');

  console.log({ B15: b15ok, D06: d06, M43: m43, M2: m2 });
} finally { await d.deleteSession(); }
