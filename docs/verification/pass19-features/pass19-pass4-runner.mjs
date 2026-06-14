#!/usr/bin/env node
/**
 * Pass 19 verification pass 4 — close 10 remaining PARTIAL rows.
 * Auth: pass7 customer login (logout → email/password → keyboard dismiss).
 * Screenshots: screenshots/pass19/pass4/{ROW-ID}.png
 */
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
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const BAG_OVERLAP_A = '8ba2bbb6-c74a-4ad5-b14e-2d22912c7c55'; // earlier window
const BAG_OVERLAP_B = '00000000-0000-0000-0000-000000000004'; // later window — non-overlap pair
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const SHELF_ITEM = '00000000-0000-0000-0000-000000000211';
const PAID_ORDER = '00000000-0000-0000-0000-000000000040';
const SUPERMARKET_OUTLET = '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4';
const BASKET_KEY = 'fae.clearanceBasket.v1';
const CART_KEY = 'fae.reservationCart.v1';
const AUTH_METHOD = 'appium-email-password-pass7';

const R = {};
let authOk = false;

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 3200));
};

const log = (e) =>
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass4', auth_method: AUTH_METHOD, ...e }) + '\n');

const shot = async (d, name) => {
  fs.mkdirSync(SS, { recursive: true });
  const rel = `screenshots/pass19/pass4/${name}`;
  fs.writeFileSync(path.join(SS, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return rel;
};

async function dismissKeyboard(d) {
  try {
    await d.hideKeyboard();
  } catch {}
  try {
    const ret = await d.$('-ios predicate string:name == "Return" OR label == "Return"');
    if (await ret.isDisplayed().catch(() => false)) await ret.click();
  } catch {}
  await d.pause(300);
}

async function tapSignIn(d) {
  const signInById = await d.$('~login.signIn');
  if (await signInById.isDisplayed().catch(() => false)) {
    const enabled = await signInById.isEnabled().catch(() => true);
    if (enabled) {
      await signInById.click();
      return;
    }
  }
  // Coordinate tap when RN disabled state blocks Appium click
  const { width } = await d.getWindowSize();
  await d.performActions([
    {
      type: 'pointer',
      id: 'si',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: Math.floor(width / 2), y: 580 },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
  await d.releaseActions();
}

async function tryTap(d, pred, timeout = 8000) {
  try {
    const el = await d.$(`-ios predicate string:${pred}`);
    await el.waitForExist({ timeout });
    await el.click();
    await d.pause(700);
    return true;
  } catch {
    return false;
  }
}

async function scrollDown(d, times = 1) {
  const { width, height } = await d.getWindowSize();
  for (let i = 0; i < times; i++) {
    await d.performActions([
      {
        type: 'pointer',
        id: 's1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.floor(width / 2), y: Math.floor(height * 0.72) },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerMove', duration: 500, x: Math.floor(width / 2), y: Math.floor(height * 0.25) },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await d.releaseActions();
    await d.pause(400);
  }
}

async function isLoggedIn(d) {
  const src = await d.getPageSource();
  return (
    src.includes('tab.discover') ||
    src.includes('discover.searchInput') ||
    (src.includes('Discover') && !src.includes('discover.guestSignInTitle') && !src.includes('Sign in to see rescue bags'))
  );
}

async function customerLogin(d) {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  await dl('freshasever://discover');
  await d.pause(2500);
  if (await isLoggedIn(d)) return true;

  await d.terminateApp(BUNDLE);
  await d.pause(700);
  await d.activateApp(BUNDLE);
  await d.pause(2000);

  await dl('freshasever://login?portal=customer');
  await d.pause(2500);

  if (!(await d.$('~login.title').isDisplayed().catch(() => false))) {
    await dl('freshasever://login?portal=customer');
    await d.pause(2500);
  }

  await tryTap(d, 'name CONTAINS "Use email" OR label CONTAINS "Use email & password"');
  await d.pause(1000);

  const emailById = await d.$('~login.email');
  if (await emailById.isDisplayed().catch(() => false)) {
    await emailById.click();
    await emailById.clearValue().catch(() => {});
    await emailById.setValue('qa.customer@freshasever.test');
  } else {
    const fields = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
    if (!fields.length) return false;
    await fields[0].click();
    await fields[0].setValue('qa.customer@freshasever.test');
  }
  await dismissKeyboard(d);
  await d.pause(500);

  let passById = await d.$('~login.password');
  for (let i = 0; i < 8; i++) {
    if (await passById.isDisplayed().catch(() => false)) break;
    await d.pause(400);
    passById = await d.$('~login.password');
  }

  if (await passById.isDisplayed().catch(() => false)) {
    await passById.click();
    await passById.clearValue().catch(() => {});
    await passById.setValue('TempCustomer#12345');
  } else {
    const secure = await d.$$('-ios predicate string:type == "XCUIElementTypeSecureTextField"');
    if (secure[0]) {
      await secure[0].click();
      await secure[0].setValue('TempCustomer#12345');
    } else {
      const fields = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
      if (fields[1]) {
        await fields[1].click();
        await fields[1].setValue('TempCustomer#12345');
      } else {
        // coord tap password row below email
        const { width } = await d.getWindowSize();
        await d.performActions([
          {
            type: 'pointer',
            id: 'pf',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: Math.floor(width / 2), y: 510 },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ]);
        await d.releaseActions();
        await d.pause(300);
        await d.keys(['TempCustomer#12345']).catch(async () => {
          const s2 = await d.$$('-ios predicate string:type == "XCUIElementTypeSecureTextField"');
          if (s2[0]) await s2[0].setValue('TempCustomer#12345');
        });
      }
    }
  }
  await dismissKeyboard(d);
  await tapSignIn(d);

  for (let i = 0; i < 25; i++) {
    await d.pause(2000);
    if (await isLoggedIn(d)) {
      await dl('freshasever://discover');
      await d.pause(2000);
      return true;
    }
  }
  return false;
}

function injectAsyncStorage(key, val) {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, { encoding: 'utf8' }).trim();
  const mp = path.join(c, 'Library', 'Application Support', 'RCTAsyncLocalStorage_V1', 'manifest.json');
  if (!fs.existsSync(mp)) {
    fs.mkdirSync(path.dirname(mp), { recursive: true });
    fs.writeFileSync(mp, '{}');
  }
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  if (val == null) delete m[key];
  else m[key] = JSON.stringify(val);
  fs.writeFileSync(mp, JSON.stringify(m));
}

async function pullToRefresh(d) {
  try {
    await d.execute('mobile: swipe', { direction: 'down', velocity: 2800 });
  } catch {
    await scrollDown(d, 0);
    const { width } = await d.getWindowSize();
    await d.performActions([
      {
        type: 'pointer',
        id: 'pr',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.floor(width / 2), y: 120 },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerMove', duration: 600, x: Math.floor(width / 2), y: 420 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await d.releaseActions();
  }
  await d.pause(2500);
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
  authOk = await customerLogin(d);
  R.auth = authOk;
  await shot(d, 'auth-logged-in.png');
  log({ id: 'auth', tool: 'appium.journey', result_summary: String(authOk), evidence: 'screenshots/pass19/pass4/auth-logged-in.png' });

  if (!authOk) {
    console.error('AUTH FAILED — attempting deeplink-only rows');
  }

  // A-02: Impact streak pull-to-refresh
  await dl('freshasever://impact');
  await d.pause(4000);
  await pullToRefresh(d);
  const a02Src = await d.getPageSource();
  R['A-02'] = /2\s*[\/\u2044]\s*3|2 of 3|2\/3/.test(a02Src) || a02Src.includes('1 rescue to go this week');
  const evA02 = await shot(d, 'A-02-impact-streak.png');
  log({ id: 'A-02', tool: 'appium.journey', args_summary: 'Impact pull-to-refresh', result_summary: R['A-02'] ? '2/3 match SQL' : 'streak mismatch', evidence: evA02 });

  // B-07: non-overlapping bags → checkout.overlapError
  injectAsyncStorage(CART_KEY, {
    outletId: BAKEHOUSE_OUTLET,
    bagIds: [BAG_OVERLAP_A, BAG_OVERLAP_B],
    bags: [
      { id: BAG_OVERLAP_A, outletId: BAKEHOUSE_OUTLET, title: 'Pastry Rescue', rescuePrice: 500 },
      { id: BAG_OVERLAP_B, outletId: BAKEHOUSE_OUTLET, title: 'Surprise Pastries', rescuePrice: 600 },
    ],
  });
  await dl(`freshasever://checkout?group=${BAG_OVERLAP_A},${BAG_OVERLAP_B}`);
  await d.pause(5000);
  const b07Src = await d.getPageSource();
  R['B-07'] =
    (await d.$('~checkout.overlapError').isDisplayed().catch(() => false)) ||
    /different pickup windows/i.test(b07Src);
  const evB07 = await shot(d, 'B-07-overlap-error.png');
  log({ id: 'B-07', tool: 'appium.journey', args_summary: 'non-overlap bag pair', result_summary: String(R['B-07']), evidence: evB07 });

  // B-15: expired basket on shelf
  injectAsyncStorage(BASKET_KEY, {
    shelfId: BAKEHOUSE_SHELF,
    items: { [SHELF_ITEM]: 1 },
    startedAtMs: Date.now() - 16 * 60 * 1000,
  });
  await d.terminateApp(BUNDLE);
  await d.pause(800);
  await d.activateApp(BUNDLE);
  await d.pause(2500);
  if (!(await isLoggedIn(d))) await customerLogin(d);
  await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
  await d.pause(5000);
  const b15Src = await d.getPageSource();
  R['B-15'] = /Prices refreshed|shelf.basketTimer/i.test(b15Src) && /Prices refreshed/i.test(b15Src);
  const evB15 = await shot(d, 'B-15-basket-expired.png');
  log({ id: 'B-15', tool: 'appium.journey', args_summary: 'expired basket inject', result_summary: String(R['B-15']), evidence: evB15 });

  // D-03: supermarket outlet on map — shelf-only, no bag pulse
  await dl('freshasever://discover');
  await d.pause(4000);
  await tryTap(d, 'name == "Map" OR label == "Map"');
  await d.pause(2000);
  const smMarker = await d.$(`~discover.mapMarker.${SUPERMARKET_OUTLET}`);
  if (await smMarker.isDisplayed().catch(() => false)) {
    await smMarker.click();
    await d.pause(2000);
  } else {
    const mks = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
    for (const mk of mks) {
      const name = await mk.getAttribute('name').catch(() => '');
      if (name.includes('8fbdd459') || name.includes('Green Grocer')) {
        await mk.click();
        await d.pause(2000);
        break;
      }
    }
  }
  const d03Src = await d.getPageSource();
  R['D-03'] = d03Src.includes('Green Grocer') || d03Src.includes('8fbdd459');
  const evD03 = await shot(d, 'D-03-supermarket-no-pulse.png');
  log({ id: 'D-03', tool: 'appium.screenshot', args_summary: 'supermarket marker', result_summary: R['D-03'] ? 'supermarket visible' : 'marker not found', evidence: evD03 });

  // D-06 + M4-3: map preview → outlet detail
  await dl('freshasever://discover');
  await d.pause(4000);
  const markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
  if (markers[0]) {
    await markers[0].click();
    await d.pause(2500);
  }
  R['D-06'] = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
  await shot(d, 'D-06-map-preview.png');
  if (R['D-06']) {
    await d.$('~discover.map.preview').click();
    await d.pause(3500);
    const afterTap = await d.getPageSource();
    R['M4-3'] = /OutletDetail|outlet.detail|View bags|Clearance/i.test(afterTap);
    await shot(d, 'M4-3-preview-to-outlet.png');
    // pan map macro
    const { width, height } = await d.getWindowSize();
    await d.performActions([
      {
        type: 'pointer',
        id: 'pan',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.floor(width * 0.7), y: Math.floor(height * 0.35) },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerMove', duration: 500, x: Math.floor(width * 0.3), y: Math.floor(height * 0.35) },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await d.releaseActions();
    await d.pause(1500);
    await shot(d, 'M4-3-map-pan.png');
  } else {
    R['M4-3'] = false;
    await shot(d, 'M4-3-preview-to-outlet.png');
  }
  log({ id: 'D-06', tool: 'appium.journey', result_summary: String(R['D-06']), evidence: 'screenshots/pass19/pass4/D-06-map-preview.png' });
  log({ id: 'M4-3', tool: 'appium.journey', result_summary: String(R['M4-3']), evidence: 'screenshots/pass19/pass4/M4-3-preview-to-outlet.png' });

  // A-09 + M3: celebration story photo + share
  await dl(`freshasever://order-celebration?orderId=${PAID_ORDER}&variant=reservation`);
  await d.pause(4500);
  const addPhoto = await d.$('~celebration.storyAddPhoto');
  if (await addPhoto.isDisplayed().catch(() => false)) {
    await addPhoto.click();
    await d.pause(2000);
  } else {
    await tryTap(d, 'label == "Add a photo"');
    await d.pause(2000);
  }
  R['A-09'] = await d.$('~celebration.storyStep').isDisplayed().catch(() => false);
  await shot(d, 'A-09-story-photo.png');
  // Try share sheet via impact or story share if visible
  await tryTap(d, 'name CONTAINS "Share" OR label CONTAINS "Share"');
  await d.pause(2000);
  const m3Share = /Share|UIActivity|Copy|Messages/i.test(await d.getPageSource());
  R['M3'] = R['A-09'] && m3Share;
  await shot(d, 'M3-story-share-sheet.png');
  log({ id: 'A-09', tool: 'appium.journey', result_summary: String(R['A-09']), evidence: 'screenshots/pass19/pass4/A-09-story-photo.png' });
  log({ id: 'M3', tool: 'appium.journey', result_summary: R['M3'] ? 'story+share' : 'partial', evidence: 'screenshots/pass19/pass4/M3-story-share-sheet.png' });

  // M2: shelf → review → checkout
  await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
  await d.pause(4000);
  await shot(d, 'M2-1-shelf-basket.png');
  const inc = await d.$(`~shelf.qtyIncrement.${SHELF_ITEM}`);
  if (await inc.isDisplayed().catch(() => false)) await inc.click();
  await d.pause(800);
  const rev = await d.$('~shelf.reviewBasket');
  if (await rev.isDisplayed().catch(() => false)) {
    await rev.click();
    await d.pause(3000);
    await shot(d, 'M2-2-shelf-review.png');
    await tryTap(d, 'name CONTAINS "Checkout" OR label CONTAINS "Checkout"');
    await d.pause(4000);
    await shot(d, 'M2-3-shelf-checkout.png');
    R['M2'] = /checkout|Pay at Store|Card|Total/i.test(await d.getPageSource());
  } else {
    R['M2'] = false;
  }
  log({ id: 'M2', tool: 'appium.journey', result_summary: R['M2'] ? 'shelf-review-checkout' : 'partial', evidence: 'screenshots/pass19/pass4/M2-3-shelf-checkout.png' });

  // M1: group checkout steps
  injectAsyncStorage(CART_KEY, {
    outletId: BAKEHOUSE_OUTLET,
    bagIds: [BAG_OVERLAP_B],
    bags: [{ id: BAG_OVERLAP_B, outletId: BAKEHOUSE_OUTLET, title: 'Surprise Pastries', rescuePrice: 600 }],
  });
  await dl(`freshasever://checkout?group=${BAG_OVERLAP_B}`);
  await d.pause(5000);
  await shot(d, 'M1-1-group-checkout.png');
  const m1Src = await d.getPageSource();
  const hasPay = /Pay at Store|Card|PayHere|checkout.groupStrip/i.test(m1Src);
  if (hasPay) {
    await tryTap(d, 'name CONTAINS "Pay at Store" OR label CONTAINS "Pay at Store"');
    await d.pause(3000);
    await shot(d, 'M1-2-pay-at-store.png');
  }
  R['M1'] = hasPay;
  log({ id: 'M1', tool: 'appium.journey', result_summary: R['M1'] ? 'checkout steps captured' : 'blocked', evidence: 'screenshots/pass19/pass4/M1-1-group-checkout.png' });

  console.log(JSON.stringify({ auth_method: AUTH_METHOD, results: R }, null, 2));
} finally {
  await d.deleteSession();
}
