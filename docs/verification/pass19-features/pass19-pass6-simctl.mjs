#!/usr/bin/env node
/**
 * Pass 6 verification via simctl deeplinks + Appium screenshots.
 * Requires embedded Appium MCP session on target sim.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(ROOT, 'screenshots', 'pass19', 'pass6');
const LOG = path.join(ROOT, 'verify-log.jsonl');
const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const OUTLET = '00000000-0000-0000-0000-000000000003';
const SHELF = '00000000-0000-0000-0000-000000000201';
const ITEM = '00000000-0000-0000-0000-000000000211';

fs.mkdirSync(SS, { recursive: true });

const log = (e) =>
  fs.appendFileSync(
    LOG,
    JSON.stringify({ ts: new Date().toISOString(), wave: 'pass6', ...e }) + '\n',
  );

const dl = (url) => {
  execSync(`xcrun simctl openurl ${UDID} "${url}"`, { stdio: 'pipe' });
};

const shot = (name) => {
  const p = path.join(SS, name);
  execSync(`xcrun simctl io ${UDID} screenshot "${p}"`, { stdio: 'pipe' });
  return `screenshots/pass19/pass6/${name}`;
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

execSync(`xcrun simctl location ${UDID} set 6.9147,79.8655`, { stdio: 'pipe' });

// Inject expired basket
execSync(`node ${path.join(ROOT, 'pass19-pass5-inject.mjs')}`, { stdio: 'inherit' });

await wait(1000);
dl('freshasever://discover');
await wait(4000);
shot('auth-discover.png');

// Warm shelf via outlet (not cold deeplink)
dl(`freshasever://outlet/${OUTLET}`);
await wait(5000);
shot('B-15-attempt1-outlet.png');

dl(`freshasever://shelves/${SHELF}`);
await wait(6000);
const ev1 = shot('B-15-attempt1-shelf.png');

// M2 journey
dl(`freshasever://shelves/${SHELF}`);
await wait(5000);
shot('M2-1-shelf-content.png');

dl(`freshasever://shelves/${SHELF}/review`);
await wait(4000);
shot('M2-3-shelf-review.png');

dl(`freshasever://checkout?shelf=${SHELF}&shelfItems=${ITEM}:1`);
await wait(5000);
const evM2 = shot('M2-4-checkout.png');

log({
  id: 'B-15',
  attempt: 1,
  tool: 'simctl.journey',
  result_summary: 'screenshots captured post product_catalog fix — verify shelf.content in Appium',
  evidence: ev1,
});
log({
  id: 'M2',
  tool: 'simctl.journey',
  result_summary: 'shelf → review → checkout deeplink macro',
  evidence: evM2,
});

console.log('Pass6 simctl evidence written to', SS);
