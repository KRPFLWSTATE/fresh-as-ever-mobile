#!/usr/bin/env node
/** Pass 6 final — B-15 + M2 via WebdriverIO + simctl evidence. */
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
const OUTLET = '00000000-0000-0000-0000-000000000003';
const SHELF = '00000000-0000-0000-0000-000000000201';
const ITEM = '00000000-0000-0000-0000-000000000211';
const BASKET_KEY = 'fae.clearanceBasket.v1';

fs.mkdirSync(SS, { recursive: true });

const log = (e) =>
  fs.appendFileSync(
    LOG,
    JSON.stringify({ ts: new Date().toISOString(), wave: 'pass6', auth_method: 'appium-email-password-pass7', ...e }) + '\n',
  );

const simShot = (name) => {
  const p = path.join(SS, name);
  execSync(`xcrun simctl io ${UDID} screenshot "${p}"`, { stdio: 'pipe' });
  return `screenshots/pass19/pass6/${name}`;
};

const dl = (url) => {
  execSync(`xcrun simctl openurl ${UDID} "${url}"`, { stdio: 'pipe' });
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function injectBasket(payload) {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, { encoding: 'utf8' }).trim();
  const mp = path.join(c, 'Library/Application Support', BUNDLE, 'RCTAsyncLocalStorage_V1/manifest.json');
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  if (payload == null) delete m[BASKET_KEY];
  else m[BASKET_KEY] = JSON.stringify(payload);
  fs.writeFileSync(mp, JSON.stringify(m));
}

async function dismissSavePassword(d) {
  try {
    const n = await d.$('~Not Now');
    if (await n.isDisplayed().catch(() => false)) await n.click();
  } catch {}
}

async function login(d) {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  dl('freshasever://discover');
  await wait(3000);
  if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  dl('freshasever://login?portal=customer');
  await wait(3000);
  const useEmail = await d.$('~login.useEmailPassword');
  if (await useEmail.isDisplayed().catch(() => false)) await useEmail.click();
  await wait(800);
  const email = await d.$('~login.email');
  await email.waitForDisplayed({ timeout: 10000 });
  await email.setValue('qa.customer@freshasever.test');
  const pass = await d.$('~login.password');
  await pass.setValue('TempCustomer#12345');
  await d.$('~login.signIn').click();
  for (let i = 0; i < 25; i++) {
    await wait(1200);
    await dismissSavePassword(d);
    if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  }
  return false;
}

async function waitShelf(d, ms = 25000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await d.$('~shelf.content').isDisplayed().catch(() => false)) return 'content';
    const src = await d.getPageSource().catch(() => '');
    if (/Prices refreshed/i.test(src)) return 'expired';
    if (src.includes('shelf.basketTimer')) return 'expired';
    if (src.includes('Sign in to view')) return 'auth';
    if (!src.includes('shelf.loading') && src.includes('Shelf not found')) return 'error';
    await wait(1200);
  }
  return 'timeout';
}

async function refreshBasketHydrate(d) {
  await d.background(2);
  await d.activateApp(BUNDLE);
  await wait(2500);
}

