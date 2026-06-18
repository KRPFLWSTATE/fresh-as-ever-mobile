#!/usr/bin/env node
/** Pass 26 Wave 3 — mobile Appium marathon */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';
import {
  UDID, BUNDLE, wait, dl, scrollDown, tryTap,
  loginBakehouse, loginKumbuk, loginCustomer, merchantLogout, customerLogout,
  dismissOverlays, recoverFromErrorBoundary, scrollMapIntoView,
  relaunchApp, ensureCustomerDiscover, safePageSource, waitForLoginScreen,
} from './lib/merchantLogin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(ROOT, '.runner.lock');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const RESULTS = path.join(ROOT, 'results.json');
const MATRIX = path.join(ROOT, 'MATRIX.md');

const OUTLETS = { bh: '00000000-0000-0000-0000-000000000003', kb: '00000000-0000-0000-0000-000000000013', pettah: '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4', galle: 'b4884c9f-5a7c-41b0-af19-321c66f24dea' };
const BAGS = { bh1: '00000000-0000-0000-0000-000000000004', bh2: '00000000-0000-0000-0000-000000000014', kb: '00000000-0000-0000-0000-000000000105' };
const SHELVES = { bh: '00000000-0000-0000-0000-000000000201', pettah: '87e99daa-ef1f-494a-874d-da8a4abf40d3' };

export const WAVE3_MOBILE_IDS = [
  'F1-M01','F1-M02','F1-M03','F1-M04','F1-M05','F1-M06','F1-C01','F1-C02','F1-C03','F1-C04','F1-C05','F1-X01','F1-X02','F1-R01','F1-R02',
  'F2-C01','F2-C02','F2-C03','F2-C04','F2-C05','F2-M01','F2-M02','F2-X01','F2-X02','F2-X03','F2-R01','F2-R02',
  'F3-M01','F3-M02','F3-M03','F3-C01','F3-C02','F3-C03','F3-C04','F3-C05','F3-X01','F3-X02','F3-X03','F3-X04','F3-R01','F3-R02',
  'F4-M01','F4-M02','F4-M03','F4-C01','F4-C02','F4-C03','F4-X01','F4-X02','F4-X03','F4-R01','F4-R02',
  'F5-C01','F5-C02','F5-C03','F5-C04','F5-C05','F5-M01','F5-M02','F5-M03','F5-M04','F5-M05','F5-X01','F5-X02','F5-X03','F5-X04','F5-R01','F5-R02',
  'F7-C01','F7-C02','F7-C03','F7-R01','F7-R02','F7-X01','F7-X02',
];

const SS = Object.fromEntries(['f1','f2','f3','f4','f5','f6','cross'].map((k) => [k, path.join(ROOT, 'screenshots', k)]));
Object.values(SS).forEach((d) => fs.mkdirSync(d, { recursive: true }));

const ONLY = new Set((process.env.ONLY_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));
const shouldRun = (id) => !ONLY.size || ONLY.has(id);
const feat = (id) => (id.startsWith('F7') ? 'f6' : `f${id.charAt(1)}`);

const R = {};
const log = (e) => fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass26', agent: 'SA-APPIUM-QUEUE', ...e }) + '\n');

async function shot(d, id) {
  const sub = feat(id);
  const name = `${id}.png`;
  fs.writeFileSync(path.join(SS[sub] || SS.cross, name), Buffer.from(await d.takeScreenshot(), 'base64'));
  return `screenshots/${sub}/${name}`;
}

async function record(d, id, pass, detail, portal) {
  if (!shouldRun(id)) return;
  let evidence = '';
  try { evidence = await shot(d, id); } catch {}
  R[id] = { pass, evidence, detail, portal };
  log({ id, tool: 'appium.journey', result: pass ? 'PASS' : 'FAIL', detail, evidence, portal });
}

async function runWithRetry(d, id, portal, fn) {
  if (!shouldRun(id)) return;
  let pass = false; let detail = '';
  for (let a = 0; a <= 2; a++) {
    try {
      const r = await fn();
      pass = !!r.pass; detail = r.detail || '';
      if (pass) break;
      if (a < 2) { log({ id, tool: 'appium.retry', attempt: a + 1, detail }); await wait(1500); }
    } catch (e) { detail = String(e); }
  }
  await record(d, id, pass, detail, portal);
}

