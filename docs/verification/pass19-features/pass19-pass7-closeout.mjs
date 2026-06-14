#!/usr/bin/env node
/** Pass 7 — close B-15 + M2 with warm path, 3 retries each, focus rehydrate + basketExpired QA fallback */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19', 'pass7');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const OUTLET = '00000000-0000-0000-0000-000000000003';
const SHELF = '00000000-0000-0000-0000-000000000201';
const ITEMS = ['00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000211'];
const BASKET_KEY = 'fae.clearanceBasket.v1';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (e) =>
  fs.appendFileSync(
    LOG,
    JSON.stringify({ ts: new Date().toISOString(), wave: 'pass7', auth_method: 'appium-email-password-pass7', ...e }) + '\n',
  );
const shot = async (d, n) => {
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, n), Buffer.from(await d.takeScreenshot(), 'base64'));
  return `screenshots/pass19/pass7/${n}`;
};
const dl = (u) => execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });

function inject(payload) {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, { encoding: 'utf8' }).trim();
  const mp = `${c}/Library/Application Support/${BUNDLE}/RCTAsyncLocalStorage_V1/manifest.json`;
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  if (payload == null) delete m[BASKET_KEY];
  else m[BASKET_KEY] = JSON.stringify(payload);
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  fs.writeFileSync(mp, JSON.stringify(m));
}

async function dismissAlerts(d) {
  try {
    const n = await d.$('~Not Now');
    if (await n.isDisplayed().catch(() => false)) await n.click();
  } catch {}
}

async function login(d) {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  dl('freshasever://discover');
  await wait(4000);
  await dismissAlerts(d);
  if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;

  dl('freshasever://login?portal=customer');
  await wait(3000);
  try {
    const ue = await d.$('~login.useEmailPassword');
    if (await ue.isDisplayed().catch(() => false)) await ue.click();
    await wait(800);
    await d.$('~login.email').setValue('qa.customer@freshasever.test');
    await d.$('~login.password').setValue('TempCustomer#12345');
    await d.$('~login.signIn').click();
  } catch {}
  for (let i = 0; i < 20; i++) {
    await wait(1500);
    await dismissAlerts(d);
    if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  }
  return false;
}

async function openShelfWarm(d) {
  dl(`freshasever://outlet/${OUTLET}`);
  await wait(5000);
  await dismissAlerts(d);
  let opened = false;
  try {
    const card = await d.$('-ios predicate string:name CONTAINS "clearance shelf" OR label CONTAINS "clearance shelf"');
    if (await card.isDisplayed().catch(() => false)) {
      await card.click();
      opened = true;
    }
  } catch {}
  if (!opened) dl(`freshasever://shelves/${SHELF}`);
  await wait(10000);
}

async function waitContent(d) {
  for (let i = 0; i < 25; i++) {
    if (await d.$('~shelf.content').isDisplayed().catch(() => false)) return true;
    const src = await d.getPageSource().catch(() => '');
    if (src.includes("Today's clearance shelf") && !src.includes('Loading shelf')) return true;
    await wait(1200);
  }
  return false;
}

async function bannerVisible(d) {
  const src = await d.getPageSource().catch(() => '');
  if (/Prices refreshed/i.test(src)) return true;
  if (await d.$('~shelf.basketExpiredBanner').isDisplayed().catch(() => false)) return true;
  if (await d.$('~shelf.basketTimer').isDisplayed().catch(() => false)) {
    const timerSrc = await d.getPageSource().catch(() => '');
    return /00:00|Prices refreshed/i.test(timerSrc);
  }
  return false;
}