async function goShelfWarm(d, withExpiredBasket = true) {
  if (withExpiredBasket) {
    injectBasket({ shelfId: SHELF, items: { [ITEM]: 1 }, startedAtMs: Date.now() - 16 * 60 * 1000 });
  }
  dl(`freshasever://outlet/${OUTLET}`);
  await wait(5000);
  const card = await d.$('-ios predicate string:name CONTAINS "clearance shelf"');
  if (await card.isDisplayed().catch(() => false)) {
    await card.click();
  } else {
    dl(`freshasever://shelves/${SHELF}`);
  }
  await wait(4000);
  let state = await waitShelf(d, 30000);
  if (state === 'content' && withExpiredBasket) {
    injectBasket({ shelfId: SHELF, items: { [ITEM]: 1 }, startedAtMs: Date.now() - 16 * 60 * 1000 });
    await refreshBasketHydrate(d);
    dl(`freshasever://shelves/${SHELF}`);
    await wait(4000);
    state = await waitShelf(d, 15000);
    let src = await d.getPageSource().catch(() => '');
    if (!/Prices refreshed|shelf.basketTimer/i.test(src)) {
      const inc = await d.$(`~shelf.qtyIncrement.${ITEM}`);
      if (await inc.isDisplayed().catch(() => false)) {
        await inc.click();
        await wait(800);
      }
      injectBasket({ shelfId: SHELF, items: { [ITEM]: 1 }, startedAtMs: Date.now() - 16 * 60 * 1000 });
      await refreshBasketHydrate(d);
      dl(`freshasever://shelves/${SHELF}`);
      await wait(4000);
      state = await waitShelf(d, 15000);
      src = await d.getPageSource().catch(() => '');
    }
    if (/Prices refreshed|shelf.basketTimer/i.test(src)) state = 'expired';
  }
  return state;
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

const R = { auth: false, 'B-15': false, M2: false };

try {
  R.auth = await login(d);
  log({ id: 'auth', tool: 'appium.journey', result_summary: String(R.auth), evidence: simShot('auth-logged-in.png') });
  if (!R.auth) throw new Error('auth failed');

  // B-15 x3
  for (let attempt = 1; attempt <= 3; attempt++) {
    dl('freshasever://discover');
    await wait(2500);
    const state = await goShelfWarm(d);
    const ev = simShot(`B-15-attempt${attempt}-shelf.png`);
    const src = await d.getPageSource().catch(() => '');
    const pass = state === 'expired' || /Prices refreshed/i.test(src) || (await d.$('~shelf.basketTimer').isDisplayed().catch(() => false));
    R['B-15'] = pass;
    log({
      id: 'B-15',
      attempt,
      tool: 'appium.journey',
      args_summary: 'expired inject + warm outlet→shelf',
      result_summary: pass ? 'PASS — Prices refreshed / shelf.basketTimer' : `PARTIAL — ${state}`,
      evidence: ev,
    });
    if (pass) break;
    dl('freshasever://discover');
    await wait(2000);
  }

  // M2
  let rec = false;
  try {
    await d.startRecordingScreen({ videoType: 'libx264', videoQuality: 'medium', videoFps: 10 });
    rec = true;
  } catch {}

  injectBasket(null);
  dl('freshasever://discover');
  await wait(2500);
  dl(`freshasever://shelves/${SHELF}`);
  await wait(6000);
  let shelfState = await waitShelf(d, 30000);
  simShot('M2-1-shelf-content.png');
  if (shelfState === 'content' || shelfState === 'expired') {
    const inc = await d.$(`~shelf.qtyIncrement.${ITEM}`);
    if (await inc.isDisplayed().catch(() => false)) {
      await inc.click();
      await wait(600);
      await inc.click();
    }
    simShot('M2-2-shelf-qty-added.png');
    const rev = await d.$('~shelf.reviewBasket');
    if (await rev.isDisplayed().catch(() => false)) {
      await rev.click();
      await wait(4000);
      simShot('M2-3-shelf-review.png');
      const checkout = await d.$('-ios predicate string:label CONTAINS "Checkout" OR label CONTAINS "Proceed"');
      if (await checkout.isDisplayed().catch(() => false)) await checkout.click();
      await wait(4000);
      simShot('M2-4-checkout.png');
      const src = await d.getPageSource().catch(() => '');
      R.M2 = /Pay at Store|Card Payment|checkout\./i.test(src) || src.includes('checkout.');
    }
  }

  log({
    id: 'M2',
    tool: 'appium.journey',
    args_summary: 'shelf → increment → review → checkout',
    result_summary: R.M2 ? 'PASS — full macro' : `PARTIAL — shelfState=${shelfState}`,
    evidence: 'screenshots/pass19/pass6/M2-4-checkout.png',
  });

  if (rec) {
    const b64 = await d.stopRecordingScreen();
    fs.writeFileSync(path.join(SS, 'M2-shelf-checkout-journey.mp4'), Buffer.from(b64, 'base64'));
    log({ id: 'M2-recording', tool: 'appium.screen_recording', result_summary: 'M2 journey MP4', evidence: 'screenshots/pass19/pass6/M2-shelf-checkout-journey.mp4' });
  }

  console.log(JSON.stringify(R, null, 2));
} finally {
  await d.deleteSession().catch(() => {});
}
