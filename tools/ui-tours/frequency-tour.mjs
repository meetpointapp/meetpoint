// Faz 24 UI turu: uyum frekansı halkası, "neden bu sayı?" sayfası ve moda özel kart katmanları.
// Çalıştırma:  node frequency-tour.mjs   (API :4000 ve web :8080 açık olmalı)
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 200)));
const shot = async (name, wait = 1500) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}freq-${name}.png` });
  console.log('shot', name);
};
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
await shot('01-all', 3000);

// Halkaya dokun → neden bu sayı
const ring = page.getByRole('button', { name: /Uyum frekansı yüzde/ }).first();
if (await ring.count()) {
  await ring.click({ force: true });
  await shot('02-sheet', 1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
} else console.log('ring semantics bulunamadı');

for (const [id, name] of [['astro', 'Astroloji'], ['music', 'Müzik'], ['interests', 'İlgi'], ['vibe', 'Vibe']]) {
  const b = page.getByRole('button', { name, exact: true }).first();
  if (await b.count()) {
    await b.click({ force: true });
    await shot(`03-${id}`, 3000);
  } else console.log('mod düğmesi yok:', name);
}
await browser.close();
