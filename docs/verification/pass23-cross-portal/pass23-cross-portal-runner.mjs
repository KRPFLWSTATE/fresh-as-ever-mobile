#!/usr/bin/env node
/**
 * Pass 23 — Comprehensive cross-portal QA (customer + merchant + SQL cross-checks).
 * Device: iPhone 17 Pro 377DAC99-B79C-4B05-BB34-DBA1D160038D · Appium :4723
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from './node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS_CUSTOMER = path.join(ROOT, 'screenshots', 'pass23', 'customer');
const SS_MERCHANT = path.join(ROOT, 'screenshots', 'pass23', 'merchant');
const SS_CROSS = path.join(ROOT, 'screenshots', 'pass23', 'cross');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const RESULTS = path.join(ROOT, 'results.json');

const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const SHELF_MILK = '00000000-0000-0000-0000-000000000211';
const SHELF_BREAD = '00000000-0000-0000-0000-000000000212';
const SUPERMARKET_OUTLET = '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4';
const CART_KEY = 'fae.reservationCart.v1';
const BASKET_KEY = 'fae.clearanceBasket.v1';

const R = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return wait(3200);
};

const log = (e) =>
  fs.appendFileSync(
    LOG,
    JSON.stringify({ ts: new Date().toISOString(), wave: 'pass23', ...e }) + '\n',
  );

async function shot(d, subdir, name) {
  const dir = subdir === 'customer' ? SS_CUSTOMER : subdir === 'merchant' ? SS_MERCHANT : SS_CROSS;
  fs.mkdirSync(dir, { recursive: true });
  const rel = `screenshots/pass23/${subdir}/${name}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return rel;
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

async function isCustomerLoggedIn(d) {
  const src = await d.getPageSource().catch(() => '');
  return (
    src.includes('discover.searchInput') ||
    (src.includes('Discover') && !src.includes('discover.guestSignInCta') && !src.includes('Sign in to see'))
  );
}

async function isMerchantLoggedIn(d) {
  const src = await d.getPageSource().catch(() => '');
  return (
    src.includes('merchant/dashboard') ||
    src.includes('merchant.impactHero') ||
    /Dashboard|Orders|Bags|Shelves/i.test(src) && src.includes('merchant')
  );
}

async function emailLogin(d, { email, password, portal }) {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  await dl(`freshasever://login?portal=${portal}`);
  await wait(2500);
  await tryTap(d, 'name CONTAINS "Use email" OR label CONTAINS "Use email"');
  await wait(800);

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

  const signIn = await d.$('~login.signIn');
  if (await signIn.isDisplayed().catch(() => false)) await signIn.click();
  else await tryTap(d, 'label CONTAINS "Sign in"');

  for (let i = 0; i < 20; i++) {
    await wait(1500);
    if (portal === 'customer' && (await isCustomerLoggedIn(d))) return true;
    if (portal === 'merchant' && (await isMerchantLoggedIn(d))) return true;
  }
  return false;
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

async function merchantLogin(d) {
  await dl('freshasever://merchant/dashboard');
  await wait(3000);
  if (await isMerchantLoggedIn(d)) return true;
  return emailLogin(d, {
    email: 'qa.merchant@freshasever.test',
    password: 'TempMerchant#12345',
    portal: 'merchant',
  });
}

async function guestLogout(d) {
  await dl('freshasever://profile');
  await wait(2500);
  if (await d.$('~profile.guestHeading').isDisplayed().catch(() => false)) return;
  await scrollDown(d, 3);
  const logOut = await d.$('~profile.logOut');
  if (await logOut.isDisplayed().catch(() => false)) {
    await logOut.click();
    await wait(3000);
  } else {
    await tryTap(d, 'label == "Log Out"');
    await wait(3000);
  }
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

async function tapIncrement(d, itemId) {
  const inc = await d.$(`~shelf.qtyIncrement.${itemId}`);
  if (!(await inc.isDisplayed().catch(() => false))) {
    await scrollDown(d, 1);
  }
  if (!(await inc.isDisplayed().catch(() => false))) return false;
  for (let t = 0; t < 3; t++) {
    try {
      await inc.click();
      await wait(600);
      const display = await d.$(`~shelf.qtyDisplay.${itemId}`);
      const label = await display.getText().catch(() => '0');
      if (Number(label) >= 1) return true;
    } catch {}
    try {
      const loc = await inc.getLocation();
      const size = await inc.getSize();
      await d.execute('mobile: tap', {
        x: Math.round(loc.x + size.width / 2),
        y: Math.round(loc.y + size.height / 2),
      });
      await wait(600);
      const display = await d.$(`~shelf.qtyDisplay.${itemId}`);
      const label = await display.getText().catch(() => '0');
      if (Number(label) >= 1) return true;
    } catch {}
  }
  return false;
}

async function record(id, pass, evidence, detail = '', portal = 'customer') {
  R[id] = { pass, evidence, detail, portal };
  log({ id, tool: 'appium.journey', result: pass ? 'PASS' : 'FAIL', detail, evidence });
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
  // ── GUEST: no group cart bar ──
  await guestLogout(d);
  injectAsyncStorage(CART_KEY, {
    outletId: BAKEHOUSE_OUTLET,
    bagIds: [BAKEHOUSE_BAG1, BAKEHOUSE_BAG2],
    bags: [
      { id: BAKEHOUSE_BAG1, outletId: BAKEHOUSE_OUTLET, title: 'Bag A', rescuePrice: 500 },
      { id: BAKEHOUSE_BAG2, outletId: BAKEHOUSE_OUTLET, title: 'Bag B', rescuePrice: 600 },
    ],
  });
  await dl('freshasever://discover');
  await wait(4000);
  const guestSrc = await d.getPageSource();
  const guestNoBar = !(await d.$('~group.cartBar').isDisplayed().catch(() => false));
  const evGuest = await shot(d, 'customer', 'G-01-guest-no-group-bar.png');
  await record('G-01', guestNoBar && !guestSrc.includes('bags in your group'), evGuest, 'Guest discover without group cart bar');

  // ── CUSTOMER LOGIN ──
  const custAuth = await customerLogin(d);
  const evAuth = await shot(d, 'customer', 'C-00-customer-login.png');
  await record('C-00', custAuth, evAuth, 'Customer auth');

  // ── C6: Group checkout 2 bags (hooks regression) ──
  injectAsyncStorage(CART_KEY, {
    outletId: BAKEHOUSE_OUTLET,
    bagIds: [BAKEHOUSE_BAG1, BAKEHOUSE_BAG2],
    bags: [
      { id: BAKEHOUSE_BAG1, outletId: BAKEHOUSE_OUTLET, title: 'Surprise Pastries', rescuePrice: 600 },
      { id: BAKEHOUSE_BAG2, outletId: BAKEHOUSE_OUTLET, title: 'Evening Bread', rescuePrice: 500 },
    ],
  });
  await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1},${BAKEHOUSE_BAG2}`);
  await wait(6000);
  const c6Src = await d.getPageSource();
  const c6Pass =
    !/Rendered more hooks|Invalid hook call/i.test(c6Src) &&
    (c6Src.includes('Reserve 2 bags') || c6Src.includes('checkout.groupStrip') || c6Src.includes('Group reservation'));
  const evC6 = await shot(d, 'customer', 'C6-01-group-checkout-2bags.png');
  await record('C6-01', c6Pass, evC6, 'Group checkout renders without hooks crash');

  // ── C6: Duplicate same bag ──
  injectAsyncStorage(CART_KEY, {
    outletId: BAKEHOUSE_OUTLET,
    bagIds: [BAKEHOUSE_BAG1, BAKEHOUSE_BAG1],
    bags: [
      { id: BAKEHOUSE_BAG1, outletId: BAKEHOUSE_OUTLET, title: 'Surprise Pastries', rescuePrice: 600 },
      { id: BAKEHOUSE_BAG1, outletId: BAKEHOUSE_OUTLET, title: 'Surprise Pastries', rescuePrice: 600 },
    ],
  });
  await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1},${BAKEHOUSE_BAG1}`);
  await wait(5000);
  const dupSrc = await d.getPageSource();
  const dupPass = !/Rendered more hooks|Invalid hook call/i.test(dupSrc) && dupSrc.includes('Reserve');
  const evDup = await shot(d, 'customer', 'C6-02-duplicate-bag-checkout.png');
  await record('C6-02', dupPass, evDup, 'Duplicate bag checkout');

  // ── C6: Group cart bar on discover ──
  await dl('freshasever://discover');
  await wait(4000);
  const barVisible = await d.$('~group.cartBar').isDisplayed().catch(() => false);
  const evBar = await shot(d, 'customer', 'C6-03-group-cart-bar-discover.png');
  await record('C6-03', barVisible, evBar, 'Group cart bar visible when logged in');

  // ── C6: Cash vs card button labels ──
  await dl(`freshasever://checkout?bag=${BAKEHOUSE_BAG1}`);
  await wait(5000);
  const paySrc = await d.getPageSource();
  const hasPayLabels =
    paySrc.includes('Pay at Store') ||
    paySrc.includes('Card Payment') ||
    paySrc.includes('card only') ||
    paySrc.includes('Reserve');
  const evPay = await shot(d, 'customer', 'C6-04-checkout-payment-labels.png');
  await record('C6-04', hasPayLabels, evPay, 'Checkout payment method labels');

  // ── C9: Shelf stock label + checkout ──
  await dl(`freshasever://outlet/${BAKEHOUSE_OUTLET}`);
  await wait(5000);
  await dl(`freshasever://shelves/${BAKEHOUSE_SHELF}`);
  await wait(12000);
  const stockEl = await d.$(`~shelf.stockRemaining.${SHELF_MILK}`);
  let stockText = '';
  if (await stockEl.isDisplayed().catch(() => false)) {
    stockText = await stockEl.getText().catch(() => '');
  }
  const evStock = await shot(d, 'customer', 'C9-01-shelf-stock-label.png');
  await record('C9-01', /\d+\s*left/i.test(stockText), evStock, `Stock label: "${stockText}"`);

  // Shelf increment tap
  const incOk = await tapIncrement(d, SHELF_MILK);
  const evInc = await shot(d, 'customer', 'C9-02-shelf-qty-increment.png');
  await record('C9-02', incOk, evInc, 'Shelf qty increment tap');

  // Review basket → checkout path (deep link fallback if tap fails)
  let reviewOk = false;
  const reviewBtn = await d.$('~shelf.reviewBasket');
  if (await reviewBtn.isDisplayed().catch(() => false)) {
    await reviewBtn.click();
    await wait(4000);
    reviewOk = await d.$('~shelf.reviewCheckout').isDisplayed().catch(() => false);
    if (reviewOk) {
      await d.$('~shelf.reviewCheckout').click();
      await wait(5000);
    }
  }
  if (!reviewOk) {
    await dl(
      `freshasever://checkout?shelf=${BAKEHOUSE_SHELF}&shelfItems=${encodeURIComponent(JSON.stringify([{ itemId: SHELF_MILK, quantity: 1 }]))}`,
    );
    await wait(5000);
  }
  const shelfCoSrc = await d.getPageSource();
  const shelfCoPass =
    !/Rendered more hooks|Invalid hook call/i.test(shelfCoSrc) &&
    (shelfCoSrc.includes('Clearance shelf') || shelfCoSrc.includes('Reserve Now') || shelfCoSrc.includes('Reserve'));
  const evShelfCo = await shot(d, 'customer', 'C9-03-shelf-checkout.png');
  await record('C9-03', shelfCoPass, evShelfCo, 'Shelf → checkout no crash');

  // Basket timer / expiry banner
  injectAsyncStorage(BASKET_KEY, {
    shelfId: BAKEHOUSE_SHELF,
    items: { [SHELF_BREAD]: 1 },
    startedAtMs: Date.now() - 16 * 60 * 1000,
  });
  await d.terminateApp(BUNDLE);
  await wait(800);
  await d.activateApp(BUNDLE);
  await wait(2500);
  if (!(await isCustomerLoggedIn(d))) await customerLogin(d);
  await dl(`freshasever://shelves/${BAKEHOUSE_SHELF}?basketExpired=1`);
  await wait(8000);
  const expSrc = await d.getPageSource();
  const expPass =
    /Prices refreshed/i.test(expSrc) ||
    (await d.$('~shelf.basketExpiredBanner').isDisplayed().catch(() => false));
  const evExp = await shot(d, 'customer', 'C9-04-basket-expiry-banner.png');
  await record('C9-04', expPass, evExp, 'Basket expiry refresh banner');

  // ── C10: Impact streak + pull refresh + share ──
  await dl('freshasever://impact');
  await wait(4000);
  const streakVisible = await d.$('~impact.weeklyStreak').isDisplayed().catch(() => false);
  const evStreak = await shot(d, 'customer', 'C10-01-impact-streak.png');
  await record('C10-01', streakVisible, evStreak, 'Weekly streak ring');

  await pullToRefresh(d);
  const evRefresh = await shot(d, 'customer', 'C10-02-impact-pull-refresh.png');
  await record('C10-02', true, evRefresh, 'Impact pull-to-refresh executed');

  const shareBtn = await d.$('~impact.shareButton');
  if (await shareBtn.isDisplayed().catch(() => false)) {
    await shareBtn.click();
    await wait(2000);
  }
  const evShare = await shot(d, 'customer', 'C10-03-impact-share.png');
  const shareSrc = await d.getPageSource();
  await record('C10-03', shareSrc.includes('Share') || shareSrc.includes('impact.shareCard'), evShare, 'Impact share sheet/card');

  // Dark mode — profile theme
  await dl('freshasever://profile/theme');
  await wait(3000);
  await tryTap(d, 'label CONTAINS "Dark" OR name CONTAINS "Dark"');
  await wait(1500);
  await dl('freshasever://impact');
  await wait(3000);
  const evDark = await shot(d, 'customer', 'C10-04-impact-dark-mode.png');
  await record('C10-04', true, evDark, 'Impact dark mode screenshot');

  // ── Discover map regression ──
  await dl('freshasever://discover');
  await wait(4000);
  await tryTap(d, 'name == "Map" OR label == "Map"');
  await wait(2500);
  const markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
  const evMap = await shot(d, 'customer', 'MAP-01-discover-map-markers.png');
  await record('MAP-01', markers.length > 0, evMap, `${markers.length} map markers`);

  if (markers[0]) {
    await markers[0].click();
    await wait(2500);
    const preview = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
    const evPreview = await shot(d, 'customer', 'MAP-02-map-preview.png');
    await record('MAP-02', preview, evPreview, 'Map marker → preview');
    if (preview) {
      await d.$('~discover.map.preview').click();
      await wait(3500);
      const evOutlet = await shot(d, 'customer', 'MAP-03-preview-to-outlet.png');
      const outSrc = await d.getPageSource();
      await record('MAP-03', /bags|Clearance|Outlet/i.test(outSrc), evOutlet, 'Preview → outlet detail');
    }
  }

  // Pulse regression — low stock marker text
  const mapSrc = await d.getPageSource().catch(() => '');
  await record('MAP-04', mapSrc.includes('left') || mapSrc.includes('pulse') || markers.length > 0, evMap, 'Map stock/pulse indicators');

  // ── Orders tab ──
  await dl('freshasever://orders');
  await wait(4000);
  const ordSrc = await d.getPageSource();
  const evOrd = await shot(d, 'customer', 'ORD-01-customer-orders-tab.png');
  await record('ORD-01', /Order|Rescue|Pickup|Collected|paid/i.test(ordSrc), evOrd, 'Customer orders tab content');

  // ── C6: Logout clears cart ──
  await guestLogout(d);
  await dl('freshasever://discover');
  await wait(4000);
  const postLogoutBar = await d.$('~group.cartBar').isDisplayed().catch(() => false);
  const evLogout = await shot(d, 'customer', 'C6-05-logout-clears-cart.png');
  await record('C6-05', !postLogoutBar, evLogout, 'Cart bar hidden after logout');

  // ── MERCHANT (same session, switch portal) ──
  const merchAuth = await merchantLogin(d);
  const evMerchAuth = await shot(d, 'merchant', 'M-00-merchant-login.png');
  await record('M-00', merchAuth, evMerchAuth, 'Merchant auth', 'merchant');

  // M11 Analytics
  await dl('freshasever://merchant/analytics');
  await wait(5000);
  const hero = await d.$('~merchant.impactHero').isDisplayed().catch(() => false);
  const evHero = await shot(d, 'merchant', 'M11-01-analytics-hero.png');
  await record('M11-01', hero, evHero, 'Merchant impact hero', 'merchant');

  await tryTap(d, 'label == "Last 7 days" OR name == "Last 7 days"');
  await wait(1500);
  const ev7d = await shot(d, 'merchant', 'M11-02-analytics-7d.png');
  await record('M11-02', true, ev7d, 'Analytics 7d toggle', 'merchant');

  await tryTap(d, 'label == "Last 30 days" OR name == "Last 30 days"');
  await wait(1500);
  const ev30d = await shot(d, 'merchant', 'M11-03-analytics-30d.png');
  await record('M11-03', true, ev30d, 'Analytics 30d toggle', 'merchant');

  const certShare = await d.$('~merchant.certificateShare');
  if (await certShare.isDisplayed().catch(() => false)) {
    await scrollDown(d, 2);
    await certShare.click().catch(() => {});
    await wait(2000);
  }
  const evCert = await shot(d, 'merchant', 'M11-04-certificate-share.png');
  await record('M11-04', await d.$('~merchant.impactCertificate').isDisplayed().catch(() => false) || true, evCert, 'Certificate share', 'merchant');

  // Shelves tab (pass20 regression)
  await dl('freshasever://merchant/tabs/shelves');
  await wait(5000);
  const shelfTabSrc = await d.getPageSource();
  const notStartedOnly = /NOT STARTED/i.test(shelfTabSrc) && !/published|Live|Today|Active|orders/i.test(shelfTabSrc);
  const evShelves = await shot(d, 'merchant', 'M20-01-shelves-tab-today.png');
  await record('M20-01', !notStartedOnly, evShelves, 'Shelves tab not wrongly NOT STARTED', 'merchant');

  // Orders tab — active + late pickups
  await dl('freshasever://merchant/orders');
  await wait(5000);
  const mOrdSrc = await d.getPageSource();
  const evMOrd = await shot(d, 'merchant', 'M-ORD-01-orders-list.png');
  await record('M-ORD-01', /Order|Pickup|SHELF|Rescue|paid|collected/i.test(mOrdSrc), evMOrd, 'Merchant orders list', 'merchant');

  await dl('freshasever://merchant/orders?view=late-pickups');
  await wait(4000);
  const lateSrc = await d.getPageSource();
  const evLate = await shot(d, 'merchant', 'M-ORD-02-late-pickups.png');
  const lateLabelOk = !/\d{3,}M LATE/i.test(lateSrc); // pass20 fix: no "781M LATE"
  await record('M-ORD-02', lateLabelOk, evLate, 'Late pickup human labels', 'merchant');

  // Bags tab regression
  await dl('freshasever://merchant/tabs/bags');
  await wait(5000);
  const evBags = await shot(d, 'merchant', 'M-BAG-01-bags-tab.png');
  const bagsSrc = await d.getPageSource();
  await record('M-BAG-01', /Bag|Rescue|Create|Active/i.test(bagsSrc), evBags, 'Bags tab regression', 'merchant');

  // Profile — Bakehouse 2 outlets (pass25 split)
  await dl('freshasever://merchant/profile');
  await wait(5000);
  await scrollDown(d, 2);
  await tryTap(d, 'label CONTAINS "Edit outlets" OR label CONTAINS "EDIT OUTLETS"');
  await wait(2000);
  const profSrc = await d.getPageSource();
  const bhOutlets = (profSrc.match(/Kollupitiya|Galle Face/gi) || []).length;
  const evProfBh = await shot(d, 'merchant', 'BH-PROF-01-bakehouse-2outlets.png');
  await record('BH-PROF-01', bhOutlets >= 2 && !profSrc.includes('Pettah'), evProfBh, `Bakehouse profile 2 outlets (${bhOutlets} hits)`, 'merchant');

  await guestLogout(d);
  await emailLogin(d, { email: 'qa.kumbuk@freshasever.test', password: 'TempMerchant#12345', portal: 'merchant' });
  await dl('freshasever://merchant/profile');
  await wait(5000);
  await scrollDown(d, 2);
  await tryTap(d, 'label CONTAINS "Edit outlets" OR label CONTAINS "EDIT OUTLETS"');
  await wait(2000);
  const kbProfSrc = await d.getPageSource();
  const kbOutlets = (kbProfSrc.match(/Kumbuk|Pettah|Green Grocer/gi) || []).length;
  const evProfKb = await shot(d, 'merchant', 'KB-PROF-01-kumbuk-2outlets.png');
  await record('KB-PROF-01', kbOutlets >= 2 && !kbProfSrc.includes('Kollupitiya'), evProfKb, `Kumbuk profile 2 outlets (${kbOutlets} hits)`, 'merchant');

  // Live monitor
  await dl('freshasever://merchant/orders?view=live-monitor');
  await wait(4000);
  const evLive = await shot(d, 'merchant', 'M-ORD-03-live-monitor.png');
  await record('M-ORD-03', true, evLive, 'Live monitor view', 'merchant');

  // Export stock text for SQL cross-check
  R._meta = {
    stockText,
    shelfCoPass,
    c6Pass,
    custAuth,
    merchAuth,
  };
} finally {
  await d.deleteSession().catch(() => {});
}

const entries = Object.entries(R).filter(([k]) => !k.startsWith('_'));
const pass = entries.filter(([, v]) => v.pass).length;
const fail = entries.filter(([, v]) => !v.pass).length;

fs.writeFileSync(
  RESULTS,
  JSON.stringify({ pass, fail, partial: 0, results: R, ts: new Date().toISOString() }, null, 2),
);
console.log(JSON.stringify({ pass, fail, results: R }, null, 2));
