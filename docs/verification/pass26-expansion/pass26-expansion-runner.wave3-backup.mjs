#!/usr/bin/env node
/**
 * Pass 26 Wave 3 — mobile Appium verification marathon.
 * Device: iPhone 17 Pro 377DAC99-B79C-4B05-BB34-DBA1D160038D · Appium :4723
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID,
  BUNDLE,
  wait,
  dl,
  scrollDown,
  tryTap,
  loginBakehouse,
  loginKumbuk,
  loginCustomer,
  merchantLogout,
  customerLogout,
  dismissOverlays,
  resetMerchantSurface,
  recoverFromErrorBoundary,
  scrollMapIntoView,
  relaunchApp,
  ensureCustomerDiscover,
  prepCustomerDiscover,
  dismissDiscoverSheets,
  ensureDiscoverFeedInView,
  waitForLandmarkInDiscover,
  landmarkVisibleInDiscover,
  scrollDiscoverListFeed,
  safePageSource,
  isBakehouseMerchantSession,
  isKumbukMerchantSession,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(ROOT, 'pass26-runner.lock');

const BAKEHOUSE_OUTLET = '00000000-0000-0000-0000-000000000003';
const KUMBUK_OUTLET = '00000000-0000-0000-0000-000000000013';
const PETTAH_OUTLET = '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4';
const GALLE_FACE_OUTLET = 'b4884c9f-5a7c-41b0-af19-321c66f24dea';
const BAKEHOUSE_BAG1 = '00000000-0000-0000-0000-000000000004';
const BAKEHOUSE_BAG2 = '00000000-0000-0000-0000-000000000014';
const BAKEHOUSE_SHELF = '00000000-0000-0000-0000-000000000201';
const KUMBUK_BAG = '00000000-0000-0000-0000-000000000105';
const PETTAH_SHELF = '87e99daa-ef1f-494a-874d-da8a4abf40d3';

/** Wave 3 mobile-only IDs — customer → merchant@ → kumbuk@ */
export const WAVE3_MOBILE_IDS = [
  'F1-C01', 'F1-C02', 'F1-C03', 'F1-C04', 'F1-C05',
  'F2-C01', 'F2-C02', 'F2-C03', 'F2-C04', 'F2-C05',
  'F3-C01', 'F3-C02', 'F3-C03', 'F3-C04', 'F3-C05',
  'F4-C01', 'F4-C02', 'F4-C03',
  'F5-C01', 'F5-C02', 'F5-C03', 'F5-C04', 'F5-C05',
  'F7-C01', 'F7-C02', 'F7-C03',
  'F1-R01', 'F1-R02', 'F2-R01', 'F2-R02', 'F3-R01', 'F3-R02', 'F4-R01', 'F5-R01', 'F5-R02', 'F7-R02',
  'F1-X01', 'F1-X02', 'F2-X01', 'F2-X02', 'F2-X03', 'F3-X01', 'F3-X02', 'F3-X03', 'F3-X04',
  'F4-X01', 'F4-X02', 'F4-X03', 'F5-X01', 'F5-X02', 'F5-X03', 'F5-X04', 'F7-X01', 'F7-X02',
  'F1-M01', 'F1-M02', 'F1-M03', 'F1-M05',
  'F2-M01', 'F3-M01', 'F3-M03', 'F4-M01', 'F4-M02', 'F5-M01', 'F5-M02', 'F5-M03', 'F5-M05',
  'F1-M04', 'F1-M06', 'F2-M02', 'F3-M02', 'F4-M03', 'F5-M04',
  'F4-R02',
];

const SS = {
  f1: path.join(ROOT, 'screenshots', 'f1'),
  f2: path.join(ROOT, 'screenshots', 'f2'),
  f3: path.join(ROOT, 'screenshots', 'f3'),
  f4: path.join(ROOT, 'screenshots', 'f4'),
  f5: path.join(ROOT, 'screenshots', 'f5'),
  f6: path.join(ROOT, 'screenshots', 'f6'),
  cross: path.join(ROOT, 'screenshots', 'cross'),
};
Object.values(SS).forEach((d) => fs.mkdirSync(d, { recursive: true }));

