#!/usr/bin/env node
/**
 * Pass 24 — Checkout "Reserve Now" infinite loading regression.
 * Device: iPhone 17 Pro 377DAC99-B79C-4B05-BB34-DBA1D160038D · Appium :4723
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from './node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const RESULTS = path.join(ROOT, 'results.json');

const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const KUMBUK_MIXED_BAG = '00000000-0000-0000-0000-000000000105';
const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const SHELF_MILK = '00000000-0000-0000-0000-000000000211';

const R = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return wait(3200);
};

const log = (e) =>
  fs.appendFileSync(
    LOG,
    JSON.stringify({ ts: new Date().toISOString(), wave: 'pass24', ...e }) + '\n',
  );

async function shot(d, name) {
  fs.mkdirSync(SS, { recursive: true });
  const rel = `screenshots/${name}`;
  fs.writeFileSync(path.join(SS, name), Buffer.from(await d.takeScreenshot(), 'base64'));
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

async function tapTestId(d, testId, timeout = 8000) {
  try {
    const el = await d.$(`~${testId}`);
    await el.waitForDisplayed({ timeout });
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

async function isCustomerLoggedIn(d) {
  const src = await d.getPageSource().catch(() => '');
  return (
    src.includes('discover.searchInput') ||
    (src.includes('Discover') && !src.includes('discover.guestSignInCta') && !src.includes('Sign in to see'))
  );
}

async function emailLogin(d) {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  await dl('freshasever://login?portal=customer');
  await wait(2500);
  await tryTap(d, 'name CONTAINS "Use email" OR label CONTAINS "Use email"');
  await wait(800);

  const emailEl = await d.$('~login.email');
  if (await emailEl.isDisplayed().catch(() => false)) {
    await emailEl.click();
    await emailEl.clearValue().catch(() => {});
    await emailEl.setValue('qa.customer@freshasever.test');
  }
  await dismissKeyboard(d);

  const passEl = await d.$('~login.password');
  if (await passEl.isDisplayed().catch(() => false)) {
    await passEl.click();
    await passEl.clearValue().catch(() => {});
    await passEl.setValue('TempCustomer#12345');
  }
  await dismissKeyboard(d);

  const signIn = await d.$('~login.signIn');
  if (await signIn.isDisplayed().catch(() => false)) await signIn.click();
  else await tryTap(d, 'label CONTAINS "Sign in"');

  for (let i = 0; i < 20; i++) {
    await wait(1500);
    if (await isCustomerLoggedIn(d)) return true;
  }
  return false;
}

async function customerLogin(d) {
  await dl('freshasever://discover');
  await wait(2500);
  if (await isCustomerLoggedIn(d)) return true;
  return emailLogin(d);
}

/** Reserve button should not stay spinner-only after payment API attempt. */
async function assertReserveSettled(d) {
  await wait(25_000);
  const src = await d.getPageSource().catch(() => '');
  const securePayment = /Secure payment/i.test(src);
  const userError =
    /Could not reach the payment server|Payment setup timed out|We could not start payment|We could not complete your reservation|sold out|Sign in required/i.test(
      src,
    );
  const celebration = /Reservation Successful|Rescue Confirmed|Pickup Code/i.test(src);
  const reserveLabelVisible =
    /Reserve Now \(card only\)|Reserve Now|Reserve · Pay at store|Reserve 2 bags/i.test(src);
  const stuckSpinnerOnly =
    !reserveLabelVisible && !securePayment && !userError && !celebration;
  return {
    pass: !stuckSpinnerOnly && (securePayment || userError || celebration || reserveLabelVisible),
    securePayment,
    userError,
    celebration,
    reserveLabelVisible,
    stuckSpinnerOnly,
    srcSnippet: src.slice(0, 4000),
  };
}

async function tapReserveNow(d) {
  if (await tapTestId(d, 'checkout.reserveNow', 5000)) return true;
  return tryTap(d, 'label CONTAINS "Reserve Now" OR label CONTAINS "Reserve 2 bags"');
}

