import { chromium } from 'playwright-core';
import { WEB } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('page error:', e.message));

const shot = async (name) => {
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};
const nav = async (x) => {
  await page.mouse.click(x, 800);
  await page.waitForTimeout(1200);
};
const swipeRight = async () => {
  await page.mouse.move(195, 400);
  await page.mouse.down();
  await page.mouse.move(495, 400, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
};

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(800);
await page.getByRole('textbox', { name: 'E-posta' }).fill('test@meetpoint.dev');
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(2500);

// Elif'e gelene kadar sağa kaydır (Elif test hesabını önceden beğenmişti)
for (let i = 0; i < 6; i++) {
  if (await page.getByRole('button', { name: 'Mesaj gönder' }).count()) break;
  await swipeRight();
}
await shot('10-match');
await page.getByRole('button', { name: 'Keşfetmeye devam' }).click().catch(() => console.log('no match dialog'));

// İstekler: Zeynep'in mesaj isteğini kabul et -> sohbet açılmalı
await nav(117);
await shot('11-requests');
await page.getByRole('button', { name: 'Kabul et' }).last().click();
await page.waitForTimeout(2000);
await shot('12-chat-from-request');
await page.getByRole('textbox').last().fill('Selam Zeynep, memnun oldum!');
await page.keyboard.press('Enter');
await shot('13-chat-sent');
await page.goBack();
await page.waitForTimeout(1000);

await nav(195);
await shot('14-chats');
await nav(273);
await shot('15-wallet');

// Keşfet'ten bir profil aç -> ücretli istek butonları
await nav(39);
await page.getByRole('button', { name: 'Yenile' }).click().catch(() => {});
await page.waitForTimeout(1500);
await page.mouse.click(195, 300);
await page.waitForTimeout(1500);
await shot('16-user-profile');
await page.mouse.wheel(0, 600);
await shot('17-user-profile-actions');
await page.goBack();
await page.waitForTimeout(800);

// Dil: İngilizce
await nav(351);
await page.getByRole('button', { name: 'EN' }).click().catch(() => page.mouse.click(330, 330));
await shot('18-profile-en');
await nav(273);
await shot('19-wallet-en');
await browser.close();