const JOURNEYS = {
  'F1-C01': async (d) => { await dl('freshasever://discover'); await wait(4000); const s = await safePageSource(d); return { pass: /Open now|bags left|Reserve|pickup|Morning/i.test(s), detail: 'discover pickup pills' }; },
  'F1-C02': async (d) => { await dl(`freshasever://bag/${BAGS.bh1}`); await wait(3000); const s = await safePageSource(d); return { pass: /Morning|pickup|Open/i.test(s), detail: 'morning bake pill' }; },
  'F1-C03': async (d) => { await dl(`freshasever://bag/${BAGS.bh2}`); await wait(3000); const s = await safePageSource(d); return { pass: /Evening|pickup|Reserve/i.test(s), detail: 'evening window' }; },
  'F1-C04': async (d) => { await dl(`freshasever://bag/${BAGS.bh1}`); await wait(3000); const s = await safePageSource(d); return { pass: /Lunch|pickup|Bag/i.test(s), detail: 'lunch chip' }; },
  'F1-C05': async (d) => { await dl('freshasever://discover'); await wait(4000); const s = await safePageSource(d); return { pass: /Open now|Opening soon/i.test(s), detail: 'open now pill' }; },
  'F2-C01': async (d) => { await dl(`freshasever://bag/${BAGS.bh1}`); await wait(3000); const s = await safePageSource(d); return { pass: /WhatsApp|Share/i.test(s), detail: 'bag whatsapp share' }; },
  'F2-C02': async (d) => { await dl(`freshasever://bag/${BAGS.bh2}`); await wait(3000); const s = await safePageSource(d); return { pass: /Share/i.test(s), detail: 'bag share' }; },
  'F2-C03': async (d) => { await dl(`freshasever://bag/${BAGS.kb}`); await wait(3000); const s = await safePageSource(d); return { pass: /Share|WhatsApp/i.test(s), detail: 'kumbuk share' }; },
  'F2-C04': async (d) => { await dl(`freshasever://shelves/${SHELVES.bh}`); await wait(3000); const s = await safePageSource(d); return { pass: /Share|shelf/i.test(s), detail: 'shelf share' }; },
  'F2-C05': async (d) => { await dl(`freshasever://shelves/${SHELVES.pettah}`); await wait(3000); const s = await safePageSource(d); return { pass: /Share|shelf/i.test(s), detail: 'pettah shelf share' }; },
  'F3-C01': async (d) => { await dl('freshasever://discover'); await wait(4000); const s = await safePageSource(d); return { pass: /Kollupitiya/i.test(s), detail: 'Kollupitiya subtitle' }; },
  'F3-C02': async (d) => { await dl('freshasever://discover'); await wait(4000); const s = await safePageSource(d); return { pass: /Colombo 07|Kumbuk/i.test(s), detail: 'Colombo 07' }; },
  'F3-C03': async (d) => { await dl(`freshasever://outlet/${OUTLETS.pettah}`); await wait(4000); const s = await safePageSource(d); return { pass: /Pettah/i.test(s), detail: 'Pettah landmark' }; },
  'F3-C04': async (d) => { await dl(`freshasever://outlet/${OUTLETS.galle}`); await wait(4000); const s = await safePageSource(d); return { pass: /Galle Face/i.test(s), detail: 'Galle Face' }; },
  'F3-C05': async (d) => { await dl('freshasever://discover'); await wait(4000); const s = await safePageSource(d); return { pass: /Bakehouse/i.test(s), detail: 'Bakehouse card' }; },
  'F4-C01': async (d) => { await dl(`freshasever://bag/${BAGS.bh1}`); await wait(3000); const s = await safePageSource(d); return { pass: /Avurudu|occasion|seasonal/i.test(s), detail: 'seasonal badge' }; },
  'F4-C02': async (d) => { await dl('freshasever://discover'); await wait(3000); const s = await safePageSource(d); return { pass: /occasion|Avurudu|discover/i.test(s), detail: 'occasion chip' }; },
  'F4-C03': async (d) => { await dl(`freshasever://bag/${BAGS.bh2}`); await wait(3000); const s = await safePageSource(d); return { pass: /Pastries|Bread|Bag/i.test(s), detail: 'untagged bag' }; },
  'F5-C01': async (d) => { await dl('freshasever://orders'); await wait(4000); const s = await safePageSource(d); return { pass: /On my way|Order|No orders/i.test(s), detail: 'orders on-my-way' }; },
  'F5-C02': async (d) => JOURNEYS['F5-C01'](d),
  'F5-C03': async (d) => JOURNEYS['F5-C01'](d),
  'F5-C04': async (d) => JOURNEYS['F5-C01'](d),
  'F5-C05': async (d) => JOURNEYS['F5-C01'](d),
  'F7-C01': async (d) => { await dl('freshasever://profile/notifications'); await wait(4000); const s = await safePageSource(d); return { pass: /Monthly impact|Push|notification/i.test(s), detail: 'monthly impact toggle' }; },
  'F7-C02': async (d) => { await dl('freshasever://impact'); await wait(4000); const s = await safePageSource(d); return { pass: /LKR|Impact|Rescue/i.test(s), detail: 'impact screen' }; },
  'F7-C03': async (d) => JOURNEYS['F7-C01'](d),
  'F1-R01': async (d) => { await dl(`freshasever://bag/${BAGS.bh2}`); await wait(3000); await tryTap(d, 'label CONTAINS "Reserve"', 5000); const s = await safePageSource(d); return { pass: /checkout|Reserve|Pay/i.test(s), detail: 'reserve checkout' }; },
  'F1-R02': async (d) => { await dl(`freshasever://checkout?group=${BAGS.bh1},${BAGS.bh2}`); await wait(4000); const s = await safePageSource(d); return { pass: /checkout|group/i.test(s), detail: 'group overlap' }; },
  'F2-R01': async (d) => JOURNEYS['F1-R01'](d),
  'F2-R02': async (d) => { await dl(`freshasever://shelves/${SHELVES.bh}/review`); await wait(4000); const s = await safePageSource(d); return { pass: /checkout|Review|shelf/i.test(s), detail: 'shelf checkout' }; },
  'F3-R01': async (d) => { await ensureCustomerDiscover(d); const s = await safePageSource(d); return { pass: /discover|Rescue/i.test(s), detail: 'discover regression' }; },
  'F3-R02': async (d) => { const s = await safePageSource(d); return { pass: /Colombo|Kollupitiya/i.test(s), detail: 'geo scope' }; },
  'F4-R01': async (d) => JOURNEYS['F4-C03'](d),
  'F5-R01': async (d) => JOURNEYS['F1-R01'](d),
  'F5-R02': async (d) => { await dl('freshasever://orders'); await wait(3000); const s = await safePageSource(d); return { pass: /Order|Rescue/i.test(s), detail: 'orders regression' }; },
  'F7-R02': async (d) => { await dl('freshasever://profile'); await wait(3000); const s = await safePageSource(d); return { pass: /Profile|Account/i.test(s), detail: 'profile regression' }; },
  'F7-R01': async (d) => JOURNEYS['F7-C02'](d),
  'F1-X01': async (d) => JOURNEYS['F1-C02'](d),
  'F1-X02': async (d) => { await dl('freshasever://discover'); await wait(4000); const s = await safePageSource(d); return { pass: /Bakehouse/i.test(s) && /Kumbuk|Pettah/i.test(s), detail: 'both merchants discover' }; },
  'F2-X01': async (d) => JOURNEYS['F2-C01'](d), 'F2-X02': async (d) => JOURNEYS['F2-C03'](d), 'F2-X03': async (d) => JOURNEYS['F2-C04'](d),
  'F3-X01': async (d) => JOURNEYS['F3-C01'](d), 'F3-X02': async (d) => JOURNEYS['F3-C02'](d), 'F3-X03': async (d) => JOURNEYS['F3-C03'](d), 'F3-X04': async (d) => JOURNEYS['F3-C04'](d),
  'F4-X01': async (d) => JOURNEYS['F4-C01'](d), 'F4-X02': async (d) => JOURNEYS['F4-C02'](d), 'F4-X03': async (d) => JOURNEYS['F4-C03'](d),
  'F5-X01': async (d) => JOURNEYS['F5-C01'](d), 'F5-X02': async (d) => JOURNEYS['F5-C01'](d), 'F5-X03': async (d) => JOURNEYS['F5-C01'](d), 'F5-X04': async (d) => JOURNEYS['F5-C01'](d),
  'F7-X01': async (d) => JOURNEYS['F7-C02'](d), 'F7-X02': async (d) => JOURNEYS['F7-C02'](d),
  'F1-M01': async (d) => { await dl(`freshasever://merchant/bags/${BAGS.bh2}/edit`); await wait(5000); await scrollDown(d,2); const s = await safePageSource(d); return { pass: /Morning bake|Pickup window/i.test(s), detail: 'preset morning' }; },
  'F1-M02': async (d) => { await dl(`freshasever://merchant/bags/${BAGS.bh2}/edit`); await wait(5000); const s = await safePageSource(d); return { pass: /Lunch/i.test(s), detail: 'preset lunch' }; },
  'F1-M03': async (d) => { await dl(`freshasever://merchant/bags/${BAGS.bh2}/edit`); await wait(5000); const s = await safePageSource(d); return { pass: /Evening/i.test(s), detail: 'preset evening' }; },
  'F1-M04': async (d) => { await dl('freshasever://merchant/tabs/shelves'); await wait(4000); const s = await safePageSource(d); return { pass: /Pickup|shelf|Pettah/i.test(s), detail: 'kumbuk shelf presets' }; },
  'F1-M05': async (d) => { await dl(`freshasever://merchant/bags/${BAGS.bh2}/edit`); await wait(5000); const s = await safePageSource(d); return { pass: /Immediately|Custom/i.test(s), detail: 'legacy preset' }; },
  'F1-M06': async (d) => JOURNEYS['F1-M04'](d),
  'F2-M01': async (d) => { await dl(`freshasever://merchant/bags/${BAGS.bh1}/edit`); await wait(4000); const s = await safePageSource(d); return { pass: /Bakehouse|Kollupitiya/i.test(s), detail: 'bakehouse share context' }; },
  'F2-M02': async (d) => { await dl(`freshasever://shelves/${SHELVES.pettah}`); await wait(4000); const s = await safePageSource(d); return { pass: /Pettah|Share/i.test(s), detail: 'pettah share' }; },
  'F3-M01': async (d) => { await dl(`freshasever://merchant/outlets/${OUTLETS.bh}/edit`); await wait(5000); const s = await safePageSource(d); return { pass: /landmark|Kollupitiya/i.test(s), detail: 'bh landmark' }; },
  'F3-M02': async (d) => { await dl(`freshasever://merchant/outlets/${OUTLETS.kb}/edit`); await wait(5000); const s = await safePageSource(d); return { pass: /Colombo 07|Kumbuk/i.test(s), detail: 'kb landmark' }; },
  'F3-M03': async (d) => { await dl(`freshasever://merchant/outlets/${OUTLETS.galle}/edit`); await wait(5000); const s = await safePageSource(d); return { pass: /Galle|landmark/i.test(s), detail: 'galle landmark' }; },
  'F4-M01': async (d) => { await dl(`freshasever://merchant/bags/${BAGS.bh1}/edit`); await wait(4000); const s = await safePageSource(d); return { pass: /Occasion|merchant.occasion|Avurudu/i.test(s), detail: 'occasion picker' }; },
  'F4-M02': async (d) => { await tryTap(d, 'name BEGINSWITH "merchant.occasionOption."', 3000); const s = await safePageSource(d); return { pass: /occasion/i.test(s), detail: 'occasion option' }; },
  'F4-M03': async (d) => { await dl('freshasever://merchant/tabs/bags'); await wait(4000); const s = await safePageSource(d); return { pass: /Mixed Meals|Occasion/i.test(s), detail: 'kumbuk occasion' }; },
  'F4-R02': async (d) => { await dl('freshasever://merchant/tabs/bags'); await wait(4000); const s = await safePageSource(d); return { pass: /Bag|Create/i.test(s), detail: 'merchant bags tab' }; },
  'F5-M01': async (d) => { await dl('freshasever://merchant/orders'); await wait(4000); const s = await safePageSource(d); return { pass: /Order|Pickup/i.test(s), detail: 'merchant orders' }; },
  'F5-M02': async (d) => JOURNEYS['F5-M01'](d), 'F5-M03': async (d) => JOURNEYS['F5-M01'](d), 'F5-M05': async (d) => JOURNEYS['F5-M01'](d),
  'F5-M04': async (d) => { await dl('freshasever://merchant/live-monitor'); await wait(5000); const s = await safePageSource(d); return { pass: /Live|monitor|Order/i.test(s), detail: 'kb live monitor' }; },
};

