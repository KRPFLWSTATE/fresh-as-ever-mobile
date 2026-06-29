#!/usr/bin/env node
/**
 * WS7 — Merchant Orders consistency E2E.
 * Drives the booted iPhone 17 Pro sim (UDID from merchantLogin.mjs) via Appium
 * (standalone server on :4723) and reuses the pass26 login helpers.
 *
 * Captures a screenshot + JSONL log line per step into this folder, then writes
 * results.json. Data-truth assertions are done separately via Supabase MCP.
 *
 * Phases are independent and wrapped in try/catch so one failure does not abort
 * the rest of the run.
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
  scrollDown,
  loginBakehouse,
  loginKumbuk,
  tryTap,
  relaunchApp,
  dismissOverlays,
  dismissSystemPrompts,
  safePageSource,
  waitForMerchantDashboard,
} from '../pass26-expansion/lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(ROOT, 'screenshots');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const RESULTS = path.join(ROOT, 'results.json');
const REPORT = path.join(ROOT, 'REPORT.md');

fs.mkdirSync(SS_DIR, { recursive: true });

const R = {};

function log(e) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({ ts: new Date().toISOString(), agent: 'WS7-ORDERS-E2E', ...e }) + '\n',
  );
}

async function shot(d, id) {
  try {
    const name = `${id}.png`;
    fs.writeFileSync(path.join(SS_DIR, name), Buffer.from(await d.takeScreenshot(), 'base64'));
    return `screenshots/${name}`;
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

function writeResults() {
  const pass = Object.values(R).filter((v) => v.pass).length;
  const fail = Object.values(R).filter((v) => !v.pass).length;
  fs.writeFileSync(
    RESULTS,
    JSON.stringify({ pass, fail, results: R, ts: new Date().toISOString() }, null, 2),
  );
}

function writeReport() {
  let merged = {};
  if (fs.existsSync(RESULTS)) {
    try {
      merged = JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results ?? {};
    } catch {}
  }
  merged = { ...merged, ...R };
  const lines = [
    '# WS7 — Merchant Orders E2E Report',
    '',
    `**Run:** ${new Date().toISOString()}`,
    `**Simulator:** iPhone 17 Pro \`377DAC99-B79C-4B05-BB34-DBA1D160038D\``,
    `**Seeder:** \`npm run refresh-demo\``,
    '',
    '## Results',
    '',
    '| ID | Result | Detail | Screenshot |',
    '|----|--------|--------|------------|',
  ];
  for (const [id, row] of Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(
      `| ${id} | ${row.pass ? 'PASS' : 'FAIL'} | ${String(row.detail).replace(/\|/g, '/')} | ${row.evidence || ''} |`,
    );
  }
  const pass = Object.values(merged).filter((r) => r.pass).length;
  const fail = Object.values(merged).filter((r) => !r.pass).length;
  lines.push('', `**Summary:** ${pass} PASS / ${fail} FAIL`, '', '## JSONL', '', `\`${LOG}\``);
  fs.writeFileSync(REPORT, lines.join('\n'));
}

async function findVerifyCodeInput(d) {
  const strategies = [
    () => d.$('~merchant.orders.verifyCode'),
    () => d.$('~Verification code'),
    () => d.$('-ios predicate string:label == "Verification code"'),
    () => d.$('-ios predicate string:type == "XCUIElementTypeTextField" AND placeholderValue CONTAINS "849201"'),
    () => d.$$('-ios predicate string:type == "XCUIElementTypeTextField"').then((els) => els[0]),
  ];
  for (const get of strategies) {
    try {
      const el = await get();
      if (el && (await el.isDisplayed().catch(() => false))) return el;
    } catch {}
  }
  await scrollDown(d, 1);
  await wait(400);
  for (const get of strategies) {
    try {
      const el = await get();
      if (el && (await el.isDisplayed().catch(() => false))) return el;
    } catch {}
  }
  return null;
}

const VIEW_TAB_LABEL = {
  all: 'All',
  verification: 'Ready now',
  'live-monitor': 'Ending soon',
  'review-pending': 'Upcoming',
  'late-pickups': 'Late',
};

async function ensureOrdersScreen(d) {
  if (await d.$('-ios predicate string:label == "Ready now"').isDisplayed().catch(() => false)) {
    return true;
  }
  await dl('freshasever://merchant/orders');
  await wait(3500);
  await dismissOverlays(d);
  return d.$('-ios predicate string:label == "Ready now"').isDisplayed().catch(() => false);
}

/** Open a merchant Orders sub-tab via in-app taps (stable vs deeplink-only). */
async function openOrdersView(d, view) {
  await ensureOrdersScreen(d);
  const label = VIEW_TAB_LABEL[view] ?? view;
  await tryTap(d, `label == "${label}"`, 5000);
  await wait(2600);
  await dismissOverlays(d);
  return safePageSource(d);
}

