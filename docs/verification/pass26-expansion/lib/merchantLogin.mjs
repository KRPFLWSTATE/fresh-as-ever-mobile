#!/usr/bin/env node
/** Pass 26 — shared login helpers (adapted from pass25 merchantLogin.mjs) */
import { execSync } from 'node:child_process';

export const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
export const BUNDLE = 'com.freshasever.mobile';

/** Colombo QA geolocation (Pass 26) */
export const COLOMBO_GEO = { latitude: 6.9271, longitude: 79.8612 };

export const CREDS = {
  bakehouse: { email: 'qa.merchant@freshasever.test', password: 'TempMerchant#12345' },
  kumbuk: { email: 'qa.kumbuk@freshasever.test', password: 'TempMerchant#12345' },
  customer: { email: 'qa.customer@freshasever.test', password: 'TempCustomer#12345' },
  admin: { email: 'qa.admin@freshasever.test', password: 'TempAdmin#12345' },
};

function loginDeeplink(portal, { merchant } = {}) {
  let url = `freshasever://login?portal=${portal}`;
  if (merchant === 'bakehouse' || merchant === 'kumbuk') {
    url += `&merchant=${merchant}`;
  }
  return url;
}

function merchantAccountFromEmail(email) {
  if (/kumbuk@/i.test(String(email))) return 'kumbuk';
  return 'bakehouse';
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function isSessionAlive(d) {
  try {
    await d.getWindowRect();
    return true;
  } catch {
    return false;
  }
}

export async function safePageSource(d) {
  try {
    return await d.getPageSource();
  } catch {
    await wait(1500);
    try {
      return await d.getPageSource();
    } catch {
      return '';
    }
  }
}

export const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  execSync(`xcrun simctl location ${UDID} set ${COLOMBO_GEO.latitude},${COLOMBO_GEO.longitude}`, { stdio: 'pipe' });
  return wait(3200);
};

export async function fillLoginField(el, value, { secure = false, skipClear = false } = {}) {
  const target = String(value);
  if (skipClear) {
    try {
      const current = String((await el.getValue().catch(() => '')) || '').trim();
      if (current === target || (!secure && current && current.includes(target))) return;
    } catch {}
  }
  await el.click();
  await wait(200);
  try {
    await el.setValue(target);
    await wait(secure ? 120 : 80);
    if (!secure) {
      const after = String((await el.getValue().catch(() => '')) || '').trim();
      if (after === target || after.includes(target)) return;
    } else {
      return;
    }
  } catch {}
  try {
    await el.clearValue();
  } catch {}
  try {
    await el.setValue('');
  } catch {}
  const maxChars = secure ? 48 : 64;
  let typed = 0;
  for (const ch of target) {
    if (typed >= maxChars) break;
    await el.addValue(ch);
    typed += 1;
    await wait(secure ? 25 : 15);
  }
  await wait(150);
  if (!secure) {
    try {
      const current = String((await el.getValue().catch(() => '')) || '');
      if (current && current !== target && !current.includes(target)) {
        await el.clearValue().catch(() => {});
        await el.setValue(target).catch(() => {});
      }
    } catch {}
  }
}


export async function qaAutofillReady(d, email) {
  const emailEl = await d.$('~login.email');
  if (!(await emailEl.isDisplayed().catch(() => false))) return false;
  const emailVal = String((await emailEl.getValue().catch(() => '')) || '').trim();
  if (emailVal !== String(email).trim()) return false;
  const signIn = await d.$('~login.signIn');
  if (!(await signIn.isDisplayed().catch(() => false))) return false;
  return await signIn.isEnabled().catch(() => false);
}

export async function dismissKeyboard(d) {
  if (!(await isSessionAlive(d))) return;
  try {
    const ret = await d.$('-ios predicate string:name == "Return" OR label == "Return"');
    if (await ret.isDisplayed().catch(() => false)) {
      await ret.click();
      await wait(200);
      return;
    }
  } catch {}
  try {
    const done = await d.$('-ios predicate string:name == "Done" OR label == "Done"');
    if (await done.isDisplayed().catch(() => false)) {
      await done.click();
      await wait(200);
      return;
    }
  } catch {}
  try {
    const { width, height } = await d.getWindowSize();
    await tapAt(d, width * 0.5, height * 0.25);
  } catch {}
  await wait(300);
}

