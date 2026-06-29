#!/usr/bin/env node
/**
 * Refresh demo rescue_bags + clearance_shelves pickup windows for QA.
 * Customer BagDetailScreen requires: status=live, quantity_remaining>0, pickup_end>now.
 * Discover shelves use pickup_end>now; nearby_bags RPC also respects open windows.
 *
 * Scenario windows populate merchant Orders sub-tabs (verification, live-monitor,
 * late-pickups, review-pending). Past-window scenario bags stay off Discover.
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

/** QA customer — qa.customer@freshasever.test */
export const QA_CUSTOMER_ID = '571aadc0-d2e6-43bf-bab7-03a35ce3ef7f';

/**
 * Dedicated scenario bags — one window kind per bag (stable IDs from demo migrations).
 * IN_WINDOW_WIDE / ENDING_SOON bags remain customer-discoverable (pickup_end > now).
 */
export const QA_SCENARIO_BAGS = {
  IN_WINDOW_WIDE: {
    id: QA_BAGS.bakehouse1,
    outlet_id: QA_OUTLETS.bakehouse,
    title: '[Demo] Surprise Pastries Bag',
  },
  ENDING_SOON: {
    id: QA_BAGS.bakehouse2,
    outlet_id: QA_OUTLETS.bakehouse,
    title: '[Demo] Evening Bread Rescue',
  },
  LATE_RECENT: {
    id: '00000000-0000-0000-0000-000000000101',
    outlet_id: QA_OUTLETS.bakehouse,
    title: '[Demo] Bakery Croissant Box',
  },
  LATE_CRITICAL: {
    id: '00000000-0000-0000-0000-000000000102',
    outlet_id: QA_OUTLETS.kumbuk,
    title: 'Cafe Sandwich & Latte Combo',
  },
  FUTURE: {
    id: '00000000-0000-0000-0000-000000000103',
    outlet_id: QA_OUTLETS.kumbuk,
    title: 'Restaurant Rice & Curry Pack',
  },
};

/** Discover-only bags — always IN_WINDOW_WIDE so customer flows stay open. */
export const QA_DISCOVER_BAGS = [QA_BAGS.kumbuk, QA_BAGS.pettah];

/**
 * Idempotent scenario orders for merchant Orders sub-tab QA.
 * Pickup window is inherited from the linked bag (or shelf).
 */
export const QA_SCENARIO_ORDERS = {
  IN_WINDOW_WIDE: {
    id: 'a1ba7758-7290-4ece-804d-15585f7da9eb',
    scenario: 'IN_WINDOW_WIDE',
    bag_id: QA_BAGS.bakehouse1,
    outlet_id: QA_OUTLETS.bakehouse,
    order_status: 'reserved',
    payment_status: 'paid',
    reservation_code: 'UQV76C',
    unit_price: 650,
    total: 650,
    merchant_tab: 'verification',
  },
  ENDING_SOON: {
    id: '00000000-0000-0000-0000-000000000301',
    scenario: 'ENDING_SOON',
    bag_id: QA_BAGS.bakehouse2,
    outlet_id: QA_OUTLETS.bakehouse,
    order_status: 'reserved',
    payment_status: 'paid',
    reservation_code: 'END2HR',
    unit_price: 750,
    total: 750,
    merchant_tab: 'live-monitor',
  },
  LATE_RECENT: {
    id: '00000000-0000-0000-0000-000000000302',
    scenario: 'LATE_RECENT',
    bag_id: QA_SCENARIO_BAGS.LATE_RECENT.id,
    outlet_id: QA_OUTLETS.bakehouse,
    order_status: 'reserved',
    payment_status: 'paid',
    reservation_code: 'LATREC',
    unit_price: 600,
    total: 600,
    merchant_tab: 'late-pickups (recent)',
  },
  LATE_CRITICAL: {
    id: '00000000-0000-0000-0000-000000000303',
    scenario: 'LATE_CRITICAL',
    bag_id: QA_SCENARIO_BAGS.LATE_CRITICAL.id,
    outlet_id: QA_OUTLETS.kumbuk,
    order_status: 'reserved',
    payment_status: 'paid',
    reservation_code: 'LATCRT',
    unit_price: 650,
    total: 650,
    merchant_tab: 'late-pickups (critical / no-show)',
  },
  FUTURE_UNPAID: {
    id: '00000000-0000-0000-0000-000000000304',
    scenario: 'FUTURE',
    bag_id: QA_SCENARIO_BAGS.FUTURE.id,
    outlet_id: QA_OUTLETS.kumbuk,
    order_status: 'reserved',
    payment_status: 'pending',
    reservation_code: 'FUTURE',
    unit_price: 750,
    total: 750,
    merchant_tab: 'review-pending',
  },
};

