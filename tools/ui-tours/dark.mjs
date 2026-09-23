// Karanlık mod + eşleşme ekranı kontrolü
import { chromium } from 'playwright-core';
import { WEB } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
page.on('pageerror', (e) => console.log('page error:', e.message));
const shot = async (name, wait = 1500) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill('test@meetpoint.dev');
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('button', { name: 'Giriş yap' }).click();
await shot('70-dark-discover', 3500);

for (let i = 0; i < 7; i++) {
  if (await page.getByRole('button', { name: 'Mesaj gönder' }).count()) break;
  await page.mouse.move(195, 350);
  await page.mouse.down();
  await page.mouse.move(495, 350, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1300);
}
await shot('71-dark-match', 1000);
await page.getByRole('button', { name: 'Keşfetmeye devam' }).click().catch(() => console.log('no match'));
await page.mouse.click(117, 812);
await shot('72-dark-requests', 2000);
await page.mouse.click(273, 812);
await shot('73-dark-wallet', 2000);
await browser.close();