async function main() {
  fs.mkdirSync(SS, { recursive: true });
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
    const loggedIn = await customerLogin(d);
    R['P24-login'] = { pass: loggedIn };
    if (!loggedIn) throw new Error('Customer login failed');

    // P24-01 Single bag card (Kumbuk Mixed Meals)
    await dl(`freshasever://bags/${KUMBUK_MIXED_BAG}`);
    await wait(3500);
    await tryTap(d, 'label CONTAINS "Reserve Now"');
    await wait(4000);
    await scrollDown(d, 1);
    const p01Start = await shot(d, 'P24-01-single-checkout-before-reserve.png');
    await tapReserveNow(d);
    const p01Settle = await assertReserveSettled(d);
    const p01End = await shot(d, 'P24-01-single-card-result.png');
    R['P24-01'] = {
      pass: p01Settle.pass,
      ...p01Settle,
      evidence: [p01Start, p01End],
      detail: 'Single bag card reserve settles (error, PayHere, or celebration — not infinite spinner)',
    };
    log({ id: 'P24-01', result: R['P24-01'].pass ? 'PASS' : 'FAIL', evidence: p01End });

    // P24-02 Group checkout card
    await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1},${BAKEHOUSE_BAG2}`);
    await wait(4500);
    await scrollDown(d, 2);
    await tapReserveNow(d);
    const p02Settle = await assertReserveSettled(d);
    const p02End = await shot(d, 'P24-02-group-card-result.png');
    R['P24-02'] = {
      pass: p02Settle.pass,
      ...p02Settle,
      evidence: p02End,
      detail: 'Group card reserve settles',
    };
    log({ id: 'P24-02', result: R['P24-02'].pass ? 'PASS' : 'FAIL', evidence: p02End });

    // P24-03 Cash when eligible (qa customer has prior pickups)
    await dl(`freshasever://checkout?draft=${BAKEHOUSE_BAG1}`);
    await wait(4500);
    await tryTap(d, 'label CONTAINS "Pay at Store"');
    await wait(1200);
    await scrollDown(d, 2);
    await tapReserveNow(d);
    await wait(12_000);
    const p03Src = await d.getPageSource().catch(() => '');
    const p03Pass =
      /Reservation Successful|Rescue Confirmed|Pickup Code/i.test(p03Src) ||
      /Reserve Now|Reserve · Pay at store/i.test(p03Src);
    const p03End = await shot(d, 'P24-03-cash-result.png');
    R['P24-03'] = {
      pass: p03Pass,
      evidence: p03End,
      detail: 'Cash-at-pickup path completes or shows actionable UI',
    };
    log({ id: 'P24-03', result: R['P24-03'].pass ? 'PASS' : 'FAIL', evidence: p03End });

    // P24-04 Shelf checkout
    const shelfPayload = encodeURIComponent(
      JSON.stringify([{ shelf_item_id: SHELF_MILK, quantity: 1 }]),
    );
    await dl(`freshasever://checkout?shelf=${BAKEHOUSE_SHELF}&shelfItems=${shelfPayload}`);
    await wait(4500);
    await scrollDown(d, 2);
    await tapReserveNow(d);
    const p04Settle = await assertReserveSettled(d);
    const p04End = await shot(d, 'P24-04-shelf-card-result.png');
    R['P24-04'] = {
      pass: p04Settle.pass,
      ...p04Settle,
      evidence: p04End,
      detail: 'Shelf card reserve settles',
    };
    log({ id: 'P24-04', result: R['P24-04'].pass ? 'PASS' : 'FAIL', evidence: p04End });

    fs.writeFileSync(RESULTS, JSON.stringify(R, null, 2));
    const failed = Object.entries(R).filter(([, v]) => v.pass === false);
    console.log(JSON.stringify(R, null, 2));
    if (failed.length) process.exit(1);
  } finally {
    await d.deleteSession().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
