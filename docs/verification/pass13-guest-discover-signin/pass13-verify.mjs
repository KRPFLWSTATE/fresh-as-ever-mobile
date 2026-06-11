#!/usr/bin/env node
/** Pass13 — guest Discover sign-in empty state + logged-in feed regression */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 2800));
};

async function dismissKeyboard(d) {
  try { await d.hideKeyboard(); } catch {}
  try { await d.execute('mobile: hideKeyboard', {}); } catch {}
  await d.pause(400);
}

async function customerLogin(d) {
  await dl('freshasever://login?portal=customer');
  await d.pause(2000);
  const fields = await d.$$('-ios class chain:**/XCUIElementTypeTextField');
  const secure = await d.$$('-ios class chain:**/XCUIElementTypeSecureTextField');
  if (fields[0]) await fields[0].setValue('qa.customer@freshasever.test');
  await dismissKeyboard(d);
  if (secure[0]) await secure[0].setValue('TempCustomer#12345');
  await dismissKeyboard(d);
  const signIn = await d.$('-ios predicate string:name CONTAINS "Sign in" AND type == "XCUIElementTypeButton"');
  await signIn.waitForDisplayed({ timeout: 15000 });
  await signIn.click();
  await d.pause(5000);
}

async function guestLogout(d) {
  await dl('freshasever://profile');
  await d.pause(2000);
  const guestHeading = await d.$('~profile.guestHeading');
  if (await guestHeading.isDisplayed().catch(() => false)) return;
  const logOut = await d.$('-ios predicate string:label == "Log Out"');
  if (await logOut.isDisplayed().catch(() => false)) {
    await logOut.click();
    await d.pause(2500);
  }
}

async function shot(d, name) {
  const p = path.join(SS, name);
  fs.writeFileSync(p, Buffer.from(await d.takeScreenshot(), 'base64'));
  return p;
}

async function main() {
  fs.mkdirSync(SS, { recursive: true });
  const log = [];
  const d = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': UDID,
      'appium:bundleId': BUNDLE,
      'appium:noReset': true,
    },
  });

  try {
    await guestLogout(d);
    await dl('freshasever://discover');
    await d.pause(3000);
    const guestSrc = await d.getPageSource();
    const guestTitleVisible = guestSrc.includes('discover.guestSignInTitle');
    const badGeoCopy = guestSrc.includes('No bags or shelves nearby');
    await shot(d, '01-guest-discover-signin-empty-state.png');
    log.push({
      step: 'guest_discover_empty_state',
      result: guestTitleVisible && !badGeoCopy ? 'pass' : 'fail',
      guestTitleVisible,
      badGeoCopy,
    });

    await customerLogin(d);
    await dl('freshasever://discover');
    await d.pause(4000);
    const authedSrc = await d.getPageSource();
    const hasGuestTitle = authedSrc.includes('discover.guestSignInTitle');
    const hasRescueSection = authedSrc.includes('Rescue near you');
    const hasFeedCard =
      authedSrc.includes('Reserve') ||
      authedSrc.includes('Browse shelf') ||
      authedSrc.includes('Rescue bag');
    await shot(d, '02-logged-in-discover-feed.png');
    log.push({
      step: 'logged_in_discover_feed',
      result: hasRescueSection && !hasGuestTitle ? 'pass' : 'fail',
      hasGuestTitle,
      hasRescueSection,
      hasFeedCard,
    });

    fs.writeFileSync(
      path.join(ROOT, 'verify-log.jsonl'),
      `${log.map((e) => JSON.stringify(e)).join('\n')}\n`,
    );
    console.log(JSON.stringify(log, null, 2));
  } finally {
    await d.deleteSession();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
