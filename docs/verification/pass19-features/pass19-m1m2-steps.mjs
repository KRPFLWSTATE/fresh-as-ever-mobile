#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';
const SS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots', 'pass19', 'pass4');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const dl = (u) => { execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' }); return new Promise((r) => setTimeout(r, 4000)); };
const d = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': 'com.freshasever.mobile', 'appium:noReset': true } });
try {
  await dl('freshasever://checkout?group=00000000-0000-0000-0000-000000000004');
  await d.pause(5000);
  const pay = await d.$('-ios predicate string:label == "Pay at Store"');
  if (await pay.isDisplayed().catch(() => false)) await pay.click();
  await d.pause(1500);
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, 'M1-2-pay-at-store.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
  await dl(`freshasever://clearance-shelf/00000000-0000-0000-0000-000000000201`);
  await d.pause(5000);
  fs.writeFileSync(path.join(SS, 'M2-1-shelf-basket.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
  const inc = await d.$('~shelf.qtyIncrement.00000000-0000-0000-0000-000000000211');
  if (await inc.isDisplayed().catch(() => false)) await inc.click();
  const rev = await d.$('~shelf.reviewBasket');
  if (await rev.isDisplayed().catch(() => false)) { await rev.click(); await d.pause(3000); fs.writeFileSync(path.join(SS, 'M2-2-shelf-review.png'), Buffer.from(await d.takeScreenshot(), 'base64')); }
} finally { await d.deleteSession(); }
