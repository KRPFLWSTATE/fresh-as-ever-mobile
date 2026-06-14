#!/usr/bin/env node
/** Inject expired clearance basket into iOS sim AsyncStorage (bundle-scoped path). */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
const BUNDLE = 'com.freshasever.mobile';
const SHELF = '00000000-0000-0000-0000-000000000201';
const ITEM = '00000000-0000-0000-0000-000000000211';

const container = execSync(`xcrun simctl get_app_container ${UDID} ${BUNDLE} data`, {
  encoding: 'utf8',
}).trim();
const manifestPath = `${container}/Library/Application Support/${BUNDLE}/RCTAsyncLocalStorage_V1/manifest.json`;

const payload = {
  shelfId: SHELF,
  items: { [ITEM]: 1 },
  startedAtMs: Date.now() - 16 * 60 * 1000,
};

const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
manifest['fae.clearanceBasket.v1'] = JSON.stringify(payload);
fs.mkdirSync(manifestPath.replace(/\/manifest\.json$/, ''), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
console.log('Injected', payload, '→', manifestPath);
