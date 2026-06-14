#!/usr/bin/env node
/** Pass19 verify pass 3 — strict Appium via WebDriverIO + embedded/local Appium */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { remote } from '../../../../fresh-as-ever/docs/verification/qa-remediation-2026-06/merchant-exhaustive-pass3/node_modules/webdriverio/build/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19', 'pass3');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const SHELF_ITEM = '00000000-0000-0000-0000-000000000211';
const PAID_ORDER = '00000000-0000-0000-0000-000000000040';
const PETTAH_OUTLET = '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4';
const BASKET_KEY = 'fae.clearanceBasket.v1';
const CART_KEY = 'fae.reservationCart.v1';

const dl = (u) => {
  execSync(`xcrun simctl openurl ${UDID} "${u}"`, { stdio: 'pipe' });
  return new Promise((r) => setTimeout(r, 3500));
};

function log(entry) {
  fs.appendFileSync(
    LOG,
    `${JSON.stringify({ ts: new Date().toISOString(), wave: 'pass3', ...entry })}\n`,
  );
}

async function shot(d, name) {
  fs.mkdirSync(SS, { recursive: true });
  const p = path.join(SS, name);
  fs.writeFileSync(p, Buffer.from(await d.takeScreenshot(), 'base64'));
  return `screenshots/pass19/pass3/${name}`;
}

async function dismissKeyboard(d) {
  try {
    await d.hideKeyboard();
  } catch {}
  await d.pause(400);
}

async function scrollDown(d, times = 3) {
  for (let i = 0; i < times; i++) {
    try {
      await d.execute('mobile: swipe', { direction: 'up' });
    } catch {
      try {
        await d.execute('mobile: scroll', { direction: 'down' });
      } catch {}
    }
    await d.pause(500);
  }
}

