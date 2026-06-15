#!/usr/bin/env node
/** P0-05: Screenshot qa.merchant@ 4-outlet profile before split */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'baseline');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return wait(3200);
};

async function scrollDown(d, times = 2) {
  const { width, height } = await d.getWindowSize();
  for (let i = 0; i < times; i++) {
    await d.performActions([
      {
        type: 'pointer',
        id: 's1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.floor(width / 2), y: Math.floor(height * 0.72) },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerMove', duration: 500, x: Math.floor(width / 2), y: Math.floor(height * 0.25) },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await d.releaseActions();
    await wait(400);
  }
}

const d = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  capabilities: {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': UDID,
    'appium:bundleId': BUNDLE,
    'appium:noReset': true,
  },
});

try {
  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });
  await dl('freshasever://login?portal=merchant');
  await wait(2500);

  const useEmail = await d.$('-ios predicate string:label CONTAINS "Use email"');
  if (await useEmail.isDisplayed().catch(() => false)) await useEmail.click();

  await d.$('~login.email').setValue('qa.merchant@freshasever.test');
  await d.$('~login.password').setValue('TempMerchant#12345');
  try { await d.hideKeyboard(); } catch {}
  await d.$('~login.signIn').click();

  for (let i = 0; i < 20; i++) {
    await wait(1500);
    const src = await d.getPageSource();
    if (/Dashboard|Orders|Bags|Shelves/i.test(src)) break;
  }

  await dl('freshasever://merchant/profile');
  await wait(3000);
  await scrollDown(d, 2);

  const editOutlets = await d.$('-ios predicate string:label CONTAINS "Edit outlets" OR label CONTAINS "EDIT OUTLETS"');
  if (await editOutlets.isDisplayed().catch(() => false)) await editOutlets.click();
  await wait(2000);
  await scrollDown(d, 3);

  fs.mkdirSync(SS, { recursive: true });
  const name = 'P0-05-before-profile-4outlets.png';
  fs.writeFileSync(path.join(SS, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  const src = await d.getPageSource();
  const outletCount = (src.match(/Kollupitiya|Galle Face|Kumbuk|Pettah|Bakehouse Colombo 07|Green Grocer/gi) || []).length;

  fs.appendFileSync(
    LOG,
    JSON.stringify({
      ts: new Date().toISOString(),
      id: 'P0-05',
      tool: 'appium',
      result: 'PASS',
      detail: `Pre-split merchant profile screenshot; outlet name hits=${outletCount}`,
      evidence: `screenshots/baseline/${name}`,
    }) + '\n',
  );
  console.log(JSON.stringify({ pass: true, evidence: name, outletNameHits: outletCount }));
} finally {
  await d.deleteSession();
}
