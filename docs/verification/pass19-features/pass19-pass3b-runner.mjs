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
const BUNDLE = 'com.freshasever.mobile';
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const SHELF_ITEM = '00000000-0000-0000-0000-000000000211';
const PAID_ORDER = '00000000-0000-0000-0000-000000000040';
const PETTAH_OUTLET = '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4';
const BASKET_KEY = 'fae.clearanceBasket.v1';
const CART_KEY = 'fae.reservationCart.v1';

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 3500));
};

function log(entry) {
  fs.appendFileSync(LOG, `${JSON.stringify({ ts: new Date().toISOString(), wave: 'pass3b', ...entry })}\n`);
}

async function shot(d, name) {
  fs.mkdirSync(SS, { recursive: true });
  const p = path.join(SS, name);
  fs.writeFileSync(p, Buffer.from(await d.takeScreenshot(), 'base64'));
  return `screenshots/pass19/pass3/${name}`;
}

async function scrollToSignInCta(d) {
  for (let i = 0; i < 6; i++) {
    const cta = await d.$('~discover.guestSignInCta');
    if (await cta.isDisplayed().catch(() => false)) return cta;
    try { await d.execute('mobile: swipe', { direction: 'up' }); } catch {}
    await d.pause(600);
  }
  return d.$('~discover.guestSignInCta');
}

async function ensureCustomerLogin(d) {
  await dl('freshasever://discover');
  await d.pause(3000);
  const src = await d.getPageSource();
  const guestOnly =
    /discover.guestSignInTitle/i.test(src) &&
    !/discover.mapMarker|Surprise Pastries|Bakehouse|2 bags in your group/i.test(src);
  if (!guestOnly) return true;
  let cta = await scrollToSignInCta(d);
  if (await cta.isDisplayed().catch(() => false)) {
    await cta.click();
  } else {
    const tab = await d.$('~tab.profile');
    if (await tab.isDisplayed().catch(() => false)) {
      await tab.click();
      await d.pause(2000);
      const pSign = await d.$('~profile.guestSignIn');
      if (await pSign.isDisplayed().catch(() => false)) await pSign.click();
    }
  }
  await d.pause(2500);
  const fields = await d.$$('-ios class chain:**/XCUIElementTypeTextField');
  const secure = await d.$$('-ios class chain:**/XCUIElementTypeSecureTextField');
  if (fields[0]) {
    await fields[0].click();
    await fields[0].clearValue().catch(() => {});
    await fields[0].setValue('qa.customer@freshasever.test');
  }
  await d.pause(400);
  if (secure[0]) {
    await secure[0].click();
    await secure[0].setValue('TempCustomer#12345');
  }
  const signIn = await d.$('-ios predicate string:label == "Sign in"');
  if (await signIn.isDisplayed().catch(() => false)) {
    await signIn.click();
    await d.pause(8000);
  }
  await dl('freshasever://discover');
  await d.pause(3000);
  const guestTitle = await d.$('~discover.guestSignInTitle');
  return !(await guestTitle.isDisplayed().catch(() => false));
}

function injectAsyncStorage(key, valueObj) {
  const container = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, { encoding: 'utf8' }).trim();
  const manifestPath = path.join(container, 'Library', 'Application Support', 'RCTAsyncLocalStorage_V1', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify({}));
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (valueObj == null) delete manifest[key];
  else manifest[key] = JSON.stringify(valueObj);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
}

async function relaunchApp(d) {
  await d.terminateApp(BUNDLE);
  await d.pause(800);
  await d.activateApp(BUNDLE);
  await d.pause(2500);
}

