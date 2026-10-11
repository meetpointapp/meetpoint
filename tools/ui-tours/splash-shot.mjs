// Uygulama yüklenirken (oturum çözülürken) kendi açılış ekranının görüntüsünü alır.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB } from './lib.mjs';
const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.goto(WEB, { waitUntil: 'commit' });
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}splash-0-native.png` });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}splash-1-app.png` });
await browser.close();
