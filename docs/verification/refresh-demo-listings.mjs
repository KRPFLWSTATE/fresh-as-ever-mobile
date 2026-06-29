#!/usr/bin/env node
/**
 * Refresh demo rescue_bags + clearance_shelves pickup windows for QA.
 * Customer BagDetailScreen requires: status=live, quantity_remaining>0, pickup_end>now.
 * Discover shelves use pickup_end>now; nearby_bags RPC also respects open windows.
 *
 * Run before Appium / when demo windows age (~8h). Staging can also use DB cron:
 * `SELECT public.refresh_demo_staging_inventory();`
 *
 * Automated in dev: `npm run ios` and `npm run start` refresh via npm `pre*` hooks.
 * Skip with: `SKIP_DEMO_REFRESH=1 npm run ios`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(ROOT, '../../../fresh-as-ever/.env.local');
const F5_BASELINE = path.join(ROOT, 'pass26-expansion/baseline/f5-test-order.json');

/** Pass25/26 canonical demo IDs — keep in sync with pass26-expansion-runner.mjs */
export const QA_OUTLETS = {
  bakehouse: '00000000-0000-0000-0000-000000000003',
  kumbuk: '00000000-0000-0000-0000-000000000013',
  pettah: '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4',
  galleFace: 'b4884c9f-5a7c-41b0-af19-321c66f24dea',
};

export const QA_BAGS = {
  bakehouse1: '00000000-0000-0000-0000-000000000004',
  bakehouse2: '00000000-0000-0000-0000-000000000014',
  kumbuk: '00000000-0000-0000-0000-000000000105',
  pettah: '87e99daa-ef1f-494a-874d-da8a4abf40e3',
};

export const QA_SHELVES = {
  bakehouse: '00000000-0000-0000-0000-000000000201',
  pettah: '87e99daa-ef1f-494a-874d-da8a4abf40d3',
};

function loadEnv() {
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`Missing Supabase env in ${ENV_PATH}`);
  }
  return env;
}