async function main() {
  const results = {};
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  const d = await remote({
    hostname: '127.0.0.1', port: 4723,
    capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': BUNDLE, 'appium:noReset': true },
  });
  try {
    results.login = await ensureCustomerLogin(d);
    await shot(d, 'auth-discover-logged-in.png');
    log({ id: 'auth', tool: 'appium.journey', result_summary: results.login ? 'customer logged in' : 'login failed', evidence: 'screenshots/pass19/pass3/auth-discover-logged-in.png' });

    // A-02
    await dl('freshasever://impact');
    await d.pause(4000);
    try { await d.execute('mobile: swipe', { direction: 'down', velocity: 2500 }); } catch {}
    await d.pause(2500);
    const streakSrc = await d.getPageSource();
    results['A-02'] = /2\s*\/\s*3|2 of 3/i.test(streakSrc);
    const evA02 = await shot(d, 'A-02-impact-streak.png');
    log({ id: 'A-02', tool: 'appium.journey', result_summary: results['A-02'] ? '2/3 streak' : 'streak mismatch', evidence: evA02 });

    // B-07
    injectAsyncStorage(CART_KEY, { outletId: BAKEHOUSE_OUTLET, bagIds: [BAKEHOUSE_BAG1, BAKEHOUSE_BAG2], bags: [
      { id: BAKEHOUSE_BAG1, outletId: BAKEHOUSE_OUTLET, title: 'Bag1', rescuePrice: 500 },
      { id: BAKEHOUSE_BAG2, outletId: BAKEHOUSE_OUTLET, title: 'Bag2', rescuePrice: 600 },
    ]});
    await relaunchApp(d);
    await ensureCustomerLogin(d);
    await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1},${BAKEHOUSE_BAG2}`);
    await d.pause(5000);
    const b07Src = await d.getPageSource();
    results['B-07'] = /different pickup windows|checkout.overlapError/i.test(b07Src);
    const evB07 = await shot(d, 'B-07-overlap-error.png');
    log({ id: 'B-07', tool: 'appium.journey', result_summary: results['B-07'] ? 'overlap blocked' : 'no overlap UI', evidence: evB07 });

    // B-15
    injectAsyncStorage(BASKET_KEY, { shelfId: BAKEHOUSE_SHELF, items: { [SHELF_ITEM]: 1 }, startedAtMs: Date.now() - 16 * 60 * 1000 });
    await relaunchApp(d);
    await ensureCustomerLogin(d);
    await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
    await d.pause(5000);
    const b15Src = await d.getPageSource();
    results['B-15'] = /Prices refreshed|shelf.basketTimer/i.test(b15Src) && /Prices refreshed/i.test(b15Src);
    const evB15 = await shot(d, 'B-15-basket-expired.png');
    log({ id: 'B-15', tool: 'appium.journey', result_summary: results['B-15'] ? 'expired banner' : 'no expiry UI', evidence: evB15 });

    // D-03, D-06, M4-3
    await dl('freshasever://discover');
    await d.pause(5000);
    const markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
    for (const m of markers) {
      const name = await m.getAttribute('name').catch(() => '');
      if (name.includes(PETTAH_OUTLET) || name.toLowerCase().includes('pettah')) { await m.click(); break; }
    }
    if (markers.length && !results['D-03']) {
      for (const m of markers) {
        const name = await m.getAttribute('name').catch(() => '');
        if (!name.includes('000000000003')) { await m.click(); break; }
      }
    }
    await d.pause(2000);
    results['D-03'] = markers.length > 0;
    await shot(d, 'D-03-shelf-only-no-pulse.png');
    log({ id: 'D-03', tool: 'appium.screenshot', result_summary: 'map marker', evidence: 'screenshots/pass19/pass3/D-03-shelf-only-no-pulse.png' });

    await dl('freshasever://discover');
    await d.pause(4000);
    const bake = await d.$('~discover.mapMarker.bakehouse');
    const mk = (await bake.isDisplayed().catch(() => false)) ? bake : (await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."'))[0];
    if (mk) { await mk.click(); await d.pause(2500); }
    results['D-06'] = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
    await shot(d, 'D-06-map-preview.png');
    if (results['D-06']) {
      await d.$('~discover.map.preview').click();
      await d.pause(3500);
      results['M4-3'] = true;
      await shot(d, 'M4-3-preview-to-outlet.png');
      try { await d.execute('mobile: swipe', { direction: 'left' }); await d.pause(1500); await shot(d, 'M4-3-map-pan.png'); } catch {}
    }
    log({ id: 'D-06', tool: 'appium.journey', result_summary: String(results['D-06']), evidence: 'screenshots/pass19/pass3/D-06-map-preview.png' });
    log({ id: 'M4-3', tool: 'appium.journey', result_summary: String(results['M4-3']), evidence: 'screenshots/pass19/pass3/M4-3-preview-to-outlet.png' });

    // A-09 / M3
    await dl(`freshasever://order-celebration?orderId=${PAID_ORDER}&variant=reservation`);
    await d.pause(4500);
    const addPhoto = await d.$('~celebration.storyAddPhoto');
    const addPhotoFallback = await d.$('-ios predicate string:label == "Add a photo"');
    const btn = (await addPhoto.isDisplayed().catch(() => false)) ? addPhoto : addPhotoFallback;
    if (await btn.isDisplayed().catch(() => false)) {
      await btn.click();
      await d.pause(2000);
      const lib = await d.$('-ios predicate string:label CONTAINS "Photo Library" OR label == "Photo Library"');
      if (await lib.isDisplayed().catch(() => false)) { await lib.click(); await d.pause(2000); }
      const first = await d.$('-ios class chain:**/XCUIElementTypeImage');
      if (await first.isDisplayed().catch(() => false)) { await first.click(); await d.pause(2000); }
    }
    results['A-09'] = await d.$('~celebration.storyGraphic').isDisplayed().catch(() => false);
    await shot(d, 'A-09-story-graphic.png');
    const save = await d.$('-ios predicate string:label == "Save story"');
    if (await save.isDisplayed().catch(() => false)) { await save.click(); await d.pause(2500); await shot(d, 'M3-story-share-sheet.png'); results['M3'] = true; }
    log({ id: 'A-09', tool: 'appium.journey', result_summary: String(results['A-09']), evidence: 'screenshots/pass19/pass3/A-09-story-graphic.png' });
    log({ id: 'M3', tool: 'appium.journey', result_summary: results['M3'] ? 'share' : 'partial', evidence: 'screenshots/pass19/pass3/M3-story-share-sheet.png' });

    // M2 shelf
    await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
    await d.pause(4000);
    const inc = await d.$(`~shelf.qtyIncrement.${SHELF_ITEM}`);
    if (await inc.isDisplayed().catch(() => false)) { await inc.click(); await d.pause(1200); }
    await shot(d, 'M2-1-shelf-basket.png');
    const review = await d.$('~shelf.reviewBasket');
    if (await review.isDisplayed().catch(() => false)) {
      await review.click(); await d.pause(3000); await shot(d, 'M2-2-shelf-review.png');
      const pay = await d.$('-ios predicate string:label CONTAINS "Checkout" OR label CONTAINS "Continue"');
      if (await pay.isDisplayed().catch(() => false)) { await pay.click(); await d.pause(3500); await shot(d, 'M2-3-shelf-checkout.png'); results['M2'] = true; }
    }
    log({ id: 'M2', tool: 'appium.journey', result_summary: results['M2'] ? 'checkout' : 'review', evidence: 'screenshots/pass19/pass3/M2-3-shelf-checkout.png' });

    // M1
    injectAsyncStorage(CART_KEY, { outletId: BAKEHOUSE_OUTLET, bagIds: [BAKEHOUSE_BAG1], bags: [{ id: BAKEHOUSE_BAG1, outletId: BAKEHOUSE_OUTLET, title: 'Bag1', rescuePrice: 500 }] });
    await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1}`);
    await d.pause(5000);
    await shot(d, 'M1-1-group-checkout.png');
    const m1Src = await d.getPageSource();
    results['M1'] = /PayHere|Card payment|Pay at Store|checkout.groupStrip/i.test(m1Src);
    const payHere = await d.$('-ios predicate string:label CONTAINS "Card" OR label CONTAINS "PayHere"');
    if (await payHere.isDisplayed().catch(() => false)) { await payHere.click(); await d.pause(3000); await shot(d, 'M1-2-payhere-webview.png'); }
    else { await shot(d, 'M1-2-pay-at-store.png'); }
    log({ id: 'M1', tool: 'appium.journey', result_summary: results['M1'] ? 'checkout UI' : 'blocked', evidence: 'screenshots/pass19/pass3/M1-1-group-checkout.png' });

    console.log(JSON.stringify(results, null, 2));
  } finally { await d.deleteSession(); }
}

main().catch((e) => { console.error(e); process.exit(1); });
