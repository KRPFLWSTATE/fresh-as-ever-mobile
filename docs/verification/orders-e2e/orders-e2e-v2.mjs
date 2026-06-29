#!/usr/bin/env node
/**
 * WS7 v2 — robust direct merchant login (force-types email + password, avoiding
 * the autofill-without-password loop) + in-app sub-tab taps + single-bag handover.
 * Appends to verify-log.jsonl and merges results.json.
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
  fillLoginField,
  ensureEmailLoginForm,
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
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), agent: 'WS7-V2', ...e }) + '\n');
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
const dueIn2h = (src) => {
  const m = String(src || '').match(/(\d+)\s*due in 2h/i);
  return m ? Number(m[1]) : null;
};

/** Direct login: force-clear + type both fields, never rely on OS autofill. */
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
    await wait(800);
    const emailEl = await d.$('~login.email');
    if (await emailEl.isDisplayed().catch(() => false)) {
      await emailEl.click();
      await wait(250);
      try {
        await emailEl.clearValue();
      } catch {}
      await fillLoginField(emailEl, creds.email, { skipClear: false });
      await dismissKeyboard(d);
    }
    const passEl = await d.$('~login.password');
    if (await passEl.isDisplayed().catch(() => false)) {
      await passEl.click();
      await wait(250);
      try {
        await passEl.clearValue();
      } catch {}
      await fillLoginField(passEl, creds.password, { secure: true, skipClear: false });
      await dismissKeyboard(d);
    }
    await dismissSavePassword(d);
    const signIn = await d.$('~login.signIn');
    if (await signIn.isDisplayed().catch(() => false)) {
      await signIn.click();
    } else {
      await tryTap(d, 'label CONTAINS "Sign in as merchant" OR name == "login.signIn"', 3000);
    }
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
async function ensureOrders(d) {
  for (let i = 0; i < 3; i++) {
    if (await onOrdersScreen(d)) return true;
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

async function main() {
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
    const bh = await loginMerchantDirect(d, 'bakehouse');
    await record(d, 'WS7-00v-bakehouse-login', bh, bh ? 'Bakehouse logged in (direct)' : 'login failed');
    if (!bh) {
      mergeResults();
      return;
    }

    await ensureOrders(d);
    await tapTab(d, 'Ending soon');
    let src = await safePageSource(d);
    const due = dueIn2h(src);
    await record(
      d,
      'WS7-03v-ending-soon',
      hasAny(src, ['END2HR', 'Evening Bread']),
      `Ending soon: END2HR present=${hasAny(src, ['END2HR', 'Evening Bread'])}; due-in-2h pill=${due}`,
      { dueIn2h: due },
    );

    await tapTab(d, 'Late');
    src = await safePageSource(d);
    await record(
      d,
      'WS7-04v-late',
      hasAny(src, ['LATREC', 'Croissant']),
      `Late: LATREC present=${hasAny(src, ['LATREC', 'Croissant'])}`,
    );

    // Single-bag handover (Ready now)
    await tapTab(d, 'Ready now');
    let handoverOk = false;
    let detail = 'code input not found';
    try {
      let codeInput = await d.$('-ios predicate string:type == "XCUIElementTypeTextField" AND (label == "Verification code" OR placeholderValue CONTAINS "849201")');
      if (!(await codeInput.isDisplayed().catch(() => false))) {
        const fields = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
        for (const f of fields) {
          const ph = (await f.getAttribute('placeholderValue').catch(() => '')) || '';
          if (/849201/i.test(ph) && (await f.isDisplayed().catch(() => false))) {
            codeInput = f;
            break;
          }
        }
      }
      if (await codeInput.isDisplayed().catch(() => false)) {
        await codeInput.click();
        await wait(400);
        await codeInput.setValue('UQV76C');
        await wait(700);
        await shot(d, 'WS7-07v-code-entered');
        const authBtn = await d.$('~Authorize handover');
        if (await authBtn.isDisplayed().catch(() => false)) {
          await authBtn.click();
          await wait(4500);
          src = await safePageSource(d);
          handoverOk = /Handover complete|marked as collected/i.test(src);
          detail = handoverOk
            ? 'Authorize -> Handover complete'
            : `unclear (error-alert=${/Could not authorize/i.test(src)})`;
          const ok = await d.$('-ios predicate string:label == "OK" OR name == "OK"');
          if (await ok.isDisplayed().catch(() => false)) await ok.click();
          await wait(1500);
        } else {
          detail = 'Authorize button not displayed';
        }
      }
    } catch (e) {
      detail = `exception: ${String(e).slice(0, 160)}`;
    }
    await record(d, 'WS7-07v-single-handover', handoverOk, `Single-bag handover UQV76C: ${detail}`);

    await dl('freshasever://merchant/dashboard');
    await wait(4500);
    await dismissOverlays(d);
    src = await safePageSource(d);
    await record(
      d,
      'WS7-08v-home-after',
      /Collected today|Revenue|LKR/i.test(src),
      'Merchant Home after handover',
    );

    // Kumbuk
    const kb = await loginMerchantDirect(d, 'kumbuk');
    await record(d, 'WS7-09v-kumbuk-login', kb, kb ? 'Kumbuk logged in (direct)' : 'login failed');
    if (kb) {
      await ensureOrders(d);
      await tapTab(d, 'Late');
      src = await safePageSource(d);
      await record(
        d,
        'WS7-10v-kumbuk-late',
        hasAny(src, ['LATCRT', 'Sandwich']),
        `Kumbuk Late: LATCRT present=${hasAny(src, ['LATCRT', 'Sandwich'])}`,
      );
      await tapTab(d, 'Upcoming');
      src = await safePageSource(d);
      await record(
        d,
        'WS7-11v-kumbuk-upcoming',
        hasAny(src, ['FUTURE', 'Rice & Curry']),
        `Kumbuk Upcoming: FUTURE present=${hasAny(src, ['FUTURE', 'Rice & Curry'])}`,
      );
    }
  } catch (e) {
    log({ id: 'FATAL-v2', result: 'FAIL', detail: String(e).slice(0, 400) });
    console.error('FATAL', e);
  } finally {
    mergeResults();
    try {
      await d.deleteSession();
    } catch {}
  }
}

main();