async function rest(env, method, table, query, body) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${table} HTTP ${res.status}: ${text.slice(0, 320)}`);
  return text ? JSON.parse(text) : null;
}

function openNowWindow(hoursAhead = 6) {
  const now = Date.now();
  return {
    pickup_start: new Date(now - 30 * 60 * 1000).toISOString(),
    pickup_end: new Date(now + hoursAhead * 60 * 60 * 1000).toISOString(),
  };
}

async function refreshBags(env, window) {
  const canonicalIds = Object.values(QA_BAGS);
  const { pickup_start, pickup_end } = window;

  const seedRows = await rest(
    env,
    'GET',
    'rescue_bags',
    `seed_demo=eq.true&status=in.(live,draft)&select=id,status,quantity_remaining,quantity_total,outlet_id`,
    null,
  );

  const ids = new Set([
    ...canonicalIds,
    ...(seedRows ?? []).map((r) => r.id),
  ]);

  const updated = [];
  for (const id of ids) {
    const rows = await rest(env, 'GET', 'rescue_bags', `id=eq.${id}&select=id,title,status`, null);
    if (!rows?.length) continue;

    const seedRow = (seedRows ?? []).find((r) => r.id === id);
    const qtyRemaining = Math.max(5, Number(seedRow?.quantity_remaining ?? 5) || 5);
    const qtyTotal = Math.max(qtyRemaining, Number(seedRow?.quantity_total ?? qtyRemaining) || qtyRemaining);

    const patch = {
      pickup_start,
      pickup_end,
      status: 'live',
      quantity_remaining: qtyRemaining,
      quantity_total: qtyTotal,
      seed_demo: true,
    };

    await rest(env, 'PATCH', 'rescue_bags', `id=eq.${id}`, patch);
    updated.push({ id, title: rows[0].title, pickup_start, pickup_end });
  }
  return updated;
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

async function refreshShelfItems(env, shelfId) {
  const items = await rest(
    env,
    'GET',
    'clearance_shelf_items',
    `shelf_id=eq.${shelfId}&status=eq.live&select=id,quantity_remaining`,
    null,
  );
  const updated = [];
  for (const item of items ?? []) {
    const qty = Number(item.quantity_remaining ?? 0);
    if (qty >= 1) continue;
    await rest(env, 'PATCH', 'clearance_shelf_items', `id=eq.${item.id}`, {
      quantity_remaining: 3,
    });
    updated.push({ id: item.id, quantity_remaining: 3 });
  }
  return updated;
}

async function refreshShelves(env, window) {
  const { pickup_start, pickup_end } = window;
  const shelfDate = utcToday();
  const updated = [];
  for (const id of Object.values(QA_SHELVES)) {
    const rows = await rest(env, 'GET', 'clearance_shelves', `id=eq.${id}&select=id,status`, null);
    if (!rows?.length) continue;
    await rest(env, 'PATCH', 'clearance_shelves', `id=eq.${id}`, {
      pickup_start,
      pickup_end,
      shelf_date: shelfDate,
      status: 'published',
      seed_demo: true,
    });
    const items = await refreshShelfItems(env, id);
    updated.push({ id, pickup_start, pickup_end, shelf_date: shelfDate, items_updated: items.length });
  }
  return updated;
}

async function refreshF5Order(env, window) {
  if (!fs.existsSync(F5_BASELINE)) return null;
  const seed = JSON.parse(fs.readFileSync(F5_BASELINE, 'utf8'));
  const { pickup_start, pickup_end } = window;

  await rest(env, 'PATCH', 'orders', `id=eq.${seed.order_id}`, {
    customer_on_the_way_at: null,
    customer_arrived_at: null,
    order_status: 'reserved',
    payment_status: 'paid',
  });

  await rest(env, 'PATCH', 'rescue_bags', `id=eq.${seed.bag_id}`, { pickup_start, pickup_end });

  const orderRows = await rest(
    env,
    'GET',
    'orders',
    `id=eq.${seed.order_id}&select=id,group_id,reservation_code`,
    null,
  );
  const order = orderRows?.[0];
  if (order?.group_id) {
    await rest(env, 'PATCH', 'reservation_groups', `id=eq.${order.group_id}`, {
      pickup_start,
      pickup_end,
    });
  }

  const updated = {
    ...seed,
    seeded_at: new Date().toISOString(),
    pickup_start,
    pickup_end,
    order_status: 'reserved',
    payment_status: 'paid',
    reservation_code: order?.reservation_code || seed.reservation_code,
    refreshed_by: 'refresh-demo-listings.mjs',
  };
  fs.writeFileSync(F5_BASELINE, JSON.stringify(updated, null, 2) + '\n');
  return { order_id: seed.order_id, bag_id: seed.bag_id };
}

async function ensureOutlets(env) {
  for (const id of Object.values(QA_OUTLETS)) {
    await rest(env, 'PATCH', 'outlets', `id=eq.${id}`, {
      is_active: true,
      use_demo_listings: true,
    });
  }
}

async function main() {
  if (process.env.SKIP_DEMO_REFRESH === '1') {
    console.log('[refresh-demo] skipped (SKIP_DEMO_REFRESH=1)');
    return;
  }
  const env = loadEnv();
  const window = openNowWindow(8);
  await ensureOutlets(env);
  const bags = await refreshBags(env, window);
  const shelves = await refreshShelves(env, window);
  const f5 = await refreshF5Order(env, window);

  console.log(
    JSON.stringify(
      {
        ok: true,
        window,
        bags_updated: bags.length,
        bags,
        shelves_updated: shelves.length,
        shelves,
        f5,
        outlets: QA_OUTLETS,
        deeplinks: {
          bakehouse_bag1: `freshasever://bag/${QA_BAGS.bakehouse1}`,
          bakehouse_bag2: `freshasever://bag/${QA_BAGS.bakehouse2}`,
          kumbuk_bag: `freshasever://bag/${QA_BAGS.kumbuk}`,
          discover: 'freshasever://discover',
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  if (process.env.DEMO_REFRESH_SOFT === '1') {
    console.warn(
      `[refresh-demo] failed (continuing dev launch): ${e instanceof Error ? e.message : e}`,
    );
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});