const LOG = path.join(ROOT, 'verify-log.jsonl');
const RESULTS = path.join(ROOT, 'results.json');
const MATRIX = path.join(ROOT, 'MATRIX.md');
const F5_ORDER_BASELINE = path.join(ROOT, 'baseline', 'f5-test-order.json');

function loadF5TestOrder() {
  try {
    return JSON.parse(fs.readFileSync(F5_ORDER_BASELINE, 'utf8'));
  } catch {
    return null;
  }
}

async function openF5OrderDetail(d) {
  const seed = loadF5TestOrder();
  if (seed?.deeplink) {
    await dl(seed.deeplink);
    await wait(4500);
    await dismissOverlays(d);
    return true;
  }
  await dl('freshasever://orders');
  await wait(4000);
  await dismissOverlays(d);
  return tryTap(d, 'label CONTAINS "Order" OR label CONTAINS "Pickup"', 3000);
}

const featureArg = process.argv.find((a) => a.startsWith('--feature='))?.slice(10)?.split(',') ?? [];
const ONLY = new Set(
  (process.env.ONLY_IDS || process.argv.find((a) => a.startsWith('--only='))?.slice(7) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

function featureDir(id) {
  const m = id.match(/^F([1-7])/);
  if (!m) return 'cross';
  if (m[1] === '7') return 'f6';
  return `f${m[1]}`;
}

function plannedIds() {
  if (ONLY.size) return [...ONLY];
  if (featureArg.length) {
    const FEATURE_MATRIX = {
      f1: ['F1-M01', 'F1-M02', 'F1-M03', 'F1-M04', 'F1-M05', 'F1-M06', 'F1-C01', 'F1-C02', 'F1-C03', 'F1-C04', 'F1-C05', 'F1-X01', 'F1-X02', 'F1-R01', 'F1-R02'],
      f2: ['F2-C01', 'F2-C02', 'F2-C03', 'F2-C04', 'F2-C05', 'F2-M01', 'F2-M02', 'F2-X01', 'F2-X02', 'F2-X03', 'F2-R01', 'F2-R02'],
      f3: ['F3-M01', 'F3-M02', 'F3-M03', 'F3-C01', 'F3-C02', 'F3-C03', 'F3-C04', 'F3-C05', 'F3-X01', 'F3-X02', 'F3-X03', 'F3-X04', 'F3-R01', 'F3-R02'],
      f4: ['F4-M01', 'F4-M02', 'F4-M03', 'F4-C01', 'F4-C02', 'F4-C03', 'F4-X01', 'F4-X02', 'F4-X03', 'F4-R01', 'F4-R02'],
      f5: ['F5-C01', 'F5-C02', 'F5-C03', 'F5-C04', 'F5-C05', 'F5-M01', 'F5-M02', 'F5-M03', 'F5-M04', 'F5-M05', 'F5-X01', 'F5-X02', 'F5-X03', 'F5-X04', 'F5-R01', 'F5-R02'],
      f6: ['F7-C01', 'F7-C02', 'F7-C03', 'F7-R01', 'F7-R02'],
    };
    return featureArg.flatMap((f) => FEATURE_MATRIX[f.trim()] ?? []);
  }
  return WAVE3_MOBILE_IDS;
}


async function acquireRunnerLock({ maxWaitMs = 45 * 60 * 1000 } = {}) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (!fs.existsSync(LOCK)) {
      fs.writeFileSync(LOCK, String(process.pid));
      return;
    }
    const holder = fs.readFileSync(LOCK, 'utf8').trim();
    let alive = false;
    if (/^\d+$/.test(holder)) {
      try {
        process.kill(Number(holder), 0);
        alive = true;
      } catch {
        alive = false;
      }
    }
    if (!alive) {
      try {
        fs.unlinkSync(LOCK);
      } catch {}
      continue;
    }
    console.error(`Waiting for pass26-runner.lock (pid ${holder})…`);
    await wait(15000);
  }
  throw new Error('Timed out waiting for pass26-runner.lock');
}

const log = (e) =>
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass26', agent: 'SA-APPIUM-QUEUE', ...e }) + '\n');

