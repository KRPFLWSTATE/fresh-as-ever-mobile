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
  fs.mkdirSync(SS, { recursive: true });
  fs.writeFileSync(path.join(SS, 'M1-1-group-checkout.png'), Buffer.from(await d.takeScreenshot(), 'base64'));
  const src = await d.getPageSource();
  const pay = await d.$('-ios predicate string:label == "Pay at Store"');
  if (await pay.isDisplayed().catch(() => false)) { await pay.click(); await d.pause(2500); fs.writeFileSync(path.join(SS, 'M1-2-pay-at-store.png'), Buffer.from(await d.takeScreenshot(), 'base64')); }
  console.log('M1 ok', /Reserve Now|Pay at Store|Total/i.test(src));
} finally { await d.deleteSession(); }
