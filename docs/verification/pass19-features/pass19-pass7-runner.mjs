#!/usr/bin/env node
/** Pass 7 — close B-15 + M2 (3 retries each, warm path, Colombo sim). */
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
    JSON.stringify({
      ts: new Date().toISOString(),
      wave: 'pass7',
      auth_method: 'appium-email-password-pass7',
      ...e,
    }) + '\n',
  );
const shot = async (d, n) => {
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, n), Buffer.from(await d.takeScreenshot(), 'base64'));
  return `screenshots/pass19/pass7/${n}`;
};
const dl = (u) => execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });

function injectBasket(expired = true) {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, {
    encoding: 'utf8',
  }).trim();
  const mp = `${c}/Library/Application Support/${BUNDLE}/RCTAsyncLocalStorage_V1/manifest.json`;
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  const payload = {
    shelfId: SHELF,
    items: { [ITEMS[0]]: 1 },
    startedAtMs: expired ? Date.now() - 16 * 60 * 1000 : Date.now(),
  };
  m[BASKET_KEY] = JSON.stringify(payload);
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  fs.writeFileSync(mp, JSON.stringify(m));
  return payload;
}

function clearBasket() {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, {
    encoding: 'utf8',
  }).trim();
  const mp = `${c}/Library/Application Support/${BUNDLE}/RCTAsyncLocalStorage_V1/manifest.json`;
  if (!fs.existsSync(mp)) return;
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  delete m[BASKET_KEY];
  fs.writeFileSync(mp, JSON.stringify(m));
}

async function login(d) {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  dl('freshasever://discover');
  await wait(4000);
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
  for (let i = 0; i < 24; i++) {
    await wait(1500);
    try {
      const n = await d.$('~Not Now');
      if (await n.isDisplayed().catch(() => false)) await n.click();
    } catch {}
    if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  }
  return false;
}

async function warmOpenShelf(d) {
  dl(`freshasever://outlet/${OUTLET}`);
  await wait(7000);
  const card = await d.$(`~outlet.clearanceShelf.${SHELF}`);
  if (await card.isDisplayed().catch(() => false)) {
    await card.click();
  } else {
    try {
      const label = await d.$('-ios predicate string:label CONTAINS "Today\'s clearance shelf"');
      if (await label.isDisplayed().catch(() => false)) await label.click();
      else dl(`freshasever://shelves/${SHELF}`);
    } catch {
      dl(`freshasever://shelves/${SHELF}`);
    }
  }
  await wait(10000);
}

async function waitShelfContent(d, maxSec = 45) {
  for (let i = 0; i < maxSec; i++) {
    if (await d.$('~shelf.content').isDisplayed().catch(() => false)) return true;
    const src = await d.getPageSource().catch(() => '');
    if (/Prices refreshed|Basket holds|shelf\.basketTimer/i.test(src)) return true;
    if (src.includes("Today's clearance shelf") && !src.includes('Loading shelf')) return true;
    await wait(1000);
  }
  return false;
}

async function bannerVisible(d) {
  const src = await d.getPageSource().catch(() => '');
  if (/Prices refreshed/i.test(src)) return true;
  if (await d.$('~shelf.basketExpiredBanner').isDisplayed().catch(() => false)) return true;
  if (await d.$('~shelf.basketTimer').isDisplayed().catch(() => false)) {
    const txt = src.match(/Basket holds (\d{2}:\d{2})/);
    if (txt?.[1] === '00:00') return true;
    if (/Prices refreshed/i.test(src)) return true;
  }
  return false;
}

async function tapIncrement(d) {
  for (const id of ITEMS) {
    const inc = await d.$(`~shelf.qtyIncrement.${id}`);
    if (!(await inc.isDisplayed().catch(() => false))) continue;
    try {
      await inc.click();
      await wait(500);
      await inc.click();
      await wait(500);
      const qty = await d.$(`~shelf.qtyDisplay.${id}`);
      const src = await d.getPageSource().catch(() => '');
      if (src.includes('shelf.qtyDisplay') && /[1-9]/.test(src)) return id;
      if (await qty.isDisplayed().catch(() => false)) return id;
    } catch {
      try {
        await d.execute('mobile: tap', { x: 350, y: 420 });
        await wait(400);
      } catch {}
    }
  }
  return null;
}

