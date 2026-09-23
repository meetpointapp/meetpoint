// Mavi tikli profilin kartı ve profil sayfası
import { chromium } from 'playwright-core';
import { WEB, call } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const login = await call(null, 'POST', '/auth/login', { email: 'test@meetpoint.dev', password: 'password123' });
const cards = await call(login.token, 'GET', '/discover');
const ayse = cards._arr.find((c) => c.displayName === 'Ayşe');
// Ayşe'den öncekileri geç, böylece keşfette Ayşe en önde olsun
for (const c of cards._arr) {
  if (c.id === ayse.id) break;
  await call(login.token, 'POST', '/swipes', { toId: c.id, direction: 'pass' });
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill('test@meetpoint.dev');
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}b1-discover-verified.png` });
await browser.close();

const page2Browser = await chromium.launch({ channel: 'msedge', headless: true });
const page2 = await page2Browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page2.goto(WEB);
await page2.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page2.locator('flt-semantics-placeholder').dispatchEvent('click');
await page2.waitForTimeout(3000);
await page2.getByRole('textbox', { name: 'E-posta' }).fill('test@meetpoint.dev');
await page2.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page2.getByRole('button', { name: 'Giriş yap' }).click();
await page2.waitForTimeout(2500);
await page2.goto(`${WEB}/#/user/${ayse.id}`);
await page2.waitForTimeout(5000);
await page2.screenshot({ path: `${out}b2-profile-verified.png` });
await page2Browser.close();
console.log('done');