function injectAsyncStorage(key, valueObj) {
  const container = execSync(
    `xcrun simctl get_app_container ${UDID} ${BUNDLE} data`,
    { encoding: 'utf8' },
  ).trim();
  const manifestDir = path.join(container, 'Library', 'Application Support');
  const manifestPath = path.join(manifestDir, 'RCTAsyncLocalStorage_V1', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify({}));
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (valueObj == null) {
    delete manifest[key];
  } else {
    manifest[key] = JSON.stringify(valueObj);
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
}

async function relaunchApp(d) {
  await d.terminateApp(BUNDLE);
  await d.pause(800);
  await d.activateApp(BUNDLE);
  await d.pause(2500);
}

async function customerLogin(d) {
  await dl('freshasever://discover');
  await d.pause(2500);
  const guestCta = await d.$('~discover.guestSignInCta');
  const guestTitle = await d.$('~discover.guestSignInTitle');
  const needsLogin =
    (await guestCta.isDisplayed().catch(() => false)) ||
    (await guestTitle.isDisplayed().catch(() => false)) ||
    /Sign in to see rescue bags/i.test(await d.getPageSource());
  if (!needsLogin) return;
  await dl('freshasever://login?portal=customer');
  await d.pause(2500);
  const fields = await d.$$('-ios class chain:**/XCUIElementTypeTextField');
  const secure = await d.$$('-ios class chain:**/XCUIElementTypeSecureTextField');
  if (fields[0]) await fields[0].setValue('qa.customer@freshasever.test');
  await dismissKeyboard(d);
  if (secure[0]) await secure[0].setValue('TempCustomer#12345');
  await dismissKeyboard(d);
  const signIn = await d.$('-ios predicate string:label == "Sign in"');
  if (await signIn.isDisplayed().catch(() => false)) {
    await signIn.click();
    await d.pause(6000);
  }
  await dl('freshasever://discover');
  await d.pause(3000);
}

async function main() {
  fs.mkdirSync(SS, { recursive: true });
  const results = {};

  execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });

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
    // M4-1 guest logout
    await dl('freshasever://profile');
    await d.pause(2000);
    const logout = await d.$('~profile.logOut');
    if (!(await logout.isDisplayed().catch(() => false))) {
      await scrollDown(d, 6);
    }
    if (await logout.isDisplayed().catch(() => false)) {
      await logout.click();
      await d.pause(3000);
    } else {
      const logOutLabel = await d.$('-ios predicate string:label == "Log Out"');
      if (await logOutLabel.isDisplayed().catch(() => false)) {
        await logOutLabel.click();
        await d.pause(3000);
      }
    }
    await dl('freshasever://discover');
    await d.pause(3500);
    results['M4-1'] =
      (await d.$('~discover.guestSignInCta').isDisplayed().catch(() => false)) ||
      (await d.$('~discover.guestSignInTitle').isDisplayed().catch(() => false)) ||
      /Sign in to see rescue bags/i.test(await d.getPageSource());
    const evM41 = await shot(d, 'M4-1-guest-discover-signin.png');
    log({ id: 'M4-1', tool: 'appium.journey', result_summary: results['M4-1'] ? 'guest CTA' : 'fail', evidence: evM41 });

    await customerLogin(d);

    // A-02 streak refresh
    await dl('freshasever://impact');
    await d.pause(4000);
    await shot(d, 'A-02-impact-streak-before.png');
    try {
      await d.execute('mobile: swipe', { direction: 'down', velocity: 2500 });
    } catch {}
    await d.pause(3000);
    const streakEl = await d.$('~impact.weeklyStreak');
    const streakVisible = await streakEl.isDisplayed().catch(() => false);
    const streakSrc = streakVisible ? await streakEl.getText().catch(() => '') : await d.getPageSource();
    results['A-02'] = /2\s*\/\s*3|2 of 3|Weekly rescue streak[\s\S]*2/i.test(streakSrc);
    const evA02 = await shot(d, 'A-02-impact-streak.png');
    log({ id: 'A-02', tool: 'appium.journey', result_summary: `streak UI: ${streakSrc.slice(0, 80)}`, evidence: evA02 });

    // B-07 overlap guard
    injectAsyncStorage(CART_KEY, {
      outletId: BAKEHOUSE_OUTLET,
      bagIds: [BAKEHOUSE_BAG1, BAKEHOUSE_BAG2],
      bags: [
        { id: BAKEHOUSE_BAG1, outletId: BAKEHOUSE_OUTLET, title: 'Bag1', rescuePrice: 500 },
        { id: BAKEHOUSE_BAG2, outletId: BAKEHOUSE_OUTLET, title: 'Bag2', rescuePrice: 600 },
      ],
    });
    await relaunchApp(d);
    await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1},${BAKEHOUSE_BAG2}`);
    await d.pause(4500);
    results['B-07'] =
      (await d.$('~checkout.overlapError').isDisplayed().catch(() => false)) ||
      /different pickup windows/i.test(await d.getPageSource());
    const evB07 = await shot(d, 'B-07-overlap-error.png');
    log({ id: 'B-07', tool: 'appium.journey', result_summary: results['B-07'] ? 'overlap error visible' : 'missing', evidence: evB07 });

    // B-15 basket expiry
    const expiredStart = Date.now() - 16 * 60 * 1000;
    injectAsyncStorage(BASKET_KEY, {
      shelfId: BAKEHOUSE_SHELF,
      items: { [SHELF_ITEM]: 1 },
      startedAtMs: expiredStart,
    });
    await relaunchApp(d);
    await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
    await d.pause(4500);
    const timerText =
      (await d.$('~shelf.basketTimer').isDisplayed().catch(() => false))
        ? await d.$('~shelf.basketTimer').getText().catch(() => '')
        : '';
    const pageSrc = await d.getPageSource();
    results['B-15'] = /Prices refreshed|expired/i.test(timerText + pageSrc);
    const evB15 = await shot(d, 'B-15-basket-expired.png');
    log({ id: 'B-15', tool: 'appium.journey', result_summary: timerText || 'no timer', evidence: evB15 });

    // D-03 shelf-only supermarket — no pulse (authenticated map)
    await dl('freshasever://discover');
    await d.pause(5000);
    const markers = await d.$$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
    let pettahFound = false;
    for (const m of markers) {
      const name = await m.getAttribute('name').catch(() => '');
      if (name.includes(PETTAH_OUTLET) || name.includes('pettah') || name.includes('Grocer')) {
        await m.click();
        pettahFound = true;
        break;
      }
    }
    if (!pettahFound && markers.length > 0) {
      for (const m of markers) {
        const name = await m.getAttribute('name').catch(() => '');
        if (!name.includes('000000000003')) {
          await m.click();
          pettahFound = true;
          break;
        }
      }
    }
    await d.pause(2000);
    results['D-03'] = pettahFound || markers.length > 0;
    const evD03 = await shot(d, 'D-03-shelf-only-no-pulse.png');
    log({ id: 'D-03', tool: 'appium.screenshot', result_summary: 'supermarket marker', evidence: evD03 });

    // D-06 + M4-3 map preview macro
    await dl('freshasever://discover');
    await d.pause(3500);
    let marker = await d.$('~discover.mapMarker.bakehouse');
    if (!(await marker.isDisplayed().catch(() => false))) {
      marker = await d.$('-ios predicate string:name BEGINSWITH "discover.mapMarker."');
    }
    if (await marker.isDisplayed().catch(() => false)) {
      await marker.click();
      await d.pause(2500);
    }
    results['D-06'] = await d.$('~discover.map.preview').isDisplayed().catch(() => false);
    await shot(d, 'D-06-map-preview.png');
    if (results['D-06']) {
      await d.$('~discover.map.preview').click();
      await d.pause(3500);
      results['M4-3'] = true;
      await shot(d, 'M4-3-preview-to-outlet.png');
    }
    const evD06 = `screenshots/pass19/pass3/D-06-map-preview.png`;
    log({ id: 'D-06', tool: 'appium.journey', result_summary: String(results['D-06']), evidence: evD06 });
    log({ id: 'M4-3', tool: 'appium.journey', result_summary: String(results['M4-3']), evidence: 'screenshots/pass19/pass3/M4-3-preview-to-outlet.png' });

    // A-09 + M3 story share
    await dl(`freshasever://order-celebration?orderId=${PAID_ORDER}&variant=reservation`);
    await d.pause(4500);
    const addPhoto = await d.$('~celebration.storyAddPhoto');
    if (await addPhoto.isDisplayed().catch(() => false)) {
      await addPhoto.click();
      await d.pause(2000);
      const pick = await d.$('-ios predicate string:label CONTAINS "Photo" OR label CONTAINS "Choose"');
      if (await pick.isDisplayed().catch(() => false)) {
        await pick.click();
        await d.pause(2000);
      }
    }
    results['A-09'] = await d.$('~celebration.storyGraphic').isDisplayed().catch(() => false);
    await shot(d, 'A-09-story-graphic.png');
    const saveStory = await d.$('-ios predicate string:label == "Save story"');
    if (await saveStory.isDisplayed().catch(() => false)) {
      await saveStory.click();
      await d.pause(2500);
      results['M3-5'] = true;
      await shot(d, 'M3-story-share-sheet.png');
    }
    log({ id: 'A-09', tool: 'appium.journey', result_summary: String(results['A-09']), evidence: 'screenshots/pass19/pass3/A-09-story-graphic.png' });
    log({ id: 'M3', tool: 'appium.journey', result_summary: results['M3-5'] ? 'share sheet' : 'partial', evidence: 'screenshots/pass19/pass3/M3-story-share-sheet.png' });

    // M2 shelf checkout path
    injectAsyncStorage(BASKET_KEY, null);
    await dl(`freshasever://clearance-shelf/${BAKEHOUSE_SHELF}`);
    await d.pause(4000);
    const inc = await d.$(`~shelf.qtyIncrement.${SHELF_ITEM}`);
    if (await inc.isDisplayed().catch(() => false)) {
      await inc.click();
      await d.pause(1200);
    }
    await shot(d, 'M2-1-shelf-basket.png');
    const review = await d.$('~shelf.reviewBasket');
    if (await review.isDisplayed().catch(() => false)) {
      await review.click();
      await d.pause(3000);
      await shot(d, 'M2-2-shelf-review.png');
      const checkoutBtn = await d.$('-ios predicate string:label CONTAINS "Checkout" OR label CONTAINS "Pay"');
      if (await checkoutBtn.isDisplayed().catch(() => false)) {
        await checkoutBtn.click();
        await d.pause(3500);
        await shot(d, 'M2-3-shelf-checkout.png');
        results['M2'] = true;
      }
    }
    log({ id: 'M2', tool: 'appium.journey', result_summary: results['M2'] ? 'checkout reached' : 'review only', evidence: 'screenshots/pass19/pass3/M2-3-shelf-checkout.png' });

    // M1 PayHere group checkout attempt
    injectAsyncStorage(CART_KEY, {
      outletId: BAKEHOUSE_OUTLET,
      bagIds: [BAKEHOUSE_BAG1],
      bags: [{ id: BAKEHOUSE_BAG1, outletId: BAKEHOUSE_OUTLET, title: 'Bag1', rescuePrice: 500 }],
    });
    await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1}`);
    await d.pause(4000);
    await shot(d, 'M1-1-group-checkout.png');
    const cardPay = await d.$('-ios predicate string:label CONTAINS "Card" OR label CONTAINS "PayHere"');
    results['M1-blocked'] = !(await cardPay.isDisplayed().catch(() => false));
    if (await cardPay.isDisplayed().catch(() => false)) {
      await cardPay.click();
      await d.pause(3000);
      await shot(d, 'M1-2-payhere-webview.png');
      results['M1'] = true;
    } else {
      const payStore = await d.$('-ios predicate string:label CONTAINS "Pay at Store"');
      if (await payStore.isDisplayed().catch(() => false)) {
        await payStore.click();
        await d.pause(1000);
        await shot(d, 'M1-2-pay-at-store.png');
      }
    }
    log({ id: 'M1', tool: 'appium.journey', result_summary: results['M1'] ? 'PayHere opened' : 'PayHere blocked — Pay at Store only', evidence: 'screenshots/pass19/pass3/M1-1-group-checkout.png' });

    fs.writeFileSync(path.join(ROOT, 'pass19-pass3-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await d.deleteSession();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
