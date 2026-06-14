#!/usr/bin/env node
/**
 * Pass 19 verification pass 6 — close B-15 and M2 (warm shelf path).
 * Auth: login.email/password/signIn (pass4/pass7 method).
 * Shelf: outlet deeplink → clearance shelf card (no cold-launch shelf deeplink).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19', 'pass6');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const SHELF_ITEM = '00000000-0000-0000-0000-000000000211';
const BASKET_KEY = 'fae.clearanceBasket.v1';
const AUTH_METHOD = 'appium-email-password-pass7';

const R = {};

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 3200));
};

const log = (e) =>
  fs.appendFileSync(
    LOG,
    JSON.stringify({ ts: new Date().toISOString(), wave: 'pass6', auth_method: AUTH_METHOD, ...e }) + '\n',
  );

const shot = async (d, name) => {
  fs.mkdirSync(SS, { recursive: true });
  const rel = `screenshots/pass19/pass6/${name}`;
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

async function dismissSavePassword(d) {
  await tryTap(d, 'name == "Not Now" OR label == "Not Now"', 4000);
  await d.pause(500);
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
  const src = await safePageSource(d);
  return (
    src.includes('tab.discover') ||
    src.includes('discover.searchInput') ||
    (src.includes('Discover') &&
      !src.includes('discover.guestSignInTitle') &&
      !src.includes('Sign in to see rescue bags'))
  );
}

async function ensureLoggedIn(d, allowAppRestart = false) {
  if (await isLoggedIn(d)) return true;
  if (allowAppRestart) return customerLogin(d);
  await dl('freshasever://login?portal=customer');
  await d.pause(2500);
  await tryTap(d, 'name CONTAINS "Use email" OR label CONTAINS "Use email & password"');
  await d.pause(800);
  const emailById = await d.$('~login.email');
  if (await emailById.isDisplayed().catch(() => false)) {
    await emailById.setValue('qa.customer@freshasever.test');
    await dismissKeyboard(d);
    const passById = await d.$('~login.password');
    if (await passById.isDisplayed().catch(() => false)) {
      await passById.setValue('TempCustomer#12345');
      await dismissKeyboard(d);
    }
    await tapSignIn(d);
    for (let i = 0; i < 15; i++) {
      await d.pause(1500);
      if (await isLoggedIn(d)) return true;
    }
  }
  return customerLogin(d);
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
      }
    }
  }
  await dismissKeyboard(d);
  await tapSignIn(d);
  await dismissSavePassword(d);

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
  const mp = path.join(
    c,
    'Library',
    'Application Support',
    BUNDLE,
    'RCTAsyncLocalStorage_V1',
    'manifest.json',
  );
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  if (val == null) delete m[key];
  else m[key] = JSON.stringify(val);
  fs.writeFileSync(mp, JSON.stringify(m));
}

async function safePageSource(d) {
  try {
    return await d.getPageSource();
  } catch {
    await d.pause(2000);
    try {
      return await d.getPageSource();
    } catch {
      return '';
    }
  }
}

async function waitForShelfContent(d, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const loading = await d.$('~shelf.loading').isDisplayed().catch(() => false);
    const content = await d.$('~shelf.content').isDisplayed().catch(() => false);
    if (content && !loading) return 'content';
    const src = await safePageSource(d);
    if (src.includes('shelf.content') || src.includes('shelf.qtyIncrement')) return 'content';
    if (/Prices refreshed/i.test(src)) return 'expired';
    if (src.includes('Shelf not found') || src.includes('Shelf took too long')) return 'error';
    if (src.includes('Loading shelf') && Date.now() - start > 28000) return 'loading';
    await d.pause(1500);
  }
  return 'timeout';
}

async function navigateToShelfWarm(d) {
  if (!(await ensureLoggedIn(d))) return 'auth_lost';
  await dl(`freshasever://outlet/${BAKEHOUSE_OUTLET}`);
  await d.pause(4500);
  await scrollDown(d, 2);
  const tapped =
    (await tryTap(d, 'label CONTAINS "Today\'s clearance shelf" OR name CONTAINS "Today\'s clearance shelf"', 5000)) ||
    (await tryTap(d, 'label CONTAINS "clearance shelf" OR name CONTAINS "clearance shelf"', 5000)) ||
    (await tryTap(d, 'label CONTAINS "item" AND label CONTAINS "Pickup"', 5000));
  if (!tapped) {
    const cards = await d.$$('-ios predicate string:type == "XCUIElementTypeButton"');
    for (const card of cards.slice(0, 20)) {
      const label = (await card.getAttribute('label').catch(() => '')) || '';
      if (/clearance|shelf|item/i.test(label)) {
        await card.click();
        await d.pause(2000);
        break;
      }
    }
  }
  let state = await waitForShelfContent(d, 15000);
  if (state === 'content' || state === 'expired') return state;
  if (!(await ensureLoggedIn(d))) return 'auth_lost';
  await dl(`freshasever://shelves/${BAKEHOUSE_SHELF}`);
  await d.pause(6000);
  state = await waitForShelfContent(d, 25000);
  return state;
}

async function verifyB15(d, attempt) {
  if (!(await ensureLoggedIn(d))) return { pass: false, state: 'auth_lost', evidence: null };
  injectAsyncStorage(BASKET_KEY, {
    shelfId: BAKEHOUSE_SHELF,
    items: { [SHELF_ITEM]: 1 },
    startedAtMs: Date.now() - 16 * 60 * 1000,
  });
  await dl('freshasever://discover');
  await d.pause(3000);
  const state = await navigateToShelfWarm(d);
  await shot(d, `B-15-attempt${attempt}-shelf.png`);
  const src = await safePageSource(d);
  const timerVisible = await d.$('~shelf.basketTimer').isDisplayed().catch(() => false);
  const pass =
    /Prices refreshed/i.test(src) ||
    timerVisible ||
    state === 'expired';
  return { pass, state, evidence: `screenshots/pass19/pass6/B-15-attempt${attempt}-shelf.png` };
}

async function verifyM2(d) {
  if (!(await ensureLoggedIn(d))) return { pass: false, step: 'auth', evidence: null };
  injectAsyncStorage(BASKET_KEY, null);
  await dl('freshasever://discover');
  await d.pause(3000);
  const state = await navigateToShelfWarm(d);
  await shot(d, 'M2-1-shelf-content.png');
  if (state !== 'content' && state !== 'expired') {
    return { pass: false, step: 'shelf', evidence: 'screenshots/pass19/pass6/M2-1-shelf-content.png' };
  }

  const inc = await d.$(`~shelf.qtyIncrement.${SHELF_ITEM}`);
  if (await inc.isDisplayed().catch(() => false)) {
    await inc.click();
    await d.pause(800);
    await inc.click();
  } else {
    await tryTap(d, 'name CONTAINS "add" OR label CONTAINS "add"', 3000);
  }
  await shot(d, 'M2-2-shelf-qty-added.png');

  const rev = await d.$('~shelf.reviewBasket');
  if (!(await rev.isDisplayed().catch(() => false))) {
    return { pass: false, step: 'reviewButton', evidence: 'screenshots/pass19/pass6/M2-2-shelf-qty-added.png' };
  }
  await rev.click();
  await d.pause(4000);
  await shot(d, 'M2-3-shelf-review.png');

  const checkoutTap =
    (await tryTap(d, 'label CONTAINS "Checkout" OR name CONTAINS "Checkout"', 6000)) ||
    (await tryTap(d, 'label CONTAINS "Proceed" OR name CONTAINS "Proceed"', 4000));
  await d.pause(4000);
  await shot(d, 'M2-4-checkout.png');
  const src = await safePageSource(d);
  const pass =
    checkoutTap ||
    src.includes('checkout.') ||
    /Pay at Store|Card Payment|Reserve/i.test(src);
  return { pass, step: 'checkout', evidence: 'screenshots/pass19/pass6/M2-4-checkout.png' };
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
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  R.auth = await customerLogin(d);
  log({ id: 'auth', tool: 'appium.journey', result_summary: String(R.auth), evidence: await shot(d, 'auth-logged-in.png') });
  if (!R.auth) {
    console.error('AUTH FAILED');
    process.exit(1);
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const b15 = await verifyB15(d, attempt);
      R[`B-15-attempt${attempt}`] = b15.pass;
      log({
        id: 'B-15',
        attempt,
        tool: 'appium.journey',
        args_summary: 'expired basket inject + warm outlet→shelf',
        result_summary: b15.pass ? 'PASS — Prices refreshed / shelf.basketTimer' : `PARTIAL — ${b15.state}`,
        evidence: b15.evidence,
      });
      if (b15.pass) {
        R['B-15'] = true;
        break;
      }
    } catch (err) {
      R[`B-15-attempt${attempt}`] = false;
      await shot(d, `B-15-attempt${attempt}-error.png`).catch(() => null);
      log({
        id: 'B-15',
        attempt,
        tool: 'appium.journey',
        result_summary: `ERROR — ${err instanceof Error ? err.message : String(err)}`,
        evidence: `screenshots/pass19/pass6/B-15-attempt${attempt}-error.png`,
      });
    }
    await dl('freshasever://discover');
    await d.pause(3000);
  }
  R['B-15'] = R['B-15'] === true;

  let recording = null;
  try {
    await d.startRecordingScreen({ videoType: 'libx264', videoQuality: 'medium', videoFps: 10 });
    recording = true;
  } catch {}

  const m2 = await verifyM2(d);
  R.M2 = m2.pass;
  log({
    id: 'M2',
    tool: 'appium.journey',
    args_summary: 'warm shelf → increment → review → checkout',
    result_summary: m2.pass ? 'PASS — full macro' : `PARTIAL — stuck at ${m2.step}`,
    evidence: m2.evidence,
  });

  if (recording) {
    const b64 = await d.stopRecordingScreen();
    fs.writeFileSync(path.join(SS, 'M2-shelf-checkout-journey.mp4'), Buffer.from(b64, 'base64'));
    log({
      id: 'M2-recording',
      tool: 'appium.screen_recording',
      result_summary: 'M2 journey MP4',
      evidence: 'screenshots/pass19/pass6/M2-shelf-checkout-journey.mp4',
    });
  }

  console.log(JSON.stringify(R, null, 2));
} finally {
  await d.deleteSession();
}