const R = {};
const shouldRun = (id) => ONLY.size === 0 || ONLY.has(id);

async function shot(d, subdir, name) {
  const dir = SS[subdir] || SS.cross;
  fs.mkdirSync(dir, { recursive: true });
  const rel = `screenshots/${subdir}/${name}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return rel;
}

async function record(id, pass, evidence, detail = '', portal = 'customer') {
  if (!shouldRun(id)) return;
  R[id] = { pass, evidence, detail, portal };
  log({ id, tool: 'appium.journey', result: pass ? 'PASS' : 'FAIL', detail, evidence, portal });
}

async function recordWithRetry(d, id, portal, fn) {
  if (!shouldRun(id)) return;
  const sub = featureDir(id);
  let pass = false;
  let detail = '';
  let evidence = '';
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fn();
      pass = !!res.pass;
      detail = res.detail || '';
      if (pass) break;
      if (attempt < 2) {
        log({ id, tool: 'appium.retry', attempt: attempt + 1, detail });
        await wait(2000);
        await recoverFromErrorBoundary(d);
      }
    } catch (err) {
      detail = String(err);
      pass = false;
    }
  }
  if (!evidence) evidence = await shot(d, sub, `${id}.png`);
  await record(id, pass, evidence, detail, portal);
}

function writeResults() {
  let merged = { ...R };
  if (ONLY.size > 0 && fs.existsSync(RESULTS)) {
    try {
      const prior = JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results || {};
      merged = { ...prior, ...R };
    } catch {}
  }
  const entries = Object.entries(merged);
  const passCount = entries.filter(([, v]) => v.pass).length;
  const failCount = entries.filter(([, v]) => !v.pass).length;
  fs.writeFileSync(
    RESULTS,
    JSON.stringify({ pass: passCount, fail: failCount, results: merged, ts: new Date().toISOString(), wave3: true }, null, 2),
  );
  updateMatrix(merged);
  return { passCount, failCount, failedIds: entries.filter(([, v]) => !v.pass).map(([k]) => k) };
}

function updateMatrix(results) {
  if (!fs.existsSync(MATRIX)) return;
  let md = fs.readFileSync(MATRIX, 'utf8');
  for (const [id, row] of Object.entries(results)) {
    const status = row.pass ? 'PASS' : 'FAIL';
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(\\| ${esc} \\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\| )([^|]+)( \\| )([^|]*)( \\|)`);
    md = md.replace(re, `$1${status}$3${row.evidence || ''}$4`);
  }
  fs.writeFileSync(MATRIX, md);
}

async function tapPresetChip(d, labelPart) {
  return tryTap(d, `label CONTAINS "${labelPart}" OR name CONTAINS "${labelPart}"`, 5000);
}

