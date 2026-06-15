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

export const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  return wait(3200);
};

export async function dismissKeyboard(d) {
  try {
    await d.hideKeyboard();
  } catch {}
  try {
    const ret = await d.$('-ios predicate string:name == "Return" OR label == "Return"');
    if (await ret.isDisplayed().catch(() => false)) await ret.click();
  } catch {}
  await wait(300);
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

/** Dismiss stacked modals / sheets so the next deeplink lands cleanly. */
export async function dismissOverlays(d, rounds = 3) {
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

export async function waitForMapMarkers(d, { timeoutMs = 18000, min = 1 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
    if (markers.length >= min) return markers;
    const src = await d.getPageSource().catch(() => '');
    if (src.includes('discover.mapMarker') || src.includes('AIRGMSMarker')) {
      markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
      if (markers.length >= min) return markers;
    }
    const countChip = await d.$('~discover.map.countChip');
    if (await countChip.isDisplayed().catch(() => false)) {
      await countChip.click();
    } else {
      await tryTap(d, 'name == "discover.map.recenter" OR label CONTAINS "Recenter"', 1500);
    }
    await wait(1200);
    markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
    if (markers.length >= min) return markers;
    await wait(1000);
  }
  return d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
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
  const src = await d.getPageSource().catch(() => '');
  return (
    src.includes('merchant/dashboard') ||
    src.includes('merchant.impactHero') ||
    (/Dashboard|Orders|Bags|Shelves/i.test(src) && src.includes('merchant'))
  );
}

export async function isCustomerLoggedIn(d) {
  const src = await d.getPageSource().catch(() => '');
  return (
    src.includes('discover.searchInput') ||
    (src.includes('Discover') && !src.includes('discover.guestSignInCta') && !src.includes('Sign in to see'))
  );
}

export async function emailLogin(d, { email, password, portal }) {
  await dl(`freshasever://login?portal=${portal}`);
  await wait(3000);
  await tryTap(d, 'name CONTAINS "Use email" OR label CONTAINS "Use email"');
  await wait(1000);
  if (portal === 'merchant') {
    await tryTap(d, 'label == "Merchant" OR name == "Merchant"', 3000);
    await wait(500);
  }

  const emailEl = await d.$('~login.email');
  if (await emailEl.isDisplayed().catch(() => false)) {
    await emailEl.click();
    await emailEl.clearValue().catch(() => {});
    await emailEl.setValue(email);
  } else {
    const fields = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
    if (fields[0]) {
      await fields[0].click().catch(() => {});
      await fields[0].setValue(email);
    }
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

  for (let i = 0; i < 25; i++) {
    await wait(1500);
    if (portal === 'customer' && (await isCustomerLoggedIn(d))) return true;
    if (portal === 'merchant' && (await isMerchantLoggedIn(d))) return true;
  }
  return false;
}

export async function isBakehouseMerchantSession(d) {
  const src = await d.getPageSource().catch(() => '');
  return src.includes('Kollupitiya') || src.includes('Galle Face') || src.includes('Bakehouse');
}

export async function isKumbukMerchantSession(d) {
  const src = await d.getPageSource().catch(() => '');
  return (
    src.includes('Kumbuk Colombo') ||
    (src.includes('Kumbuk') && (src.includes('Pettah') || src.includes('Green Grocer')))
  ) && !src.includes('Kollupitiya') && !src.includes('Bakehouse Kollupitiya');
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
  await dl('freshasever://login?portal=merchant');
  await wait(2000);
  if ((await isMerchantLoggedIn(d)) && (await isKumbukMerchantSession(d))) return true;
  return emailLogin(d, { ...CREDS.kumbuk, portal: 'merchant' });
}

export async function loginCustomer(d) {
  await dl('freshasever://discover');
  await wait(2500);
  if (await isCustomerLoggedIn(d)) return true;
  return emailLogin(d, { ...CREDS.customer, portal: 'customer' });
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
        await tryTap(d, 'label == "Log out" OR label == "Log Out"', 1500);
      }
      await dl('freshasever://discover');
      await wait(3000);
      return await isLoggedOut(d);
    }
    if (await tryTap(d, 'label == "Log out" OR label == "Log Out"', 1500)) {
      await dl('freshasever://discover');
      await wait(3000);
      return await isLoggedOut(d);
    }
    await scrollDown(d, 1);
  }

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
  return tryTap(d, 'label == "Log Out"');
}
