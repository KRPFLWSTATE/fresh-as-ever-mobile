#!/usr/bin/env node
/** WS7 Kumbuk tabs — attach to the already-logged-in Kumbuk session (no re-login). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import { UDID, BUNDLE, wait, dl, tryTap, dismissOverlays, safePageSource } from '../pass26-expansion/lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(ROOT, 'screenshots');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const RESULTS = path.join(ROOT, 'results.json');
const R = {};
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), agent: 'WS7-KUMBUK', ...e }) + '\n');
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
const hasAny = (src, ns) => {
  const s = String(src || '').toLowerCase();
  return ns.some((n) => s.includes(String(n).toLowerCase()));
};
async function onOrders(d) {
  return (
    (await d.$('-ios predicate string:label == "Ready now"').isDisplayed().catch(() => false)) &&
    (await d.$('-ios predicate string:label == "Ending soon"').isDisplayed().catch(() => false))
  );
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
    for (let i = 0; i < 4; i++) {
      await dismissOverlays(d);
      if (await onOrders(d)) break;
      await dl('freshasever://merchant/orders');
      await wait(3500);
    }
    const ready = await onOrders(d);
    if (!ready) {
      await record(d, 'WS7-10k-kumbuk-orders', false, 'Could not reach Kumbuk Orders (session/login)');
      mergeResults();
      return;
    }
    await tapTab(d, 'Late');
    let src = await safePageSource(d);
    await record(
      d,
      'WS7-10k-kumbuk-late',
      hasAny(src, ['LATCRT', 'Sandwich', 'Latte', 'Critical']),
      `Kumbuk Late: LATCRT present=${hasAny(src, ['LATCRT', 'Sandwich', 'Latte'])}`,
    );
    await tapTab(d, 'Upcoming');
    src = await safePageSource(d);
    await record(
      d,
      'WS7-11k-kumbuk-upcoming',
      hasAny(src, ['FUTURE', 'Rice & Curry']),
      `Kumbuk Upcoming: FUTURE present=${hasAny(src, ['FUTURE', 'Rice & Curry'])}`,
    );
  } catch (e) {
    log({ id: 'FATAL-kumbuk', result: 'FAIL', detail: String(e).slice(0, 300) });
  } finally {
    mergeResults();
    try {
      await d.deleteSession();
    } catch {}
  }
}
main();