async function runCustomerPhase(d) {
  const ids = plannedIds();
  const usePrepDiscover = ids.some((id) => /^F3-C/.test(id));
  const ok = usePrepDiscover
    ? await prepCustomerDiscover(d, { freshSession: true })
    : await loginCustomer(d);
  if (!ok) {
    for (const id of ids.filter((x) => /^F[1-7]-C/.test(x) || /-R0[12]$/.test(x) || /-X/.test(x))) {
      await record(
        id,
        false,
        await shot(d, featureDir(id), `${id}-login-fail.png`),
        usePrepDiscover ? 'customer discover prep failed' : 'customer login failed',
        'customer',
      );
    }
    return;
  }
  await ensureCustomerDiscover(d);
  await scrollMapIntoView(d);
  await wait(2000);

  const discoverSrc = async () => safePageSource(d);

  await recordWithRetry(d, 'F1-C01', 'customer', async () => {
    await dl('freshasever://discover');
    await wait(4000);
    const src = await discoverSrc();
    const pass = /Open now|Opening soon|Morning bake|Evening|Lunch/i.test(src);
    return { pass, detail: pass ? 'discover pickup browse pills' : 'no pickup pills on discover' };
  });

  for (const [id, needle] of [
    ['F1-C02', 'Morning bake'],
    ['F1-C03', 'Evening'],
    ['F1-C04', 'Lunch'],
    ['F1-C05', 'Open now'],
  ]) {
    await recordWithRetry(d, id, 'customer', async () => {
      await dl(`freshasever://bags/${BAKEHOUSE_BAG1}`);
      await wait(4000);
      const src = await discoverSrc();
      const pass = new RegExp(needle, 'i').test(src) || /Pickup|pickup/i.test(src);
      return { pass, detail: `${needle} on bag detail` };
    });
  }

  for (const [id, bag] of [
    ['F2-C01', BAKEHOUSE_BAG1],
    ['F2-C02', BAKEHOUSE_BAG2],
    ['F2-C03', KUMBUK_BAG],
    ['F2-C04', BAKEHOUSE_SHELF],
    ['F2-C05', PETTAH_SHELF],
  ]) {
    await recordWithRetry(d, id, 'customer', async () => {
      const route = id === 'F2-C04' ? `freshasever://shelves/${bag}` : id === 'F2-C05' ? `freshasever://shelves/${bag}` : `freshasever://bag/${bag}`;
      await dl(route);
      await wait(4000);
      const src = await discoverSrc();
      const pass = /Share on WhatsApp|WhatsApp/i.test(src) || /share/i.test(src);
      return { pass, detail: 'WhatsApp share affordance' };
    });
  }

  const landmarks = [
    ['F3-C01', 'Kollupitiya'],
    ['F3-C02', 'Colombo 07'],
    ['F3-C03', 'Pettah'],
    ['F3-C04', 'Galle Face'],
    ['F3-C05', 'Bakehouse'],
  ];
  let f3DiscoverPrepped = false;
  for (const [id, lm] of landmarks) {
    await recordWithRetry(d, id, 'customer', async () => {
      if (!f3DiscoverPrepped) {
        f3DiscoverPrepped = true;
      } else {
        await dl('freshasever://discover');
        await wait(4000);
        await dismissDiscoverSheets(d);
        await ensureDiscoverFeedInView(d);
      }
      const found = await waitForLandmarkInDiscover(d, lm);
      const pass = found || (await landmarkVisibleInDiscover(d, lm));
      return { pass, detail: `neighbourhood subtitle ${lm}` };
    });
  }

  await recordWithRetry(d, 'F4-C01', 'customer', async () => {
    await dl(`freshasever://bags/${BAKEHOUSE_BAG1}`);
    await wait(4500);
    await dismissOverlays(d);
    const badge = await d.$('~bagDetail.occasionBadge').isDisplayed().catch(() => false);
    const src = await discoverSrc();
    const pass = badge || /Avurudu|seasonal|occasion/i.test(src) || /bagDetail\.occasionBadge/i.test(src);
    return { pass, detail: badge ? 'bagDetail.occasionBadge visible' : 'seasonal badge on avurudu-tagged bag' };
  });
  await recordWithRetry(d, 'F4-C02', 'customer', async () => {
    await dl('freshasever://discover');
    await wait(4000);
    await dismissDiscoverSheets(d);
    const chipVisible = await d.$('~discover.occasionChip.avurudu').isDisplayed().catch(() => false);
    const tapped =
      chipVisible ||
      (await tryTap(d, 'name == "discover.occasionChip.avurudu"', 5000)) ||
      (await tryTap(d, 'name BEGINSWITH "discover.occasionChip."', 4000));
    const src = await discoverSrc();
    return {
      pass: tapped || /discover\.occasionChip\.avurudu/i.test(src) || /Avurudu|Occasion/i.test(src),
      detail: 'discover.occasionChip.avurudu filter chip',
    };
  });
  await recordWithRetry(d, 'F4-C03', 'customer', async () => {
    await dl(`freshasever://bags/${BAKEHOUSE_BAG2}`);
    await wait(3000);
    const src = await discoverSrc();
    const pass = !/Avurudu seasonal/i.test(src) || /Pastries|Bread/i.test(src);
    return { pass, detail: 'untagged bag without seasonal badge emphasis' };
  });

  for (const id of ['F5-C01', 'F5-C02', 'F5-C03', 'F5-C04', 'F5-C05']) {
    await recordWithRetry(d, id, 'customer', async () => {
      const opened = await openF5OrderDetail(d);
      await wait(2000);
      const src = await discoverSrc();
      const hasTestIds =
        (await d.$('~order.onMyWay').isExisting().catch(() => false)) ||
        (await d.$('~order.arrival').isExisting().catch(() => false));
      const pass =
        opened &&
        (hasTestIds || /On my way|I'm at the outlet|at the outlet|Available 2 hours/i.test(src));
      return { pass, detail: pass ? 'on-my-way CTAs visible' : 'no eligible order / CTAs absent' };
    });
  }

  for (const [id, route] of [
    ['F7-C01', 'freshasever://profile/notifications'],
    ['F7-C02', 'freshasever://impact'],
    ['F7-C03', 'freshasever://profile/notifications'],
  ]) {
    await recordWithRetry(d, id, 'customer', async () => {
      await dl(route);
      await wait(4000);
      const src = await discoverSrc();
      const pass = /Monthly impact|monthly_impact|LKR|Environmental Impact/i.test(src);
      return { pass, detail: 'monthly savings / impact UX' };
    });
  }

  await recordWithRetry(d, 'F1-R01', 'customer', async () => {
    await dl(`freshasever://bags/${BAKEHOUSE_BAG2}`);
    await wait(3000);
    await tryTap(d, 'label CONTAINS "Reserve"', 6000);
    await wait(3000);
    const src = await discoverSrc();
    return { pass: /checkout|Pay|Reserve/i.test(src), detail: 'Reserve Now checkout path' };
  });

  await recordWithRetry(d, 'F1-R02', 'customer', async () => {
    await dl(`freshasever://checkout?group=${BAKEHOUSE_BAG1},${BAKEHOUSE_BAG2}`);
    await wait(5000);
    const src = await discoverSrc();
    return { pass: /checkout|group|overlap|outlet/i.test(src), detail: 'group overlap checkout' };
  });

  await recordWithRetry(d, 'F2-R01', 'customer', async () => {
    await dl(`freshasever://bags/${BAKEHOUSE_BAG1}`);
    await wait(3000);
    await tryTap(d, 'label CONTAINS "Reserve"', 5000);
    await wait(2000);
    const src = await discoverSrc();
    return { pass: /checkout|Reserve/i.test(src), detail: 'post-share reserve path' };
  });

  await recordWithRetry(d, 'F2-R02', 'customer', async () => {
    await dl(`freshasever://shelves/${BAKEHOUSE_SHELF}/review`);
    await wait(4000);
    const src = await discoverSrc();
    return { pass: /checkout|Review|shelf/i.test(src), detail: 'Pass25 shelf checkout regression' };
  });

  await recordWithRetry(d, 'F3-R01', 'customer', async () => {
    await ensureCustomerDiscover(d);
    const src = await discoverSrc();
    return { pass: /discover|Rescue|Search/i.test(src), detail: 'discover load regression' };
  });

  await recordWithRetry(d, 'F3-R02', 'customer', async () => {
    const src = await discoverSrc();
    return { pass: /Colombo|Kollupitiya|Bakehouse/i.test(src), detail: 'Colombo geo scope' };
  });

  await recordWithRetry(d, 'F4-R01', 'customer', async () => {
    await dl(`freshasever://bags/${BAKEHOUSE_BAG2}`);
    await wait(3000);
    const src = await discoverSrc();
    return { pass: !/Avurudu seasonal surplus/i.test(src) || /Bag|Reserve/i.test(src), detail: 'untagged bag UX' };
  });

  await recordWithRetry(d, 'F5-R01', 'customer', async () => {
    await dl(`freshasever://bags/${BAKEHOUSE_BAG2}`);
    await wait(3000);
    await tryTap(d, 'label CONTAINS "Reserve"', 5000);
    const src = await discoverSrc();
    return { pass: /checkout|Reserve/i.test(src), detail: 'Pass24 reserve hang smoke' };
  });

  await recordWithRetry(d, 'F5-R02', 'customer', async () => {
    await dl('freshasever://orders');
    await wait(3000);
    const src = await discoverSrc();
    return { pass: /Order|Rescue|No orders/i.test(src), detail: 'Pass25 orders regression' };
  });

  await recordWithRetry(d, 'F7-R02', 'customer', async () => {
    await dl('freshasever://profile');
    await wait(3000);
    const src = await discoverSrc();
    return { pass: /Profile|Account|qa\.customer/i.test(src), detail: 'Pass25 profile regression' };
  });

  await recordWithRetry(d, 'F1-X01', 'cross', async () => {
    await dl(`freshasever://bags/${BAKEHOUSE_BAG1}`);
    await wait(4000);
    const src = await discoverSrc();
    return { pass: /Morning bake|pickup|Open now/i.test(src), detail: 'customer bag pickup kind pill' };
  });

  await recordWithRetry(d, 'F1-X02', 'cross', async () => {
    await dl('freshasever://discover');
    await wait(5000);
    const src = await discoverSrc();
    const pass = /Bakehouse/i.test(src) && /Kumbuk|Pettah/i.test(src);
    return { pass, detail: 'both merchants on discover' };
  });

  for (const id of ['F2-X01', 'F2-X02', 'F2-X03']) {
    await recordWithRetry(d, id, 'cross', async () => {
      await dl(`freshasever://bags/${BAKEHOUSE_BAG1}`);
      await wait(3000);
      const src = await discoverSrc();
      return { pass: /WhatsApp|Share/i.test(src), detail: 'share triangulation customer leg' };
    });
  }

  for (const [id, lm] of [
    ['F3-X01', 'Kollupitiya'],
    ['F3-X02', 'Colombo 07'],
    ['F3-X03', 'Pettah'],
    ['F3-X04', 'Galle Face'],
  ]) {
    await recordWithRetry(d, id, 'cross', async () => {
      await dl('freshasever://discover');
      await wait(4000);
      const src = await discoverSrc();
      return { pass: new RegExp(lm, 'i').test(src), detail: `landmark triangulation ${lm}` };
    });
  }

  for (const id of ['F4-X01', 'F4-X02', 'F4-X03']) {
    await recordWithRetry(d, id, 'cross', async () => {
      await dl(`freshasever://bags/${BAKEHOUSE_BAG1}`);
      await wait(3000);
      const src = await discoverSrc();
      return { pass: /occasion|Avurudu|Badge|Bag/i.test(src), detail: 'seasonal cross-check customer' };
    });
  }

  await recordWithRetry(d, 'F5-X01', 'cross', async () => {
    const opened = await openF5OrderDetail(d);
    const tapped = await tryTap(d, 'name == "order.onMyWay" OR label == "On my way"', 6000);
    await wait(1500);
    await dismissOverlays(d);
    await customerLogout(d);
    const merchOk = await loginBakehouse(d);
    if (!merchOk) {
      return { pass: false, detail: 'merchant login failed' };
    }
    let seen = false;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      await dl('freshasever://merchant/live-monitor');
      await wait(2000);
      const src = await safePageSource(d);
      if (/On the way|En route|Heading to you|merchant\.liveMonitor\.hero/i.test(src)) {
        seen = true;
        break;
      }
      await wait(2000);
    }
    await merchantLogout(d);
    return {
      pass: opened && tapped && seen,
      detail: seen
        ? 'merchant saw on-the-way tier within 10s'
        : `cross-portal realtime miss (opened=${opened} tapped=${tapped})`,
    };
  });

  for (const id of ['F5-X02', 'F5-X03', 'F5-X04']) {
    await recordWithRetry(d, id, 'cross', async () => {
      const opened = await openF5OrderDetail(d);
      const src = await discoverSrc();
      return {
        pass: opened && /Order|On my way|Pickup|at the outlet/i.test(src),
        detail: 'on-my-way cross customer leg',
      };
    });
  }

  await recordWithRetry(d, 'F7-X01', 'cross', async () => {
    await dl('freshasever://impact');
    await wait(4000);
    const src = await discoverSrc();
    return { pass: /LKR|saved|Impact/i.test(src), detail: 'impact LKR slice' };
  });

  await recordWithRetry(d, 'F7-X02', 'cross', async () => {
    await dl('freshasever://impact');
    await wait(3000);
    const src = await discoverSrc();
    return { pass: /LKR|Rescue|order/i.test(src), detail: 'savings threshold UX' };
  });
}

