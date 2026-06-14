#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19', 'pass6');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const SHELF = '00000000-0000-0000-0000-000000000201';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass6', ...e }) + '\n');
const shot = async (d, n) => { fs.writeFileSync(path.join(SS, n), Buffer.from(await d.takeScreenshot(), 'base64')); return `screenshots/pass19/pass6/${n}`; };
const dl = (u) => execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });

const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': BUNDLE, 'appium:noReset': true } });
try {
  dl('freshasever://discover');
  await wait(4000);
  await d.startRecordingScreen({ videoType: 'libx264', videoQuality: 'medium', videoFps: 10 }).catch(() => {});
  dl(`freshasever://shelves/${SHELF}`);
  await wait(10000);
  await shot(d, 'M2-1-shelf-content.png');
  for (const id of ['00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000211']) {
    const inc = await d.$(`~shelf.qtyIncrement.${id}`);
    if (await inc.isDisplayed().catch(() => false)) {
      await inc.click(); await wait(700); await inc.click(); await wait(700);
      break;
    }
  }
  await shot(d, 'M2-2-shelf-qty-added.png');
  const rev = await d.$('~shelf.reviewBasket');
  let pass = false;
  if (await rev.isDisplayed().catch(() => false)) {
    await rev.click(); await wait(5000);
    await shot(d, 'M2-3-shelf-review.png');
    const co = await d.$('-ios predicate string:label CONTAINS "Checkout" OR label CONTAINS "Proceed" OR label CONTAINS "Continue"');
    if (await co.isDisplayed().catch(() => false)) await co.click();
    await wait(5000);
    await shot(d, 'M2-4-checkout.png');
    const src = await d.getPageSource().catch(() => '');
    pass = /Pay at Store|Card Payment|checkout\./i.test(src);
  }
  log({ id: 'M2', tool: 'appium.journey', args_summary: 'shelf→increment→review→checkout', result_summary: pass ? 'PASS — full macro' : 'PARTIAL', evidence: 'screenshots/pass19/pass6/M2-4-checkout.png' });
  const b64 = await d.stopRecordingScreen().catch(() => null);
  if (b64) fs.writeFileSync(path.join(SS, 'M2-shelf-checkout-journey.mp4'), Buffer.from(b64, 'base64'));
  console.log('M2', pass);
} finally { await d.deleteSession().catch(() => {}); }
