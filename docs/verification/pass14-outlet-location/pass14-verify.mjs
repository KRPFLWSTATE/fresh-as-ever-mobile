#!/usr/bin/env node
/**
 * Pass14 — outlet location typing (clear-before-setValue).
 * Requires Appium on 127.0.0.1:4723 and simulator UDID below.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const OUTLET_ID = '00000000-0000-0000-0000-000000000003';

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 2800));
};

async function dismissKeyboard(d) {
  try {
    await d.hideKeyboard();
  } catch {}
  try {
    await d.execute('mobile: hideKeyboard', {});
  } catch {}
  await d.pause(400);
}

/** iOS XCUITest setValue appends unless the field is cleared first (pass7 pattern). */
async function clearAndType(d, accessibilityId, text) {
  const el = await d.$(`~${accessibilityId}`);
  await el.waitForDisplayed({ timeout: 15000 });
  await el.click();
  await d.pause(400);
  try {
    await el.clearValue();
  } catch {
    const current = await el.getText().catch(() => '');
    if (current) {
      await el.setValue('\u0008'.repeat(current.length));
    }
  }
  await d.pause(200);
  await el.setValue(text);
  await d.pause(400);
  try {
    await d.hideKeyboard();
  } catch {}
  try {
    await d.execute('mobile: hideKeyboard', {});
  } catch {}
  await d.pause(600);
}

async function shot(d, name) {
  const p = path.join(SS, name);
  fs.writeFileSync(p, Buffer.from(await d.takeScreenshot(), 'base64'));
  return p;
}

async function main() {
  fs.mkdirSync(SS, { recursive: true });
  const log = [];
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

  try {
    await dl(`freshasever://merchant/outlets/${OUTLET_ID}/edit`);
    await d.pause(2000);

    await clearAndType(d, 'outlet.location.search', '12 Ward Place, Colombo 07');
    const map = await d.$('~outlet.location.map');
    await map.click();
    await d.pause(1500);

    const search1 = await d.$('~outlet.location.search');
    const text1 = (await search1.getText()).replace(/\uE03[0-9A-F]/gi, '').trim();
    log.push({ step: 'type_ward_place', text: text1, pass: text1 === '12 Ward Place, Colombo 07' });
    await shot(d, 'replace-not-append-ward-place.png');

    await clearAndType(d, 'outlet.location.search', 'Colombo 03');
    await map.click();
    await d.pause(1500);

    const search2 = await d.$('~outlet.location.search');
    const text2 = (await search2.getText()).replace(/\uE03[0-9A-F]/gi, '').trim();
    log.push({ step: 'replace_colombo03', text: text2, pass: text2 === 'Colombo 03' });
    await shot(d, 'replace-not-append-colombo03.png');

    await dismissKeyboard(d);
    console.log(JSON.stringify(log, null, 2));
    const failed = log.filter((e) => !e.pass);
    if (failed.length) process.exitCode = 1;
  } finally {
    await d.deleteSession();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
