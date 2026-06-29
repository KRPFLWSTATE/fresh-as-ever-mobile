#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { remote } from '../pass23-cross-portal/node_modules/webdriverio/build/index.js';

const UDID = '377DAC99-B79C-4B05-BB34-DBA1D160038D';
execSync(`xcrun simctl openurl ${UDID} "freshasever://login?portal=merchant"`);
await new Promise((r) => setTimeout(r, 5000));
const d = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  capabilities: {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': UDID,
    'appium:bundleId': 'com.freshasever.mobile',
    'appium:noReset': true,
  },
});
const src = await d.getPageSource();
console.log('has login.email', src.includes('login.email'));
console.log('has Use email', /Use email/i.test(src));
console.log('has Try again', /Try again/i.test(src));
console.log('has Checkout', /Checkout/i.test(src));
const m = src.match(/value="([^"]{0,80})"/g);
console.log('sample values', m?.slice(0, 8));
await d.deleteSession();