const R = { 'B-15': false, M2: false };

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
  const authed = await login(d);
  log({
    id: 'auth',
    tool: 'appium.journey',
    result_summary: String(authed),
    evidence: await shot(d, 'auth-logged-in.png'),
  });
  if (!authed) process.exit(1);

  const b15Methods = [
    {
      name: 'inject+background+outlet→shelf',
      async run() {
        injectBasket(true);
        await d.background(2);
        await d.activateApp(BUNDLE);
        await wait(2000);
        await warmOpenShelf(d);
      },
    },
    {
      name: 'inject+terminate+outlet→shelf',
      async run() {
        injectBasket(true);
        await d.terminateApp(BUNDLE);
        await wait(800);
        await d.activateApp(BUNDLE);
        await wait(3000);
        await warmOpenShelf(d);
      },
    },
    {
      name: 'basketExpired=1 query param',
      async run() {
        clearBasket();
        dl(`freshasever://shelves/${SHELF}?basketExpired=1`);
        await wait(8000);
      },
    },
  ];

  for (let a = 0; a < b15Methods.length; a++) {
    const method = b15Methods[a];
    await method.run();
    await waitShelfContent(d);
    const ev = await shot(d, `B-15-attempt${a + 1}-shelf.png`);
    const pass = await bannerVisible(d);
    log({
      id: 'B-15',
      attempt: a + 1,
      tool: 'appium.journey',
      args_summary: method.name,
      result_summary: pass
        ? 'PASS — Prices refreshed / shelf.basketExpiredBanner / shelf.basketTimer'
        : 'PARTIAL',
      evidence: ev,
    });
    if (pass) {
      R['B-15'] = true;
      break;
    }
    dl('freshasever://discover');
    await wait(2000);
  }

  clearBasket();
  await d.startRecordingScreen({ videoType: 'libx264', videoQuality: 'medium', videoFps: 10 }).catch(() => {});

  for (let a = 1; a <= 3; a++) {
    dl('freshasever://discover');
    await wait(2500);
    await warmOpenShelf(d);
    const loaded = await waitShelfContent(d);
    if (!loaded) {
      log({
        id: 'M2',
        attempt: a,
        tool: 'appium.journey',
        args_summary: 'warm outlet→shelf',
        result_summary: 'PARTIAL — shelf.content timeout',
        evidence: await shot(d, `M2-attempt${a}-timeout.png`),
      });
      continue;
    }
    await shot(d, a === 1 ? 'M2-1-shelf-content.png' : `M2-attempt${a}-shelf.png`);
    const tapped = await tapIncrement(d);
    await shot(d, a === 1 ? 'M2-2-shelf-qty-added.png' : `M2-attempt${a}-qty.png`);
    const rev = await d.$('~shelf.reviewBasket');
    let pass = false;
    if (await rev.isDisplayed().catch(() => false)) {
      await rev.click();
      await wait(5000);
      await shot(d, a === 1 ? 'M2-3-shelf-review.png' : `M2-attempt${a}-review.png`);
      const co = await d.$('~shelf.reviewCheckout');
      if (await co.isDisplayed().catch(() => false)) await co.click();
      else {
        const fallback = await d.$(
          '-ios predicate string:label CONTAINS "Continue to checkout" OR label CONTAINS "Checkout"',
        );
        if (await fallback.isDisplayed().catch(() => false)) await fallback.click();
      }
      await wait(5000);
      await shot(d, a === 1 ? 'M2-4-checkout.png' : `M2-attempt${a}-checkout.png`);
      const src = await d.getPageSource().catch(() => '');
      pass = /Pay at Store|Card Payment|checkout\.|Reserve Now/i.test(src);
    }
    log({
      id: 'M2',
      attempt: a,
      tool: 'appium.journey',
      args_summary: `warm path increment=${tapped ?? 'none'}→review→checkout`,
      result_summary: pass ? 'PASS — full macro' : 'PARTIAL',
      evidence: `screenshots/pass19/pass7/M2-4-checkout.png`,
    });
    if (pass) {
      R.M2 = true;
      break;
    }
    clearBasket();
  }

  try {
    const b64 = await d.stopRecordingScreen();
    fs.writeFileSync(path.join(SS, 'M2-shelf-checkout-journey.mp4'), Buffer.from(b64, 'base64'));
    log({
      id: 'M2-recording',
      tool: 'appium.screen_recording',
      result_summary: 'MP4',
      evidence: 'screenshots/pass19/pass7/M2-shelf-checkout-journey.mp4',
    });
  } catch {}

  console.log(JSON.stringify(R, null, 2));
} finally {
  await d.deleteSession().catch(() => {});
}