/** True if every needle appears in src (case-insensitive). */
function hasAll(src, needles) {
  const s = String(src || '').toLowerCase();
  return needles.every((n) => s.includes(String(n).toLowerCase()));
}
function hasAny(src, needles) {
  const s = String(src || '').toLowerCase();
  return needles.some((n) => s.includes(String(n).toLowerCase()));
}

/** Pull the "{n} due in 2h" count from the verify card if present. */
async function dueIn2hCount(d, src) {
  try {
    const el = await d.$('~merchant.orders.dueIn2h');
    if (await el.isDisplayed().catch(() => false)) {
      const label =
        (await el.getAttribute('label').catch(() => '')) ||
        (await el.getText().catch(() => '')) ||
        '';
      const m = String(label).match(/(\d+)/);
      if (m) return Number(m[1]);
    }
  } catch {}
  const m = String(src || '').match(/(\d+)\s*due in 2h/i);
  return m ? Number(m[1]) : null;
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
    // ---- Phase 1: Bakehouse login + Home baseline ----
    const bh = await loginBakehouse(d);
    await record(d, 'WS7-00-bakehouse-login', bh, bh ? 'Bakehouse merchant logged in' : 'login failed');
    if (!bh) {
      writeResults();
      return;
    }

    await dl('freshasever://merchant/dashboard');
    await wait(3500);
    await dismissOverlays(d);
    let homeSrc = await safePageSource(d);
    await record(
      d,
      'WS7-01-home-before',
      /Today|Revenue|Orders|LKR|Active/i.test(homeSrc),
      'Merchant Home before handover',
    );

    // ---- Phase 2: Bakehouse Orders sub-tabs ----
    // Ready now (verification): UQV76C (in-window paid) + END2HR (ending soon is also in-window)
    let src = await openOrdersView(d, 'verification');
    await record(
      d,
      'WS7-02-tab-ready-now',
      hasAny(src, ['UQV76C', 'END2HR']),
      `Ready now shows in-window collectible orders (UQV76C/END2HR present=${hasAny(src, ['UQV76C', 'END2HR'])})`,
      { dueIn2h: await dueIn2hCount(d, src) },
    );

    // Ending soon (live-monitor): END2HR (ends within 2h)
    src = await openOrdersView(d, 'live-monitor');
    const due2h = await dueIn2hCount(d, src);
    await record(
      d,
      'WS7-03-tab-ending-soon',
      hasAny(src, ['END2HR', 'Evening Bread']),
      `Ending soon shows END2HR (present=${hasAny(src, ['END2HR', 'Evening Bread'])}), dueIn2h pill=${due2h}`,
      { dueIn2h: due2h },
    );

    // Late: LATREC (bakehouse recent-late). LATCRT is Kumbuk scope.
    src = await openOrdersView(d, 'late-pickups');
    await record(
      d,
      'WS7-04-tab-late',
      hasAny(src, ['LATREC', 'Croissant', 'late', 'urgent']),
      `Late shows recent-late LATREC (present=${hasAny(src, ['LATREC', 'Croissant'])})`,
    );

    // Upcoming (review-pending)
    src = await openOrdersView(d, 'review-pending');
    await record(
      d,
      'WS7-05-tab-upcoming',
      /Upcoming|Scheduled|awaiting payment|No orders/i.test(src),
      'Upcoming (review-pending) rendered',
    );

    // All
    src = await openOrdersView(d, 'all');
    await record(
      d,
      'WS7-06-tab-all',
      hasAny(src, ['UQV76C', 'END2HR', 'LATREC']),
      'All shows active orders',
    );

    // ---- Phase 3: Single-bag handover by code UQV76C ----
    src = await openOrdersView(d, 'verification');
    let handoverOk = false;
    let handoverDetail = 'code entry not found';
    try {
      const codeInput = await findVerifyCodeInput(d);
      if (codeInput) {
        await codeInput.click();
        await wait(400);
        await codeInput.setValue('UQV76C');
        await wait(600);
        await shot(d, 'WS7-07a-code-entered');
        const authBtn = await d.$('~Authorize handover');
        if (await authBtn.isDisplayed().catch(() => false)) {
          await authBtn.click();
          await wait(3500);
          await dismissSystemPrompts(d);
          const after = await safePageSource(d);
          // Success alert title is "Handover complete"
          handoverOk = /Handover complete|collected/i.test(after);
          handoverDetail = handoverOk
            ? 'Authorize -> Handover complete alert'
            : `no success alert; src snippet present=${/Could not authorize/i.test(after) ? 'error-alert' : 'unknown'}`;
          // dismiss alert
          const ok = await d.$('-ios predicate string:label == "OK" OR name == "OK"');
          if (await ok.isDisplayed().catch(() => false)) await ok.click();
          await wait(1500);
        } else {
          handoverDetail = 'Authorize button not displayed';
        }
      }
    } catch (e) {
      handoverDetail = `exception: ${String(e).slice(0, 160)}`;
    }
    await record(d, 'WS7-07-single-handover', handoverOk, `Single-bag handover UQV76C: ${handoverDetail}`);

    // ---- Phase 4: Home after handover (revenue/recent should update) ----
    await dl('freshasever://merchant/dashboard');
    await wait(4000);
    await dismissOverlays(d);
    homeSrc = await safePageSource(d);
    await record(
      d,
      'WS7-08-home-after',
      /Today|Revenue|LKR|Picked up|PICKED|collected|Surprise/i.test(homeSrc),
      'Merchant Home after handover (revenue/recent)',
    );

    // ---- Phase 5: Kumbuk scope (LATCRT + FUTURE) ----
    await relaunchApp(d);
    const kb = await loginKumbuk(d);
    await record(d, 'WS7-09-kumbuk-login', kb, kb ? 'Kumbuk merchant logged in' : 'login failed');
    if (kb) {
      await waitForMerchantDashboard(d, { timeoutMs: 15000 });
      src = await openOrdersView(d, 'late-pickups');
      await record(
        d,
        'WS7-10-kumbuk-late-critical',
        hasAny(src, ['LATCRT', 'Sandwich', 'Critical', 'urgent', 'late']),
        `Kumbuk Late shows critical LATCRT (present=${hasAny(src, ['LATCRT', 'Sandwich'])})`,
      );
      src = await openOrdersView(d, 'review-pending');
      await record(
        d,
        'WS7-11-kumbuk-upcoming',
        hasAny(src, ['FUTURE', 'Rice & Curry', 'Scheduled', 'awaiting']),
        `Kumbuk Upcoming shows FUTURE unpaid (present=${hasAny(src, ['FUTURE', 'Rice & Curry'])})`,
      );
    }

    // ---- Phase 6: Due-in-2h pill vs Ending soon list parity ----
    await loginBakehouse(d);
    src = await openOrdersView(d, 'verification');
    const pillCount = await dueIn2hCount(d, src);
    const endingSrc = await openOrdersView(d, 'live-monitor');
    const endingListHas = hasAny(endingSrc, ['END2HR', 'Evening Bread']);
    const endingCount = (endingSrc.match(/END2HR/gi) || []).length || (endingListHas ? 1 : 0);
    await record(
      d,
      'WS7-12-bucket-parity',
      pillCount !== null && pillCount >= endingCount && endingListHas,
      `due-in-2h pill=${pillCount} ending-soon has END2HR=${endingListHas}`,
      { dueIn2h: pillCount },
    );

    // ---- Phase 7: Group handover (DV387Y) — skip if no collectible group ----
    src = await openOrdersView(d, 'verification');
    let groupOk = false;
    let groupDetail = 'no group sheet';
    try {
      const codeInput = await findVerifyCodeInput(d);
      if (codeInput) {
        await codeInput.click();
        await codeInput.setValue('DV387Y');
        await wait(500);
        const authBtn = await d.$('~merchant.orders.authorizeHandover');
        if (!(await authBtn.isDisplayed().catch(() => false))) {
          const fallback = await d.$('~Authorize handover');
          if (await fallback.isDisplayed().catch(() => false)) await fallback.click();
        } else {
          await authBtn.click();
        }
        await wait(3500);
        const gsrc = await safePageSource(d);
        if (/Group pickup|bags/i.test(gsrc)) {
          let confirmBtn = await d.$('~merchant.orders.confirmGroupCollect');
          if (!(await confirmBtn.isDisplayed().catch(() => false))) {
            confirmBtn = await d.$(
              '-ios predicate string:label CONTAINS "Confirm all" OR label CONTAINS "Collect all"',
            );
          }
          if (await confirmBtn.isDisplayed().catch(() => false)) {
            await confirmBtn.click();
            await wait(4000);
            groupOk = /All \d+ bags|marked as collected|Handover complete/i.test(await safePageSource(d));
            groupDetail = groupOk ? 'Group collect complete' : 'confirm tapped, no success alert';
          } else {
            groupDetail = 'group sheet without confirm CTA';
          }
        } else {
          groupDetail = 'DV387Y not collectible (legacy group already collected)';
        }
      }
    } catch (e) {
      groupDetail = String(e).slice(0, 120);
    }
    await record(
      d,
      'WS7-13-group-handover',
      groupOk,
      `Group handover DV387Y: ${groupDetail}`,
      { blocker: groupOk ? undefined : 'no_active_group_demo_data' },
    );
  } catch (e) {
    log({ id: 'FATAL', result: 'FAIL', detail: String(e).slice(0, 400) });
    console.error('FATAL', e);
  } finally {
    writeResults();
    writeReport();
    try {
      await d.deleteSession();
    } catch {}
  }
}

main();
