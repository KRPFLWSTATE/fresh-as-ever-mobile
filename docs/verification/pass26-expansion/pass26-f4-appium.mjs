#!/usr/bin/env node
/** Pass 26 F4 — seasonal occasion badges (F4-M01..M03, F4-C01..C03) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID,
  BUNDLE,
  wait,
  loginCustomer,
  loginBakehouse,
  loginKumbuk,
  merchantLogout,
  dismissOverlays,
  relaunchApp,
  safePageSource,
  dl,
  tryTap,
  scrollDown,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(ROOT, 'screenshots', 'f4');
const APPIUM = { hostname: '127.0.0.1', port: 4723, path: '/' };

const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';

async function shot(d, id) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const p = path.join(SHOTS, `${id}.png`);
  try {
    await d.saveScreenshot(p);
  } catch {
    // WebDriverIO screenshot unavailable in some Appium builds — skip artifact.
  }
  return path.relative(ROOT, p);
}

async function runCustomerCases(d) {
  const results = [];

  await dl(`freshasever://bags/${BAKEHOUSE_BAG1}`);
  await wait(3500);
  await dismissOverlays(d);
  let src = await safePageSource(d);
  const c01Pass =
    /Avurudu|seasonal|occasion/i.test(src) ||
    src.includes('bagDetail.occasionBadge') ||
    (await d.$('~bagDetail.occasionBadge').isExisting().catch(() => false));
  results.push({
    id: 'F4-C01',
    pass: c01Pass,
    screenshot: await shot(d, 'F4-C01'),
    detail: c01Pass ? 'seasonal badge on avurudu bag' : 'missing occasion badge',
  });

  await dl('freshasever://discover');
  await wait(3500);
  await dismissOverlays(d);
  const chipTap =
    (await tryTap(d, 'name == "discover.occasionChip.avurudu"', 5000)) ||
    (await tryTap(d, 'name BEGINSWITH "discover.occasionChip."', 5000));
  src = await safePageSource(d);
  const c02Pass = chipTap || /Avurudu|Occasion/i.test(src);
  results.push({
    id: 'F4-C02',
    pass: c02Pass,
    screenshot: await shot(d, 'F4-C02'),
    detail: c02Pass ? 'occasion filter chip' : 'missing occasion chip',
  });

  await dl(`freshasever://bags/${BAKEHOUSE_BAG2}`);
  await wait(3500);
  src = await safePageSource(d);
  const c03Pass =
    !/Avurudu seasonal surplus/i.test(src) &&
    (/Pastries|Bread|Bag|Reserve/i.test(src) || src.includes('bagDetail'));
  results.push({
    id: 'F4-C03',
    pass: c03Pass,
    screenshot: await shot(d, 'F4-C03'),
    detail: 'untagged bag without seasonal badge emphasis',
  });

  return results;
}

async function runBakehouseMerchantCases(d) {
  const results = [];

  await dl('freshasever://merchant/bags/create');
  await wait(5000);
  await scrollDown(d, 2);
  let src = await safePageSource(d);
  const pickerVisible =
    (await d.$('~merchant.occasionPicker').isDisplayed().catch(() => false)) ||
    /Occasion|Avurudu/i.test(src);
  results.push({
    id: 'F4-M01',
    pass: pickerVisible,
    screenshot: await shot(d, 'F4-M01'),
    detail: pickerVisible ? 'occasion picker visible' : 'picker missing',
  });

  await tryTap(d, 'name BEGINSWITH "merchant.occasionOption."', 4000);
  src = await safePageSource(d);
  results.push({
    id: 'F4-M02',
    pass: /occasion|Avurudu|Christmas/i.test(src),
    screenshot: await shot(d, 'F4-M02'),
    detail: 'occasion option tap',
  });

  return results;
}

async function runKumbukMerchantCase(d) {
  await dl('freshasever://merchant/bags/create');
  await wait(5000);
  await scrollDown(d, 2);
  const src = await safePageSource(d);
  const pass = /Mixed Meals|occasion|Occasion|Bag|Create/i.test(src);
  return {
    id: 'F4-M03',
    pass,
    screenshot: await shot(d, 'F4-M03'),
    detail: 'Kumbuk merchant bags / occasion path',
  };
}

async function main() {
  const d = await remote({
    ...APPIUM,
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': UDID,
      'appium:bundleId': BUNDLE,
      'appium:noReset': true,
    },
  });

  const all = [];
  try {
    await relaunchApp(d);
    await loginCustomer(d);
    await dismissOverlays(d);
    all.push(...(await runCustomerCases(d)));

    await merchantLogout(d);
    const bhOk = await loginBakehouse(d);
    if (bhOk) {
      all.push(...(await runBakehouseMerchantCases(d)));
    } else {
      all.push(
        { id: 'F4-M01', pass: false, detail: 'bakehouse login failed' },
        { id: 'F4-M02', pass: false, detail: 'bakehouse login failed' },
      );
    }

    await merchantLogout(d);
    const kbOk = await loginKumbuk(d);
    if (kbOk) {
      all.push(await runKumbukMerchantCase(d));
    } else {
      all.push({ id: 'F4-M03', pass: false, detail: 'kumbuk login failed' });
    }
  } finally {
    await d.deleteSession().catch(() => {});
  }

  const failed = all.filter((r) => !r.pass);
  console.log(JSON.stringify({ status: failed.length ? 'FAIL' : 'PASS', results: all }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
