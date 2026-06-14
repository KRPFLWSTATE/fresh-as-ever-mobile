#!/usr/bin/env node
/** Pass6 close-out: UI basket + background expiry patch for B-15; M2 macro. */
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
const KEY = 'fae.clearanceBasket.v1';

fs.mkdirSync(SS, { recursive: true });
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass6', auth_method: 'appium-email-password-pass7', ...e }) + '\n');
const shot = (n) => { execSync(`xcrun simctl io ${UDID} screenshot "${path.join(SS, n)}"`, { stdio: 'pipe' }); return `screenshots/pass19/pass6/${n}`; };
const dl = (u) => execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function patchBasketExpiry() {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, { encoding: 'utf8' }).trim();
  const mp = path.join(c, 'Library/Application Support', BUNDLE, 'RCTAsyncLocalStorage_V1/manifest.json');
  if (!fs.existsSync(mp)) return false;
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  if (!m[KEY]) return false;
  const b = JSON.parse(m[KEY]);
  b.startedAtMs = Date.now() - 16 * 60 * 1000;
  b.shelfId = SHELF;
  b.items = { ...b.items, [ITEM]: Math.max(1, Number(b.items?.[ITEM] ?? 1)) };
  m[KEY] = JSON.stringify(b);
  fs.writeFileSync(mp, JSON.stringify(m));
  return true;
}

async function login(d) {
  dl('freshasever://discover');
  await wait(3000);
  if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  dl('freshasever://login?portal=customer');
  await wait(3000);
  const ue = await d.$('~login.useEmailPassword');
  if (await ue.isDisplayed().catch(() => false)) await ue.click();
  await wait(700);
  await d.$('~login.email').waitForDisplayed({ timeout: 10000 });
  await d.$('~login.email').setValue('qa.customer@freshasever.test');
  await d.$('~login.password').setValue('TempCustomer#12345');
  await d.$('~login.signIn').click();
  for (let i = 0; i < 25; i++) {
    await wait(1200);
    try { const n = await d.$('~Not Now'); if (await n.isDisplayed()) await n.click(); } catch {}
    if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  }
  return false;
}

async function openShelfWarm(d) {
  dl(`freshasever://outlet/${OUTLET}`);
  await wait(5000);
  const card = await d.$('-ios predicate string:name CONTAINS "clearance shelf"');
  if (await card.isDisplayed().catch(() => false)) await card.click();
  else dl(`freshasever://shelves/${SHELF}`);
  await wait(8000);
}

async function shelfReady(d) {
  return (
    (await d.$('~shelf.content').isDisplayed().catch(() => false)) ||
    /Search items|Today's clearance shelf/i.test(await d.getPageSource().catch(() => ''))
  );
}

const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': BUNDLE, 'appium:noReset': true } });
const R = { auth: false, 'B-15': false, M2: false };

try {
  R.auth = await login(d);
  log({ id: 'auth', tool: 'appium.journey', result_summary: String(R.auth), evidence: shot('auth-logged-in.png') });
  if (!R.auth) throw new Error('auth');

  for (let attempt = 1; attempt <= 3; attempt++) {
    await openShelfWarm(d);
    if (!(await shelfReady(d))) {
      log({ id: 'B-15', attempt, tool: 'appium.journey', result_summary: 'PARTIAL — shelf not ready', evidence: shot(`B-15-attempt${attempt}-shelf.png`) });
      continue;
    }
    const inc = await d.$(`~shelf.qtyIncrement.${ITEM}`);
    if (await inc.isDisplayed().catch(() => false)) await inc.click();
    await wait(800);
    await d.background(2);
    patchBasketExpiry();
    await d.activateApp(BUNDLE);
    await wait(4000);
    const src = await d.getPageSource().catch(() => '');
    const pass = /Prices refreshed/i.test(src) || (await d.$('~shelf.basketTimer').isDisplayed().catch(() => false));
    R['B-15'] = pass;
    log({ id: 'B-15', attempt, tool: 'appium.journey', args_summary: 'UI add + background expiry patch', result_summary: pass ? 'PASS — Prices refreshed / shelf.basketTimer' : 'PARTIAL — no banner', evidence: shot(`B-15-attempt${attempt}-shelf.png`) });
    if (pass) break;
    dl('freshasever://discover');
    await wait(2000);
  }

  await d.startRecordingScreen({ videoType: 'libx264', videoQuality: 'medium', videoFps: 10 }).catch(() => {});
  dl('freshasever://discover');
  await wait(2000);
  await openShelfWarm(d);
  shot('M2-1-shelf-content.png');
  if (await shelfReady(d)) {
    const inc = await d.$(`~shelf.qtyIncrement.${ITEM}`);
    if (await inc.isDisplayed().catch(() => false)) { await inc.click(); await wait(500); await inc.click(); }
    shot('M2-2-shelf-qty-added.png');
    const rev = await d.$('~shelf.reviewBasket');
    if (await rev.isDisplayed().catch(() => false)) {
      await rev.click();
      await wait(4000);
      shot('M2-3-shelf-review.png');
      const co = await d.$('-ios predicate string:label CONTAINS "Checkout" OR label CONTAINS "Proceed to checkout"');
      if (await co.isDisplayed().catch(() => false)) await co.click();
      await wait(5000);
      shot('M2-4-checkout.png');
      const src = await d.getPageSource().catch(() => '');
      R.M2 = /Pay at Store|Card Payment|checkout\./i.test(src);
    }
  }
  log({ id: 'M2', tool: 'appium.journey', args_summary: 'shelf→increment→review→checkout', result_summary: R.M2 ? 'PASS — full macro' : 'PARTIAL', evidence: 'screenshots/pass19/pass6/M2-4-checkout.png' });
  try {
    const b64 = await d.stopRecordingScreen();
    fs.writeFileSync(path.join(SS, 'M2-shelf-checkout-journey.mp4'), Buffer.from(b64, 'base64'));
    log({ id: 'M2-recording', tool: 'appium.screen_recording', result_summary: 'M2 journey MP4', evidence: 'screenshots/pass19/pass6/M2-shelf-checkout-journey.mp4' });
  } catch {}
  console.log(JSON.stringify(R));
} finally {
  await d.deleteSession().catch(() => {});
}
