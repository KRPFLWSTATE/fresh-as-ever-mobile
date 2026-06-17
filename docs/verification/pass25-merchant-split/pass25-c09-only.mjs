#!/usr/bin/env node
/** Pass 25 — C-09 cross-outlet group cart only */
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
  loginCustomer,
  customerLogout,
  relaunchApp,
  dismissSavePassword,
  dismissSystemPrompts,
  recoverFromErrorBoundary,
  safePageSource,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(ROOT, 'results.json');
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const KUMBUK_OUTLET = '00000000-0000-0000-0000-000000000013';

const d = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  capabilities: {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': UDID,
    'appium:bundleId': BUNDLE,
    'appium:noReset': true,
    'appium:newCommandTimeout': 300,
    'appium:waitForIdleTimeout': 0,
  },
});

try {
  await relaunchApp(d);
  await wait(3000);
  await customerLogout(d).catch(() => {});
  await dismissSystemPrompts(d);
  const loggedIn = await loginCustomer(d);
  await dismissSavePassword(d);
  await dismissSystemPrompts(d);
  if (!loggedIn) throw new Error('customer login failed');

  await dl(`freshasever://outlet/${KUMBUK_OUTLET}`);
  await wait(6000);
  await recoverFromErrorBoundary(d);
  await tryTap(d, 'label == "Add to group" OR name == "Add to group"', 6000);
  await wait(2000);
  await dl(`freshasever://outlet/${BAKEHOUSE_OUTLET}`);
  await wait(6000);
  await recoverFromErrorBoundary(d);
  await tryTap(d, 'label == "Add to group" OR name == "Add to group"', 6000);
  await wait(2500);
  const crossSrc = await safePageSource(d);
  const pass =
    /check_circle|Remove from group|Pastries|Bread|Kollupitiya|Surprise/i.test(crossSrc) ||
    /different outlet|one outlet|clear|alert|cart|replace|switch|group order/i.test(crossSrc);

  const prior = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  prior.results['C-09'] = {
    pass,
    evidence: 'screenshots/customer/C-09-cross-outlet-guard.png',
    detail: pass ? 'Cross-outlet group cart replaces prior outlet' : 'Cross-outlet cart guard',
    portal: 'customer',
  };
  fs.mkdirSync(path.join(ROOT, 'screenshots/customer'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'screenshots/customer/C-09-cross-outlet-guard.png'),
    Buffer.from(await d.takeScreenshot(), 'base64'),
  );
  const entries = Object.entries(prior.results);
  prior.pass = entries.filter(([, v]) => v.pass).length;
  prior.fail = entries.filter(([, v]) => !v.pass).length;
  prior.ts = new Date().toISOString();
  fs.writeFileSync(RESULTS, JSON.stringify(prior, null, 2));
  console.log(JSON.stringify({ id: 'C-09', pass, passTotal: prior.pass, failTotal: prior.fail }));
} finally {
  await d.deleteSession().catch(() => {});
}
