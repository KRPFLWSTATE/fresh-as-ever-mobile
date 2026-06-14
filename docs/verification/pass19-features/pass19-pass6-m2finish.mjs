#!/usr/bin/env node
/** M2 finish — coordinate tap + on shelf, review, checkout. */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const SS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots', 'pass19', 'pass6');
const LOG = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const OUTLET = '00000000-0000-0000-0000-000000000003';
const SHELF = '00000000-0000-0000-0000-000000000201';
const dl = (u) => execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (d, n) => { fs.mkdirSync(SS, { recursive: true }); fs.writeFileSync(path.join(SS, n), Buffer.from(await d.takeScreenshot(), 'base64')); return `screenshots/pass19/pass6/${n}`; };

const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': 'com.freshasever.mobile', 'appium:noReset': true } });
try {
  await d.startRecordingScreen({ videoType: 'libx264', videoQuality: 'medium', videoFps: 10 }).catch(() => {});
  dl(`freshasever://outlet/${OUTLET}`);
  await wait(5000);
  const card = await d.$('-ios predicate string:name CONTAINS "clearance shelf"');
  if (await card.isDisplayed().catch(() => false)) await card.click();
  await wait(8000);
  await shot(d, 'M2-1-shelf-content.png');
  const { width, height } = await d.getWindowSize();
  // Tap + on first item row (right side)
  await d.performActions([{ type: 'pointer', id: 'p1', parameters: { pointerType: 'touch' }, actions: [
    { type: 'pointerMove', duration: 0, x: Math.floor(width * 0.88), y: Math.floor(height * 0.62) },
    { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 100 }, { type: 'pointerUp', button: 0 },
  ]}]);
  await d.releaseActions();
  await wait(1000);
  await d.performActions([{ type: 'pointer', id: 'p2', parameters: { pointerType: 'touch' }, actions: [
    { type: 'pointerMove', duration: 0, x: Math.floor(width * 0.88), y: Math.floor(height * 0.62) },
    { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 100 }, { type: 'pointerUp', button: 0 },
  ]}]);
  await d.releaseActions();
  await wait(1000);
  await shot(d, 'M2-2-shelf-qty-added.png');
  const rev = await d.$('~shelf.reviewBasket');
  if (await rev.isDisplayed().catch(() => false)) {
    await rev.click();
    await wait(4000);
    await shot(d, 'M2-3-shelf-review.png');
    const co = await d.$('-ios predicate string:label CONTAINS "Checkout" OR label CONTAINS "Proceed"');
    if (await co.isDisplayed().catch(() => false)) await co.click();
    await wait(5000);
    const ev = await shot(d, 'M2-4-checkout.png');
    const src = await d.getPageSource();
    const pass = /Pay at Store|Card Payment|checkout\./i.test(src);
    fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass6', id: 'M2', tool: 'appium.journey', result_summary: pass ? 'PASS — full macro' : 'PARTIAL', evidence: ev }) + '\n');
    console.log(JSON.stringify({ M2: pass }));
  }
  try {
    const b64 = await d.stopRecordingScreen();
    fs.writeFileSync(path.join(SS, 'M2-shelf-checkout-journey.mp4'), Buffer.from(b64, 'base64'));
  } catch {}
} finally {
  await d.deleteSession().catch(() => {});
}
