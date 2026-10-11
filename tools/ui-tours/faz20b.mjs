// Faz 20 (ikinci tur) UI turu: keşfette kart yığını/fotoğraf geçişi, öne çıkar, alt menü sayacı, profil kutuları.
// Giriş: TOUR_EMAIL (varsayılan mert6@meetpoint.dev). Çıktı: shots/faz20b-*.png
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(out, { recursive: true });
const email = process.env.TOUR_EMAIL ?? 'mert6@meetpoint.dev';
const password = process.env.TOUR_PASSWORD ?? 'password123';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 200)));

const shot = async (name, wait = 900) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}faz20b-${name}.png` });
  console.log('shot', name);
};
const tap = (name, opts = {}) =>
  page.getByRole('button', { name, exact: opts.exact ?? false }).or(page.getByRole('tab', { name, exact: opts.exact ?? false })).first().click({ timeout: 8000 });

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill(email);
await page.getByRole('textbox', { name: 'Şifre' }).click();
await page.keyboard.type(password, { delay: 30 });
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(4500);
await page.getByRole('button', { name: 'Atla' }).click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(1500);
// Günlük ödül ekranı kendiliğinden açıldıysa kapat
await page.keyboard.press('Escape').catch(() => {});

const steps = (process.env.STEPS ?? 'deck').split(',');

if (steps.includes('deck')) {
  await shot('01-deck');
  // Kartın ortasına dokun: fotoğraf değişmeli
  await page.mouse.click(195, 330);
  await shot('02-after-tap', 500);
  await page.mouse.click(195, 330);
  await shot('03-after-tap2', 500);
  // Kartı yarıya kadar sürükle (üst üste binme kontrolü)
  await page.mouse.move(195, 400);
  await page.mouse.down();
  await page.mouse.move(300, 420, { steps: 8 });
  await page.mouse.move(380, 430, { steps: 6 });
  await shot('04-dragging', 200);
  await page.mouse.up();
  await shot('05-after-swipe', 300);
}

if (steps.includes('info')) {
  await page.mouse.click(340, 574);
  await shot('06-info-profile', 1500);
}

if (steps.includes('me')) {
  await tap('Profil', { exact: true });
  await shot('10-me', 1500);
  await page.mouse.wheel(0, 500);
  await shot('11-me-scrolled', 600);
}

if (steps.includes('profile')) {
  await page.getByRole('button', { name: 'Profili gör' }).first().click({ timeout: 5000 }).catch((e) => console.log('info click', e.message.slice(0, 80)));
  await shot('12-user-profile', 1500);
}

if (steps.includes('boost')) {
  await page.mouse.click(364, 24);
  await shot('20-boost-sheet', 900);
  await page.getByRole('button', { name: /Öne çıkar/ }).last().click({ timeout: 4000 }).catch((e) => console.log('boost click', e.message.slice(0, 80)));
  await shot('21-boosted', 1500);
  await page.getByRole('button', { name: /dk/ }).first().click({ timeout: 4000 }).catch((e) => console.log('chip click', e.message.slice(0, 80)));
  await shot('22-boost-extend-sheet', 900);
}

if (steps.includes('store')) {
  await tap('Mağaza', { exact: true });
  await shot('30-store', 1500);
  await page.getByRole('button', { name: /^75/ }).first().click({ timeout: 4000 }).catch((e) => console.log('buy click', e.message.slice(0, 80)));
  await shot('31-store-bought', 1500);
  await tap('Keşfet', { exact: true });
  await shot('32-discover-after-buy', 1200);
}

if (steps.includes('badge')) {
  await shot('40-badge', 800);
  await tap('Sohbetler', { exact: false });
  await shot('41-chats', 1200);
}

if (steps.includes('matches')) {
  // TARGET_ID: bakılacak kullanıcının kimliği (profil sayfası doğrudan açılır)
  const target = process.env.TARGET_ID;
  await page.goto(`${WEB}/#/user/${target}`);
  await page.waitForTimeout(4000);
  await shot('50-target-profile', 800);
}

await browser.close();
