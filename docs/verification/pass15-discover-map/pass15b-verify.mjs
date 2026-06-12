#!/usr/bin/env node
/** Pass15b — Discover location header + typed map pins */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots');
const LOG = path.join(ROOT, 'pass15b-verify-log.jsonl');
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
  log({ shot: name });
  return p;
}

async function main() {
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(LOG, '');

  execSync(`xcrun simctl location ${UDID} set ${COLOMBO}`, { stdio: 'pipe' });
  log({ simLocation: COLOMBO });

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
    await shot(d, 'pass15b-01-discover-map-colombo.png');

    const src = await d.getPageSource();
    const hasRescueNearYou = src.includes('Rescue near you');
    const hasBakehouse =
      src.includes('Bakehouse') ||
      src.includes('Pastry') ||
      src.includes('clearance shelf');
    const hasMapPin =
      src.includes('Map pin') ||
      src.includes('MKAnnotation') ||
      src.includes('AnnotationContainer');
    const hasLocationPill = src.includes('discover.locationPill');
    const locationReadable =
      src.includes('Colombo') ||
      src.includes('Sri Lanka') ||
      src.includes('Current location');

    results.feedAndLocation =
      hasRescueNearYou && hasBakehouse && hasLocationPill && locationReadable;
    results.mapAnnotations = hasMapPin;

    log({
      check: 'feedAndLocation',
      pass: results.feedAndLocation,
      hasRescueNearYou,
      hasBakehouse,
      hasLocationPill,
      locationReadable,
    });
    log({ check: 'mapAnnotations', pass: results.mapAnnotations, hasMapPin });

    // Tap first map annotation if exposed
    try {
      const pin = await d.$('-ios predicate string:label CONTAINS "Bakehouse"');
      if (await pin.isDisplayed().catch(() => false)) {
        await pin.click();
        await d.pause(2000);
        await shot(d, 'pass15b-02-marker-tap-bakehouse.png');
        results.markerTap = true;
      } else {
        results.markerTap = false;
      }
    } catch {
      results.markerTap = false;
    }

    await shot(d, 'pass15b-03-discover-header-and-map.png');
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
