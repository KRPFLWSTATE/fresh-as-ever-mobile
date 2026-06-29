#!/usr/bin/env node
/**
 * WS7 final — bulletproof credential entry (char-by-char into the iOS secure
 * field, since setValue silently no-ops there), robust handover, Kumbuk tabs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID,
  BUNDLE,
  wait,
  dl,
  tryTap,
  CREDS,
  ensureMerchantLoginPortal,
  dismissKeyboard,
  dismissSavePassword,
  dismissSystemPrompts,
  dismissOverlays,
  relaunchApp,
  merchantLogout,
  isMerchantLoggedIn,
  isBakehouseMerchantSession,
  isKumbukMerchantSession,
  waitForMerchantDashboard,
  safePageSource,
} from '../pass26-expansion/lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(ROOT, 'screenshots');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const RESULTS = path.join(ROOT, 'results.json');
fs.mkdirSync(SS_DIR, { recursive: true });

const R = {};
function log(e) {
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), agent: 'WS7-FINAL', ...e }) + '\n');
}
async function shot(d, id) {
  try {
    fs.writeFileSync(path.join(SS_DIR, `${id}.png`), Buffer.from(await d.takeScreenshot(), 'base64'));
    return `screenshots/${id}.png`;
  } catch {
    return '';
  }
}
async function record(d, id, pass, detail, extra = {}) {
  const evidence = await shot(d, id);
  R[id] = { pass, evidence, detail, ...extra };
  log({ id, result: pass ? 'PASS' : 'FAIL', detail, evidence, ...extra });
  console.log(`${id}: ${pass ? 'PASS' : 'FAIL'} — ${detail}`);
}
function mergeResults() {
  let merged = {};
  if (fs.existsSync(RESULTS)) {
    try {
      merged = { ...JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results };
    } catch {}
  }
  for (const [id, row] of Object.entries(R)) merged[id] = row;
  const pass = Object.values(merged).filter((v) => v.pass).length;
  const fail = Object.values(merged).filter((v) => !v.pass).length;
  fs.writeFileSync(RESULTS, JSON.stringify({ pass, fail, results: merged, ts: new Date().toISOString() }, null, 2));
}
const hasAny = (src, ns) => {
  const s = String(src || '').toLowerCase();
  return ns.some((n) => s.includes(String(n).toLowerCase()));
};

async function typeInto(el, text, secure = false) {
  await el.click();
  await wait(350);
  try {
    await el.clearValue();
  } catch {}
  await wait(150);
  for (const ch of text) {
    await el.addValue(ch);
    await wait(secure ? 45 : 25);
  }
  await wait(250);
}

async function loginMerchantDirect(d, account) {
  const creds = CREDS[account];
  const isSession = account === 'kumbuk' ? isKumbukMerchantSession : isBakehouseMerchantSession;
  await relaunchApp(d);
  await dismissSystemPrompts(d);
  await dl('freshasever://merchant/dashboard');
  await wait(3000);
  if ((await isMerchantLoggedIn(d)) && (await isSession(d))) return true;
  if (await isMerchantLoggedIn(d)) {
    await merchantLogout(d);
    await wait(1500);
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    await ensureMerchantLoginPortal(d, account);
    await wait(900);

    const emailEl = await d.$('~login.email');
    if (await emailEl.isDisplayed().catch(() => false)) {
      await typeInto(emailEl, creds.email, false);
      await dismissKeyboard(d);
    }
    // Secure password field — char-by-char (setValue no-ops on secure fields).
    let passEl = await d.$('-ios predicate string:type == "XCUIElementTypeSecureTextField"');
    if (!(await passEl.isDisplayed().catch(() => false))) {
      passEl = await d.$('~login.password');
    }
    if (await passEl.isDisplayed().catch(() => false)) {
      await typeInto(passEl, creds.password, true);
      await dismissKeyboard(d);
    }
    await dismissSavePassword(d);
    const signIn = await d.$('~login.signIn');
    if (await signIn.isDisplayed().catch(() => false)) await signIn.click();
    else await tryTap(d, 'label CONTAINS "Sign in as merchant" OR name == "login.signIn"', 3000);

    for (let i = 0; i < 25; i++) {
      await wait(1500);
      await dismissSavePassword(d);
      if (await isMerchantLoggedIn(d)) break;
    }
    if (await isMerchantLoggedIn(d)) break;
    await relaunchApp(d);
    await dismissSystemPrompts(d);
  }
  await dl('freshasever://merchant/dashboard');
  await wait(2500);
  return waitForMerchantDashboard(d, { timeoutMs: 20000 });
}

async function onOrdersScreen(d) {
  return (
    (await d.$('-ios predicate string:label == "Ready now"').isDisplayed().catch(() => false)) &&
    (await d.$('-ios predicate string:label == "Ending soon"').isDisplayed().catch(() => false))
  );
}
async function ensureOrders(d, account) {
  for (let i = 0; i < 4; i++) {
    await dismissOverlays(d);
    if (await onOrdersScreen(d)) return true;
    if (await d.$('~login.email').isDisplayed().catch(() => false)) await loginMerchantDirect(d, account);
    await dl('freshasever://merchant/orders');
    await wait(3500);
    await dismissOverlays(d);
    if (await onOrdersScreen(d)) return true;
  }
  return onOrdersScreen(d);
}
async function tapTab(d, label) {
  await tryTap(d, `label == "${label}"`, 5000);
  await wait(2600);
  await dismissOverlays(d);
}
async function findCodeField(d) {
  const fields = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
  for (const f of fields) {
    if (await f.isDisplayed().catch(() => false)) return f;
  }
  return null;
}
async function doHandover(d, account, code) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await ensureOrders(d, account);
    await tapTab(d, 'Ready now');
    const field = await findCodeField(d);
    if (!field) {
      await wait(1500);
      continue;
    }
    try {
      await field.click();
      await wait(400);
      try {
        await field.clearValue();
      } catch {}
      for (const ch of code) {
        await field.addValue(ch);
        await wait(40);
      }
      await wait(500);
      await dismissKeyboard(d);
    } catch {
      continue;
    }
    await shot(d, `WS7-07f-code-entered-${attempt}`);
    const authBtn = await d.$(
      '-ios predicate string:label == "Authorize handover" OR name == "Authorize handover" OR label == "Authorize"',
    );
    if (await authBtn.isDisplayed().catch(() => false)) await authBtn.click();
    else await tryTap(d, 'label == "Authorize"', 3000);
    await wait(4500);
    const src = await safePageSource(d);
    if (/Handover complete|marked as collected/i.test(src)) {
      const ok = await d.$('-ios predicate string:label == "OK" OR name == "OK"');
      if (await ok.isDisplayed().catch(() => false)) await ok.click();
      await wait(1200);
      return { ok: true, detail: `Authorize -> Handover complete (attempt ${attempt + 1})` };
    }
    if (/Could not authorize|not ready|No order found/i.test(src)) {
      const m = src.match(/Could not authorize[\s\S]{0,140}/i);
      return { ok: false, detail: `error alert: ${m ? m[0].replace(/\s+/g, ' ').slice(0, 140) : 'unknown'}` };
    }
    await dismissOverlays(d);
  }
  return { ok: false, detail: 'no success after retries' };
}

async function main() {
  const account = process.argv[2] || 'both';
  const d = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    logLevel: 'error',
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': UDID,
      'appium:bundleId': BUNDLE,
      'appium:noReset': true,
      'appium:newCommandTimeout': 600,
    },
  });
  try {
    if (account === 'bakehouse' || account === 'both') {
      const bh = await loginMerchantDirect(d, 'bakehouse');
      await record(d, 'WS7-00f-bakehouse-login', bh, bh ? 'Bakehouse logged in' : 'login failed');
      if (bh) {
        const res = await doHandover(d, 'bakehouse', 'UQV76C');
        await record(d, 'WS7-07f-single-handover', res.ok, `Single-bag handover UQV76C: ${res.detail}`);
        await dl('freshasever://merchant/dashboard');
        await wait(5000);
        await dismissOverlays(d);
        const src = await safePageSource(d);
        await record(d, 'WS7-08f-home-after', /Collected today|Revenue|LKR/i.test(src), 'Home after handover');
      }
    }
    if (account === 'kumbuk' || account === 'both') {
      const kb = await loginMerchantDirect(d, 'kumbuk');
      await record(d, 'WS7-09f-kumbuk-login', kb, kb ? 'Kumbuk logged in' : 'login failed');
      if (kb) {
        await ensureOrders(d, 'kumbuk');
        await tapTab(d, 'Late');
        let src = await safePageSource(d);
        await record(
          d,
          'WS7-10f-kumbuk-late',
          hasAny(src, ['LATCRT', 'Sandwich', 'Latte']),
          `Kumbuk Late: LATCRT present=${hasAny(src, ['LATCRT', 'Sandwich', 'Latte'])}`,
        );
        await tapTab(d, 'Upcoming');
        src = await safePageSource(d);
        await record(
          d,
          'WS7-11f-kumbuk-upcoming',
          hasAny(src, ['FUTURE', 'Rice & Curry']),
          `Kumbuk Upcoming: FUTURE present=${hasAny(src, ['FUTURE', 'Rice & Curry'])}`,
        );
      }
    }
  } catch (e) {
    log({ id: 'FATAL-final', result: 'FAIL', detail: String(e).slice(0, 400) });
    console.error('FATAL', e);
  } finally {
    mergeResults();
    try {
      await d.deleteSession();
    } catch {}
  }
}
main();
