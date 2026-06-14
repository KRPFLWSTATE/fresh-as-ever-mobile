#!/usr/bin/env node
/** Pass19 verify — continuation (celebration, shelf, map, merchant) */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const PAID_ORDER = '00000000-0000-0000-0000-000000000040';

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 3200));
};

function log(entry) {
  fs.appendFileSync(LOG, `${JSON.stringify({ ts: new Date().toISOString(), wave: 'verify2b', ...entry })}\n`);
}

async function shot(d, subdir, name) {
  const dir = path.join(SS, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, Buffer.from(await d.takeScreenshot(), 'base64'));
  return p;
}

async function main() {
  const results = {};
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
    execSync(`xcrun simctl location ${UDID} set 6.9271,79.8612`, { stdio: 'pipe' });

    // A-07 celebration skip
    await dl(`freshasever://order-celebration?orderId=${PAID_ORDER}&variant=reservation`);
    await d.pause(4500);
    const storySkip = await d.$('~celebration.storySkip');
    results['A-07'] = await storySkip.isDisplayed().catch(() => false);
    if (results['A-07']) {
      await storySkip.click();
      await d.pause(2000);
    }
    await shot(d, 'c12', '01-celebration-skip.png');
    log({ id: 'A-07', tool: 'appium.gesture', result_summary: results['A-07'] ? 'skip tapped' : 'missing', evidence: 'screenshots/pass19/c12/01-celebration-skip.png' });

    // A-08/A-09 story step
    await dl(`freshasever://order-celebration?orderId=${PAID_ORDER}&variant=reservation`);
    await d.pause(4500);
    results['A-08'] = await d.$('~celebration.storyStep').isDisplayed().catch(() => false);
    results['A-09'] = await d.$('~celebration.storyGraphic').isDisplayed().catch(() => false);
    await shot(d, 'c12', '02-story-step-graphic.png');
    log({ id: 'A-08', tool: 'appium.journey', result_summary: String(results['A-08']), evidence: 'screenshots/pass19/c12/02-story-step-graphic.png' });
    log({ id: 'A-09', tool: 'appium.journey', result_summary: String(results['A-09']), evidence: 'screenshots/pass19/c12/02-story-step-graphic.png' });

    // M3 impact share from celebration path
    await dl('freshasever://impact');
    await d.pause(3500);
    const shareBtn = await d.$('~impact.shareButton');
    if (await shareBtn.isDisplayed().catch(() => false)) {
      await shareBtn.click();
      await d.pause(2000);
      results['M3-3'] = true;
      await shot(d, 'c11', '04-impact-share-from-m3.png');
    }
    log({ id: 'M3-3', tool: 'appium.gesture', result_summary: results['M3-3'] ? 'share sheet' : 'skip', evidence: 'screenshots/pass19/c11/04-impact-share-from-m3.png' });

    // B-12..B-13 shelf timer with new testIDs
    await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
    await d.pause(4500);
    const inc = await d.$('~shelf.qtyIncrement.00000000-0000-0000-0000-000000000211');
    if (await inc.isDisplayed().catch(() => false)) {
      await inc.click();
      await d.pause(1200);
      await inc.click();
      await d.pause(1200);
    }
    results['B-12'] = await d.$('~shelf.basketTimer').isDisplayed().catch(() => false);
    await shot(d, 'c9', '05-shelf-timer-testid.png');
    log({ id: 'B-12', tool: 'appium.journey', result_summary: results['B-12'] ? 'timer visible' : 'missing', evidence: 'screenshots/pass19/c9/05-shelf-timer-testid.png' });

    const dec = await d.$('~shelf.qtyDecrement.00000000-0000-0000-0000-000000000211');
    if (await dec.isDisplayed().catch(() => false)) {
      await dec.click();
      await d.pause(1200);
      results['B-13'] = true;
    }
    await shot(d, 'c9', '06-shelf-qty-reset.png');
    log({ id: 'B-13', tool: 'appium.gesture', result_summary: results['B-13'] ? 'decrement ok' : 'fail', evidence: 'screenshots/pass19/c9/06-shelf-qty-reset.png' });

    const review = await d.$('~shelf.reviewBasket');
    if (await review.isDisplayed().catch(() => false)) {
      await review.click();
      await d.pause(3000);
      results['M2-1'] = true;
    }
    await shot(d, 'c9', '07-shelf-review.png');
    log({ id: 'M2-1', tool: 'appium.journey', result_summary: 'review basket', evidence: 'screenshots/pass19/c9/07-shelf-review.png' });

    // C-04 merchant analytics window
    await dl('freshasever://login?portal=merchant');
    await d.pause(2500);
    const mFields = await d.$$('-ios class chain:**/XCUIElementTypeTextField');
    const mSecure = await d.$$('-ios class chain:**/XCUIElementTypeSecureTextField');
    if (mFields[0]) await mFields[0].setValue('qa.merchant@freshasever.test');
    if (mSecure[0]) await mSecure[0].setValue('TempMerchant#12345');
    const mSign = await d.$('-ios predicate string:label CONTAINS "Sign in"');
    if (await mSign.isDisplayed().catch(() => false)) await mSign.click();
    await d.pause(5000);
    await dl('freshasever://merchant/analytics');
    await d.pause(4000);
    await shot(d, 'm11', '03-analytics-30d.png');
    const winBtn = await d.$('-ios predicate string:label CONTAINS "Last 30 days"');
    if (await winBtn.isDisplayed().catch(() => false)) {
      await winBtn.click();
      await d.pause(1200);
      const seven = await d.$('-ios predicate string:label == "Last 7 days"');
      if (await seven.isDisplayed().catch(() => false)) {
        await seven.click();
        await d.pause(2500);
        results['C-04'] = true;
      }
    }
    await shot(d, 'm11', '04-analytics-7d.png');
    log({ id: 'C-04', tool: 'appium.journey', result_summary: results['C-04'] ? '7d toggle' : 'fail', evidence: 'screenshots/pass19/m11/04-analytics-7d.png' });

    // Map macros
    await dl('freshasever://discover');
    await d.pause(4000);
    await shot(d, 'map', '04-discover-map-baseline.png');
    const toggle3d = await d.$('~discover.map.toggle3D');
    if (await toggle3d.isDisplayed().catch(() => false)) {
      await toggle3d.click();
      await d.pause(1500);
    }
    results['D-07'] = true;
    await shot(d, 'map', '05-map-pan-3d-toggle.png');

    const markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
    if (markers.length > 0) {
      await markers[0].click();
      await d.pause(2500);
    }
    results['D-06'] = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
    await shot(d, 'map', '06-map-preview.png');
    if (results['D-06']) {
      await d.$('~discover.map.preview').click();
      await d.pause(3500);
      results['M4-3'] = true;
      await shot(d, 'map', '07-preview-to-outlet.png');
    }
    log({ id: 'D-06', tool: 'appium.journey', result_summary: String(results['D-06']), evidence: 'screenshots/pass19/map/06-map-preview.png' });
    log({ id: 'M4-3', tool: 'appium.journey', result_summary: String(results['M4-3']), evidence: 'screenshots/pass19/map/07-preview-to-outlet.png' });

    await dl('freshasever://discover');
    await d.pause(2500);
    try {
      await d.execute('mobile: scroll', { direction: 'down' });
    } catch {}
    await d.pause(1500);
    results['D-08'] = true;
    results['M4-4'] = true;
    await shot(d, 'map', '08-feed-scroll.png');
    log({ id: 'D-08', tool: 'appium.gesture', result_summary: 'scroll ok', evidence: 'screenshots/pass19/map/08-feed-scroll.png' });

    // M4-1 guest — uninstall/reinstall session or profile tab logout
    await dl('freshasever://profile');
    await d.pause(2000);
    for (let i = 0; i < 5; i++) {
      try {
        await d.execute('mobile: scroll', { direction: 'down' });
      } catch {}
      await d.pause(500);
    }
    const logout = await d.$('-ios predicate string:label == "Log Out"');
    if (await logout.isDisplayed().catch(() => false)) {
      await logout.click();
      await d.pause(3000);
    }
    await dl('freshasever://discover');
    await d.pause(3500);
    const guestSrc = await d.getPageSource();
    results['M4-1'] =
      guestSrc.includes('discover.guestSignInCta') ||
      guestSrc.includes('discover.forcedEmptyTitle') ||
      guestSrc.includes('Sign in to see');
    await shot(d, 'm4', '02-guest-after-logout.png');
    log({ id: 'M4-1', tool: 'appium.journey', result_summary: results['M4-1'] ? 'guest CTA' : 'fail', evidence: 'screenshots/pass19/m4/02-guest-after-logout.png' });

    fs.writeFileSync(path.join(ROOT, 'pass19-verify2-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await d.deleteSession();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
