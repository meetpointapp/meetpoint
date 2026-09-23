import { chromium } from 'playwright-core';
import { WEB } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('page error:', e.message));

const shot = async (name, wait = 1500) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};
const nav = async (x) => {
  await page.mouse.click(x, 812);
  await page.waitForTimeout(1500);
};
const swipeRight = async () => {
  await page.mouse.move(195, 350);
  await page.mouse.down();
  await page.mouse.move(495, 350, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1300);
};

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(1500);
await page.getByRole('textbox', { name: 'E-posta' }).fill('test@meetpoint.dev');
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('button', { name: 'Giriş yap' }).click();
await shot('50-discover', 3500);

// Karta sağ yarıdan dokun -> 2. fotoğraf
await page.mouse.click(300, 300);
await shot('51-discover-photo2', 800);

// Profil detayı
await page.getByRole('button', { name: 'Profili gör' }).first().click();
await shot('52-profile-top', 2500);
await page.mouse.wheel(0, 700);
await shot('53-profile-scroll', 1200);
await page.mouse.wheel(0, 900);
await shot('54-profile-scroll2', 1200);

// Mesaj isteği sayfası
await page.getByRole('button', { name: /Mesaj isteği/ }).click();
await shot('55-message-sheet', 1200);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await page.goBack();
await page.waitForTimeout(1200);

// Eşleşme: Ayşe veya Elif gelene kadar sağa kaydır
for (let i = 0; i < 7; i++) {
  if (await page.getByRole('button', { name: 'Mesaj gönder' }).count()) break;
  await swipeRight();
}
await shot('56-match', 800);
await page.getByRole('button', { name: 'Keşfetmeye devam' }).click().catch(() => console.log('no match'));
await page.waitForTimeout(800);

await nav(351);
await shot('57-me', 2000);
await page.getByRole('button', { name: 'Profili düzenle' }).click();
await shot('58-edit', 2500);
await page.mouse.wheel(0, 800);
await shot('59-edit-scroll', 1200);
await browser.close();
