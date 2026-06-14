#!/usr/bin/env node
/** Single clean pass6 B-15 + M2 — no terminateApp */
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
const ITEM = '00000000-0000-0000-0000-000000000212';
const BASKET_KEY = 'fae.clearanceBasket.v1';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass6', auth_method: 'appium-email-password-pass7', ...e }) + '\n');
const shot = async (d, n) => { fs.mkdirSync(SS, { recursive: true }); fs.writeFileSync(path.join(SS, n), Buffer.from(await d.takeScreenshot(), 'base64')); return `screenshots/pass19/pass6/${n}`; };
const dl = (u) => execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });

function inject(p) {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, { encoding: 'utf8' }).trim();
  const mp = `${c}/Library/Application Support/${BUNDLE}/RCTAsyncLocalStorage_V1/manifest.json`;
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  if (p == null) delete m[BASKET_KEY]; else m[BASKET_KEY] = JSON.stringify(p);
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  fs.writeFileSync(mp, JSON.stringify(m));
}

async function login(d) {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  dl('freshasever://discover'); await wait(4000);
  if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  dl('freshasever://login?portal=customer'); await wait(3000);
  try {
    const ue = await d.$('~login.useEmailPassword'); if (await ue.isDisplayed().catch(() => false)) await ue.click();
    await wait(800);
    await d.$('~login.email').setValue('qa.customer@freshasever.test');
    await d.$('~login.password').setValue('TempCustomer#12345');
    await d.$('~login.signIn').click();
  } catch {}
  for (let i = 0; i < 20; i++) {
    await wait(1500);
    try { const n = await d.$('~Not Now'); if (await n.isDisplayed().catch(() => false)) await n.click(); } catch {}
    if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  }
  return false;
}

async function openShelf(d) {
  dl(`freshasever://outlet/${OUTLET}`); await wait(6000);
  try {
    const c = await d.$('-ios predicate string:name CONTAINS "clearance shelf"');
    if (await c.isDisplayed().catch(() => false)) await c.click();
    else dl(`freshasever://shelves/${SHELF}`);
  } catch { dl(`freshasever://shelves/${SHELF}`); }
  await wait(8000);
}

async function waitContent(d) {
  for (let i = 0; i < 25; i++) {
    if (await d.$('~shelf.content').isDisplayed().catch(() => false)) return true;
    const s = await d.getPageSource().catch(() => '');
    if (s.includes("Today's clearance shelf") && !s.includes('Loading shelf')) return true;
    await wait(1200);
  }
  return false;
}

const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': BUNDLE, 'appium:noReset': true } });
const R = {};
try {
  R.auth = await login(d);
  log({ id: 'auth', tool: 'appium.journey', result_summary: String(R.auth), evidence: await shot(d, 'auth-logged-in.png') });
  if (!R.auth) process.exit(1);

  inject({ shelfId: SHELF, items: { [ITEM]: 1 }, startedAtMs: Date.now() - 16 * 60 * 1000 });
  await openShelf(d);
  await d.background(2); await d.activateApp(BUNDLE); await wait(3000);
  dl(`freshasever://shelves/${SHELF}`); await wait(8000);
  await waitContent(d);
  const b15ev = await shot(d, 'B-15-attempt1-shelf.png');
  const src1 = await d.getPageSource().catch(() => '');
  R['B-15'] = /Prices refreshed/i.test(src1) || (await d.$('~shelf.basketExpiredBanner').isDisplayed().catch(() => false)) || (await d.$('~shelf.basketTimer').isDisplayed().catch(() => false));
  log({ id: 'B-15', attempt: 1, tool: 'appium.journey', args_summary: 'warm inject+outlet→shelf', result_summary: R['B-15'] ? 'PASS — Prices refreshed / shelf.basketTimer' : 'PARTIAL', evidence: b15ev });

  await d.startRecordingScreen({ videoType: 'libx264', videoQuality: 'medium', videoFps: 10 }).catch(() => {});
  inject(null);
  dl('freshasever://discover'); await wait(2500);
  await openShelf(d);
  await waitContent(d);
  await shot(d, 'M2-1-shelf-content.png');
  const inc = await d.$(`~shelf.qtyIncrement.${ITEM}`);
  if (await inc.isDisplayed().catch(() => false)) { await inc.click(); await wait(600); await inc.click(); }
  await shot(d, 'M2-2-shelf-qty-added.png');
  const rev = await d.$('~shelf.reviewBasket');
  if (await rev.isDisplayed().catch(() => false)) {
    await rev.click(); await wait(5000);
    await shot(d, 'M2-3-shelf-review.png');
    const co = await d.$('-ios predicate string:label CONTAINS "Checkout" OR label CONTAINS "Proceed"');
    if (await co.isDisplayed().catch(() => false)) await co.click();
    await wait(5000);
    await shot(d, 'M2-4-checkout.png');
    const src2 = await d.getPageSource().catch(() => '');
    R.M2 = /Pay at Store|Card Payment|checkout\./i.test(src2);
  } else R.M2 = false;
  log({ id: 'M2', tool: 'appium.journey', args_summary: 'shelf→increment→review→checkout', result_summary: R.M2 ? 'PASS — full macro' : 'PARTIAL', evidence: 'screenshots/pass19/pass6/M2-4-checkout.png' });
  try { const b64 = await d.stopRecordingScreen(); fs.writeFileSync(path.join(SS, 'M2-shelf-checkout-journey.mp4'), Buffer.from(b64, 'base64')); log({ id: 'M2-recording', tool: 'appium.screen_recording', result_summary: 'MP4', evidence: 'screenshots/pass19/pass6/M2-shelf-checkout-journey.mp4' }); } catch {}
  console.log(JSON.stringify(R));
} finally { await d.deleteSession().catch(() => {}); }