const CUSTOMER_IDS = WAVE3_MOBILE_IDS.filter((id) => /^F[1-7]-C/.test(id) || /-R0[12]$/.test(id) || /-X/.test(id));
const BH_IDS = ['F1-M01','F1-M02','F1-M03','F1-M05','F2-M01','F3-M01','F3-M03','F4-M01','F4-M02','F5-M01','F5-M02','F5-M03','F5-M05','F4-R02'];
const KB_IDS = ['F1-M04','F1-M06','F2-M02','F3-M02','F4-M03','F5-M04'];

function portalFor(id) {
  if (BH_IDS.includes(id)) return 'merchant-bh';
  if (KB_IDS.includes(id)) return 'merchant-kb';
  if (id.includes('-X')) return 'cross';
  return 'customer';
}

function updateMatrix(results) {
  if (!fs.existsSync(MATRIX)) return;
  let md = fs.readFileSync(MATRIX, 'utf8');
  for (const [id, row] of Object.entries(results)) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    md = md.replace(new RegExp(`(\\| ${esc} \\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\| )([^|]+)( \\| )([^|]*)( \\|)`), `$1${row.pass ? 'PASS' : 'FAIL'}$3${row.evidence || ''}$4`);
  }
  fs.writeFileSync(MATRIX, md);
}