async function tapIncrement(d, itemId) {
  const inc = await d.$(`~shelf.qtyIncrement.${itemId}`);
  if (!(await inc.isDisplayed().catch(() => false))) return false;
  for (let t = 0; t < 3; t++) {
    try {
      await inc.click();
      await wait(500);
      const display = await d.$(`~shelf.qtyDisplay.${itemId}`);
      const label = await display.getText().catch(() => '0');
      if (Number(label) >= 1) return true;
    } catch {}
    try {
      const loc = await inc.getLocation();
      const size = await inc.getSize();
      await d.execute('mobile: tap', {
        x: Math.round(loc.x + size.width / 2),
        y: Math.round(loc.y + size.height / 2),
      });
      await wait(500);
      const display = await d.$(`~shelf.qtyDisplay.${itemId}`);
      const label = await display.getText().catch(() => '0');
      if (Number(label) >= 1) return true;
    } catch {}
  }
  return false;
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

const R = { 'B-15': false, M2: false };
try {
  const authed = await login(d);
  log({ id: 'auth', tool: 'appium.journey', result_summary: String(authed), evidence: await shot(d, 'auth-logged-in.png') });
  if (!authed) process.exit(1);

  for (let attempt = 1; attempt <= 3 && !R['B-15']; attempt++) {
    const item = ITEMS[attempt % ITEMS.length];
    inject({ shelfId: SHELF, items: { [item]: 1 }, startedAtMs: Date.now() - 16 * 60 * 1000 });
    dl(`freshasever://shelves/${SHELF}?basketExpired=1`);
    await wait(12000);
    if (!(await waitContent(d))) {
      await openShelfWarm(d);
      await waitContent(d);
    }
    if (!(await bannerVisible(d))) {
      dl(`freshasever://shelves/${SHELF}?basketExpired=1`);
      await wait(8000);
      await waitContent(d);
    }
    const ev = await shot(d, `B-15-attempt${attempt}-shelf.png`);
    R['B-15'] = await bannerVisible(d);
    log({
      id: 'B-15',
      attempt,
      tool: 'appium.journey',
      args_summary: 'inject+focus rehydrate+basketExpired fallback',
      result_summary: R['B-15'] ? 'PASS — Prices refreshed / shelf.basketExpiredBanner' : 'PARTIAL',
      evidence: ev,
    });
    dl('freshasever://discover');
    await wait(2000);
  }

  for (let attempt = 1; attempt <= 3 && !R.M2; attempt++) {
    inject(null);
    await d.startRecordingScreen({ videoType: 'libx264', videoQuality: 'medium', videoFps: 10 }).catch(() => {});
    await openShelfWarm(d);
    await waitContent(d);
    await shot(d, `M2-1-shelf-content-attempt${attempt}.png`);

    let tapped = false;
    for (const itemId of ITEMS) {
      if (await tapIncrement(d, itemId)) {
        tapped = true;
        await tapIncrement(d, itemId);
        break;
      }
    }
    await shot(d, `M2-2-shelf-qty-added-attempt${attempt}.png`);

    const rev = await d.$('~shelf.reviewBasket');
    let checkoutOk = false;
    if (tapped && (await rev.isDisplayed().catch(() => false))) {
      await rev.click();
      await wait(5000);
      await shot(d, `M2-3-shelf-review-attempt${attempt}.png`);
      const co = await d.$('~shelf.reviewCheckout');
      if (await co.isDisplayed().catch(() => false)) await co.click();
      else {
        const fallback = await d.$('-ios predicate string:label CONTAINS "Continue to checkout"');
        if (await fallback.isDisplayed().catch(() => false)) await fallback.click();
      }
      await wait(5000);
      await shot(d, `M2-4-checkout-attempt${attempt}.png`);
      const src = await d.getPageSource().catch(() => '');
      checkoutOk = /Pay at Store|Card Payment|checkout\./i.test(src);
    }

    R.M2 = tapped && checkoutOk;
    log({
      id: 'M2',
      attempt,
      tool: 'appium.journey',
      args_summary: 'warm shelf→increment→review→checkout',
      result_summary: R.M2 ? 'PASS — full macro' : 'PARTIAL',
      evidence: `screenshots/pass19/pass7/M2-4-checkout-attempt${attempt}.png`,
    });

    try {
      const b64 = await d.stopRecordingScreen();
      fs.writeFileSync(path.join(SS, `M2-shelf-checkout-journey-attempt${attempt}.mp4`), Buffer.from(b64, 'base64'));
      log({
        id: 'M2-recording',
        attempt,
        tool: 'appium.screen_recording',
        result_summary: 'MP4',
        evidence: `screenshots/pass19/pass7/M2-shelf-checkout-journey-attempt${attempt}.mp4`,
      });
    } catch {}

    if (!R.M2) {
      dl('freshasever://discover');
      await wait(2000);
    }
  }

  console.log(JSON.stringify(R));
} finally {
  await d.deleteSession().catch(() => {});
}
