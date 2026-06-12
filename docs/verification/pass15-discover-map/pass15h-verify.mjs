#!/usr/bin/env node
/** Pass15h — branded lighter map surface + tap flow */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass15h');
const LOG = path.join(ROOT, 'pass15h-verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const COLOMBO = '6.9147,79.8655';

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 3200));
};

function log(entry) {
  fs.appendFileSync(LOG, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
}

async function dismissKeyboard(d) {
  try {
    await d.hideKeyboard();
  } catch {}
  try {
    await d.execute('mobile: hideKeyboard', {});
  } catch {}
  await d.pause(400);
}

async function customerLogin(d) {
  await dl('freshasever://login?portal=customer');
  await d.pause(2000);
  const fields = await d.$$('-ios class chain:**/XCUIElementTypeTextField');
  const secure = await d.$$('-ios class chain:**/XCUIElementTypeSecureTextField');
  if (fields[0]) await fields[0].setValue('qa.customer@freshasever.test');
  await dismissKeyboard(d);
  if (secure[0]) await secure[0].setValue('TempCustomer#12345');
  await dismissKeyboard(d);
  const signIn = await d.$(
    '-ios predicate string:name CONTAINS "Sign in" AND type == "XCUIElementTypeButton"',
  );
  await signIn.waitForDisplayed({ timeout: 15000 });
  await signIn.click();
  await d.pause(5000);
}

async function shot(d, name) {
  const p = path.join(SS, name);
  fs.writeFileSync(p, Buffer.from(await d.takeScreenshot(), 'base64'));
  log({ shot: name, path: p });
  return p;
}

async function main() {
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(LOG, '');
  execSync(`xcrun simctl location ${UDID} set ${COLOMBO}`, { stdio: 'pipe' });

  const d = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': UDID,
      'appium:bundleId': BUNDLE,
      'appium:noReset': true,
    },
  });

  const results = {};

  try {
    await customerLogin(d);
    await dl('freshasever://discover');
    await d.pause(6000);
    await shot(d, '01-map-surface-colombo.png');

    const src = await d.getPageSource();
    results.feedVisible =
      src.includes('Rescue near you') &&
      (src.includes('Bakehouse') || src.includes('clearance shelf'));

    // Marker tap → preview only
    let previewFound = false;
    try {
      const bakehouse = await d.$('-ios predicate string:label CONTAINS "Bakehouse"');
      if (await bakehouse.isDisplayed().catch(() => false)) {
        await bakehouse.click();
        await d.pause(2500);
        await shot(d, '02-marker-tap-preview-only.png');
        const afterTap = await d.getPageSource();
        previewFound =
          afterTap.includes('discover.map.preview') ||
          afterTap.includes('bag left') ||
          afterTap.includes('clearance shelf live');
        results.feedNotScrolled = afterTap.includes('Rescue near you');
      }
    } catch (err) {
      log({ markerTapError: String(err) });
    }
    results.markerPreviewOnly = previewFound;

    // Preview tap → outlet
    try {
      const preview = await d.$('~discover.map.preview');
      if (await preview.isDisplayed().catch(() => false)) {
        await preview.click();
        await d.pause(3500);
        await shot(d, '03-preview-opens-outlet.png');
        const outletSrc = await d.getPageSource();
        results.previewOpensOutlet =
          outletSrc.includes('Bakehouse') &&
          (outletSrc.includes('clearance shelf') || outletSrc.includes('Outlet'));
      } else {
        results.previewOpensOutlet = false;
      }
    } catch {
      results.previewOpensOutlet = false;
    }

    log({ results });
  } finally {
    await d.deleteSession();
  }

  const pass = Object.values(results).every(Boolean);
  log({ overall: pass ? 'PASS' : 'PARTIAL', results });
  console.log(JSON.stringify({ pass, results }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
