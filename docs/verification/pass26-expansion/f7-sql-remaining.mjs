#!/usr/bin/env node
/** F7-R01 — shelf publish queue + notification types regression */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(ROOT, 'verify-log.jsonl');

function loadEnv() {
  const envPath = path.join(ROOT, '../../../../fresh-as-ever/.env.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}

async function rest(env, table, query = 'select=*&limit=500') {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`${table} HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const env = loadEnv();
  const notifications = await rest(env, 'notifications', 'select=type');
  const queue = await rest(env, 'shelf_publish_notification_queue', 'select=id,processed_at,last_error&limit=20');

  const typeCounts = {};
  for (const r of notifications) typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;

  const queueOk = queue.length > 0 && queue.every((r) => !r.last_error);
  const pass = queueOk && Object.keys(typeCounts).length > 0;

  const out = {
    id: 'F7-R01',
    pass,
    notificationTypes: typeCounts,
    shelfPublishQueueRows: queue.length,
    shelfPublishQueueOk: queueOk,
  };

  fs.appendFileSync(
    LOG,
    JSON.stringify({
      ts: new Date().toISOString(),
      id: 'F7-R01',
      tool: 'supabase.rest',
      result: pass ? 'PASS' : 'FAIL',
      detail: JSON.stringify({ typeCounts, queue: queue.length }),
    }) + '\n',
  );

  console.log(JSON.stringify(out));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
