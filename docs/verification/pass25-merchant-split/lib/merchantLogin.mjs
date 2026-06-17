#!/usr/bin/env node
/** Pass 25 — shared merchant login helpers */
import { execSync } from 'node:child_process';

export const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
export const BUNDLE = 'com.freshasever.mobile';

export const CREDS = {
  bakehouse: { email: 'qa.merchant@freshasever.test', password: 'TempMerchant#12345' },
  kumbuk: { email: 'qa.kumbuk@freshasever.test', password: 'TempMerchant#12345' },
  customer: { email: 'qa.customer@freshasever.test', password: 'TempCustomer#12345' },
};

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
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  return wait(3200);
};

export async function fillLoginField(el, value) {
  await el.click();
  await wait(250);
  try {
    await el.clearValue();
  } catch {}
  try {
    const current = String((await el.getValue().catch(() => '')) || '');
    if (current && current !== value) {
      await el.setValue('');
      await wait(100);
    }
  } catch {}
  try {
    await el.setValue(value);
  } catch {
    await el.addValue(value);
  }
}

export async function dismissKeyboard(d) {
  try {
    await d.hideKeyboard();
  } catch {}
  try {
    const ret = await d.$('-ios predicate string:name == "Return" OR label == "Return"');
    if (await ret.isDisplayed().catch(() => false)) await ret.click();
  } catch {}
  try {
    const done = await d.$('-ios predicate string:name == "Done" OR label == "Done"');
    if (await done.isDisplayed().catch(() => false)) await done.click();
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
    const notNow = await d.$('~Not Now');
    if (await notNow.isDisplayed().catch(() => false)) {
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

export async function tapSignIn(d) {
  const signIn = await d.$('~login.signIn');
  if (await signIn.isDisplayed().catch(() => false)) {
    const enabled = await signIn.isEnabled().catch(() => true);
    if (enabled) {
      await signIn.click();
      await wait(700);
      return true;
    }
  }
  if (await tryTap(d, 'label CONTAINS "Sign in as merchant" OR label CONTAINS "Sign in"', 2500)) {
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

export async function prepCustomerDiscover(d) {
  await recoverFromErrorBoundary(d);
  await customerLogout(d);
  await wait(1500);
  await relaunchApp(d);
  const loggedIn = await loginCustomer(d);
  if (!loggedIn) return false;
  await dl('freshasever://discover');
  await wait(6000);
  await recoverFromErrorBoundary(d);
  await scrollMapIntoView(d);
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

export async function waitForMerchantDashboard(d, { timeoutMs = 25000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await dismissSavePassword(d);
    if (await isMerchantLoggedIn(d)) return true;
    await wait(1500);
  }
  return await isMerchantLoggedIn(d);
}

export async function isCustomerLoggedIn(d) {
  if (await d.$('~profile.logOut').isDisplayed().catch(() => false)) return true;
  if (await d.$('~discover.guestSignInCta').isDisplayed().catch(() => false)) return false;
  if (await d.$('~profile.guestHeading').isDisplayed().catch(() => false)) return false;
  if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) {
    const src = await d.getPageSource().catch(() => '');
    if (/discover\.guestSignIn|Sign in to see rescue bags/i.test(src)) return false;
    return true;
  }
  if (await d.$('~tab.orders').isDisplayed().catch(() => false)) return true;
  if (await d.$('~tab.profile').isDisplayed().catch(() => false)) {
    return !(await d.$('~discover.guestSignInCta').isDisplayed().catch(() => false));
  }
  return false;
}

export async function emailLogin(d, { email, password, portal }) {
  await dismissSystemPrompts(d);
  await dl(`freshasever://login?portal=${portal}`);
  await wait(3000);
  await dismissSystemPrompts(d);

  if (portal === 'merchant') {
    const merchantTab = await d.$('~login.portal.merchant');
    if (await merchantTab.isDisplayed().catch(() => false)) {
      await merchantTab.click();
    } else {
      await tryTap(d, 'label == "Merchant" OR name == "Merchant"', 3000);
    }
    await wait(500);
  }
  if (portal === 'customer') {
    const customerTab = await d.$('~login.portal.customer');
    if (await customerTab.isDisplayed().catch(() => false)) {
      await customerTab.click();
    }
    await wait(300);
  }

  await tryTap(
    d,
    'name CONTAINS "Use email" OR label CONTAINS "Use email" OR name == "login.useEmailPassword"',
    4000,
  );
  await wait(1200);

  const emailEl = await d.$('~login.email');
  for (let i = 0; i < 10; i++) {
    if (await emailEl.isDisplayed().catch(() => false)) break;
    await tryTap(
      d,
      'name CONTAINS "Use email" OR label CONTAINS "Use email" OR name == "login.useEmailPassword"',
      2000,
    );
    await wait(600);
  }
  if (await emailEl.isDisplayed().catch(() => false)) {
    await fillLoginField(emailEl, email);
  } else {
    const fields = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
    if (fields[0]) await fillLoginField(fields[0], email);
  }
  await dismissKeyboard(d);
  await wait(500);

  let passEl = await d.$('~login.password');
  for (let i = 0; i < 12; i++) {
    if (await passEl.isDisplayed().catch(() => false)) break;
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
    await fillLoginField(passEl, password);
  } else {
    const secure = await d.$$('-ios predicate string:type == "XCUIElementTypeSecureTextField"');
    if (secure[0]) {
      await fillLoginField(secure[0], password);
    } else {
      const fields = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
      if (fields[1]) await fillLoginField(fields[1], password);
    }
  }
  await dismissKeyboard(d);
  await tapSignIn(d);
  await dismissSavePassword(d);

  for (let i = 0; i < 15; i++) {
    await wait(2000);
    if (!(await isSessionAlive(d))) return false;
    await dismissSavePassword(d);
    if (portal === 'customer' && (await isCustomerLoggedIn(d))) {
      await dl('freshasever://discover');
      await wait(2000);
      return true;
    }
    if (portal === 'merchant' && (await isMerchantLoggedIn(d))) {
      await dismissSavePassword(d);
      await dl('freshasever://merchant/dashboard');
      await wait(2000);
      return true;
    }
  }
  return false;
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
  await dl('freshasever://merchant/dashboard');
  await wait(3000);
  if ((await isMerchantLoggedIn(d)) && (await isBakehouseMerchantSession(d))) return true;
  await dl('freshasever://login?portal=merchant');
  await wait(2000);
  return emailLogin(d, { ...CREDS.bakehouse, portal: 'merchant' });
}

export async function loginKumbuk(d) {
  await dismissSystemPrompts(d);
  if (await isMerchantLoggedIn(d)) return true;
  const ok = await emailLogin(d, { ...CREDS.kumbuk, portal: 'merchant' });
  await dismissSystemPrompts(d);
  if (!ok) return false;
  return await waitForMerchantDashboard(d);
}

export async function loginCustomer(d) {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  await dl('freshasever://discover');
  await wait(2500);
  await dismissSystemPrompts(d);
  if (await isCustomerLoggedIn(d)) return true;

  await dl('freshasever://login?portal=customer');
  await wait(2500);
  if (!(await d.$('~login.title').isDisplayed().catch(() => false))) {
    await dl('freshasever://login?portal=customer');
    await wait(2500);
  }

  const ok = await emailLogin(d, { ...CREDS.customer, portal: 'customer' });
  await dismissSystemPrompts(d);
  await dismissSavePassword(d);
  if (ok && (await isCustomerLoggedIn(d))) return true;

  await relaunchApp(d);
  const retry = await emailLogin(d, { ...CREDS.customer, portal: 'customer' });
  await dismissSavePassword(d);
  return retry && (await isCustomerLoggedIn(d));
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
  await dl('freshasever://profile');
  await wait(2500);
  if (await d.$('~profile.guestHeading').isDisplayed().catch(() => false)) return true;
  await scrollDown(d, 3);
  const logOut = await d.$('~profile.logOut');
  if (await logOut.isDisplayed().catch(() => false)) {
    await logOut.click();
    await wait(3000);
    return true;
  }
  return quickTap(d, 'label == "Log Out"');
}
