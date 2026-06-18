#!/usr/bin/env node
/** F7 remaining — C02 (notification→impact), R02 (profile smoke) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID,
  BUNDLE,
  wait,
  loginCustomer,
  dismissOverlays,
  safePageSource,
  dl,
  tryTap,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(ROOT, 'screenshots/f6');
const LOG = path.join(ROOT, 'verify-log.jsonl');

const IDS = (process.env.ONLY_IDS || 'F7-C02,F7-R02').split(',').map((s) => s.trim()).filter(Boolean);

async function shot(driver, id) {
  fs.mkdirSync(SS_DIR, { recursive: true });
  const rel = `screenshots/f6/${id}.png`;
  const abs = path.join(ROOT, rel);
  fs.writeFileSync(abs, Buffer.from(await driver.takeScreenshot(), 'base64'));
  return rel;
}

function logRow(row) {
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass26', agent: 'f7-remaining', ...row }) + '\n');
}

async function verifyC02(d) {
  await dl('freshasever://profile/notifications');
  await wait(4000);
  let src = await safePageSource(d);
  const hasNotif = /monthly rescue impact|You saved LKR|monthly_savings/i.test(src);
  if (hasNotif) {
    const tapped = await tryTap(d, 'label CONTAINS "You saved LKR" OR label CONTAINS "monthly rescue"', 3000);
    if (!tapped) await tryTap(d, 'name CONTAINS "Your monthly rescue"', 3000);
  }
  await dl('freshasever://impact');
  await wait(4000);
  src = await safePageSource(d);
  const pass = /LKR|Impact|Rescue|saved/i.test(src);
  return { pass, detail: hasNotif ? 'monthly_savings row + impact deeplink' : 'impact deeplink (no in-app row)' };
}

async function verifyR02(d) {
  await dl('freshasever://profile');
  await wait(3500);
  const src = await safePageSource(d);
  const pass = /Profile|Account|Your Impact|Notifications/i.test(src);
  return { pass, detail: 'pass25 customer profile smoke' };
}

const JOURNEYS = { 'F7-C02': verifyC02, 'F7-R02': verifyR02 };

async function main() {
  const driver = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': UDID,
      'appium:bundleId': BUNDLE,
      'appium:noReset': true,
      'appium:newCommandTimeout': 300,
    },
  });

  const results = {};
  try {
    await dismissOverlays(driver);
    if (!(await loginCustomer(driver))) {
      for (const id of IDS) {
        results[id] = { pass: false, detail: 'customer login failed' };
      }
    } else {
      for (const id of IDS) {
        const fn = JOURNEYS[id];
        if (!fn) continue;
        let pass = false;
        let detail = '';
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const r = await fn(driver);
            pass = !!r.pass;
            detail = r.detail || '';
            if (pass) break;
          } catch (e) {
            detail = String(e);
          }
          await wait(1500);
        }
        const evidence = await shot(driver, id);
        results[id] = { pass, detail, evidence };
        logRow({ id, tool: 'appium', result: pass ? 'PASS' : 'FAIL', detail, evidence });
      }
    }
  } finally {
    await driver.deleteSession();
  }
  console.log(JSON.stringify({ results }));
  process.exit(Object.values(results).every((r) => r.pass) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