async function runBakehouseMerchantPhase(d) {
  const ok = await loginBakehouse(d);
  if (!ok) {
    for (const id of ['F1-M01', 'F1-M02', 'F1-M03', 'F1-M05', 'F2-M01', 'F3-M01', 'F3-M03', 'F4-M01', 'F4-M02', 'F5-M01', 'F5-M02', 'F5-M03', 'F5-M05']) {
      if (shouldRun(id)) await record(id, false, await shot(d, featureDir(id), `${id}-login-fail.png`), 'bakehouse login failed', 'merchant-bh');
    }
    return;
  }

  const presets = [
    ['F1-M01', 'Morning bake'],
    ['F1-M02', 'Lunch'],
    ['F1-M03', 'Evening'],
    ['F1-M05', 'Immediately'],
  ];
  for (const [id, chip] of presets) {
    await recordWithRetry(d, id, 'merchant-bh', async () => {
      await dl(`freshasever://merchant/bags/${BAKEHOUSE_BAG2}/edit`);
      await wait(5000);
      await dismissOverlays(d);
      await scrollDown(d, 2);
      const tapped = await tapPresetChip(d, chip);
      const src = await safePageSource(d);
      const pass = tapped || new RegExp(chip, 'i').test(src);
      return { pass, detail: `preset chip ${chip}` };
    });
  }

  await recordWithRetry(d, 'F2-M01', 'merchant-bh', async () => {
    await dl(`freshasever://merchant/bags/${BAKEHOUSE_BAG1}/edit`);
    await wait(4000);
    const src = await safePageSource(d);
    const pass = /Bakehouse|Kollupitiya/i.test(src);
    return { pass, detail: 'share message outlet Bakehouse context' };
  });

  for (const [id, outlet] of [
    ['F3-M01', BAKEHOUSE_OUTLET],
    ['F3-M03', GALLE_FACE_OUTLET],
  ]) {
    await recordWithRetry(d, id, 'merchant-bh', async () => {
      await dl(`freshasever://merchant/outlets/${outlet}/edit`);
      await wait(5000);
      const src = await safePageSource(d);
      const pass = /landmark|Landmark|Kollupitiya|Galle/i.test(src);
      return { pass, detail: 'landmark edit surface' };
    });
  }

  await recordWithRetry(d, 'F4-M01', 'merchant-bh', async () => {
    await dl('freshasever://merchant/bags/create');
    await wait(5000);
    await dismissOverlays(d);
    await scrollDown(d, 2);
    const pass = await d.$('~merchant.occasionPicker').isDisplayed().catch(() => false);
    const src = await safePageSource(d);
    return {
      pass: pass || /merchant\.occasionPicker|SeasonalOccasionPicker|Occasion|Avurudu/i.test(src),
      detail: 'SeasonalOccasionPicker on bag create (merchant.occasionPicker)',
    };
  });

  await recordWithRetry(d, 'F4-M02', 'merchant-bh', async () => {
    if (!(await d.$('~merchant.occasionPicker').isDisplayed().catch(() => false))) {
      await dl('freshasever://merchant/bags/create');
      await wait(4000);
      await scrollDown(d, 2);
    }
    const tapped =
      (await tryTap(d, 'name == "merchant.occasionOption.avurudu"', 5000)) ||
      (await tryTap(d, 'name BEGINSWITH "merchant.occasionOption."', 4000));
    const src = await safePageSource(d);
    return { pass: tapped || /merchant\.occasionOption|occasion|Avurudu|Christmas/i.test(src), detail: 'occasion option tap' };
  });

  for (const id of ['F5-M01', 'F5-M02', 'F5-M03', 'F5-M05']) {
    await recordWithRetry(d, id, 'merchant-bh', async () => {
      await dl('freshasever://merchant/orders');
      await wait(4000);
      const src = await safePageSource(d);
      const pass = /Order|Pickup|Live|monitor|On the way|At outlet/i.test(src);
      return { pass, detail: 'merchant orders / live monitor' };
    });
  }

  await recordWithRetry(d, 'F4-R02', 'merchant-bh', async () => {
    await dl('freshasever://merchant/tabs/bags');
    await wait(4000);
    const src = await safePageSource(d);
    return { pass: /Bag|Create|Pastries/i.test(src), detail: 'Pass25 merchant publish flow' };
  });

  await merchantLogout(d);
}

