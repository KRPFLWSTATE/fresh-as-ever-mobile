#!/usr/bin/env node
/** C-00 gate + F5 customer in one Appium session (no session delete between). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
spawnSync('node', ['reset-f5-order.mjs'], { cwd: ROOT, stdio: 'inherit' });
process.env.PORTAL = 'customer';
process.env.SKIP_C00_DELETE = '1';
const r = spawnSync('node', ['pass26-f5-appium.mjs'], { cwd: ROOT, stdio: 'inherit', env: process.env });
process.exit(r.status || 0);
