#!/usr/bin/env node
/** Ensure a live Pettah outlet bag exists for F3-C03 discover landmark smoke */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(ROOT, '../../../../fresh-as-ever/.env.local');
const PETTAH_OUTLET = '8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4';
const BAG_ID = '87e99daa-ef1f-494a-874d-da8a4abf40e3';

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
  if (!res.ok) throw new Error(`${method} ${table} HTTP ${res.status}: ${text.slice(0, 240)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const env = loadEnv();
  const now = Date.now();
  const pickupStart = new Date(now - 20 * 60 * 1000).toISOString();
  const pickupEnd = new Date(now + 4 * 60 * 60 * 1000).toISOString();
  const payload = {
    id: BAG_ID,
    outlet_id: PETTAH_OUTLET,
    title: '[Demo] Pettah Veg Rescue',
    category: 'groceries',
    retail_value_estimate: 2800,
    rescue_price: 950,
    quantity_total: 6,
    quantity_remaining: 5,
    pickup_start: pickupStart,
    pickup_end: pickupEnd,
    status: 'live',
    seed_demo: true,
    pickup_window_kind: 'lunch',
    image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=800',
  };
  const existing = await rest(env, 'GET', 'rescue_bags', `id=eq.${BAG_ID}&select=id,status`, null);
  if (existing?.length) {
    await rest(env, 'PATCH', 'rescue_bags', `id=eq.${BAG_ID}`, payload);
  } else {
    await rest(env, 'POST', 'rescue_bags', '', payload);
  }
  console.log(JSON.stringify({ ok: true, bag_id: BAG_ID, outlet_id: PETTAH_OUTLET, pickup_start: pickupStart, pickup_end: pickupEnd }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
