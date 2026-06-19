#!/usr/bin/env node
/** Reset F5 QA order pickup window + clear customer pickup signals */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(ROOT, 'baseline', 'f5-test-order.json');
const ENV_PATH = path.join(ROOT, '../../../../fresh-as-ever/.env.local');

function loadEnv() {
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}

async function rest(env, method, table, query, body) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?${query}`;
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
  if (!res.ok) throw new Error(`${method} ${table} HTTP ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const seed = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const env = loadEnv();
  const now = Date.now();
  // Window must be OPEN NOW: pickup already started, end still in future.
  const pickupStart = new Date(now - 10 * 60 * 1000).toISOString();
  const pickupEnd = new Date(now + 2 * 60 * 60 * 1000).toISOString();

  await rest(env, 'PATCH', 'orders', `id=eq.${seed.order_id}`, {
    customer_on_the_way_at: null,
    customer_arrived_at: null,
    order_status: 'reserved',
    payment_status: 'paid',
  });

  await rest(env, 'PATCH', 'rescue_bags', `id=eq.${seed.bag_id}`, {
    pickup_start: pickupStart,
    pickup_end: pickupEnd,
  });

  const orderRows = await rest(
    env,
    'GET',
    'orders',
    `id=eq.${seed.order_id}&select=id,order_status,payment_status,customer_on_the_way_at,customer_arrived_at,group_id,reservation_code`,
  );
  const order = orderRows[0];
  if (order?.group_id) {
    await rest(env, 'PATCH', 'reservation_groups', `id=eq.${order.group_id}`, {
      pickup_start: pickupStart,
      pickup_end: pickupEnd,
    });
  }

  const updated = {
    ...seed,
    seeded_at: new Date().toISOString(),
    reservation_code: order?.reservation_code || seed.reservation_code,
    pickup_start: pickupStart,
    pickup_end: pickupEnd,
    order_status: 'reserved',
    payment_status: 'paid',
    eligibility: {
      on_my_way_window: true,
      pickup_end_not_passed: true,
      collectible: true,
    },
    refreshed_for_run: 'SA-F5-FINAL',
  };
  fs.writeFileSync(BASELINE, JSON.stringify(updated, null, 2) + '\n');

  console.log(
    JSON.stringify({
      ok: true,
      order_id: seed.order_id,
      pickup_start: pickupStart,
      pickup_end: pickupEnd,
      reservation_code: updated.reservation_code,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
