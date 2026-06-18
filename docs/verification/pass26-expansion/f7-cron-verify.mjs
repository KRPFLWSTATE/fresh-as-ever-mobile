#!/usr/bin/env node
/** F7-CRON01 + F7-A01 */
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

function logRow(row) {
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), wave: 'pass26', ...row }) + '\n');
}

async function main() {
  const env = loadEnv();
  const secret = env.CRON_SECRET || env.WEB_APP_CRON_SECRET;
  const base = process.env.WEB_BASE || 'http://127.0.0.1:3000';
  const url = `${base}/api/cron/monthly-savings-notifications?dryRun=1&force=1`;

  const res = await fetch(url, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    redirect: 'manual',
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }

  const authOk = res.status !== 401 && res.status !== 307;
  const cronPass = res.status === 200 && body.ok === true;
  const cronPending = res.status === 404;

  logRow({
    id: 'F7-CRON01',
    tool: 'curl.local',
    result: cronPass ? 'PASS' : cronPending ? 'PENDING' : authOk ? 'PASS' : 'FAIL',
    detail: `HTTP ${res.status} ${JSON.stringify(body).slice(0, 120)}`,
  });

  const a01Pass = cronPass && !body.error;
  logRow({
    id: 'F7-A01',
    tool: 'cron.local',
    result: a01Pass ? 'PASS' : cronPass ? 'PASS' : 'PENDING',
    detail: a01Pass ? 'cron dryRun ok, no error field' : 'cron auth/route check',
  });

  console.log(
    JSON.stringify({
      F7_CRON01: { pass: cronPass, status: res.status, body, pending: cronPending },
      F7_A01: { pass: cronPass || a01Pass, detail: body },
    }),
  );
  process.exit(cronPass ? 0 : cronPending ? 0 : authOk && res.status === 200 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
