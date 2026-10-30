// Faz 24 UI turu: karta basılı tutma — Merak / İlgi / Tutku kademeleri ve bırakınca giden beğeni.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB } from './lib.mjs';
const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 200)));
const shot = async (n) => { await page.screenshot({ path: `${out}capture-${n}.png` }); console.log('shot', n); };
await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill('can7@meetpoint.dev');
await page.getByRole('textbox', { name: 'Şifre' }).click();
await page.keyboard.type('password123', { delay: 30 });
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(4500);
await page.getByRole('button', { name: 'Atla' }).click({ timeout: 3000 }).catch(() => {});
await page.goto(`${WEB}/#/discover`);
await page.waitForTimeout(3500);
await shot('0-before');
const x = 195, y = 520;
// 1) sürükleyerek kaydırma artık çalışmamalı
await page.mouse.move(x, y);
await page.mouse.down();
await page.mouse.move(x + 220, y, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(1200); await shot('1-drag-ignored');
// 2) Tutku'ya kadar tut → bırak → onay penceresi
await page.mouse.move(x, y);
await page.mouse.down();
await page.waitForTimeout(2400); await shot('2-tutku');
await page.mouse.up();
await page.waitForTimeout(800); await shot('3-confirm');
await page.getByRole('button', { name: 'Vazgeç' }).click({ force: true });
await page.waitForTimeout(1200); await shot('4-cancelled');
// 3) İlgi'de bırak → doğrudan gider
await page.mouse.move(x, y);
await page.mouse.down();
await page.waitForTimeout(1500);
await page.mouse.up();
await page.waitForTimeout(1500); await shot('5-interest-sent');
await browser.close();
