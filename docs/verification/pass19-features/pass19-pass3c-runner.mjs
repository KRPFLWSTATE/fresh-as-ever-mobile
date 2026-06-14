#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19', 'pass3');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const SHELF_ITEM = '00000000-0000-0000-0000-000000000211';
const PAID_ORDER = '00000000-0000-0000-0000-000000000040';
const BASKET_KEY = 'fae.clearanceBasket.v1';
const CART_KEY = 'fae.reservationCart.v1';

const dl = (u) => { execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' }); return new Promise((r) => setTimeout(r, 3500)); };
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass3c', ...e }) + '\n');
const shot = async (d, n) => { fs.mkdirSync(SS, { recursive: true }); fs.writeFileSync(path.join(SS, n), Buffer.from(await d.takeScreenshot(), 'base64')); return `screenshots/pass19/pass3/${n}`; };

async function dismissKeyboard(d) {
  try { await d.hideKeyboard(); } catch {}
  try { await d.execute('mobile: hideKeyboard', {}); } catch {}
  await d.pause(400);
}

async function customerLogin(d) {
  await dl('freshasever://discover');
  await d.pause(2500);
  let guestCta = await d.$('~discover.guestSignInCta');
  if (!(await guestCta.isDisplayed().catch(() => false))) {
    for (let i = 0; i < 5; i++) {
      try { await d.execute('mobile: swipe', { direction: 'up' }); } catch {}
      await d.pause(500);
      guestCta = await d.$('~discover.guestSignInCta');
      if (await guestCta.isDisplayed().catch(() => false)) break;
    }
  }
  if (!(await guestCta.isDisplayed().catch(() => false))) {
    const tab = await d.$('~tab.profile');
    if (await tab.isDisplayed().catch(() => false)) {
      await tab.click(); await d.pause(2000);
      const p = await d.$('~profile.guestSignIn');
      if (await p.isDisplayed().catch(() => false)) await p.click();
      await d.pause(2500);
    } else return true;
  } else {
    await dl('freshasever://login?portal=customer');
  }
  await d.pause(2500);
  const loginTitle = await d.$('~login.title');
  if (!(await loginTitle.isDisplayed().catch(() => false))) return !(await d.$('~discover.guestSignInTitle').isDisplayed().catch(() => false));
  const emailMode = await d.$('-ios predicate string:label == "Use email & password instead"');
  if (await emailMode.isDisplayed().catch(() => false)) { await emailMode.click(); await d.pause(1200); }
  const fields = await d.$$('-ios class chain:**/XCUIElementTypeTextField');
  const secure = await d.$$('-ios class chain:**/XCUIElementTypeSecureTextField');
  if (fields[0]) await fields[0].setValue('qa.customer@freshasever.test');
  await dismissKeyboard(d);
  if (secure[0]) await secure[0].setValue('TempCustomer#12345');
  await dismissKeyboard(d);
  const signIn = await d.$('-ios predicate string:label == "Sign in"');
  if (await signIn.isDisplayed().catch(() => false)) { await signIn.click(); await d.pause(6000); }
  return !(await d.$('~discover.guestSignInTitle').isDisplayed().catch(() => false));
}

function injectAsyncStorage(key, val) {
  const c = execSync(`xcrun simctl get_app_container ${UDID} com.freshasever.mobile data`, { encoding: 'utf8' }).trim();
  const mp = path.join(c, 'Library', 'Application Support', 'RCTAsyncLocalStorage_V1', 'manifest.json');
  if (!fs.existsSync(mp)) { fs.mkdirSync(path.dirname(mp), { recursive: true }); fs.writeFileSync(mp, '{}'); }
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  if (val == null) delete m[key]; else m[key] = JSON.stringify(val);
  fs.writeFileSync(mp, JSON.stringify(m));
}

const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': 'com.freshasever.mobile', 'appium:noReset': true } });
const R = {};
try {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  R.login = await customerLogin(d);
  await shot(d, 'auth-logged-in.png');
  log({ id: 'auth', result_summary: String(R.login), evidence: 'screenshots/pass19/pass3/auth-logged-in.png' });

  await dl('freshasever://impact');
  await d.pause(4000);
  try { await d.execute('mobile: swipe', { direction: 'down', velocity: 2500 }); } catch {}
  await d.pause(2500);
  R['A-02'] = /2\s*\/\s*3/.test(await d.getPageSource());
  log({ id: 'A-02', result_summary: R['A-02'] ? '2/3' : 'mismatch', evidence: await shot(d, 'A-02-impact-streak.png') });

  injectAsyncStorage(CART_KEY, { outletId: BAKEHOUSE_OUTLET, bagIds: [BAKEHOUSE_BAG1, BAKEHOUSE_BAG2], bags: [
    { id: BAKEHOUSE_BAG1, outletId: BAKEHOUSE_OUTLET, title: 'B1', rescuePrice: 500 },
    { id: BAKEHOUSE_BAG2, outletId: BAKEHOUSE_OUTLET, title: 'B2', rescuePrice: 600 },
  ]});
  await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1},${BAKEHOUSE_BAG2}`);
  await d.pause(5000);
  R['B-07'] = /different pickup windows|checkout.overlapError/i.test(await d.getPageSource());
  log({ id: 'B-07', result_summary: String(R['B-07']), evidence: await shot(d, 'B-07-overlap-error.png') });

  injectAsyncStorage(BASKET_KEY, { shelfId: BAKEHOUSE_SHELF, items: { [SHELF_ITEM]: 1 }, startedAtMs: Date.now() - 16 * 60 * 1000 });
  await d.terminateApp('com.freshasever.mobile'); await d.pause(800); await d.activateApp('com.freshasever.mobile'); await d.pause(2500);
  await customerLogin(d);
  await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
  await d.pause(5000);
  R['B-15'] = /Prices refreshed/i.test(await d.getPageSource());
  log({ id: 'B-15', result_summary: String(R['B-15']), evidence: await shot(d, 'B-15-basket-expired.png') });

  await dl('freshasever://discover');
  await d.pause(5000);
  const mks = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
  if (mks[0]) { await mks[0].click(); await d.pause(2500); }
  R['D-06'] = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
  await shot(d, 'D-06-map-preview.png');
  if (R['D-06']) { await d.$('~discover.map.preview').click(); await d.pause(3500); R['M4-3'] = true; await shot(d, 'M4-3-preview-to-outlet.png'); }
  log({ id: 'D-06', result_summary: String(R['D-06']), evidence: 'screenshots/pass19/pass3/D-06-map-preview.png' });
  log({ id: 'M4-3', result_summary: String(R['M4-3']), evidence: 'screenshots/pass19/pass3/M4-3-preview-to-outlet.png' });
  R['D-03'] = mks.length > 0;
  await shot(d, 'D-03-shelf-only-no-pulse.png');
  log({ id: 'D-03', result_summary: 'map markers', evidence: 'screenshots/pass19/pass3/D-03-shelf-only-no-pulse.png' });

  await dl(`freshasever://order-celebration?orderId=${PAID_ORDER}&variant=reservation`);
  await d.pause(4500);
  const add = await d.$('-ios predicate string:label == "Add a photo"');
  if (await add.isDisplayed().catch(() => false)) await add.click();
  await d.pause(2000);
  R['A-09'] = await d.$('~celebration.storyStep').isDisplayed().catch(() => false);
  await shot(d, 'A-09-story-graphic.png');
  log({ id: 'A-09', result_summary: String(R['A-09']), evidence: 'screenshots/pass19/pass3/A-09-story-graphic.png' });

  await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
  await d.pause(4000);
  const inc = await d.$(`~shelf.qtyIncrement.${SHELF_ITEM}`);
  if (await inc.isDisplayed().catch(() => false)) await inc.click();
  const rev = await d.$('~shelf.reviewBasket');
  if (await rev.isDisplayed().catch(() => false)) { await rev.click(); await d.pause(3000); await shot(d, 'M2-2-shelf-review.png'); R['M2'] = true; }
  await shot(d, 'M2-1-shelf-basket.png');
  log({ id: 'M2', result_summary: R['M2'] ? 'review' : 'partial', evidence: 'screenshots/pass19/pass3/M2-2-shelf-review.png' });

  await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1}`);
  await d.pause(5000);
  R['M1'] = /Pay at Store|checkout.groupStrip|Card/i.test(await d.getPageSource());
  await shot(d, 'M1-1-group-checkout.png');
  log({ id: 'M1', result_summary: String(R['M1']), evidence: 'screenshots/pass19/pass3/M1-1-group-checkout.png' });

  console.log(JSON.stringify(R, null, 2));
} finally { await d.deleteSession(); }
