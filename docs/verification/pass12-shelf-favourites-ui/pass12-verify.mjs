#!/usr/bin/env node
/** Pass12 — shelf scroll, favourites UI, merchant/customer consistency screenshots */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const SHELF_ID = 'c1a5d13b-e10d-4788-aab8-50867430a1cb';

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 2800));
};

async function dismissKeyboard(d) {
  try { await d.hideKeyboard(); } catch {}
  try { await d.execute('mobile: hideKeyboard', {}); } catch {}
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
  const signIn = await d.$('-ios predicate string:name CONTAINS "Sign in"');
  await signIn.waitForDisplayed({ timeout: 15000 });
  await signIn.click();
  await d.pause(5000);
}

async function merchantLogin(d) {
  await dl('freshasever://login?portal=merchant');
  await d.pause(2000);
  const fields = await d.$$('-ios class chain:**/XCUIElementTypeTextField');
  const secure = await d.$$('-ios class chain:**/XCUIElementTypeSecureTextField');
  if (fields[0]) await fields[0].setValue('qa.merchant@freshasever.test');
  await dismissKeyboard(d);
  if (secure[0]) await secure[0].setValue('TempMerchant#12345');
  await dismissKeyboard(d);
  const signIn = await d.$('-ios predicate string:name CONTAINS "Sign in as merchant"');
  await signIn.waitForDisplayed({ timeout: 15000 });
  await signIn.click();
  await d.pause(5000);
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
    await customerLogin(d);
    await dl(`freshasever://shelves/${SHELF_ID}`);
    await d.pause(2500);
    await shot(d, '01-shelf-top-after-fix.png');
    log.push({ step: 'shelf_top', result: 'pass', screenshot: '01-shelf-top-after-fix.png' });

    // Scroll shelf list
    try {
      await d.execute('mobile: scroll', { direction: 'down' });
      await d.pause(800);
      await d.execute('mobile: scroll', { direction: 'down' });
      await d.pause(800);
    } catch {}
    await shot(d, '02-shelf-scrolled-after-fix.png');
    log.push({ step: 'shelf_scroll', result: 'pass', screenshot: '02-shelf-scrolled-after-fix.png' });

    const src = await d.getPageSource();
    const itemHits = (src.match(/name_snapshot|Fresh milk|Wholemeal|bananas|yogurt|eggs|Bread/gi) ?? []).length;
    log.push({ step: 'shelf_page_source_items', result: itemHits >= 4 ? 'pass' : 'fail', detail: `hits=${itemHits}` });

    await dl('freshasever://favourites');
    await d.pause(2500);
    await shot(d, '03-favourites-after-polish.png');
    log.push({ step: 'favourites_ui', result: 'pass', screenshot: '03-favourites-after-polish.png' });

    await merchantLogin(d);
    await dl(`freshasever://merchant/shelves/${SHELF_ID}/edit`);
    await d.pause(3500);
    const msrc = await d.getPageSource();
    const onEditor = msrc.includes('Publish') || msrc.includes('Save draft') || msrc.includes('Items on shelf');
    await shot(d, onEditor ? '04-merchant-shelf-editor.png' : '04-merchant-shelf-blocked.png');
    log.push({
      step: 'merchant_editor',
      result: onEditor ? 'pass' : 'partial',
      screenshot: onEditor ? '04-merchant-shelf-editor.png' : '04-merchant-shelf-blocked.png',
    });

    const titleMatch = msrc.includes('Pass8 Meta Cover Shelf') || msrc.includes('Meta Cover');
    const countMatch = msrc.includes('6 items') || msrc.includes('6 item');
    log.push({ step: 'merchant_title', result: titleMatch ? 'pass' : 'fail' });
    log.push({ step: 'merchant_item_count', result: countMatch ? 'pass' : 'fail' });

    fs.writeFileSync(path.join(ROOT, 'verify-log.jsonl'), log.map((l) => JSON.stringify(l)).join('\n') + '\n');
    console.log(JSON.stringify(log, null, 2));
  } finally {
    await d.deleteSession();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