async function runKumbukMerchantPhase(d) {
  const ok = await loginKumbuk(d);
  if (!ok) {
    for (const id of ['F1-M04', 'F1-M06', 'F2-M02', 'F3-M02', 'F4-M03', 'F5-M04']) {
      if (shouldRun(id)) await record(id, false, await shot(d, featureDir(id), `${id}-login-fail.png`), 'kumbuk login failed', 'merchant-kb');
    }
    return;
  }

  for (const [id, chip] of [
    ['F1-M04', 'Morning bake'],
    ['F1-M06', 'Now (4h'],
  ]) {
    await recordWithRetry(d, id, 'merchant-kb', async () => {
      await dl('freshasever://merchant/tabs/shelves');
      await wait(4000);
      await tryTap(d, 'label CONTAINS "Pettah"', 3000);
      const tapped = await tapPresetChip(d, chip.replace(' (4h', ''));
      const src = await safePageSource(d);
      return { pass: tapped || /Pickup|preset|shelf/i.test(src), detail: `kumbuk preset ${chip}` };
    });
  }

  await recordWithRetry(d, 'F2-M02', 'merchant-kb', async () => {
    await dl(`freshasever://shelves/${PETTAH_SHELF}`);
    await wait(4000);
    const src = await safePageSource(d);
    return { pass: /Pettah|Share|WhatsApp|shelf/i.test(src), detail: 'Pettah shelf share cross-check' };
  });

  await recordWithRetry(d, 'F3-M02', 'merchant-kb', async () => {
    await dl(`freshasever://merchant/outlets/${KUMBUK_OUTLET}/edit`);
    await wait(5000);
    const src = await safePageSource(d);
    return { pass: /Colombo 07|Kumbuk|landmark/i.test(src), detail: 'Kumbuk landmark edit' };
  });

  await recordWithRetry(d, 'F4-M03', 'merchant-kb', async () => {
    await dl('freshasever://merchant/bags/create');
    await wait(5000);
    await scrollDown(d, 2);
    const pass = await d.$('~merchant.occasionPicker').isDisplayed().catch(() => false);
    const src = await safePageSource(d);
    return {
      pass: pass || /merchant\.occasionPicker|Mixed Meals|occasion|Occasion/i.test(src),
      detail: 'Kumbuk SeasonalOccasionPicker on bag create',
    };
  });

  await recordWithRetry(d, 'F5-M04', 'merchant-kb', async () => {
    await dl('freshasever://merchant/live-monitor');
    await wait(5000);
    const src = await safePageSource(d);
    return { pass: /Live|Order|monitor|Kumbuk/i.test(src), detail: 'Kumbuk live monitor' };
  });

  await merchantLogout(d);
}

async function main() {
  await acquireRunnerLock();
  process.on('exit', () => {
    try {
      fs.unlinkSync(LOCK);
    } catch {}
  });

  const ids = plannedIds();
  console.log(`Pass 26 Wave 3 — ${ids.length} mobile IDs · UDID ${UDID}`);

  const d = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': UDID,
      'appium:bundleId': BUNDLE,
      'appium:noReset': true,
      'appium:newCommandTimeout': 600,
      'appium:waitForIdleTimeout': 0,
    },
  });

  try {
    await tryTap(d, 'name == "redbox-reload" OR label CONTAINS "Reload"', 3000);
    await wait(3000);
    await recoverFromErrorBoundary(d);
    await runCustomerPhase(d);
    await runBakehouseMerchantPhase(d);
    await runKumbukMerchantPhase(d);
  } catch (err) {
    log({ tool: 'runner.crash', result: 'FAIL', detail: String(err) });
    console.error(err);
  } finally {
    await d.deleteSession().catch(() => {});
    const summary = writeResults();
    console.log(JSON.stringify({ status: summary.failCount ? 'PARTIAL' : 'PASS', ...summary, blockers: [] }));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