export async function tapAt(d, x, y) {
  try {
    await d.performActions([
      {
        type: 'pointer',
        id: 'tapAt',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.floor(x), y: Math.floor(y) },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await d.releaseActions().catch(() => {});
    await wait(400);
    return true;
  } catch {
    return false;
  }
}
export async function tryTap(d, pred, timeout = 8000) {
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

/** Fast tap for system sheets — no long waitForExist poll. */
export async function tryTapVisible(d, pred, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await quickTap(d, pred)) return true;
    await scrollDown(d, 1);
    await wait(500);
  }
  return false;
}

export async function quickTap(d, pred) {
  try {
    const els = await d.$$(`-ios predicate string:${pred}`);
    for (const el of els) {
      if (await el.isDisplayed().catch(() => false)) {
        await el.click();
        await wait(400);
        return true;
      }
    }
  } catch {}
  return false;
}

/** iOS "Save Password?" sheet after email login. */
export async function dismissSavePassword(d) {
  for (let i = 0; i < 5; i++) {
    let notNow;
    try {
      notNow = await d.$('~Not Now');
    } catch {
      notNow = null;
    }
    if (notNow && (await notNow.isDisplayed().catch(() => false))) {
      await notNow.click();
      await wait(500);
      continue;
    }
    if (await quickTap(d, 'name == "Not Now" OR label == "Not Now"')) continue;
    if (await quickTap(d, 'name == "Never for This Website" OR label CONTAINS "Never"')) continue;

    const stillVisible = await d.$('~Not Now').isDisplayed().catch(() => false);
    if (!stillVisible) return true;

    const { width, height } = await d.getWindowSize().catch(() => ({ width: 393, height: 852 }));
    await tapAt(d, width * 0.28, height * 0.58);
    await wait(500);
  }
  return !(await d.$('~Not Now').isDisplayed().catch(() => false));
}

export async function tapSignIn(d, { portal } = {}) {
  if (portal === 'customer') {
    await ensureEmailLoginForm(d, 'customer');
    const src = await safePageSource(d);
    if (/Sign in as merchant/i.test(src)) {
      const cust = await d.$('~login.portal.customer');
      if (await cust.isDisplayed().catch(() => false)) await cust.click();
      await wait(900);
      await ensureEmailLoginForm(d, 'customer');
    }
  }
  const signIn = await d.$('~login.signIn');
  if (await signIn.isDisplayed().catch(() => false)) {
    const label = String((await signIn.getText().catch(() => '')) || '');
    if (portal === 'customer' && /merchant/i.test(label)) {
      await ensureEmailLoginForm(d, 'customer');
    } else {
      const enabled = await signIn.isEnabled().catch(() => true);
      if (enabled) {
        await signIn.click();
        await wait(700);
        return true;
      }
    }
  }
  if (portal === 'customer') {
    if (await tryTap(d, 'label == "Sign in" AND NOT label CONTAINS "merchant"', 2500)) return true;
  } else if (await tryTap(d, 'label CONTAINS "Sign in as merchant" OR label CONTAINS "Sign in"', 2500)) {
    return true;
  }
  try {
    const { width } = await d.getWindowSize();
    await d.performActions([
      {
        type: 'pointer',
        id: 'tapSignIn',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.floor(width / 2), y: 580 },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await d.releaseActions().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Dismiss stacked modals / sheets so the next deeplink lands cleanly. */
export async function dismissSystemPrompts(d) {
  await dismissSavePassword(d);
  for (let round = 0; round < 2; round++) {
    const dismissed =
      (await quickTap(d, 'label == "Don\'t Allow" OR label CONTAINS "Don\'t Allow"')) ||
      (await quickTap(d, 'label == "Later" OR name == "Later"')) ||
      (await quickTap(d, 'label == "Keep order" OR name == "Keep order"')) ||
      (await quickTap(d, 'label == "OK" OR name == "OK"')) ||
      (await quickTap(d, 'label == "Cancel" OR name == "Cancel"'));
    if (!dismissed) break;
    await wait(300);
  }
  try {
    const alerts = await d.$$('-ios class chain:**/XCUIElementTypeAlert');
    for (const alert of alerts) {
      const ok = await alert.$('-ios predicate string:label == "OK" OR name == "OK"');
      if (await ok.isDisplayed().catch(() => false)) await ok.click();
    }
  } catch {}
  await dismissKeyboard(d);
}

export async function dismissOverlays(d, rounds = 3) {
  await dismissSystemPrompts(d);
  for (let i = 0; i < rounds; i++) {
    const dismissed =
      (await tryTap(d, 'name CONTAINS "Close" OR label CONTAINS "Close"', 1200)) ||
      (await tryTap(d, 'name CONTAINS "Done" OR label CONTAINS "Done"', 1200)) ||
      (await tryTap(d, 'name CONTAINS "Cancel" OR label CONTAINS "Cancel"', 1200)) ||
      (await tryTap(d, 'name CONTAINS "Back" OR label CONTAINS "Back"', 1200)) ||
      (await tryTap(d, 'name CONTAINS "Dismiss" OR label CONTAINS "Dismiss"', 1200));
    if (!dismissed) break;
    await wait(500);
  }
}

export async function resetMerchantSurface(d) {
  await dismissOverlays(d);
  await dl('freshasever://merchant/dashboard');
  await wait(2000);
  await dismissOverlays(d);
}

export async function recoverFromErrorBoundary(d) {
  if (!(await isSessionAlive(d))) return false;
  const tryAgain = await d.$('-ios predicate string:label == "Try again"');
  if (await tryAgain.isDisplayed().catch(() => false)) {
    await tryAgain.click();
    await wait(2000);
    return true;
  }
  return false;
}

export async function ensureCustomerDiscover(d) {
  await recoverFromErrorBoundary(d);
  await tryTap(d, 'label == "Go back" OR label CONTAINS "Go back"', 2000);
  await dl('freshasever://discover');
  await wait(3500);
  if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  await tryTap(d, 'name == "tab.discover" OR label == "Discover"', 3000);
  await wait(2000);
  return d.$('~discover.searchInput').isDisplayed().catch(() => false);
}

export async function relaunchApp(d) {
  if (d && (await isSessionAlive(d))) {
    try {
      await d.terminateApp(BUNDLE);
      await wait(700);
      await d.activateApp(BUNDLE);
      return wait(4500);
    } catch {}
  }
  execSync(`xcrun simctl terminate ${UDID} ${BUNDLE}`, { stdio: 'pipe' });
  execSync(`xcrun simctl launch ${UDID} ${BUNDLE}`, { stdio: 'pipe' });
  return wait(4500);
}

export async function assessDiscoverMap(d) {
  const markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
  const gmsEls = await d.$$('-ios predicate string:name BEGINSWITH "AIRGMSMarker"');
  const chipText = (await d.$('~discover.map.countChip').getText().catch(() => '')) || '';
  const searchReady =
    (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) ||
    (await d
      .$('-ios predicate string:label CONTAINS "Search for fresh rescue" OR value CONTAINS "Search for fresh rescue"')
      .isDisplayed()
      .catch(() => false));
  const recenter = await d.$('~discover.map.recenter').isDisplayed().catch(() => false);
  const feedCards = await d.$$(
    '-ios predicate string:label CONTAINS "bags left" OR label CONTAINS "Reserve" OR label CONTAINS "Pastries" OR label CONTAINS "Bakehouse" OR label CONTAINS "Kumbuk"',
  );
  const feedReady =
    feedCards.length > 0 ||
    (await d.$('-ios predicate string:label == "Rescue near you"').isDisplayed().catch(() => false));
  const gmsCount = gmsEls.length;
  const pass =
    (searchReady || feedReady) &&
    (markers.length >= 1 ||
      gmsCount >= 1 ||
      /\d+ rescues here/.test(chipText) ||
      feedReady ||
      feedCards.length >= 1 ||
      (recenter && feedReady));
  return {
    pass,
    markers,
    gmsCount,
    chipText,
    feedReady,
    detail: `${markers.length} markers gms=${gmsCount} chip=${chipText || 'n/a'} feed=${feedReady}`,
  };
}

export async function scrollMapIntoView(d) {
  try {
    const { width, height } = await d.getWindowSize();
    await d.performActions([
      {
        type: 'pointer',
        id: 'scrollMapTop',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.floor(width / 2), y: Math.floor(height * 0.72) },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerMove', duration: 400, x: Math.floor(width / 2), y: Math.floor(height * 0.28) },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await d.releaseActions().catch(() => {});
    await wait(800);
  } catch {}
}

export async function ensureKumbukMerchantSession(d) {
  if ((await isMerchantLoggedIn(d)) && (await isKumbukMerchantSession(d))) return true;
  await dl('freshasever://login?portal=merchant');
  await wait(2500);
  const ok = await loginKumbuk(d);
  if (!ok) return false;
  return await waitForMerchantDashboard(d);
}

export async function dismissDiscoverSheets(d) {
  await dismissOverlays(d);
  await dismissSavePassword(d);
  await tryTap(d, 'label CONTAINS "Dismiss location" OR name CONTAINS "Dismiss location"', 2000);
  await tryTap(d, 'label == "Not now" OR label == "Not Now"', 1500);
}

const LANDMARK_ALIASES = {
  Pettah: ['Pettah', 'Pettah Green', 'Colombo 11'],
  'Galle Face': ['Galle Face', 'Galle Face Bites'],
};

function landmarkPatterns(landmark) {
  const aliases = LANDMARK_ALIASES[landmark] || [landmark];
  return aliases.map((token) => {
    const esc = String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(esc, 'i');
  });
}

export async function landmarkVisibleInDiscover(d, landmark) {
  const patterns = landmarkPatterns(landmark);
  const subs = await d.$$('-ios predicate string:name BEGINSWITH "discover.card.subtitle."');
  for (const el of subs) {
    const label =
      (await el.getText().catch(() => '')) ||
      (await el.getAttribute('label').catch(() => '')) ||
      (await el.getAttribute('name').catch(() => '')) ||
      '';
    if (patterns.some((re) => re.test(label))) return true;
  }
  const src = await safePageSource(d);
  if (patterns.some((re) => re.test(src))) return true;
  return false;
}

export async function scrollDiscoverListFeed(d, times = 1) {
  try {
    const feed = await d.$('~discover.list-feed');
    if (await feed.isExisting().catch(() => false)) {
      for (let i = 0; i < times; i++) {
        try {
          await feed.execute('mobile: scroll', { direction: 'down' });
        } catch {
          await scrollDown(d, 1);
        }
        await wait(600);
      }
      return;
    }
  } catch {}
  const { width, height } = await d.getWindowSize();
  for (let i = 0; i < times; i++) {
    await d.performActions([
      {
        type: 'pointer',
        id: 'feedScroll',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.floor(width / 2), y: Math.floor(height * 0.78) },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 80 },
          { type: 'pointerMove', duration: 450, x: Math.floor(width / 2), y: Math.floor(height * 0.42) },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await d.releaseActions().catch(() => {});
    await wait(500);
  }
}

export async function ensureDiscoverFeedInView(d) {
  const rescueNear = await d.$('-ios predicate string:label == "Rescue near you"');
  if (await rescueNear.isDisplayed().catch(() => false)) return true;
  await scrollMapIntoView(d);
  await wait(500);
  await scrollDiscoverListFeed(d, 2);
  return true;
}

export async function waitForLandmarkInDiscover(d, landmark, { timeoutMs = 45000, maxScrolls = 22 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let scrolls = 0;
  const searchInput = await d.$('~discover.searchInput');
  if (await searchInput.isDisplayed().catch(() => false)) {
    await searchInput.click().catch(() => {});
    await searchInput.setValue(String(landmark));
    await wait(2800);
    await dismissKeyboard(d);
    await dismissDiscoverSheets(d);
  }
  while (Date.now() < deadline) {
    if (!(await isSessionAlive(d))) return false;
    await recoverFromErrorBoundary(d);
    await dismissDiscoverSheets(d);
    if (await landmarkVisibleInDiscover(d, landmark)) return true;
    if (scrolls >= maxScrolls) break;
    await scrollDiscoverListFeed(d, 1);
    scrolls += 1;
    await wait(800);
  }
  return landmarkVisibleInDiscover(d, landmark);
}

export async function prepCustomerDiscover(d, { freshSession = false } = {}) {
  await recoverFromErrorBoundary(d);
  if (freshSession) {
    if (await isMerchantLoggedIn(d)) {
      await merchantLogout(d);
      await wait(2000);
    }
    const guest =
      (await d.$('~discover.guestSignInCta').isDisplayed().catch(() => false)) ||
      (await d.$('~profile.guestHeading').isDisplayed().catch(() => false));
    if (guest || (await d.$('~login.email').isDisplayed().catch(() => false))) {
      await relaunchApp(d);
    } else if (!(await isCustomerLoggedIn(d))) {
      await customerLogout(d).catch(() => {});
      await wait(1200);
      await relaunchApp(d);
    }
  }
  let loggedIn = await isCustomerLoggedIn(d);
  if (!loggedIn) loggedIn = await loginCustomer(d);
  if (!loggedIn) return false;
  await dismissDiscoverSheets(d);
  await dl('freshasever://discover');
  await wait(5500);
  await recoverFromErrorBoundary(d);
  await dismissDiscoverSheets(d);
  if (await d.$('~login.email').isDisplayed().catch(() => false)) {
    loggedIn = await loginCustomer(d);
    if (!loggedIn) return false;
    await dl('freshasever://discover');
    await wait(4500);
  }
  await ensureDiscoverFeedInView(d);
  await scrollDiscoverListFeed(d, 2);
  return await d.$('~discover.searchInput').isDisplayed().catch(() => false);
}

export async function waitForMapMarkers(d, { timeoutMs = 18000, min = 1 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isSessionAlive(d))) return [];
    await recoverFromErrorBoundary(d);
    let markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
    if (markers.length >= min) return markers;
    const gms = await d.$$('-ios predicate string:name BEGINSWITH "AIRGMSMarker"');
    if (gms.length >= min) return gms;
    const chipText = (await d.$('~discover.map.countChip').getText().catch(() => '')) || '';
    if (/\d+ rescues here/.test(chipText)) return markers.length ? markers : gms;
    const countChip = await d.$('~discover.map.countChip');
    if (await countChip.isDisplayed().catch(() => false)) {
      await countChip.click();
    } else {
      await scrollMapIntoView(d);
      await quickTap(d, 'name == "discover.map.recenter" OR label CONTAINS "Recenter"');
    }
    await wait(1200);
    markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
    if (markers.length >= min) return markers;
    if (gms.length >= min) return gms;
    await wait(800);
  }
  const markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
  if (markers.length >= min) return markers;
  return d.$$('-ios predicate string:name BEGINSWITH "AIRGMSMarker"');
}

export async function scrollDown(d, times = 1) {
  try {
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
  } catch {
    // Session may have ended — caller handles logout/login fallback.
  }
}

export async function isMerchantLoggedIn(d) {
  if (await d.$('~tab.merchant.home').isDisplayed().catch(() => false)) return true;
  if (await d.$('~merchant.impactHero').isDisplayed().catch(() => false)) return true;
  if (await d.$('~tab.merchant.settings').isDisplayed().catch(() => false)) return true;
  if (await d.$('~merchant.bags.activeOutlet').isDisplayed().catch(() => false)) return true;
  if (await d.$('~tab.merchant.orders').isDisplayed().catch(() => false)) return true;
  return false;
}

export async function waitForMerchantDashboard(d, { timeoutMs = 60000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await dismissSavePassword(d);
    await dismissSystemPrompts(d);
    if (await d.$('~tab.merchant.home').isDisplayed().catch(() => false)) return true;
    if (await isMerchantLoggedIn(d)) return true;
    await wait(2000);
  }
  return (
    (await d.$('~tab.merchant.home').isDisplayed().catch(() => false)) || (await isMerchantLoggedIn(d))
  );
}

export async function isCustomerLoggedIn(d) {
  if (await d.$('~profile.logOut').isDisplayed().catch(() => false)) return true;
  if (await d.$('~discover.guestSignInCta').isDisplayed().catch(() => false)) return false;
  if (await d.$('~profile.guestHeading').isDisplayed().catch(() => false)) return false;
  const src = await safePageSource(d);
  if (/discover\.guestSignIn|guestSignInCta|Sign in to see rescue bags/i.test(src)) return false;
  if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) {
    return !/guestSignIn|Sign in to see/i.test(src);
  }
  if (await d.$('~tab.profile').isDisplayed().catch(() => false)) {
    await dl('freshasever://profile');
    await wait(2000);
    if (await d.$('~profile.logOut').isDisplayed().catch(() => false)) return true;
    if (await d.$('~profile.guestHeading').isDisplayed().catch(() => false)) return false;
  }
  return false;
}

/** Confirm Supabase session hydrated — profile logout visible. */
export async function confirmCustomerAuth(d) {
  await dl('freshasever://profile');
  await wait(3000);
  await dismissOverlays(d);
  for (let i = 0; i < 8; i++) {
    if (await d.$('~profile.logOut').isDisplayed().catch(() => false)) return true;
    if (await d.$('~profile.guestHeading').isDisplayed().catch(() => false)) return false;
    await scrollDown(d, 1);
    await wait(400);
  }
  return false;
}

export async function waitForPostLoginSurface(d, portal, { timeoutMs = 60000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isSessionAlive(d))) return false;
    await dismissSavePassword(d);
    await dismissSystemPrompts(d);
    if (portal === 'customer') {
      if (await isCustomerLoggedIn(d)) return true;
      await tryTap(d, 'name == "tab.discover" OR label == "Discover"', 1500);
      await dl('freshasever://discover');
      await wait(2500);
      if (await isCustomerLoggedIn(d)) return true;
      if (!(await d.$('~login.email').isDisplayed().catch(() => false))) {
        await dl('freshasever://profile');
        await wait(2000);
        if (await d.$('~profile.logOut').isDisplayed().catch(() => false)) return true;
      }
    }
    if (portal === 'merchant') {
      if (await d.$('~tab.merchant.home').isDisplayed().catch(() => false)) return true;
      if (await isMerchantLoggedIn(d)) return true;
    }
    await wait(1500);
  }
  if (portal === 'customer') return await isCustomerLoggedIn(d);
  return (
    (await d.$('~tab.merchant.home').isDisplayed().catch(() => false)) || (await isMerchantLoggedIn(d))
  );
}

export async function screenshotLoginFail(d, tag = 'login-fail') {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const dir = path.join(here, '..', 'screenshots', 'login-fail');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${tag}-${Date.now()}.png`);
    fs.writeFileSync(file, Buffer.from(await d.takeScreenshot(), 'base64'));
    return file;
  } catch {
    return null;
  }
}

export async function waitForLoginScreen(d, { timeoutMs = 20000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isSessionAlive(d))) return false;
    await dismissSystemPrompts(d);
    if (
      (await d.$('~login.title').isDisplayed().catch(() => false)) ||
      (await d.$('~login.email').isDisplayed().catch(() => false)) ||
      (await d.$('~login.portal.merchant').isDisplayed().catch(() => false)) ||
      (await d.$('~login.portal.customer').isDisplayed().catch(() => false)) ||
      (await d.$('~discover.guestSignInCta').isDisplayed().catch(() => false)) ||
      (await d.$('~profile.guestHeading').isDisplayed().catch(() => false))
    ) {
      return true;
    }
    await wait(500);
  }
  return (
    (await d.$('~login.email').isDisplayed().catch(() => false)) ||
    (await d.$('~discover.guestSignInCta').isDisplayed().catch(() => false))
  );
}

export async function ensureMerchantLoginPortal(d, account = 'bakehouse') {
  await dismissSystemPrompts(d);
  await dismissOverlays(d);
  await dl(loginDeeplink('merchant', { merchant: account }));
  await wait(3500);
  await dismissSystemPrompts(d);
  const merch = await d.$('~login.portal.merchant');
  if (await merch.isDisplayed().catch(() => false)) {
    await merch.click();
    await wait(400);
  } else {
    await tryTap(d, 'label == "Merchant" OR name == "login.portal.merchant"', 2000);
  }
  await ensureEmailLoginForm(d, 'merchant');
  return d.$('~login.email').isDisplayed().catch(() => false);
}

export async function ensureEmailLoginForm(d, portal) {
  if (portal === 'merchant') {
    const merchantTab = await d.$('~login.portal.merchant');
    if (await merchantTab.isDisplayed().catch(() => false)) {
      await merchantTab.click();
      await wait(400);
    }
    if (await d.$('~login.email').isDisplayed().catch(() => false)) return true;
  }
  if (portal === 'customer') {
    const customerTab = await d.$('~login.portal.customer');
    if (await customerTab.isDisplayed().catch(() => false)) {
      await customerTab.click();
      await wait(900);
    } else {
      await tryTap(d, 'label == "Customer" OR name == "login.portal.customer"', 2000);
      await wait(600);
    }
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    if (await d.$('~login.email').isDisplayed().catch(() => false)) return true;
    const onLogin =
      (await d.$('~login.title').isDisplayed().catch(() => false)) ||
      (await d.$('~login.portal.customer').isDisplayed().catch(() => false)) ||
      (await d.$('~login.portal.merchant').isDisplayed().catch(() => false));
    const useEmail = await d.$('~login.useEmailPassword');
    if (await useEmail.isExisting().catch(() => false)) {
      if (!(await useEmail.isDisplayed().catch(() => false))) {
        await scrollDown(d, 1);
        await wait(400);
      }
      if (await useEmail.isDisplayed().catch(() => false)) {
        await useEmail.click();
        await wait(1200);
        if (await d.$('~login.email').isDisplayed().catch(() => false)) return true;
      }
      await quickTap(d, 'name == "login.useEmailPassword" OR label CONTAINS "Use email"');
      await wait(1200);
      if (await d.$('~login.email').isDisplayed().catch(() => false)) return true;
    }
    if (onLogin) {
      await tryTap(
        d,
        'label CONTAINS "Use email" OR name == "login.useEmailPassword"',
        2000,
      );
      await wait(900);
      if (await d.$('~login.email').isDisplayed().catch(() => false)) return true;
      await scrollDown(d, 1);
      continue;
    }
    await dl(`freshasever://login?portal=${portal}`);
    await wait(3200);
  }
  return d.$('~login.email').isDisplayed().catch(() => false);
}


export async function ensureCustomerEmailForm(d) {
  const customerTab = await d.$('~login.portal.customer');
  if (await customerTab.isDisplayed().catch(() => false)) {
    await customerTab.click();
    await wait(400);
  } else {
    await tryTap(d, 'label == "Customer" OR name == "Customer"', 2500);
  }
  const useEmail = await d.$('~login.useEmailPassword');
  for (let i = 0; i < 8; i++) {
    if (await d.$('~login.password').isDisplayed().catch(() => false)) return true;
    if (await useEmail.isDisplayed().catch(() => false)) {
      await useEmail.click();
      await wait(600);
      continue;
    }
    await tryTap(
      d,
      'label CONTAINS "Use email" OR name == "login.useEmailPassword"',
      1500,
    );
    await scrollDown(d, 1);
    await wait(400);
  }
  return d.$('~login.password').isDisplayed().catch(() => false);
}

export async function emailLogin(d, { email, password, portal }) {
  await dismissSystemPrompts(d);
  const merchantAccount = portal === 'merchant' ? merchantAccountFromEmail(email) : null;
  await dl(loginDeeplink(portal, { merchant: merchantAccount }));
  await wait(3500);
  await dismissSystemPrompts(d);
  await ensureEmailLoginForm(d, portal);
  await wait(portal === 'customer' ? 1200 : 900);

  const emailEl = await d.$('~login.email');
  for (let i = 0; i < 6; i++) {
    if (await emailEl.isDisplayed().catch(() => false)) break;
    await ensureEmailLoginForm(d, portal);
    await wait(500);
  }

  if (await qaAutofillReady(d, email)) {
    await dismissKeyboard(d);
    if (portal === 'merchant') {
      const passEl = await d.$('~login.password');
      if (await passEl.isExisting().catch(() => false)) {
        try {
          await passEl.scrollIntoView();
          await wait(300);
        } catch {
          await scrollDown(d, 1);
        }
      }
    }
    await dismissSavePassword(d);
    await tapSignIn(d, { portal });
    for (let i = 0; i < 25; i++) {
      await wait(1000);
      await dismissSavePassword(d);
      if (portal === 'customer' && (await isCustomerLoggedIn(d))) break;
      if (portal === 'customer' && (await d.$('~discover.searchInput').isDisplayed().catch(() => false))) {
        if (await isCustomerLoggedIn(d)) break;
      }
      if (!(await d.$('~login.email').isDisplayed().catch(() => false))) break;
      if (portal === 'merchant' && (await isMerchantLoggedIn(d))) break;
    }
    await dismissSavePassword(d);
    await dismissSystemPrompts(d);
    const landed = await waitForPostLoginSurface(d, portal, { timeoutMs: 60000 });
    if (!landed) return false;
    if (portal === 'customer') {
      await ensureCustomerDiscover(d);
      return await isCustomerLoggedIn(d);
    }
    await dl('freshasever://merchant/dashboard');
    await wait(2500);
    return await waitForMerchantDashboard(d, { timeoutMs: 15000 });
  }
  const currentEmail = String((await emailEl.getValue().catch(() => '')) || '').trim();
  if (portal === 'customer' && /merchant@/i.test(currentEmail)) {
    await tryTap(d, 'label == "Customer" OR name == "login.portal.customer"', 2500);
    await wait(700);
  }
  if (portal === 'merchant' && /customer@/i.test(currentEmail)) {
    await tryTap(d, 'label == "Merchant" OR name == "login.portal.merchant"', 2500);
    await wait(700);
  }
  if (
    portal === 'merchant' &&
    email === CREDS.kumbuk.email &&
    /merchant@/i.test(currentEmail)
  ) {
    await dl(loginDeeplink('merchant', { merchant: 'kumbuk' }));
    await wait(2500);
    await ensureMerchantLoginPortal(d, 'kumbuk');
    await wait(900);
  }
  const prefilled =
    String((await emailEl.getValue().catch(() => '')) || '').trim() === email;
  if (!prefilled) {
    if (await emailEl.isDisplayed().catch(() => false)) {
      await fillLoginField(emailEl, email, { skipClear: true });
    } else {
      const fields = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
      if (fields[0]) await fillLoginField(fields[0], email, { skipClear: true });
    }
    await dismissKeyboard(d);
    await wait(500);
  } else {
    await wait(400);
  }

  if (portal === 'customer') {
    await ensureEmailLoginForm(d, portal);
  }
  let passEl = await d.$('~login.password');
  for (let i = 0; i < 12; i++) {
    if (await passEl.isDisplayed().catch(() => false)) break;
    if (portal === 'customer') await ensureEmailLoginForm(d, portal);
    await dismissKeyboard(d);
    await tryTap(
      d,
      'name CONTAINS "Use email" OR label CONTAINS "Use email" OR name == "login.useEmailPassword"',
      1500,
    );
    await wait(500);
    passEl = await d.$('~login.password');
  }
  if (await passEl.isDisplayed().catch(() => false)) {
    try {
      await passEl.scrollIntoView();
      await wait(300);
    } catch {}
    await fillLoginField(passEl, password, { secure: true, skipClear: true });
  } else {
    const secure = await d.$$('-ios predicate string:type == "XCUIElementTypeSecureTextField"');
    if (secure[0]) {
      await fillLoginField(secure[0], password, { secure: true, skipClear: true });
    } else {
      const fields = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
      if (fields[1]) await fillLoginField(fields[1], password, { secure: true, skipClear: true });
    }
  }
  await dismissKeyboard(d);
  if (portal === 'merchant') {
    if (await passEl.isExisting().catch(() => false)) {
      try {
        await passEl.scrollIntoView();
        await wait(300);
      } catch {
        await scrollDown(d, 1);
      }
    }
  }
  await dismissSavePassword(d);
  await tapSignIn(d, { portal });
  for (let i = 0; i < 25; i++) {
    await wait(1000);
    await dismissSavePassword(d);
    if (portal === 'customer' && (await isCustomerLoggedIn(d))) break;
    if (portal === 'customer' && (await d.$('~discover.searchInput').isDisplayed().catch(() => false))) {
      if (await isCustomerLoggedIn(d)) break;
    }
    if (!(await d.$('~login.email').isDisplayed().catch(() => false))) break;
    if (portal === 'merchant' && (await isMerchantLoggedIn(d))) break;
  }
  await dismissSavePassword(d);
  await dismissSystemPrompts(d);

  const landed = await waitForPostLoginSurface(d, portal, { timeoutMs: 60000 });
  if (!landed) return false;
  if (portal === 'customer') {
    await ensureCustomerDiscover(d);
    return await isCustomerLoggedIn(d);
  }
  await dl('freshasever://merchant/dashboard');
  await wait(2500);
  return await waitForMerchantDashboard(d, { timeoutMs: 15000 });
}

export async function isBakehouseMerchantSession(d) {
  const outletLabel = (await d.$('~merchant.bags.activeOutlet').getText().catch(() => '')) || '';
  if (/Kollupitiya|Galle Face|Bakehouse/i.test(outletLabel)) return true;
  const hits = await d.$$('-ios predicate string:label CONTAINS "Kollupitiya" OR label CONTAINS "Galle Face" OR label CONTAINS "Bakehouse"');
  for (const el of hits) {
    if (await el.isDisplayed().catch(() => false)) return true;
  }
  return false;
}

export async function isKumbukMerchantSession(d) {
  const outletLabel = (await d.$('~merchant.bags.activeOutlet').getText().catch(() => '')) || '';
  if (/Kollupitiya|Bakehouse Kollupitiya/i.test(outletLabel)) return false;
  if (/Kumbuk|Pettah|Green Grocer/i.test(outletLabel)) return true;
  const heroText = (await d.$('~merchant.impactHero').getText().catch(() => '')) || '';
  if (/Kumbuk|Pettah/i.test(heroText) && !/Kollupitiya/i.test(heroText)) return true;
  const hits = await d.$$('-ios predicate string:label CONTAINS "Kumbuk" OR label CONTAINS "Pettah Green"');
  for (const el of hits) {
    if (await el.isDisplayed().catch(() => false)) return true;
  }
  return false;
}

export async function loginBakehouse(d) {
  await dismissSystemPrompts(d);
  await dl('freshasever://merchant/dashboard');
  await wait(3000);
  if ((await isMerchantLoggedIn(d)) && (await isBakehouseMerchantSession(d))) {
    return await waitForMerchantDashboard(d, { timeoutMs: 15000 });
  }

  if (await isMerchantLoggedIn(d)) {
    await merchantLogout(d);
    await waitForLoginScreen(d);
    await dismissOverlays(d);
  }
  if (await isCustomerLoggedIn(d)) {
    await customerLogout(d);
    await waitForLoginScreen(d);
    await dismissOverlays(d);
    await dismissSystemPrompts(d);
  }

  await ensureMerchantLoginPortal(d, 'bakehouse');
  let ok = await merchantLoginTapPath(d, { email: CREDS.bakehouse.email, account: 'bakehouse' });
  if (!ok) ok = await emailLogin(d, { ...CREDS.bakehouse, portal: 'merchant' });
  if (!ok) {
    await screenshotLoginFail(d, 'bakehouse-attempt1');
    await relaunchApp(d);
    await waitForLoginScreen(d);
    await ensureMerchantLoginPortal(d, 'bakehouse');
    ok = await merchantLoginTapPath(d, { email: CREDS.bakehouse.email, account: 'bakehouse' });
    if (!ok) ok = await emailLogin(d, { ...CREDS.bakehouse, portal: 'merchant' });
  }
  if (!ok) {
    await screenshotLoginFail(d, 'bakehouse-final');
    return false;
  }
  if (!(await waitForMerchantDashboard(d, { timeoutMs: 60000 }))) return false;
  return (await isBakehouseMerchantSession(d)) || (await isMerchantLoggedIn(d));
}

export async function loginKumbuk(d) {
  await dismissSystemPrompts(d);
  await dl('freshasever://merchant/dashboard');
  await wait(3000);
  if ((await isMerchantLoggedIn(d)) && (await isKumbukMerchantSession(d))) {
    return await waitForMerchantDashboard(d, { timeoutMs: 15000 });
  }

  if (await isMerchantLoggedIn(d)) {
    await merchantLogout(d);
    await waitForLoginScreen(d);
    await dismissOverlays(d);
  }
  if (await isCustomerLoggedIn(d)) {
    await customerLogout(d);
    await waitForLoginScreen(d);
    await dismissOverlays(d);
    await dismissSystemPrompts(d);
  }

  await ensureMerchantLoginPortal(d, 'kumbuk');
  let ok = await loginKumbukTapPath(d);
  if (!ok) ok = await emailLogin(d, { ...CREDS.kumbuk, portal: 'merchant' });
  await dismissSystemPrompts(d);
  if (!ok) {
    await screenshotLoginFail(d, 'kumbuk-attempt1');
    await relaunchApp(d);
    await waitForLoginScreen(d);
    await ensureMerchantLoginPortal(d, 'kumbuk');
    ok = await loginKumbukTapPath(d);
    if (!ok) ok = await emailLogin(d, { ...CREDS.kumbuk, portal: 'merchant' });
  }
  if (!ok) {
    await screenshotLoginFail(d, 'kumbuk-final');
    return false;
  }
  if (!(await waitForMerchantDashboard(d, { timeoutMs: 60000 }))) return false;
  return (await isKumbukMerchantSession(d)) || (await isMerchantLoggedIn(d));
}


export async function ensureCustomerLoginSurface(d) {
  await dismissSystemPrompts(d);
  if (
    (await d.$('~login.email').isDisplayed().catch(() => false)) ||
    (await d.$('~login.title').isDisplayed().catch(() => false))
  ) {
    return true;
  }
  await dl('freshasever://login?portal=customer');
  await wait(2500);
  await dismissSystemPrompts(d);
  if (await d.$('~login.title').isDisplayed().catch(() => false)) return true;

  const guest = await d.$('~discover.guestSignInCta');
  if (await guest.isExisting().catch(() => false)) {
    try {
      await guest.scrollIntoView();
      await wait(350);
    } catch {}
    try {
      await guest.click();
    } catch {
      await quickTap(d, 'name == "discover.guestSignInCta" OR label == "Sign in"');
    }
    await wait(2200);
    if (await d.$('~login.title').isDisplayed().catch(() => false)) return true;
  }

  await tryTap(d, 'label == "Sign in" OR name == "discover.guestSignInCta"', 2500);
  await wait(1500);
  return (
    (await d.$('~login.email').isDisplayed().catch(() => false)) ||
    (await d.$('~login.title').isDisplayed().catch(() => false))
  );
}


async function merchantLoginTapPath(d, { email, account = 'bakehouse' } = {}) {
  await dl(loginDeeplink('merchant', { merchant: account }));
  await wait(5000);
  await dismissSavePassword(d);
  await dismissSystemPrompts(d);
  const merch = await d.$('~login.portal.merchant');
  if (await merch.isDisplayed().catch(() => false)) await merch.click();
  await wait(2000);
  await ensureEmailLoginForm(d, 'merchant');
  await wait(1200);
  const autofillEmail = email || CREDS.bakehouse.email;
  if (await qaAutofillReady(d, autofillEmail)) {
    const passEl = await d.$('~login.password');
    if (await passEl.isExisting().catch(() => false)) {
      try {
        await passEl.scrollIntoView();
        await wait(300);
      } catch {
        await scrollDown(d, 1);
      }
    }
    await dismissSavePassword(d);
    await tapSignIn(d, { portal: 'merchant' });
  } else {
    const emailEl = await d.$('~login.email');
    if (await emailEl.isDisplayed().catch(() => false)) {
      await fillLoginField(emailEl, autofillEmail, { skipClear: true });
    }
    const passEl = await d.$('~login.password');
    if (await passEl.isDisplayed().catch(() => false)) {
      await fillLoginField(passEl, CREDS.bakehouse.password, { secure: true, skipClear: true });
    }
    await dismissKeyboard(d);
    await tapSignIn(d, { portal: 'merchant' });
  }
  for (let i = 0; i < 25; i++) {
    await wait(2000);
    await dismissSavePassword(d);
    if (await isMerchantLoggedIn(d)) return true;
  }
  return await waitForMerchantDashboard(d, { timeoutMs: 15000 });
}

async function loginKumbukTapPath(d) {
  await dl(loginDeeplink('merchant', { merchant: 'kumbuk' }));
  await wait(5000);
  await dismissSavePassword(d);
  await dismissSystemPrompts(d);
  const merch = await d.$('~login.portal.merchant');
  if (await merch.isDisplayed().catch(() => false)) await merch.click();
  await wait(2000);
  await ensureEmailLoginForm(d, 'merchant');
  await wait(1200);

  const emailEl = await d.$('~login.email');
  const currentEmail = String((await emailEl.getValue().catch(() => '')) || '').trim();
  if (currentEmail !== CREDS.kumbuk.email) {
    if (await emailEl.isDisplayed().catch(() => false)) {
      await fillLoginField(emailEl, CREDS.kumbuk.email, { skipClear: true });
    }
  }
  const passEl = await d.$('~login.password');
  if (await passEl.isDisplayed().catch(() => false)) {
    await fillLoginField(passEl, CREDS.kumbuk.password, { secure: true, skipClear: true });
  }
  await dismissKeyboard(d);
  await dismissSavePassword(d);
  await tapSignIn(d, { portal: 'merchant' });
  for (let i = 0; i < 25; i++) {
    await wait(2000);
    await dismissSavePassword(d);
    if (await isMerchantLoggedIn(d)) return true;
  }
  return await waitForMerchantDashboard(d, { timeoutMs: 15000 });
}

async function customerLoginTapPath(d) {
  await dl('freshasever://login?portal=customer');
  await wait(5000);
  await dismissSavePassword(d);
  await dismissSystemPrompts(d);
  const cust = await d.$('~login.portal.customer');
  if (await cust.isDisplayed().catch(() => false)) await cust.click();
  await wait(2000);
  await ensureEmailLoginForm(d, 'customer');
  await tapSignIn(d, { portal: 'customer' });
  for (let i = 0; i < 10; i++) {
    await wait(1500);
    await dismissSavePassword(d);
    if (await isCustomerLoggedIn(d)) return true;
    const tabDiscover = await d.$('~tab.discover');
    if (await tabDiscover.isDisplayed().catch(() => false)) await tabDiscover.click().catch(() => {});
  }
  return await isCustomerLoggedIn(d);
}

export async function loginCustomer(d) {
  execSync(`xcrun simctl location ${UDID} set ${COLOMBO_GEO.latitude},${COLOMBO_GEO.longitude}`, { stdio: 'pipe' });
  await dismissOverlays(d);
  await tryTap(d, 'label == "Keep order" OR name == "Keep order"', 2000);
  if (await isMerchantLoggedIn(d)) {
    await merchantLogout(d);
    await relaunchApp(d);
  }
  await dl('freshasever://discover');
  await wait(2500);
  await dismissDiscoverSheets(d);
  if (await isCustomerLoggedIn(d)) {
    await ensureCustomerDiscover(d);
    return customerLoginSucceeded(d);
  }

  let ok = await customerLoginTapPath(d);
  if (ok) {
    await ensureCustomerDiscover(d);
    return customerLoginSucceeded(d);
  }

  await ensureCustomerLoginSurface(d);
  ok = await emailLogin(d, { ...CREDS.customer, portal: 'customer' });
  await dismissSystemPrompts(d);
  await dismissSavePassword(d);
  if (ok && (await isCustomerLoggedIn(d))) {
    await ensureCustomerDiscover(d);
    return customerLoginSucceeded(d);
  }

  await screenshotLoginFail(d, 'customer-attempt1');
  await relaunchApp(d);
  await ensureCustomerLoginSurface(d);
  ok = await emailLogin(d, { ...CREDS.customer, portal: 'customer' });
  await dismissSavePassword(d);
  if (ok && (await isCustomerLoggedIn(d))) {
    await ensureCustomerDiscover(d);
    return customerLoginSucceeded(d);
  }
  await screenshotLoginFail(d, 'customer-final');
  return false;
}

async function customerLoginSucceeded(d) {
  await ensureCustomerDiscover(d);
  return isCustomerLoggedIn(d);
}

export async function isLoggedOut(d) {
  for (let i = 0; i < 10; i++) {
    if (await d.$('~login.email').isDisplayed().catch(() => false)) return true;
    if (await d.$('~discover.guestSignInCta').isDisplayed().catch(() => false)) return true;
    if (await d.$('~profile.guestHeading').isDisplayed().catch(() => false)) return true;
    const src = await d.getPageSource().catch(() => '');
    if (/discover\.guestSignIn|Sign in to see/i.test(src)) return true;
    if (!(await isMerchantLoggedIn(d))) return true;
    await wait(1000);
  }
  return false;
}

export async function merchantLogout(d) {
  await dismissOverlays(d);
  await dl('freshasever://merchant/tabs/settings');
  await wait(3500);
  await tryTap(d, 'name == "tab.merchant.settings"', 4000);
  await wait(2000);

  const logOut = await d.$('~merchant.profile.logOut');
  for (let i = 0; i < 10; i++) {
    if (await logOut.isExisting().catch(() => false)) {
      try {
        await logOut.scrollIntoView();
        await wait(400);
      } catch {
        await scrollDown(d, 1);
      }
      if (await logOut.isDisplayed().catch(() => false)) {
        await logOut.click();
      } else {
        await quickTap(d, 'label == "Log out" OR label == "Log Out"');
      }
      await dl('freshasever://discover');
      await wait(3000);
      return await isLoggedOut(d);
    }
    if (await quickTap(d, 'label == "Log out" OR label == "Log Out"')) {
      await dl('freshasever://discover');
      await wait(3000);
      return await isLoggedOut(d);
    }
    await scrollDown(d, 1);
  }

  await dl('freshasever://discover');
  await wait(2000);
  return await isLoggedOut(d);
}

export async function customerLogout(d) {
  await dismissOverlays(d);
  await dl('freshasever://profile');
  await wait(2500);
  if (await d.$('~profile.guestHeading').isDisplayed().catch(() => false)) {
    return await waitForLoginScreen(d);
  }
  await scrollDown(d, 3);
  const logOut = await d.$('~profile.logOut');
  if (await logOut.isDisplayed().catch(() => false)) {
    await logOut.click();
    await wait(3000);
    await dismissSystemPrompts(d);
    return await waitForLoginScreen(d);
  }
  const tapped = await quickTap(d, 'label == "Log Out" OR label == "Log out"');
  if (tapped) {
    await wait(3000);
    await dismissSystemPrompts(d);
    return await waitForLoginScreen(d);
  }
  return false;
}

/** Open F5 QA order detail — login, Appium deepLink, wait for testIDs, Orders-tab fallback. */
export async function openF5OrderDetail(d, seed = null, { skipLogin = false } = {}) {
  const code = seed?.reservation_code || 'UQV76C';
  const orderId = seed?.order_id || 'a1ba7758-7290-4ece-804d-15585f7da9eb';
  const outlet = seed?.outlet_name || '';
  const orderRef = `#FAE-${code}`;
  const deeplink = seed?.deeplink || `freshasever://orders/${orderId}`;

  async function onOrderDetail() {
    const src = await safePageSource(d);
    if (/Please sign in/i.test(src)) return false;
    return (
      (await d.$('~order.onMyWay').isExisting().catch(() => false)) ||
      (await d.$('~order.arrival').isExisting().catch(() => false)) ||
      (await d.$('~order.onMyWayStatus').isExisting().catch(() => false)) ||
      (orderId && src.includes(orderId)) ||
      (code && new RegExp(code, 'i').test(src)) ||
      (orderRef && src.includes(orderRef)) ||
      (outlet && new RegExp(outlet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(src)) ||
      /Surprise Pastries|Pickup window|Reservation code|On my way/i.test(src)
    );
  }

  async function waitForOrderSurface(timeoutMs = 12_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await dismissOverlays(d);
      if (await onOrderDetail()) return true;
      await wait(1000);
    }
    return false;
  }

  async function openViaDeeplink() {
    await dismissOverlays(d);
    try {
      await d.execute('mobile: deepLink', { url: deeplink });
    } catch {
      await dl(deeplink);
    }
    await wait(4500);
    await dismissOverlays(d);
    if (await waitForOrderSurface(12_000)) return true;
    await dl(deeplink);
    await wait(4500);
    return waitForOrderSurface(12_000);
  }

  async function openViaOrdersTab() {
    await dl('freshasever://orders');
    await wait(3500);
    await dismissOverlays(d);
    for (const tabLabel of ['Active', 'Upcoming', 'Past']) {
      await tryTap(d, `label == "${tabLabel}"`, 2500);
      await wait(1500);
      if (await onOrderDetail()) return true;
    }
    const tab = await d.$('~tab.orders');
    if (await tab.isDisplayed().catch(() => false)) {
      await tab.click();
    } else {
      await tryTap(d, 'name == "tab.orders" OR label CONTAINS "Orders, tab"', 5000);
    }
    await wait(3500);
    await dismissOverlays(d);
    await tryTap(d, 'label == "Active"', 4000);
    await wait(2000);
    for (let scroll = 0; scroll < 8; scroll += 1) {
      if (await onOrderDetail()) return true;
      const tapped =
        (await tryTap(d, `label CONTAINS "${code}"`, 4000)) ||
        (orderRef && (await tryTap(d, `label CONTAINS "${orderRef}"`, 4000))) ||
        (orderId && (await tryTap(d, `label CONTAINS "${orderId.slice(0, 8)}"`, 4000))) ||
        (await tryTap(d, 'label CONTAINS "Surprise Pastries"', 3000)) ||
        (await tryTap(d, 'label CONTAINS "Bakehouse Kollupitiya"', 3000));
      if (tapped) {
        await wait(4500);
        await dismissOverlays(d);
        if (await onOrderDetail()) return true;
      }
      await scrollDown(d, 1);
      await wait(600);
    }
    return onOrderDetail();
  }

  if (skipLogin) {
    if (!(await isCustomerLoggedIn(d)) && !(await loginCustomer(d))) return false;
    await dismissOverlays(d);
    if (await openViaOrdersTab()) return true;
    return openViaDeeplink();
  }
  if (!(await loginCustomer(d))) return false;
  if (await openViaDeeplink()) return true;
  return openViaOrdersTab();
}
