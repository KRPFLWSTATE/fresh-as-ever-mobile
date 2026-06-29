#!/usr/bin/env node
/**
 * Pass26 finish orchestrator — portal-scoped Appium + web + derive + integration.
 * Usage:
 *   node pass26-reconcile.mjs
 *   PORTAL=customer node pass26-finish.mjs --appium
 *   PORTAL=bakehouse node pass26-finish.mjs --appium
 *   PORTAL=kumbuk node pass26-finish.mjs --appium
 *   node pass26-finish.mjs --web
 *   node pass26-finish.mjs --cross
 *   node pass26-finish.mjs --derive
 *   node pass26-finish.mjs --integration
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = path.resolve(ROOT, '../../..');
const WEB_ROOT = path.resolve(MOBILE_ROOT, '../fresh-as-ever');

const args = process.argv.slice(2);
const PORTAL = process.env.PORTAL || 'all';

function run(cmd, opts = {}) {
  const env = { ...process.env, ...opts.env };
  console.log(`\n>>> ${opts.label || cmd}`);
  const r = spawnSync(cmd, {
    shell: true,
    cwd: opts.cwd || ROOT,
    env,
    stdio: 'inherit',
    timeout: opts.timeout || 45 * 60 * 1000,
  });
  if (r.status !== 0 && !opts.allowFail) {
    console.error(`Command failed (${r.status}): ${cmd}`);
    if (opts.exitOnFail !== false) process.exit(r.status || 1);
  }
  return r.status;
}

function loadQueue() {
  const q = path.join(ROOT, 'work-queue.json');
  if (!fs.existsSync(q)) {
    run('node pass26-reconcile.mjs');
  }
  return JSON.parse(fs.readFileSync(q, 'utf8'));
}

const BAKEHOUSE_IDS = new Set([
  'F1-M01', 'F1-M02', 'F1-M03', 'F1-M05',
  'F2-M01', 'F3-M01', 'F3-M03', 'F4-M01', 'F4-M02', 'F5-M01', 'F5-M02', 'F5-M03', 'F5-M05',
]);
const KUMBUK_IDS = new Set([
  'F1-M04', 'F1-M06', 'F2-M02', 'F3-M02', 'F4-M03', 'F5-M04',
]);

function portalFailIds(portal) {
  const q = loadQueue();
  const { results } = JSON.parse(fs.readFileSync(path.join(ROOT, 'results.json'), 'utf8'));
  const mobileFail = Object.entries(results)
    .filter(([, r]) => !r.pass)
    .map(([id]) => id);

  const cust = (id) =>
    /-C\d+/.test(id) ||
    /-R\d+/.test(id) ||
    /-X\d+/.test(id) ||
    /^F7-/.test(id);

  if (portal === 'customer') return mobileFail.filter(cust);
  if (portal === 'bakehouse') return mobileFail.filter((id) => BAKEHOUSE_IDS.has(id));
  if (portal === 'kumbuk') return mobileFail.filter((id) => KUMBUK_IDS.has(id));
  return mobileFail;
}

function clearStaleLock(lockPath, maxAgeMs = 30 * 60 * 1000) {
  if (!fs.existsSync(lockPath)) return;
  const age = Date.now() - fs.statSync(lockPath).mtimeMs;
  if (age > maxAgeMs) {
    try {
      fs.unlinkSync(lockPath);
      console.log(`Removed stale lock ${path.basename(lockPath)}`);
    } catch {}
  }
}

function runAppiumPortal(portal) {
  const failIds = portalFailIds(portal);
  console.log(`Portal ${portal}: ${failIds.length} FAIL IDs`, failIds.join(', ') || '(none)');
  if (!failIds.length) return 0;

  if (portal === 'customer') {
    run('node reset-f5-order.mjs', { label: 'reset F5 order' });
  }

  clearStaleLock(path.join(ROOT, 'pass26-f5.lock'));
  clearStaleLock(path.join(ROOT, 'pass26-runner.lock'));

  const features = portal === 'customer' ? ['f5', 'f7', 'f3', 'f2', 'f1', 'f4'] : ['f5', 'f3', 'f2', 'f1', 'f4'];
  for (const f of features) {
    const script = f === 'f7' ? 'pass26-expansion-runner.mjs' : `pass26-${f}-appium.mjs`;
    const scriptPath = f === 'f7' ? 'pass26-expansion-runner.mjs' : script;
    if (!fs.existsSync(path.join(ROOT, scriptPath))) continue;
    const prefix = f === 'f7' ? 'F7-' : `F${f.slice(1)}-`.replace('F5-', 'F5-').replace('Ff', 'F');
    const featPrefix = f === 'f7' ? 'F7-' : `F${f.charAt(1)}-`;
    const relevant = failIds.some((id) => id.startsWith(featPrefix));
    if (!relevant) continue;
    if (f === 'f7') {
      const f7ids = failIds.filter((id) => id.startsWith('F7-')).join(',');
      if (!f7ids) continue;
      run(`ONLY_IDS=${f7ids} PORTAL=${portal} node pass26-expansion-runner.mjs`, {
        label: 'F7 via expansion runner',
        allowFail: true,
      });
    } else if (f === 'f5' && portal === 'customer') {
      run(`PORTAL=${portal} node pass26-f5-customer-gate.mjs`, { label: 'F5 customer gate', allowFail: true });
    } else {
      run(`PORTAL=${portal} ONLY_FAIL=1 node ${script}`, { label: script, allowFail: true });
    }
  }
  return 0;
}

function runCross() {
  run('node reset-f5-order.mjs', { label: 'reset F5 for cross', allowFail: true });
  const crossIds = 'X-01,X-02,X-03,X-04,X-05,X-06,X-07,X-08,X-09';
  run(`ONLY_IDS=${crossIds} PORTAL=customer node pass26-expansion-runner.mjs`, {
    label: 'X-01..X-09 cross',
    allowFail: true,
  });
  // Feature cross IDs still failing
  for (const f of ['f1', 'f2', 'f3', 'f5', 'f7']) {
    const script = f === 'f7' ? 'pass26-expansion-runner.mjs' : `pass26-${f}-appium.mjs`;
    run(`PORTAL=customer ONLY_FAIL=1 node ${script}`, { label: `${f} cross legs`, allowFail: true });
  }
}

function runIntegration() {
  run('node pass26-reconcile.mjs', { label: 'reconcile before integration' });
  run('node docs/verification/pass25-merchant-split/pass25-merchant-split-runner.mjs', {
    cwd: MOBILE_ROOT,
    label: 'Pass25 45/45',
    timeout: 60 * 60 * 1000,
  });
  run('npm test -- --passWithNoTests', { cwd: MOBILE_ROOT, label: 'mobile jest', allowFail: false });
  run('npm run typecheck', { cwd: MOBILE_ROOT, label: 'mobile typecheck' });
  run('npm test -- --passWithNoTests', { cwd: WEB_ROOT, label: 'web jest', allowFail: true });
  run('npm run typecheck', { cwd: WEB_ROOT, label: 'web typecheck', allowFail: true });
  run('node pass26-derive-cross.mjs', { label: 'derive cross rows' });
  run('node pass26-mark-integration.mjs', { label: 'mark integration IDs', allowFail: true });
}

async function main() {
  if (args.includes('--appium')) {
    if (PORTAL === 'all') {
      console.error('Set PORTAL=customer|bakehouse|kumbuk for --appium');
      process.exit(1);
    }
    if (PORTAL === 'customer') {
      run('node docs/verification/pass25-merchant-split/pass25-c00-login-smoke.mjs', {
        cwd: MOBILE_ROOT,
        label: 'C-00 login gate',
      });
    }
    runAppiumPortal(PORTAL);
    run('node pass26-reconcile.mjs');
    return;
  }
  if (args.includes('--web')) {
    run('node pass26-web-smoke.mjs');
    run('node pass26-reconcile.mjs');
    return;
  }
  if (args.includes('--cross')) {
    runCross();
    run('node pass26-reconcile.mjs');
    return;
  }
  if (args.includes('--derive')) {
    run('node pass26-derive-cross.mjs');
    run('node pass26-reconcile.mjs');
    return;
  }
  if (args.includes('--integration')) {
    runIntegration();
    run('node pass26-reconcile.mjs');
    return;
  }

  // Full pipeline
  run('node pass26-reconcile.mjs');
  run('node docs/verification/pass25-merchant-split/pass25-c00-login-smoke.mjs', { cwd: MOBILE_ROOT, label: 'C-00' });
  run('node reset-f5-order.mjs');
  for (const p of ['customer', 'bakehouse', 'kumbuk']) {
    run(`PORTAL=${p} node pass26-finish.mjs --appium`, { env: { PORTAL: p } });
  }
  run('node pass26-finish.mjs --cross', { allowFail: true });
  run('node pass26-finish.mjs --web', { allowFail: true });
  run('node pass26-finish.mjs --derive');
  run('node pass26-finish.mjs --integration');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
