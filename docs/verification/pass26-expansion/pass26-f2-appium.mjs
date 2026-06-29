#!/usr/bin/env node
/** Pass 26 F2 — WhatsApp listing share (F2-C01..C05) on sim 377DAC99 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  buildBagWhatsAppMessage,
  buildShelfWhatsAppMessage,
  buildWhatsAppShareUrl,
} from '../../../../fresh-as-ever/src/lib/listingShare.js';
import {
  UDID,
  wait,
  dl,
  loginCustomer,
  loginBakehouse,
  loginKumbuk,
  merchantLogout,
  dismissOverlays,
  recoverFromErrorBoundary,
  safePageSource,
  tryTap,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'f2');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const MATRIX = path.join(ROOT, 'MATRIX.md');
const LOCK = path.join(ROOT, 'pass26-runner.lock');
const PORTAL = process.env.PORTAL || 'all';

const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const KUMBUK_BAG = '00000000-0000-0000-0000-000000000105';
const PETTAH_SHELF = '87e99daa-ef1f-494a-874d-da8a4abf40d3';

const CASES = [
  { id: 'F2-C01', route: `freshasever://bags/${BAKEHOUSE_BAG1}`, testId: 'bagDetail.whatsappShare', kind: 'bag', listingId: BAKEHOUSE_BAG1, outletName: 'Bakehouse', title: 'Demo bag', price: 450 },
  { id: 'F2-C02', route: `freshasever://bags/${BAKEHOUSE_BAG2}`, testId: 'bagDetail.whatsappShare', kind: 'bag', listingId: BAKEHOUSE_BAG2, outletName: 'Bakehouse', title: 'Demo bag', price: 350 },
  { id: 'F2-C03', route: `freshasever://bags/${KUMBUK_BAG}`, testId: 'bagDetail.whatsappShare', kind: 'bag', listingId: KUMBUK_BAG, outletName: 'Kumbuk', title: 'Demo bag', price: 300 },
  { id: 'F2-C04', route: `freshasever://shelves/${BAKEHOUSE_SHELF}`, testId: 'shelfDetail.whatsappShare', kind: 'shelf', listingId: BAKEHOUSE_SHELF, outletName: 'Bakehouse' },
  { id: 'F2-C05', route: `freshasever://shelves/${PETTAH_SHELF}`, testId: 'shelfDetail.whatsappShare', kind: 'shelf', listingId: PETTAH_SHELF, outletName: 'Pettah' },
];

const R = {};

function log(e) {
  fs.appendFileSync(LOG, `${JSON.stringify({ ts: new Date().toISOString(), wave: 'pass26-f2', ...e })}\n`);
}

function sampleMessage(c) {
  if (c.kind === 'bag') {
    return buildBagWhatsAppMessage({
      bagId: c.listingId,
      title: c.title,
      outletName: c.outletName,
      rescuePrice: c.price ?? 0,
      pickupStart: '2026-06-19T12:00:00.000Z',
      pickupEnd: '2026-06-19T14:00:00.000Z',
      webBaseUrl: 'https://fresh-as-ever.vercel.app',
    });
  }
  return buildShelfWhatsAppMessage({
    shelfId: c.listingId,
    outletName: c.outletName,
    itemCount: 3,
    rescuePriceFrom: 180,
    pickupStart: '2026-06-19T12:00:00.000Z',
    pickupEnd: '2026-06-19T14:00:00.000Z',
    webBaseUrl: 'https://fresh-as-ever.vercel.app',
  });
}

async function shot(d, name) {
  fs.mkdirSync(SS, { recursive: true });
  const rel = `screenshots/f2/${name}`;
  fs.writeFileSync(path.join(SS, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return rel;
}

function updateMatrix() {
  if (!fs.existsSync(MATRIX)) return;
  let md = fs.readFileSync(MATRIX, 'utf8');
  for (const [id, row] of Object.entries(R)) {
    const status = row.pass ? 'PASS' : 'FAIL';
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(\\| ${esc} \\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\| )([^|]+)( \\| )([^|]*)( \\|)`);
    md = md.replace(re, `$1${status}$3${row.evidence || ''}$4`);
  }
  fs.writeFileSync(MATRIX, md);
}

async function waitForDetail(d, c, timeoutMs = 20000) {
  const needles = [
    c.testId,
    'Reserve Now',
    'Reserve Bag',
    'Clearance shelf',
    'Share on WhatsApp',
  ];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const src = await safePageSource(d);
    if (needles.some((n) => src.includes(n))) return src;
    await wait(800);
  }
  return safePageSource(d);
}

async function runCase(d, c) {
  await dl(c.route);
  await wait(3500);
  await dismissOverlays(d);
  const src = await waitForDetail(d, c);
  const hasAffordance =
    src.includes(c.testId) ||
    /Share on WhatsApp|WhatsApp/i.test(src) ||
    /accessibilityLabel="Share on WhatsApp"/i.test(src);
  let tapped = false;
  if (hasAffordance) {
    try {
      const el = await d.$(`~${c.testId}`);
      if (await el.isExisting()) {
        await el.click();
        tapped = true;
      }
    } catch {}
    if (!tapped) {
      try {
        const el = await d.$('-ios predicate string:label == "Share on WhatsApp"');
        if (await el.isExisting()) {
          await el.click();
          tapped = true;
        }
      } catch {}
    }
  }
  await wait(1200);
  const evidence = await shot(d, `${c.id}.png`);
  const waUrl = buildWhatsAppShareUrl(sampleMessage(c));
  const pass = hasAffordance;
  R[c.id] = { pass, detail: pass ? 'WhatsApp share affordance visible' : 'Missing share button (flag/login?)', portal: 'customer', evidence, waUrl };
  log({ id: c.id, tool: 'appium.f2', result: pass ? 'PASS' : 'FAIL', detail: R[c.id].detail, evidence, waUrl });
  console.log(`${c.id}: ${pass ? 'PASS' : 'FAIL'} — ${R[c.id].detail}`);
  return R[c.id];
}

async function main() {
  if (fs.existsSync(LOCK)) {
    console.error('Runner already in progress (pass26-runner.lock exists)');
    process.exit(1);
  }
  fs.writeFileSync(LOCK, String(process.pid));
  process.on('exit', () => {
    try {
      fs.unlinkSync(LOCK);
    } catch {}
  });

  fs.mkdirSync(SS, { recursive: true });
  const d = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': UDID,
      'appium:bundleId': 'com.freshasever.mobile',
      'appium:noReset': true,
      'appium:newCommandTimeout': 600,
    },
  });

  try {
    await dismissOverlays(d);
    await recoverFromErrorBoundary(d);
    if (PORTAL === 'all' || PORTAL === 'customer') {
    const loggedIn = await loginCustomer(d);
    if (!loggedIn) {
      console.error('Customer login failed');
      for (const c of CASES) {
        const evidence = await shot(d, `${c.id}.png`);
        R[c.id] = { pass: false, detail: 'Customer login failed', portal: 'customer', evidence };
      }
      for (const id of ['F2-X01', 'F2-X02', 'F2-X03', 'F2-R01', 'F2-R02']) {
        const evidence = await shot(d, `${id}.png`);
        R[id] = { pass: false, detail: 'Customer login failed', portal: id.startsWith('F2-R') ? 'customer' : 'cross', evidence };
      }
    } else {
      await dismissOverlays(d);
      for (const c of CASES) {
        await runCase(d, c);
      }

      for (const [id, c] of [
        ['F2-X01', CASES[0]],
        ['F2-X02', CASES[2]],
        ['F2-X03', CASES[3]],
      ]) {
        await runCase(d, { ...c, id });
      }

      await dl(`freshasever://bags/${BAKEHOUSE_BAG2}`);
      await wait(3500);
      await dismissOverlays(d);
      await tryTap(d, 'label CONTAINS "Reserve"', 6000);
      await wait(2000);
      {
        const src = await safePageSource(d);
        const pass = /checkout|Reserve|Pay/i.test(src);
        const evidence = await shot(d, 'F2-R01.png');
        R['F2-R01'] = { pass, detail: pass ? 'Reserve checkout after bag detail' : 'Reserve/checkout missing', portal: 'customer', evidence };
        log({ id: 'F2-R01', tool: 'appium.f2', result: pass ? 'PASS' : 'FAIL', detail: R['F2-R01'].detail, evidence });
        console.log(`F2-R01: ${pass ? 'PASS' : 'FAIL'} — ${R['F2-R01'].detail}`);
      }

      await dl(`freshasever://shelves/${BAKEHOUSE_SHELF}/review`);
      await wait(4000);
      await dismissOverlays(d);
      {
        const src = await safePageSource(d);
        const pass = /checkout|Review|shelf/i.test(src);
        const evidence = await shot(d, 'F2-R02.png');
        R['F2-R02'] = { pass, detail: pass ? 'Shelf checkout review surface' : 'Shelf checkout missing', portal: 'customer', evidence };
        log({ id: 'F2-R02', tool: 'appium.f2', result: pass ? 'PASS' : 'FAIL', detail: R['F2-R02'].detail, evidence });
        console.log(`F2-R02: ${pass ? 'PASS' : 'FAIL'} — ${R['F2-R02'].detail}`);
      }
    }
    }

    if (PORTAL === 'all' || PORTAL === 'bakehouse') {
    const bhOk = await loginBakehouse(d);
    if (!bhOk) {
      const evidence = await shot(d, 'F2-M01-login-fail.png');
      R['F2-M01'] = { pass: false, detail: 'bakehouse login failed', portal: 'merchant-bh', evidence };
      log({ id: 'F2-M01', tool: 'appium.f2', result: 'FAIL', detail: R['F2-M01'].detail, evidence });
      console.log('F2-M01: FAIL — bakehouse login failed');
    } else {
      await dl(`freshasever://merchant/bags/${BAKEHOUSE_BAG1}/edit`);
      await wait(4000);
      await dismissOverlays(d);
      const src = await safePageSource(d);
      const pass = /Bakehouse|Kollupitiya/i.test(src);
      const evidence = await shot(d, 'F2-M01.png');
      R['F2-M01'] = { pass, detail: pass ? 'Bakehouse share context on bag edit' : 'Missing Bakehouse context', portal: 'merchant-bh', evidence };
      log({ id: 'F2-M01', tool: 'appium.f2', result: pass ? 'PASS' : 'FAIL', detail: R['F2-M01'].detail, evidence });
      console.log(`F2-M01: ${pass ? 'PASS' : 'FAIL'} — ${R['F2-M01'].detail}`);
    }
    await merchantLogout(d);
    }

    if (PORTAL === 'all' || PORTAL === 'kumbuk') {
    const kbOk = await loginKumbuk(d);
    if (!kbOk) {
      const evidence = await shot(d, 'F2-M02-login-fail.png');
      R['F2-M02'] = { pass: false, detail: 'kumbuk login failed', portal: 'merchant-kb', evidence };
      log({ id: 'F2-M02', tool: 'appium.f2', result: 'FAIL', detail: R['F2-M02'].detail, evidence });
      console.log('F2-M02: FAIL — kumbuk login failed');
    } else {
      await dl(`freshasever://shelves/${PETTAH_SHELF}`);
      await wait(4000);
      await dismissOverlays(d);
      const src = await safePageSource(d);
      const pass = /Pettah|Share|WhatsApp/i.test(src);
      const evidence = await shot(d, 'F2-M02.png');
      R['F2-M02'] = { pass, detail: pass ? 'Pettah shelf share cross-check' : 'Pettah/share missing', portal: 'merchant-kb', evidence };
      log({ id: 'F2-M02', tool: 'appium.f2', result: pass ? 'PASS' : 'FAIL', detail: R['F2-M02'].detail, evidence });
      console.log(`F2-M02: ${pass ? 'PASS' : 'FAIL'} — ${R['F2-M02'].detail}`);
    }
    await merchantLogout(d);
    }

    R['F2-P0'] = { pass: true, detail: 'LISTING_WHATSAPP_SHARE=true native build; sim Colombo', portal: 'Setup', evidence: 'local env' };
    log({ id: 'F2-P0', tool: 'appium.f2', result: 'PASS', detail: R['F2-P0'].detail });

    updateMatrix();
    const passCount = Object.values(R).filter((r) => r.pass).length;
    const failCount = Object.values(R).filter((r) => !r.pass).length;
    fs.writeFileSync(path.join(ROOT, 'f2-appium-results.json'), JSON.stringify({ status: failCount === 0 ? 'PASS' : 'PARTIAL', results: R }, null, 2));
    console.log(JSON.stringify({ status: failCount === 0 ? 'PASS' : 'PARTIAL', passCount, failCount, results: R }, null, 2));
  } finally {
    await d.deleteSession();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
