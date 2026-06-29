#!/usr/bin/env node
/**
 * WS7 focused re-run — fixes flakiness from repeated deeplinks bouncing to login.
 * Navigates to Orders once, then taps the in-app sub-tab labels. Re-logs in if a
 * login screen ever appears. Performs the single-bag handover (code UQV76C).
 * Appends to the same verify-log.jsonl and merges into results.json.
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
  scrollDown,
  loginBakehouse,
  loginKumbuk,
  dismissOverlays,
  dismissSystemPrompts,
  safePageSource,
  isMerchantLoggedIn,
  waitForMerchantDashboard,
} from '../pass26-expansion/lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(ROOT, 'screenshots');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const RESULTS = path.join(ROOT, 'results.json');

fs.mkdirSync(SS_DIR, { recursive: true });

const R = {};
function log(e) {
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), agent: 'WS7-FOCUSED', ...e }) + '\n');
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

function hasAny(src, needles) {
  const s = String(src || '').toLowerCase();
  return needles.some((n) => s.includes(String(n).toLowerCase()));
}
function dueIn2hCount(src) {
  const m = String(src || '').match(/(\d+)\s*DUE IN 2H/i);
  return m ? Number(m[1]) : null;
}

async function onOrdersScreen(d) {
  return (
    (await d.$('-ios predicate string:label == "Ready now"').isDisplayed().catch(() => false)) &&
    (await d.$('-ios predicate string:label == "Ending soon"').isDisplayed().catch(() => false))
  );
}

/** Reach the Orders screen with a healthy merchant session, re-login if needed. */
async function ensureOrders(d, loginFn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await dismissOverlays(d);
    if (await onOrdersScreen(d)) return true;
    if (await d.$('~login.email').isDisplayed().catch(() => false)) {
      await loginFn(d);
      await wait(1500);
    }
    if (!(await isMerchantLoggedIn(d)) && !(await onOrdersScreen(d))) {
      await loginFn(d);
    }
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
    // ---- Bakehouse ----
    const bh = await loginBakehouse(d);
    if (!bh) {
      await record(d, 'WS7-00b-bakehouse-login', false, 'Bakehouse re-login failed');
      mergeResults();
      return;
    }
    const reached = await ensureOrders(d, loginBakehouse);
    await record(d, 'WS7-02b-orders-screen', reached, `Orders screen reached (tabs visible=${reached})`);

    // Ending soon
    await tapTab(d, 'Ending soon');
    let src = await safePageSource(d);
    let due = dueIn2hCount(src);
    await record(
      d,
      'WS7-03b-tab-ending-soon',
      hasAny(src, ['END2HR', 'Evening Bread']),
      `Ending soon shows END2HR (present=${hasAny(src, ['END2HR', 'Evening Bread'])}); due-in-2h pill=${due}`,
      { dueIn2h: due },
    );

    // Late
    await tapTab(d, 'Late');
    src = await safePageSource(d);
    await record(
      d,
      'WS7-04b-tab-late',
      hasAny(src, ['LATREC', 'Croissant']),
      `Late shows recent-late LATREC (present=${hasAny(src, ['LATREC', 'Croissant'])})`,
    );

    // ---- Single-bag handover by code UQV76C (on Ready now tab) ----
    await ensureOrders(d, loginBakehouse);
    await tapTab(d, 'Ready now');
    let handoverOk = false;
    let detail = 'code input not found';
    try {
      const codeInput = await d.$('~Verification code');
      if (await codeInput.isDisplayed().catch(() => false)) {
        await codeInput.click();
        await wait(400);
        await codeInput.setValue('UQV76C');
        await wait(700);
        await shot(d, 'WS7-07b-code-entered');
        const authBtn = await d.$('~Authorize handover');
        if (await authBtn.isDisplayed().catch(() => false)) {
          await authBtn.click();
          await wait(4000);
          src = await safePageSource(d);
          handoverOk = /Handover complete|marked as collected/i.test(src);
          detail = handoverOk
            ? 'Authorize -> Handover complete alert shown'
            : `result unclear (error-alert=${/Could not authorize/i.test(src)})`;
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
    await record(d, 'WS7-07b-single-handover', handoverOk, `Single-bag handover UQV76C: ${detail}`);

    // Home after
    await dl('freshasever://merchant/dashboard');
    await wait(4500);
    await dismissOverlays(d);
    src = await safePageSource(d);
    await record(
      d,
      'WS7-08b-home-after',
      /Collected today|Revenue|LKR/i.test(src),
      'Merchant Home after handover',
    );

    // ---- Kumbuk: LATCRT + FUTURE ----
    const kb = await loginKumbuk(d);
    await record(d, 'WS7-09b-kumbuk-login', kb, kb ? 'Kumbuk merchant logged in' : 'Kumbuk login failed');
    if (kb) {
      await ensureOrders(d, loginKumbuk);
      await tapTab(d, 'Late');
      src = await safePageSource(d);
      await record(
        d,
        'WS7-10b-kumbuk-late',
        hasAny(src, ['LATCRT', 'Sandwich']),
        `Kumbuk Late shows critical LATCRT (present=${hasAny(src, ['LATCRT', 'Sandwich'])})`,
      );
      await tapTab(d, 'Upcoming');
      src = await safePageSource(d);
      await record(
        d,
        'WS7-11b-kumbuk-upcoming',
        hasAny(src, ['FUTURE', 'Rice & Curry']),
        `Kumbuk Upcoming shows FUTURE unpaid (present=${hasAny(src, ['FUTURE', 'Rice & Curry'])})`,
      );
    }
  } catch (e) {
    log({ id: 'FATAL-focused', result: 'FAIL', detail: String(e).slice(0, 400) });
    console.error('FATAL', e);
  } finally {
    mergeResults();
    try {
      await d.deleteSession();
    } catch {}
  }
}

main();
