#!/usr/bin/env node
/** WS7 group handover — enter shared code DV387Y, confirm via merchant.orders.confirmGroupCollect. */
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
  waitForMerchantDashboard,
  safePageSource,
} from '../pass26-expansion/lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(ROOT, 'screenshots');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const RESULTS = path.join(ROOT, 'results.json');
fs.mkdirSync(SS_DIR, { recursive: true });

const R = {};
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), agent: 'WS7-GROUP', ...e }) + '\n');
async function shot(d, id) {
  try {
    fs.writeFileSync(path.join(SS_DIR, `${id}.png`), Buffer.from(await d.takeScreenshot(), 'base64'));
    return `screenshots/${id}.png`;
  } catch {
    return '';
  }
}
async function record(d, id, pass, detail) {
  const evidence = await shot(d, id);
  R[id] = { pass, evidence, detail };
  log({ id, result: pass ? 'PASS' : 'FAIL', detail, evidence });
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

async function typeInto(el, text, secure = false) {
  await el.click();
  await wait(350);
  try {
    await el.clearValue();
  } catch {}
  await wait(150);
  for (const ch of text) {
    await el.addValue(ch);
    await wait(secure ? 45 : 30);
  }
  await wait(250);
}
async function loginBakehouseDirect(d) {
  await relaunchApp(d);
  await dismissSystemPrompts(d);
  await dl('freshasever://merchant/dashboard');
  await wait(3000);
  if ((await isMerchantLoggedIn(d)) && (await isBakehouseMerchantSession(d))) return true;
  if (await isMerchantLoggedIn(d)) {
    await merchantLogout(d);
    await wait(1500);
  }
  for (let a = 0; a < 3; a++) {
    await ensureMerchantLoginPortal(d, 'bakehouse');
    await wait(900);
    const emailEl = await d.$('~login.email');
    if (await emailEl.isDisplayed().catch(() => false)) {
      await typeInto(emailEl, CREDS.bakehouse.email, false);
      await dismissKeyboard(d);
    }
    let passEl = await d.$('-ios predicate string:type == "XCUIElementTypeSecureTextField"');
    if (!(await passEl.isDisplayed().catch(() => false))) passEl = await d.$('~login.password');
    if (await passEl.isDisplayed().catch(() => false)) {
      await typeInto(passEl, CREDS.bakehouse.password, true);
      await dismissKeyboard(d);
    }
    await dismissSavePassword(d);
    const signIn = await d.$('~login.signIn');
    if (await signIn.isDisplayed().catch(() => false)) await signIn.click();
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
async function onOrders(d) {
  return (
    (await d.$('-ios predicate string:label == "Ready now"').isDisplayed().catch(() => false)) &&
    (await d.$('-ios predicate string:label == "Ending soon"').isDisplayed().catch(() => false))
  );
}
async function ensureOrders(d) {
  for (let i = 0; i < 4; i++) {
    await dismissOverlays(d);
    if (await onOrders(d)) return true;
    if (await d.$('~login.email').isDisplayed().catch(() => false)) await loginBakehouseDirect(d);
    await dl('freshasever://merchant/orders');
    await wait(3500);
    await dismissOverlays(d);
    if (await onOrders(d)) return true;
  }
  return onOrders(d);
}
async function codeField(d) {
  const fs2 = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
  for (const f of fs2) if (await f.isDisplayed().catch(() => false)) return f;
  return null;
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
    const bh = await loginBakehouseDirect(d);
    if (!bh) {
      await record(d, 'WS7-12g-group-login', false, 'Bakehouse login failed');
      mergeResults();
      return;
    }
    await ensureOrders(d);
    let groupOk = false;
    let detail = 'code field not found';
    // Single, non-destructive pass — re-entering a collected group code would error.
    for (let attempt = 0; attempt < 3; attempt++) {
      await ensureOrders(d);
      const field = await codeField(d);
      if (!field) {
        await wait(1500);
        continue;
      }
      await field.click();
      await wait(400);
      try {
        await field.clearValue();
      } catch {}
      for (const ch of 'DV387Y') {
        await field.addValue(ch);
        await wait(40);
      }
      await wait(400);
      await dismissKeyboard(d);
      const authBtn = await d.$('~merchant.orders.authorizeHandover');
      if (await authBtn.isDisplayed().catch(() => false)) await authBtn.click();
      else {
        const fallback = await d.$('-ios predicate string:label == "Authorize handover" OR label == "Authorize"');
        if (await fallback.isDisplayed().catch(() => false)) await fallback.click();
        else await tryTap(d, 'label == "Authorize"', 3000);
      }
      await wait(4000);
      let src = await safePageSource(d);
      const sheetShown = /Group pickup|one shared pickup code|Bags in this group|Confirm all/i.test(src);
      if (!sheetShown) {
        // not on the sheet (maybe login bounce) — retry the whole entry
        await wait(1500);
        continue;
      }
      await record(d, `WS7-12g-group-preview-${attempt}`, true, 'Group preview sheet shown (2 bags)');
      let confirmed = false;
      const confirmTestId = await d.$('~merchant.orders.confirmGroupCollect');
      if (await confirmTestId.isDisplayed().catch(() => false)) {
        await confirmTestId.click();
        confirmed = true;
      }
      if (!confirmed) {
        const btn = await d.$(
          '-ios predicate string:type == "XCUIElementTypeButton" AND (label CONTAINS "Confirm" OR name CONTAINS "Confirm")',
        );
        if (await btn.isDisplayed().catch(() => false)) {
          await btn.click();
          confirmed = true;
        }
      }
      await wait(1000);
      await wait(4500);
      src = await safePageSource(d);
      await shot(d, `WS7-13g-after-confirm-${attempt}`);
      if (/Handover complete|bags in this group are marked as collected|marked as collected/i.test(src)) {
        groupOk = true;
        detail = `Group handover complete (attempt ${attempt + 1})`;
      } else {
        detail = `confirm tapped (confirmed=${confirmed}); success alert not detected`;
      }
      const ok = await d.$('-ios predicate string:label == "OK" OR name == "OK"');
      if (await ok.isDisplayed().catch(() => false)) await ok.click();
      await wait(1000);
      break; // do not re-enter the code (would error if already collected)
    }
    await record(d, 'WS7-13g-group-handover', groupOk, `Group handover DV387Y: ${detail}`);
  } catch (e) {
    log({ id: 'FATAL-group', result: 'FAIL', detail: String(e).slice(0, 400) });
  } finally {
    mergeResults();
    try {
      await d.deleteSession();
    } catch {}
  }
}
main();
