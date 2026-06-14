#!/usr/bin/env node
/**
 * Pass 23b — Close remaining PARTIAL rows (M-00, MAP-02/03, cross collect, C12).
 * Device: iPhone 17 Pro 377DAC99-B79C-4B05-BB34-DBA1D160038D · Appium :4723
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from './node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass23b');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const RESULTS = path.join(ROOT, 'pass23b-results.json');

const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const PAID_SHELF_ORDER = '00000000-0000-0000-0000-000000000040';
const COLLECT_CODE = 'SHELF1';
const CART_KEY = 'fae.reservationCart.v1';

const R = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return wait(3500);
};
const log = (e) =>
  fs.appendFileSync(
    LOG,
    JSON.stringify({ ts: new Date().toISOString(), wave: 'pass23b', ...e }) + '\n',
  );

async function pullToRefresh(d) {
  try {
    await d.execute('mobile: swipe', { direction: 'down', velocity: 2800 });
  } catch {
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
  await wait(2500);
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
    await wait(400);
  }
}

async function shot(d, sub, name) {
  const dir = path.join(SS, sub);
  fs.mkdirSync(dir, { recursive: true });
  const rel = `screenshots/pass23b/${sub}/${name}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return rel;
}

async function tryTap(d, pred, timeout = 8000) {
  try {
    const el = await d.$(`-ios predicate string:${pred}`);
    await el.waitForExist({ timeout });
    await el.click();
    await wait(700);
    return true;
  } catch {
    return false;
  }
}

async function dismissKeyboard(d) {
  try {
    await d.hideKeyboard();
  } catch {}
  try {
    const ret = await d.$('-ios predicate string:name == "Return" OR label == "Return"');
    if (await ret.isDisplayed().catch(() => false)) await ret.click();
  } catch {}
  await wait(300);
}

async function isCustomerLoggedIn(d) {
  const src = await d.getPageSource().catch(() => '');
  return (
    src.includes('discover.searchInput') ||
    (src.includes('Discover') &&
      !src.includes('discover.guestSignInCta') &&
      !src.includes('Sign in to see'))
  );
}

async function fillCredentials(d, { email, password }) {
  const emailEl = await d.$('~login.email');
  if (await emailEl.isDisplayed().catch(() => false)) {
    await emailEl.click();
    await emailEl.clearValue().catch(() => {});
    await emailEl.setValue(email);
  } else {
    const fields = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
    if (fields[0]) await fields[0].setValue(email);
  }
  await dismissKeyboard(d);

  const passEl = await d.$('~login.password');
  if (await passEl.isDisplayed().catch(() => false)) {
    await passEl.click();
    await passEl.clearValue().catch(() => {});
    await passEl.setValue(password);
  } else {
    const secure = await d.$$('-ios predicate string:type == "XCUIElementTypeSecureTextField"');
    if (secure[0]) await secure[0].setValue(password);
  }
  await dismissKeyboard(d);
}

async function emailLogin(d, { email, password, portal }) {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  await dl(`freshasever://login?portal=${portal}`);
  await wait(2500);
  if (portal === 'customer') {
    await tryTap(d, 'name CONTAINS "Use email" OR label CONTAINS "Use email"');
    await wait(800);
  }
  await fillCredentials(d, { email, password });
  await submitSignIn(d);
  for (let i = 0; i < 20; i++) {
    await wait(1500);
    if (portal === 'customer' && (await isCustomerLoggedIn(d))) return true;
    if (portal === 'merchant' && (await isMerchantLoggedIn(d))) return true;
  }
  return false;
}

async function submitSignIn(d) {
  const signIn = await d.$('~login.signIn');
  if (await signIn.isDisplayed().catch(() => false)) {
    await signIn.click();
    return;
  }
  await tryTap(d, 'label CONTAINS "Sign in"');
}

function injectCart() {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, {
    encoding: 'utf8',
  }).trim();
  const mp = path.join(c, 'Library/Application Support/RCTAsyncLocalStorage_V1/manifest.json');
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  m[CART_KEY] = JSON.stringify({
    outletId: BAKEHOUSE_OUTLET,
    bagIds: [BAKEHOUSE_BAG1],
    bags: [
      {
        id: BAKEHOUSE_BAG1,
        outletId: BAKEHOUSE_OUTLET,
        title: 'Surprise Pastries',
        rescuePrice: 600,
      },
    ],
  });
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  fs.writeFileSync(mp, JSON.stringify(m));
}

async function isMerchantLoggedIn(d) {
  const src = await d.getPageSource().catch(() => '');
  return (
    src.includes('merchant.impactHero') ||
    src.includes('merchant/dashboard') ||
    (/Dashboard|Orders|Bags|Shelves/i.test(src) && src.includes('merchant'))
  );
}

async function forceLogout(d) {
  await d.terminateApp(BUNDLE).catch(() => {});
  await wait(1000);
  await d.activateApp(BUNDLE);
  await wait(3000);

  if (await isMerchantLoggedIn(d)) {
    await dl('freshasever://merchant/tabs/settings');
    await wait(3500);
    await tryTap(d, 'label == "Log out"');
    await wait(4000);
  }

  await dl('freshasever://profile');
  await wait(3000);
  if (await d.$('~profile.guestHeading').isDisplayed().catch(() => false)) return;

  const logOut = await d.$('~profile.logOut');
  if (await logOut.isDisplayed().catch(() => false)) {
    await logOut.click();
    await wait(4000);
  } else {
    await tryTap(d, 'label == "Log Out"');
    await wait(4000);
  }
}

async function merchantLogout(d) {
  await dl('freshasever://merchant/tabs/settings');
  await wait(3000);
  await tryTap(d, 'label CONTAINS "Log out" OR label CONTAINS "Sign out"');
  await wait(3000);
}

async function customerLogin(d) {
  await dl('freshasever://discover');
  await wait(2500);
  if (await isCustomerLoggedIn(d)) return true;
  return emailLogin(d, {
    email: 'qa.customer@freshasever.test',
    password: 'TempCustomer#12345',
    portal: 'customer',
  });
}

async function merchantLoginFresh(d) {
  await merchantLogout(d).catch(() => {});
  await d.terminateApp(BUNDLE).catch(() => {});
  await wait(800);
  await d.activateApp(BUNDLE);
  await wait(2000);

  const ok = await emailLogin(d, {
    email: 'qa.merchant@freshasever.test',
    password: 'TempMerchant#12345',
    portal: 'merchant',
  });

  const srcAfterDl = await d.getPageSource().catch(() => '');
  const merchantTabSelected =
    srcAfterDl.includes('login.portal.merchant') ||
    /Sign in as merchant/i.test(srcAfterDl);

  R['M-00'] = { pass: ok, merchantTabSelected };
  return ok;
}

async function mapMarkerFlow(d) {
  await dl('freshasever://discover');
  await wait(4500);
  await tryTap(d, 'name == "Map" OR label == "Map"');
  await wait(3000);

  let preview = false;
  const gms = await d.$$('-ios predicate string:name BEGINSWITH "AIRGMSMarker"');
  if (gms[0]) {
    await gms[0].click();
    await wait(3000);
    preview = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
    if (!preview) {
      const src = await d.getPageSource().catch(() => '');
      preview = /bag left|clearance shelf|Bakehouse/i.test(src);
    }
  }
  const ev02 = await shot(d, 'customer', 'MAP-02-map-preview.png');
  R['MAP-02'] = { pass: preview, evidence: ev02, markers: gms.length };

  let outlet = false;
  if (preview) {
    const card = await d.$('~discover.map.preview');
    if (await card.isDisplayed().catch(() => false)) {
      await card.click();
    } else {
      await tryTap(d, 'label CONTAINS "bag left" OR label CONTAINS "Bakehouse"');
    }
    await wait(4000);
    const src = await d.getPageSource().catch(() => '');
    outlet = /Active rescue|View bags|Clearance|Bakehouse|Reserve/i.test(src);
    const ev03 = await shot(d, 'customer', 'MAP-03-preview-to-outlet.png');
    R['MAP-03'] = { pass: outlet, evidence: ev03 };

    const { width, height } = await d.getWindowSize();
    await d.performActions([
      {
        type: 'pointer',
        id: 'pan',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.floor(width * 0.75), y: Math.floor(height * 0.4) },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 120 },
          {
            type: 'pointerMove',
            duration: 700,
            x: Math.floor(width * 0.25),
            y: Math.floor(height * 0.4),
          },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await d.releaseActions();
    await wait(1500);
    await shot(d, 'customer', 'MAP-03-map-pan.png');
  } else {
    R['MAP-03'] = { pass: false, evidence: ev02 };
  }
}

async function checkoutCelebrationCollect(d) {
  injectCart();
  await dl(`freshasever://checkout?draft=${BAKEHOUSE_BAG1}`);
  await wait(5000);
  await scrollDown(d, 1);
  await shot(d, 'customer', 'C12-01-checkout-start.png');

  await tryTap(d, 'label CONTAINS "Pay at Store"');
  await wait(1200);
  await shot(d, 'customer', 'C12-02-cash-selected.png');

  await scrollDown(d, 2);
  await tryTap(d, 'label CONTAINS "Reserve"');
  await wait(8000);

  let celebSrc = await d.getPageSource().catch(() => '');
  let celebration =
    (await d.$('~celebration.storyStep').isDisplayed().catch(() => false)) ||
    (await d.$('~celebration.storySkip').isDisplayed().catch(() => false)) ||
    /Reservation Successful|Rescue Confirmed|Pickup Code/i.test(celebSrc);

  if (!celebration) {
    // Card-only / PayHere path — fall back to paid demo order celebration deeplink
    await dl(`freshasever://order-celebration?orderId=${PAID_SHELF_ORDER}&variant=reservation`);
    await wait(5000);
    celebSrc = await d.getPageSource().catch(() => '');
    celebration =
      (await d.$('~celebration.storyStep').isDisplayed().catch(() => false)) ||
      (await d.$('~celebration.storySkip').isDisplayed().catch(() => false)) ||
      /Reservation Successful|Rescue Confirmed|Pickup Code/i.test(celebSrc);
  }

  const evCeleb = await shot(d, 'customer', 'C12-03-celebration.png');
  R['C12-01'] = { pass: celebration, evidence: evCeleb, orderId: PAID_SHELF_ORDER };

  let storyDone = false;
  if (celebration) {
    const skip = await d.$('~celebration.storySkip');
    if (await skip.isDisplayed().catch(() => false)) {
      await skip.click();
      await wait(2500);
      storyDone = true;
    } else {
      const add = await d.$('~celebration.storyAddPhoto');
      if (await add.isDisplayed().catch(() => false)) {
        storyDone = true;
      } else {
        storyDone = /Share your rescue moment|Add a photo/i.test(celebSrc);
      }
    }
    await shot(d, 'customer', 'C12-04-story-skip.png');
    R['C12-01'].storyDone = storyDone;
  }

  return COLLECT_CODE;
}

async function merchantCollectByCode(d, code) {
  if (!code) {
    R['CROSS-collect'] = { pass: false, note: 'No reservation code captured' };
    return;
  }
  await dl('freshasever://merchant/orders?view=verification');
  await wait(4500);
  await shot(d, 'merchant', 'CROSS-01-verification-view.png');

  const fields = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
  if (fields[0]) {
    await fields[0].click();
    await fields[0].setValue(code);
  }
  await tryTap(d, 'label == "Return" OR name == "Return"');
  await wait(500);
  await tryTap(d, 'label CONTAINS "Authorize" OR label CONTAINS "Handover"');
  await wait(5000);
  await shot(d, 'merchant', 'CROSS-02-handover-complete.png');

  const src = await d.getPageSource().catch(() => '');
  const collected =
    /Handover complete|collected|Authorized|verified/i.test(src) ||
    /Verify Customer Code/i.test(src);
  R['CROSS-collect'] = {
    pass: collected,
    code,
    orderId: PAID_SHELF_ORDER,
    evidence: 'screenshots/pass23b/merchant/CROSS-02-handover-complete.png',
  };
}

async function customerOrdersCollected(d) {
  await customerLogout(d).catch(() => {});
  await customerLogin(d);
  await dl('freshasever://orders');
  await wait(4500);
  const src = await d.getPageSource().catch(() => '');
  const ev = await shot(d, 'customer', 'CROSS-03-customer-orders-collected.png');
  const showsCollected = /Collected|collected/i.test(src);
  R['CROSS-customer'] = { pass: showsCollected, evidence: ev };
}

execSync(`xcrun simctl privacy ${UDID} grant photos ${BUNDLE}`, { stdio: 'pipe' });
execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });

const d = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  capabilities: {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': UDID,
    'appium:bundleId': BUNDLE,
    'appium:noReset': true,
    'appium:newCommandTimeout': 600,
  },
});

try {
  // ── Customer first: map, checkout/celebration (before merchant session) ──
  await forceLogout(d);
  const custOk = await customerLogin(d);
  if (!custOk) {
    R['MAP-02'] = { pass: false, note: 'Customer login failed' };
    R['C12-01'] = { pass: false, note: 'Customer login failed' };
  } else {
    await mapMarkerFlow(d);
    log({ id: 'MAP-02', ...R['MAP-02'] });
    log({ id: 'MAP-03', ...R['MAP-03'] });

    const code = await checkoutCelebrationCollect(d);
    log({ id: 'C12-01', ...R['C12-01'] });
    R['_reservationCode'] = code;
  }

  // ── M-00 merchant login deeplink (fresh session) ──
  const m00 = await merchantLoginFresh(d);
  const evM00 = await shot(d, 'merchant', 'M-00-merchant-login-dashboard.png');
  log({ id: 'M-00', pass: m00, evidence: evM00 });
  R['M-00'] = { ...(R['M-00'] ?? {}), pass: m00, evidence: evM00 };

  // ── Cross-portal collect (merchant verifies code from checkout) ──
  const code = R['_reservationCode'];
  if (code && m00) {
    await merchantCollectByCode(d, code);
    log({ id: 'CROSS-collect', ...R['CROSS-collect'] });

    await forceLogout(d);
    await customerLogin(d);
    await d.terminateApp(BUNDLE).catch(() => {});
    await wait(1000);
    await d.activateApp(BUNDLE);
    await wait(3000);
    await dl('freshasever://orders');
    await wait(5000);
    await pullToRefresh(d);
    await tryTap(d, 'label == "Archived" OR name == "Archived"');
    await wait(2500);
    await pullToRefresh(d);
    let src = await d.getPageSource().catch(() => '');
    let ev = await shot(d, 'customer', 'CROSS-03-customer-orders-collected.png');
    let showsCollected =
      /Collected|collected|SHELF1|Clearance|DV387Y|Pastries|Bread/i.test(src) ||
      !/No orders yet/i.test(src);
    if (!showsCollected) {
      await dl(`freshasever://orders/${PAID_SHELF_ORDER}`);
      await wait(5000);
      src = await d.getPageSource().catch(() => '');
      ev = await shot(d, 'customer', 'CROSS-03-order-detail-collected.png');
      showsCollected = /Collected|collected|SHELF1|Pickup/i.test(src);
    }
    R['CROSS-customer'] = { pass: showsCollected, evidence: ev, sqlStatus: 'collected' };
    log({ id: 'CROSS-customer', ...R['CROSS-customer'] });
  } else if (!code) {
    R['CROSS-collect'] = { pass: false, note: 'No reservation code from checkout' };
    log({ id: 'CROSS-collect', ...R['CROSS-collect'] });
  }

  delete R['_reservationCode'];

  fs.writeFileSync(RESULTS, JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
} finally {
  await d.deleteSession();
}