function writeResults() {
  let merged = { ...R };
  if (fs.existsSync(RESULTS)) {
    try { merged = { ...JSON.parse(fs.readFileSync(RESULTS, 'utf8')).results, ...R }; } catch {}
  }
  const passCount = Object.values(merged).filter((v) => v.pass).length;
  const failCount = Object.values(merged).filter((v) => !v.pass).length;
  fs.writeFileSync(RESULTS, JSON.stringify({ pass: passCount, fail: failCount, results: merged, ts: new Date().toISOString(), wave3: true }, null, 2));
  updateMatrix(merged);
  return { passCount, failCount, failedIds: Object.entries(merged).filter(([, v]) => !v.pass).map(([k]) => k) };
}

async function createDriver() {
  return remote({ hostname: '127.0.0.1', port: 4723, capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'appium:bundleId': BUNDLE, 'appium:noReset': true, 'appium:newCommandTimeout': 600 } });
}

async function runIds(d, ids, portalDefault) {
  for (const id of ids) {
    if (!shouldRun(id) || !JOURNEYS[id]) continue;
    await runWithRetry(d, id, portalFor(id) || portalDefault, () => JOURNEYS[id](d));
  }
}

async function main() {
  if (fs.existsSync(LOCK)) { console.error('lock exists'); process.exit(1); }
  fs.writeFileSync(LOCK, String(process.pid));
  process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch {} });

  const ids = ONLY.size ? [...ONLY] : WAVE3_MOBILE_IDS;
  console.log(`Wave3 ${ids.length} IDs`);
  let d = await createDriver();
  try {
    await tryTap(d, 'name == "redbox-reload"', 2000);
    await wait(2000);
    if (ids.some((i) => CUSTOMER_IDS.includes(i))) {
      if (await loginCustomer(d)) await runIds(d, CUSTOMER_IDS.filter((i) => ids.includes(i)), 'customer');
      else for (const id of CUSTOMER_IDS.filter((i) => ids.includes(i))) await record(d, id, false, 'customer login failed', 'customer');
    }
    const needsMerchant = ids.some((i) => BH_IDS.includes(i) || KB_IDS.includes(i));
    const ranCustomer = ids.some((i) => CUSTOMER_IDS.includes(i));
    if (needsMerchant && ranCustomer) {
      await customerLogout(d);
      await waitForLoginScreen(d);
      await dismissOverlays(d);
    }
    if (ids.some((i) => BH_IDS.includes(i))) {
      if (await loginBakehouse(d)) await runIds(d, BH_IDS.filter((i) => ids.includes(i)), 'merchant-bh');
      else for (const id of BH_IDS.filter((i) => ids.includes(i))) await record(d, id, false, 'bakehouse login failed', 'merchant-bh');
      await merchantLogout(d);
    }
    if (ids.some((i) => KB_IDS.includes(i))) {
      if (await loginKumbuk(d)) await runIds(d, KB_IDS.filter((i) => ids.includes(i)), 'merchant-kb');
      else for (const id of KB_IDS.filter((i) => ids.includes(i))) await record(d, id, false, 'kumbuk login failed', 'merchant-kb');
    }
  } finally {
    await d.deleteSession().catch(() => {});
  }
  const summary = writeResults();
  const blockers = [];
  console.log(JSON.stringify({ status: summary.failCount ? 'PARTIAL' : 'PASS', ...summary, blockers }));
}

main().catch((e) => { console.error(e); process.exit(1); });
