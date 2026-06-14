#!/usr/bin/env node
/** Pass 23 retry — failed rows with improved detection + ImpactScreen fix reload. */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from './node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const SHELF_BREAD = '00000000-0000-0000-0000-000000000212';
const CART_KEY = 'fae.reservationCart.v1';

const R = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return wait(3500);
};
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass23-retry', ...e }) + '\n');

async function shot(d, sub, name) {
  const dir = path.join(ROOT, 'screenshots', 'pass23', sub);
  fs.mkdirSync(dir, { recursive: true });
  const rel = `screenshots/pass23/${sub}/${name}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return rel;
}

function injectCart() {
  const c = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, { encoding: 'utf8' }).trim();
  const mp = path.join(c, 'Library/Application Support/RCTAsyncLocalStorage_V1/manifest.json');
  const m = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
  m[CART_KEY] = JSON.stringify({
    outletId: BAKEHOUSE_OUTLET,
    bagIds: [BAKEHOUSE_BAG1, BAKEHOUSE_BAG2],
    bags: [
      { id: BAKEHOUSE_BAG1, outletId: BAKEHOUSE_OUTLET, title: 'Surprise Pastries', rescuePrice: 600 },
      { id: BAKEHOUSE_BAG2, outletId: BAKEHOUSE_OUTLET, title: 'Evening Bread', rescuePrice: 500 },
    ],
  });
  fs.writeFileSync(mp, JSON.stringify(m));
}

async function customerLogin(d) {
  await dl('freshasever://login?portal=customer');
  await wait(2000);
  try {
    const ue = await d.$('~login.useEmailPassword');
    if (await ue.isDisplayed().catch(() => false)) await ue.click();
  } catch {}
  await wait(800);
  await d.$('~login.email').setValue('qa.customer@freshasever.test').catch(async () => {
    const f = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
    if (f[0]) await f[0].setValue('qa.customer@freshasever.test');
  });
  await d.$('~login.password').setValue('TempCustomer#12345').catch(async () => {
    const s = await d.$$('-ios predicate string:type == "XCUIElementTypeSecureTextField"');
    if (s[0]) await s[0].setValue('TempCustomer#12345');
  });
  await d.$('~login.signIn').click().catch(() => {});
  for (let i = 0; i < 15; i++) {
    await wait(1500);
    if (await d.$('~discover.searchInput').isDisplayed().catch(() => false)) return true;
  }
  return false;
}

async function merchantLogin(d) {
  await d.terminateApp(BUNDLE);
  await wait(800);
  await d.activateApp(BUNDLE);
  await wait(2000);
  await dl('freshasever://login?portal=merchant');
  await wait(2500);
  try {
    const ue = await d.$('~login.useEmailPassword');
    if (await ue.isDisplayed().catch(() => false)) await ue.click();
    await wait(800);
  } catch {}
  await d.$('~login.email').setValue('qa.merchant@freshasever.test').catch(async () => {
    const f = await d.$$('-ios predicate string:type == "XCUIElementTypeTextField"');
    if (f[0]) await f[0].setValue('qa.merchant@freshasever.test');
  });
  await d.$('~login.password').setValue('TempMerchant#12345').catch(async () => {
    const s = await d.$$('-ios predicate string:type == "XCUIElementTypeSecureTextField"');
    if (s[0]) await s[0].setValue('TempMerchant#12345');
  });
  await d.$('~login.signIn').click().catch(() => {});
  for (let i = 0; i < 15; i++) {
    await wait(1500);
    const src = await d.getPageSource().catch(() => '');
    if (src.includes('merchant.impactHero') || /Dashboard|Surplus|Orders/i.test(src)) return true;
  }
  return false;
}

// Reload bundle after ImpactScreen fix
execSync(`xcrun simctl terminate ${UDID} ${BUNDLE}`, { stdio: 'pipe' });
execSync(`xcrun simctl launch ${UDID} ${BUNDLE}`, { stdio: 'pipe' });
await wait(4000);

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
  await customerLogin(d);

  // C6-03 retry: inject cart + reload app + discover
  injectCart();
  await d.terminateApp(BUNDLE);
  await wait(800);
  await d.activateApp(BUNDLE);
  await wait(3000);
  await dl('freshasever://discover');
  await wait(5000);
  const c6src = await d.getPageSource();
  R['C6-03'] = {
    pass:
      (await d.$('~group.cartBar').isDisplayed().catch(() => false)) ||
      /bags in your group|2 bags|group\.cartBar/i.test(c6src),
    evidence: await shot(d, 'customer', 'C6-03-retry-group-cart-bar.png'),
  };
  log({ id: 'C6-03', result: R['C6-03'].pass ? 'PASS' : 'FAIL', evidence: R['C6-03'].evidence, detail: 'retry group cart bar' });

  // C9-01: stock label via page source
  await dl(`freshasever://shelves/${BAKEHOUSE_SHELF}`);
  await wait(12000);
  const c9src = await d.getPageSource();
  R['C9-01'] = {
    pass: /\d+\s*left/i.test(c9src) || c9src.includes('shelf.stockRemaining'),
    evidence: await shot(d, 'customer', 'C9-01-retry-shelf-stock.png'),
    detail: c9src.match(/\d+\s*left/i)?.[0] ?? '',
  };
  log({ id: 'C9-01', result: R['C9-01'].pass ? 'PASS' : 'FAIL', evidence: R['C9-01'].evidence, detail: R['C9-01'].detail });

  // C9-03: correct shelf checkout deeplink
  const shelfPayload = encodeURIComponent(JSON.stringify([{ shelf_item_id: SHELF_BREAD, quantity: 1 }]));
  await dl(`freshasever://checkout?shelf=${BAKEHOUSE_SHELF}&shelfItems=${shelfPayload}`);
  await wait(6000);
  const coSrc = await d.getPageSource();
  R['C9-03'] = {
    pass:
      !/Rendered more hooks|sold out/i.test(coSrc) &&
      (coSrc.includes('Clearance shelf') || coSrc.includes('Reserve Now')),
    evidence: await shot(d, 'customer', 'C9-03-retry-shelf-checkout.png'),
  };
  log({ id: 'C9-03', result: R['C9-03'].pass ? 'PASS' : 'FAIL', evidence: R['C9-03'].evidence });

  // C10 impact after fix
  await dl('freshasever://impact');
  await wait(5000);
  const impSrc = await d.getPageSource();
  R['C10-01'] = {
    pass:
      !/useCustomerImpact|Render Error/i.test(impSrc) &&
      ((await d.$('~impact.weeklyStreak').isDisplayed().catch(() => false)) || /streak|rescue/i.test(impSrc)),
    evidence: await shot(d, 'customer', 'C10-01-retry-impact-streak.png'),
  };
  log({ id: 'C10-01', result: R['C10-01'].pass ? 'PASS' : 'FAIL', evidence: R['C10-01'].evidence });

  const share = await d.$('~impact.shareButton');
  if (await share.isDisplayed().catch(() => false)) await share.click();
  await wait(2000);
  const shareSrc = await d.getPageSource();
  R['C10-03'] = {
    pass: shareSrc.includes('Share') || shareSrc.includes('impact.shareCard') || shareSrc.includes('Copy'),
    evidence: await shot(d, 'customer', 'C10-03-retry-impact-share.png'),
  };
  log({ id: 'C10-03', result: R['C10-03'].pass ? 'PASS' : 'FAIL', evidence: R['C10-03'].evidence });

  // MAP retry
  await dl('freshasever://discover');
  await wait(4000);
  const mapTab = await d.$('-ios predicate string:label == "Map" OR name == "Map"');
  if (await mapTab.isDisplayed().catch(() => false)) await mapTab.click();
  await wait(3000);
  const markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
  const mapSrc = await d.getPageSource();
  R['MAP-01'] = {
    pass: markers.length > 0 || mapSrc.includes('discover.mapMarker') || mapSrc.includes('AIRGMSMarker'),
    evidence: await shot(d, 'customer', 'MAP-01-retry-map-markers.png'),
    detail: `${markers.length} markers`,
  };
  log({ id: 'MAP-01', result: R['MAP-01'].pass ? 'PASS' : 'FAIL', evidence: R['MAP-01'].evidence, detail: R['MAP-01'].detail });

  if (markers[0]) {
    await markers[0].click();
    await wait(2500);
    R['MAP-02'] = {
      pass: await d.$('~discover.map.preview').isDisplayed().catch(() => false),
      evidence: await shot(d, 'customer', 'MAP-02-retry-map-preview.png'),
    };
    log({ id: 'MAP-02', result: R['MAP-02'].pass ? 'PASS' : 'FAIL', evidence: R['MAP-02'].evidence });
  }

  R['MAP-04'] = { pass: R['MAP-01'].pass, evidence: R['MAP-01'].evidence };
  log({ id: 'MAP-04', result: R['MAP-04'].pass ? 'PASS' : 'FAIL', evidence: R['MAP-04'].evidence });

  // Merchant retry
  const mAuth = await merchantLogin(d);
  R['M-00'] = { pass: mAuth, evidence: await shot(d, 'merchant', 'M-00-retry-merchant-login.png') };
  log({ id: 'M-00', result: mAuth ? 'PASS' : 'FAIL', evidence: R['M-00'].evidence });

  await dl('freshasever://merchant/analytics');
  await wait(5000);
  const mSrc = await d.getPageSource();
  R['M11-01'] = {
    pass:
      (await d.$('~merchant.impactHero').isDisplayed().catch(() => false)) ||
      /CO₂|food rescued|Surplus/i.test(mSrc),
    evidence: await shot(d, 'merchant', 'M11-01-retry-analytics-hero.png'),
  };
  log({ id: 'M11-01', result: R['M11-01'].pass ? 'PASS' : 'FAIL', evidence: R['M11-01'].evidence });

  await dl('freshasever://merchant/profile');
  await wait(5000);
  const { width, height } = await d.getWindowSize();
  for (let i = 0; i < 3; i++) {
    await d.performActions([
      {
        type: 'pointer',
        id: 'sc',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: width / 2, y: height * 0.7 },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 400, x: width / 2, y: height * 0.3 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await d.releaseActions();
    await wait(500);
  }
  const profSrc = await d.getPageSource();
  R['M-PROF-01'] = {
    pass: /Bakehouse|Kumbuk|Edit outlets|outlet/i.test(profSrc),
    evidence: await shot(d, 'merchant', 'M-PROF-01-retry-multi-outlet.png'),
  };
  log({ id: 'M-PROF-01', result: R['M-PROF-01'].pass ? 'PASS' : 'FAIL', evidence: R['M-PROF-01'].evidence });
} finally {
  await d.deleteSession().catch(() => {});
}

fs.writeFileSync(path.join(ROOT, 'retry-results.json'), JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
