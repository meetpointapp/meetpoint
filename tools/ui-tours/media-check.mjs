// Fotoğrafların yeni imzalı adreslerden (/media) yüklendiğini gerçek tarayıcıda doğrular
import { chromium } from 'playwright-core';
import { WEB } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const media = [];
page.on('response', (r) => {
  if (r.url().includes('/media/')) media.push({ status: r.status(), size: r.url().match(/-(sm|md|lg)\.webp/)?.[1] });
});
await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill('test@meetpoint.dev');
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(5000);
await page.screenshot({ path: `${out}m1-discover.png` });
await page.goto(`${WEB}/#/chats`);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}m2-chats.png` });
const bySize = media.reduce((a, m) => ((a[`${m.size ?? '?'} ${m.status}`] = (a[`${m.size ?? '?'} ${m.status}`] ?? 0) + 1), a), {});
console.log('media istekleri:', JSON.stringify(bySize));
await browser.close();
