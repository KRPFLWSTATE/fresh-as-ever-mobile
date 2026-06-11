#!/usr/bin/env node
/** Pass15 — Discover map pins from feed outlets */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 3200));
};

function log(entry) {
  fs.appendFileSync(LOG, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
}

async function dismissKeyboard(d) {
  try {
    await d.hideKeyboard();
  } catch {}
  try {
    await d.execute('mobile: hideKeyboard', {});
  } catch {}
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
  const signIn = await d.$(
    '-ios predicate string:name CONTAINS "Sign in" AND type == "XCUIElementTypeButton"',
  );
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
  log({ shot: name });
  return p;
}

async function main() {
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(LOG, '');

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

  const results = {};

  try {
    await customerLogin(d);
    await dl('freshasever://discover');
    await d.pause(4000);
    await shot(d, '01-discover-logged-in-map-and-feed.png');

    const src = await d.getPageSource();
    const hasRescueNearYou = src.includes('Rescue near you');
    const hasBakehouse =
      src.includes('Bakehouse') || src.includes('Pastry') || src.includes('clearance shelf');
    const hasGuestSignIn = src.includes('discover.guestSignInTitle');

    results.loggedInFeed = hasRescueNearYou && hasBakehouse && !hasGuestSignIn;
    log({
      check: 'loggedInFeed',
      pass: results.loggedInFeed,
      hasRescueNearYou,
      hasBakehouse,
      hasGuestSignIn,
    });

    await guestLogout(d);
    await dl('freshasever://discover');
    await d.pause(3000);
    await shot(d, '02-discover-guest-sign-in.png');

    const guestSrc = await d.getPageSource();
    results.guestSignIn =
      guestSrc.includes('discover.guestSignInTitle') &&
      guestSrc.includes('discover.guestSignInCta');
    log({ check: 'guestSignIn', pass: results.guestSignIn });

    await customerLogin(d);
    await dl('freshasever://discover');
    await d.pause(3500);
    await shot(d, '03-discover-map-after-login.png');
  } finally {
    await d.deleteSession();
  }

  const pass = Object.values(results).every(Boolean);
  log({ overall: pass ? 'PASS' : 'FAIL', results });
  console.log(JSON.stringify({ pass, results }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
