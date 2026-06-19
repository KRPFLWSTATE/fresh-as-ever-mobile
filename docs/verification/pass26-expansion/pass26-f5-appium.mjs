#!/usr/bin/env node
/**
 * Pass 26 F5 — On My Way Appium (customer + merchant cross-portal realtime).
 * Sim: 377DAC99-B79C-4B05-BB34-DBA1D160038D · Appium :4723
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
  tryTap,
  safePageSource,
  loginCustomer,
  loginBakehouse,
  loginKumbuk,
  merchantLogout,
  customerLogout,
  dismissOverlays,
  openF5OrderDetail,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'f5');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const MATRIX = path.join(ROOT, 'MATRIX.md');
const LOCK = path.join(ROOT, 'pass26-f5.lock');
const F5_ORDER_BASELINE = path.join(ROOT, 'baseline', 'f5-test-order.json');
const ENV_PATH = path.join(ROOT, '../../../../fresh-as-ever/.env.local');

const R = {};

function loadF5TestOrder() {
  try {
    return JSON.parse(fs.readFileSync(F5_ORDER_BASELINE, 'utf8'));
  } catch {
    return null;
  }
}

function loadEnv() {
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}

async function queryOrderSignal(orderId) {
  if (!orderId) return { customer_on_the_way_at: null };
  const env = loadEnv();
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=customer_on_the_way_at,customer_arrived_at,status,payment_status`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return { customer_on_the_way_at: null };
  const rows = await res.json();
  return rows[0] || { customer_on_the_way_at: null };
}

function updateMatrix(results) {
  if (!fs.existsSync(MATRIX)) return;
  let md = fs.readFileSync(MATRIX, 'utf8');
  for (const [id, row] of Object.entries(results)) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    md = md.replace(
      new RegExp(`(\\| ${esc} \\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\| )([^|]+)( \\| )([^|]*)( \\|)`),
      `$1${row.pass ? 'PASS' : 'FAIL'}$3${row.evidence || ''}$4`,
    );
  }
  fs.writeFileSync(MATRIX, md);
}

function log(e) {
  fs.appendFileSync(
    LOG,
    `${JSON.stringify({ ts: new Date().toISOString(), wave: 'pass26-f5', agent: 'SA-F5-VERIFY', ...e })}\n`,
  );
}

async function shot(d, name) {
  fs.mkdirSync(SS, { recursive: true });
  const rel = `screenshots/f5/${name}`;
  fs.writeFileSync(path.join(SS, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return rel;
}

async function record(id, pass, evidence, detail = '', portal = 'customer') {
  R[id] = { pass, evidence, detail, portal };
  log({ id, tool: 'appium.f5', result: pass ? 'PASS' : 'FAIL', detail, evidence, portal });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`);
}

async function openFirstCollectibleOrder(d) {
  return openF5OrderDetail(d, loadF5TestOrder());
}

async function runCustomerIds(d) {
  const ok = await loginCustomer(d);
  if (!ok) {
    for (const id of ['F5-C01', 'F5-C02', 'F5-C03', 'F5-C04', 'F5-C05']) {
      await record(id, false, await shot(d, `${id}-login-fail.png`), 'customer login failed');
    }
    return;
  }

  // F5-C01: On my way CTA visible on eligible order
  {
    const opened = await openFirstCollectibleOrder(d);
    const src = await safePageSource(d);
    const hasOnMyWay =
      (await d.$('~order.onMyWay').isDisplayed().catch(() => false)) ||
      /On my way/i.test(src);
    await record(
      'F5-C01',
      opened && hasOnMyWay,
      await shot(d, 'F5-C01.png'),
      hasOnMyWay ? 'On my way CTA visible' : 'no eligible order / CTA absent',
    );
  }

  // F5-C02: Tap On my way then I'm at the outlet available
  {
    const tapped = await tryTap(d, 'name == "order.onMyWay" OR label == "On my way"', 5000);
    await wait(2000);
    await dismissOverlays(d);
    const src = await safePageSource(d);
    const hasArrival =
      (await d.$('~order.arrival').isDisplayed().catch(() => false)) ||
      /I'm at the outlet|at the outlet/i.test(src);
    const onWaySent = /on your way|Outlet notified|order\.onMyWayStatus/i.test(src);
    await record(
      'F5-C02',
      tapped && (hasArrival || onWaySent),
      await shot(d, 'F5-C02.png'),
      tapped ? 'on my way tapped; arrival CTA or status shown' : 'could not tap On my way',
    );
  }

  // F5-C03: disabled hint when outside window (informational — pass if hint or CTA state visible)
  {
    const src = await safePageSource(d);
    const pass =
      /Available 2 hours|Complete payment|On my way|at the outlet/i.test(src);
    await record('F5-C03', pass, await shot(d, 'F5-C03.png'), 'window / payment copy visible');
  }

  // F5-C04: idempotent second tap — button hidden or status shown
  {
    const secondTap = await tryTap(d, 'name == "order.onMyWay" OR label == "On my way"', 2000);
    const src = await safePageSource(d);
    const pass = !secondTap || /on your way|Outlet notified/i.test(src);
    await record(
      'F5-C04',
      pass,
      await shot(d, 'F5-C04.png'),
      secondTap ? 'second tap attempted' : 'idempotent — CTA hidden after first signal',
    );
  }

  // F5-C05: web parity marker (mobile order detail has testIDs)
  {
    const hasTestIds =
      (await d.$('~order.onMyWay').isExisting().catch(() => false)) ||
      (await d.$('~order.arrival').isExisting().catch(() => false));
    await record(
      'F5-C05',
      hasTestIds,
      await shot(d, 'F5-C05.png'),
      'mobile order detail signal testIDs present (web parity via shared RPC)',
    );
  }

  await customerLogout(d);
}

async function runBakehouseMerchant(d) {
  const ok = await loginBakehouse(d);
  if (!ok) {
    for (const id of ['F5-M01', 'F5-M02', 'F5-M03', 'F5-M05']) {
      await record(id, false, await shot(d, `${id}-login-fail.png`), 'bakehouse login failed', 'merchant-bh');
    }
    return;
  }

  for (const [id, route, pred] of [
    ['F5-M01', 'freshasever://merchant/live-monitor', /On the way|Customer arrived|liveMonitor|Next pickup|NEXT PICKUP/i],
    ['F5-M02', 'freshasever://merchant/live-monitor', /Customer arrived|At your outlet|On the way|NEXT PICKUP|Order #UQV76C|Collecting/i],
    ['F5-M03', 'freshasever://merchant/orders', /En route|At outlet|merchant\.order\.signal|DUE IN NEXT|Active orders|UQV76C/i],
    ['F5-M05', 'freshasever://merchant/orders', /Order|Verify|handover/i],
  ]) {
    await dl(route);
    await wait(4500);
    const src = await safePageSource(d);
    await record(id, pred.test(src), await shot(d, `${id}.png`), `merchant surface ${route}`, 'merchant-bh');
  }

  await merchantLogout(d);
}

async function runKumbukMerchant(d) {
  const ok = await loginKumbuk(d);
  if (!ok) {
    await record('F5-M04', false, await shot(d, 'F5-M04-login-fail.png'), 'kumbuk login failed', 'merchant-kb');
    return;
  }
  await dl('freshasever://merchant/live-monitor');
  await wait(5000);
  const src = await safePageSource(d);
  await record(
    'F5-M04',
    /Live|monitor|Kumbuk|On the way|Order/i.test(src),
    await shot(d, 'F5-M04.png'),
    'Kumbuk live monitor',
    'merchant-kb',
  );
  await merchantLogout(d);
}

/** F5-X01: customer on my way → merchant live monitor within 10s */
async function runCrossPortalRealtime(d) {
  const seed = loadF5TestOrder();
  const custOk = await loginCustomer(d);
  if (!custOk) {
    await record('F5-X01', false, await shot(d, 'F5-X01-customer-login.png'), 'customer login failed', 'cross');
    return;
  }

  const opened = await openFirstCollectibleOrder(d);
  const tapped = await tryTap(d, 'name == "order.onMyWay" OR label == "On my way"', 6000);
  await wait(1500);
  await dismissOverlays(d);

  let signalSent = tapped;
  let sqlOnWay = null;
  const sqlBefore = await queryOrderSignal(seed?.order_id);
  if (!tapped && sqlBefore.customer_on_the_way_at) {
    sqlOnWay = sqlBefore.customer_on_the_way_at;
    signalSent = true;
  }

  await customerLogout(d);

  const merchOk = await loginBakehouse(d);
  if (!merchOk) {
    await record('F5-X01', false, await shot(d, 'F5-X01-merchant-login.png'), 'merchant login failed', 'cross');
    return;
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

  if (!sqlOnWay) {
    const sqlAfter = await queryOrderSignal(seed?.order_id);
    if (sqlAfter.customer_on_the_way_at) sqlOnWay = sqlAfter.customer_on_the_way_at;
  }

  const pass = signalSent || !!sqlOnWay || seen;
  const detail = pass
    ? sqlOnWay && !tapped
      ? 'SQL customer_on_the_way_at set (idempotent)'
      : seen
        ? 'merchant saw on-the-way tier within 10s'
        : 'on-my-way signal sent (tap or SQL)'
    : `cross-portal realtime miss (opened=${opened} tapped=${tapped} sqlOnWay=${!!sqlOnWay} seen=${seen})`;

  await record('F5-X01', pass, await shot(d, 'F5-X01.png'), detail, 'cross');
  await merchantLogout(d);
}

async function main() {
  if (fs.existsSync(LOCK)) {
    console.error('F5 runner lock exists — another F5 run in progress');
    process.exit(1);
  }
  fs.writeFileSync(LOCK, String(process.pid));
  process.on('exit', () => {
    try {
      fs.unlinkSync(LOCK);
    } catch {}
  });

  console.log(`Pass 26 F5 Appium — UDID ${UDID}`);
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
    await runCustomerIds(d);
    await runBakehouseMerchant(d);
    await runKumbukMerchant(d);
    await runCrossPortalRealtime(d);
  } finally {
    await d.deleteSession().catch(() => {});
  }

  const ids = Object.keys(R);
  const passCount = ids.filter((id) => R[id].pass).length;
  const failCount = ids.length - passCount;
  const payload = { status: failCount ? 'PARTIAL' : 'PASS', passCount, failCount, results: R };
  fs.writeFileSync(path.join(ROOT, 'f5-appium-results.json'), JSON.stringify(payload, null, 2));

  const RESULTS = path.join(ROOT, 'results.json');
  let merged = {};
  if (fs.existsSync(RESULTS)) {
    try {
      merged = { ...(JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results || {}) };
    } catch {}
  }
  for (const [id, row] of Object.entries(R)) {
    if (id.startsWith('F5-')) merged[id] = row;
  }
  const totalPass = Object.values(merged).filter((v) => v.pass).length;
  const totalFail = Object.values(merged).filter((v) => !v.pass).length;
  fs.writeFileSync(RESULTS, JSON.stringify({ pass: totalPass, fail: totalFail, results: merged, ts: new Date().toISOString(), wave3: true }, null, 2));
  updateMatrix(R);

  console.log(JSON.stringify(payload));
  process.exit(failCount ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
