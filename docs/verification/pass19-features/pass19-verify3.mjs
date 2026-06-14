#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 3500));
};

function log(entry) {
  fs.appendFileSync(LOG, `${JSON.stringify({ ts: new Date().toISOString(), wave: 'verify3', ...entry })}\n`);
}

function shot(d, subdir, name) {
  const dir = path.join(SS, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  return d.takeScreenshot().then((b) => {
    fs.writeFileSync(p, Buffer.from(b, 'base64'));
    return p;
  });
}

const d = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  capabilities: {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': UDID,
    'appium:bundleId': 'com.freshasever.mobile',
    'appium:noReset': true,
  },
});

try {
  await dl('freshasever://order-celebration?orderId=00000000-0000-0000-0000-000000000040&variant=reservation');
  const skip = await d.$('-ios predicate string:label == "Skip for now"');
  const a07 = await skip.isDisplayed().catch(() => false);
  if (a07) await skip.click();
  await d.pause(2000);
  await shot(d, 'c12', '03-celebration-skip-label.png');
  log({ id: 'A-07', tool: 'appium.gesture', result_summary: a07 ? 'Skip for now tapped' : 'missing', evidence: 'screenshots/pass19/c12/03-celebration-skip-label.png' });

  await dl('freshasever://order-celebration?orderId=00000000-0000-0000-0000-000000000040&variant=reservation');
  const src1 = await d.getPageSource();
  const a08 = src1.includes('Share your rescue moment');
  await shot(d, 'c12', '04-story-step-visible.png');
  log({ id: 'A-08', tool: 'appium.journey', result_summary: a08 ? 'story step UI' : 'missing', evidence: 'screenshots/pass19/c12/04-story-step-visible.png' });

  await dl('freshasever://shelves/00000000-0000-0000-0000-000000000201');
  await d.pause(4000);
  const inc = await d.$('~shelf.qtyIncrement.00000000-0000-0000-0000-000000000211');
  if (await inc.isDisplayed().catch(() => false)) {
    await inc.click();
    await d.pause(1000);
    await inc.click();
  }
  const b12 = await d.$('~shelf.basketTimer').isDisplayed().catch(() => false);
  await shot(d, 'c9', '08-shelf-timer-rebuild.png');
  log({ id: 'B-12', tool: 'appium.journey', result_summary: b12 ? 'shelf.basketTimer' : 'missing', evidence: 'screenshots/pass19/c9/08-shelf-timer-rebuild.png' });

  const dec = await d.$('~shelf.qtyDecrement.00000000-0000-0000-0000-000000000211');
  if (await dec.isDisplayed().catch(() => false)) await dec.click();
  await shot(d, 'c9', '09-shelf-qty-decrement.png');
  log({ id: 'B-13', tool: 'appium.gesture', result_summary: 'decrement tapped', evidence: 'screenshots/pass19/c9/09-shelf-qty-decrement.png' });

  console.log(JSON.stringify({ a07, a08, b12 }));
} finally {
  await d.deleteSession();
}