/**
 * Idempotent 2-bag group for merchant group-handover E2E (code DV387Y).
 * Child orders use null reservation_code — code lives on the group row.
 */
export const QA_SCENARIO_GROUP = {
  id: '00000000-0000-0000-0000-000000000400',
  reservation_code: 'DV387Y',
  outlet_id: QA_OUTLETS.bakehouse,
  scenario: 'IN_WINDOW_WIDE',
  child_orders: [
    {
      id: '00000000-0000-0000-0000-000000000321',
      bag_id: QA_BAGS.bakehouse1,
      unit_price: 650,
      total: 650,
    },
    {
      id: '00000000-0000-0000-0000-000000000322',
      bag_id: QA_BAGS.bakehouse2,
      unit_price: 750,
      total: 750,
    },
  ],
};

/** Shelf window overrides — bakehouse shelf carries FUTURE for upcoming pickup QA. */
export const QA_SCENARIO_SHELVES = {
  bakehouse: 'FUTURE',
  pettah: 'IN_WINDOW_WIDE',
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

async function rest(env, method, table, query, body, prefer) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: prefer ?? 'return=representation',
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${table} HTTP ${res.status}: ${text.slice(0, 320)}`);
  return text ? JSON.parse(text) : null;
}

/** Scenario pickup windows — relative to now so merchant sub-tabs stay populated. */
export function scenarioWindows(nowMs = Date.now()) {
  return {
    IN_WINDOW_WIDE: {
      pickup_start: new Date(nowMs - 60 * 60 * 1000).toISOString(),
      pickup_end: new Date(nowMs + 6 * 60 * 60 * 1000).toISOString(),
    },
    ENDING_SOON: {
      pickup_start: new Date(nowMs - 30 * 60 * 1000).toISOString(),
      pickup_end: new Date(nowMs + 90 * 60 * 1000).toISOString(),
    },
    LATE_RECENT: {
      pickup_start: new Date(nowMs - 90 * 60 * 1000).toISOString(),
      pickup_end: new Date(nowMs - 10 * 60 * 1000).toISOString(),
    },
    LATE_CRITICAL: {
      pickup_start: new Date(nowMs - 3 * 60 * 60 * 1000).toISOString(),
      pickup_end: new Date(nowMs - 45 * 60 * 1000).toISOString(),
    },
    FUTURE: {
      pickup_start: new Date(nowMs + 3 * 60 * 60 * 1000).toISOString(),
      pickup_end: new Date(nowMs + 7 * 60 * 60 * 1000).toISOString(),
    },
  };
}

function windowForBag(bagId, windows) {
  for (const [kind, meta] of Object.entries(QA_SCENARIO_BAGS)) {
    if (meta.id === bagId) return { kind, ...windows[kind] };
  }
  if (QA_DISCOVER_BAGS.includes(bagId)) {
    return { kind: 'IN_WINDOW_WIDE', ...windows.IN_WINDOW_WIDE };
  }
  return { kind: 'IN_WINDOW_WIDE', ...windows.IN_WINDOW_WIDE };
}

async function refreshBags(env, windows) {
  const scenarioBagIds = new Set(Object.values(QA_SCENARIO_BAGS).map((b) => b.id));
  const canonicalIds = new Set([
    ...Object.values(QA_BAGS),
    ...scenarioBagIds,
  ]);

  const seedRows = await rest(
    env,
    'GET',
    'rescue_bags',
    `seed_demo=eq.true&status=in.(live,draft)&select=id,status,quantity_remaining,quantity_total,outlet_id`,
    null,
  );

  for (const row of seedRows ?? []) {
    canonicalIds.add(row.id);
  }

  const updated = [];
  for (const id of canonicalIds) {
    const rows = await rest(env, 'GET', 'rescue_bags', `id=eq.${id}&select=id,title,status`, null);
    if (!rows?.length) continue;

    const seedRow = (seedRows ?? []).find((r) => r.id === id);
    const qtyRemaining = Math.max(5, Number(seedRow?.quantity_remaining ?? 5) || 5);
    const qtyTotal = Math.max(qtyRemaining, Number(seedRow?.quantity_total ?? qtyRemaining) || qtyRemaining);
    const { kind, pickup_start, pickup_end } = windowForBag(id, windows);

    const patch = {
      pickup_start,
      pickup_end,
      status: 'live',
      quantity_remaining: qtyRemaining,
      quantity_total: qtyTotal,
      seed_demo: true,
    };

    await rest(env, 'PATCH', 'rescue_bags', `id=eq.${id}`, patch);
    updated.push({ id, title: rows[0].title, scenario: kind, pickup_start, pickup_end });
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

function shelfScenarioKind(shelfKey) {
  return QA_SCENARIO_SHELVES[shelfKey] ?? 'IN_WINDOW_WIDE';
}

async function refreshShelves(env, windows) {
  const shelfDate = utcToday();
  const updated = [];
  for (const [key, id] of Object.entries(QA_SHELVES)) {
    const rows = await rest(env, 'GET', 'clearance_shelves', `id=eq.${id}&select=id,status`, null);
    if (!rows?.length) continue;

    const kind = shelfScenarioKind(key);
    const { pickup_start, pickup_end } = windows[kind];

    await rest(env, 'PATCH', 'clearance_shelves', `id=eq.${id}`, {
      pickup_start,
      pickup_end,
      shelf_date: shelfDate,
      status: 'published',
      seed_demo: true,
    });
    const items = await refreshShelfItems(env, id);
    updated.push({
      id,
      scenario: kind,
      pickup_start,
      pickup_end,
      shelf_date: shelfDate,
      items_updated: items.length,
    });
  }
  return updated;
}

async function upsertScenarioOrder(env, spec, windows) {
  const { pickup_start, pickup_end } = windows[spec.scenario];
  const existing = await rest(
    env,
    'GET',
    'orders',
    `id=eq.${spec.id}&select=id,reservation_code,group_id`,
    null,
  );

  const orderBody = {
    id: spec.id,
    bag_id: spec.bag_id,
    customer_id: QA_CUSTOMER_ID,
    outlet_id: spec.outlet_id,
    quantity: 1,
    unit_price: spec.unit_price,
    subtotal: spec.unit_price,
    platform_fee: 0,
    total: spec.total,
    payment_method: spec.payment_status === 'paid' ? 'card' : 'cash',
    payment_status: spec.payment_status,
    order_status: spec.order_status,
    reservation_code: spec.reservation_code,
    customer_on_the_way_at: null,
    customer_arrived_at: null,
    collected_at: null,
  };

  let order;
  if (existing?.length) {
    const [row] = await rest(env, 'PATCH', 'orders', `id=eq.${spec.id}`, orderBody);
    order = row ?? existing[0];
  } else {
    const [row] = await rest(env, 'POST', 'orders', '', orderBody);
    order = row;
  }

  if (order?.group_id) {
    await rest(env, 'PATCH', 'reservation_groups', `id=eq.${order.group_id}`, {
      pickup_start,
      pickup_end,
    });
  }

  return {
    id: spec.id,
    scenario: spec.scenario,
    merchant_tab: spec.merchant_tab,
    bag_id: spec.bag_id,
    outlet_id: spec.outlet_id,
    order_status: spec.order_status,
    payment_status: spec.payment_status,
    reservation_code: order?.reservation_code ?? spec.reservation_code,
    pickup_start,
    pickup_end,
  };
}

async function refreshScenarioOrders(env, windows) {
  const refreshed = [];
  for (const spec of Object.values(QA_SCENARIO_ORDERS)) {
    refreshed.push(await upsertScenarioOrder(env, spec, windows));
  }
  return refreshed;
}

/** Rename legacy groups that steal single-order codes (UQV76C) from scenario orders. */
async function sanitizeConflictingGroupCodes(env, keepGroupId) {
  for (const code of ['UQV76C', 'DV387Y']) {
    const rows = await rest(
      env,
      'GET',
      'reservation_groups',
      `reservation_code=eq.${code}&select=id,reservation_code`,
      null,
    );
    for (const row of rows ?? []) {
      if (row.id === keepGroupId) continue;
      const suffix = String(row.id).slice(-4).toUpperCase();
      await rest(env, 'PATCH', 'reservation_groups', `id=eq.${row.id}`, {
        reservation_code: `X${suffix}`,
        order_status: 'collected',
      });
    }
  }
}

async function refreshScenarioGroup(env, windows) {
  const spec = QA_SCENARIO_GROUP;
  const { pickup_start, pickup_end } = windows[spec.scenario];
  await sanitizeConflictingGroupCodes(env, spec.id);

  const subtotal = spec.child_orders.reduce((sum, c) => sum + c.unit_price, 0);
  const groupBody = {
    id: spec.id,
    reservation_code: spec.reservation_code,
    customer_id: QA_CUSTOMER_ID,
    outlet_id: spec.outlet_id,
    bag_count: spec.child_orders.length,
    subtotal,
    discount_amount: 0,
    total: subtotal,
    payment_method: 'card',
    payment_status: 'paid',
    order_status: 'reserved',
    pickup_start,
    pickup_end,
  };

  const existingGroup = await rest(
    env,
    'GET',
    'reservation_groups',
    `id=eq.${spec.id}&select=id`,
    null,
  );
  if (existingGroup?.length) {
    await rest(env, 'PATCH', 'reservation_groups', `id=eq.${spec.id}`, groupBody);
  } else {
    await rest(env, 'POST', 'reservation_groups', '', groupBody);
  }

  const children = [];
  for (const child of spec.child_orders) {
    const orderBody = {
      id: child.id,
      bag_id: child.bag_id,
      customer_id: QA_CUSTOMER_ID,
      outlet_id: spec.outlet_id,
      group_id: spec.id,
      quantity: 1,
      unit_price: child.unit_price,
      subtotal: child.unit_price,
      platform_fee: 0,
      total: child.total,
      payment_method: 'card',
      payment_status: 'paid',
      order_status: 'reserved',
      reservation_code: spec.reservation_code,
      customer_on_the_way_at: null,
      customer_arrived_at: null,
      collected_at: null,
    };
    const existing = await rest(
      env,
      'GET',
      'orders',
      `id=eq.${child.id}&select=id`,
      null,
    );
    if (existing?.length) {
      await rest(env, 'PATCH', 'orders', `id=eq.${child.id}`, orderBody);
    } else {
      await rest(env, 'POST', 'orders', '', orderBody);
    }
    children.push({ id: child.id, bag_id: child.bag_id });
  }

  return {
    id: spec.id,
    reservation_code: spec.reservation_code,
    outlet_id: spec.outlet_id,
    order_status: 'reserved',
    payment_status: 'paid',
    pickup_start,
    pickup_end,
    child_orders: children,
  };
}

async function refreshF5Order(env, windows) {
  if (!fs.existsSync(F5_BASELINE)) return null;
  const seed = JSON.parse(fs.readFileSync(F5_BASELINE, 'utf8'));
  const f5Spec = QA_SCENARIO_ORDERS.IN_WINDOW_WIDE;
  const { pickup_start, pickup_end } = windows.IN_WINDOW_WIDE;

  const result = await upsertScenarioOrder(env, f5Spec, windows);

  const updated = {
    ...seed,
    seeded_at: new Date().toISOString(),
    pickup_start,
    pickup_end,
    order_status: f5Spec.order_status,
    payment_status: f5Spec.payment_status,
    reservation_code: result.reservation_code,
    refreshed_by: 'refresh-demo-listings.mjs',
    scenario: 'IN_WINDOW_WIDE',
    merchant_tab: 'verification',
  };
  fs.writeFileSync(F5_BASELINE, JSON.stringify(updated, null, 2) + '\n');
  return { order_id: f5Spec.id, bag_id: f5Spec.bag_id, scenario: 'IN_WINDOW_WIDE' };
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
  const windows = scenarioWindows();
  await ensureOutlets(env);
  const bags = await refreshBags(env, windows);
  const shelves = await refreshShelves(env, windows);
  const scenarioOrders = await refreshScenarioOrders(env, windows);
  const scenarioGroup = await refreshScenarioGroup(env, windows);
  const f5 = await refreshF5Order(env, windows);

  console.log(
    JSON.stringify(
      {
        ok: true,
        windows,
        scenario_bags: QA_SCENARIO_BAGS,
        scenario_orders: scenarioOrders,
        scenario_group: scenarioGroup,
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
          scenario_orders: Object.fromEntries(
            Object.entries(QA_SCENARIO_ORDERS).map(([k, v]) => [
              k,
              `freshasever://orders/${v.id}`,
            ]),
          ),
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
