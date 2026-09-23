import { chromium } from 'playwright-core';
import { WEB } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('console', (m) => m.type() === 'error' && console.log('console error:', m.text()));
page.on('pageerror', (e) => console.log('page error:', e.message));

const shot = async (name) => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(800);
await shot('01-login');

await page.getByRole('textbox', { name: 'E-posta' }).fill('test@meetpoint.dev');
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(2500);
await shot('02-discover');

// Kartı sağa kaydır (Ayşe seni beğenmişti -> eşleşme bekleniyor)
const hearts = page.getByRole('button').last();
const box = { x: 195, y: 400 };
await page.mouse.move(box.x, box.y);
await page.mouse.down();
await page.mouse.move(box.x + 120, box.y, { steps: 8 });
await shot('03-swiping');
await page.mouse.move(box.x + 300, box.y, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(1500);
await shot('04-after-swipe');

const names = (await page.locator('flt-semantics').allInnerTexts()).join(' | ').slice(0, 800);
console.log('semantics:', names);
await browser.close();
