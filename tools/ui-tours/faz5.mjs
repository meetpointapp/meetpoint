// Faz 5 UI turu: hediye jeton, ilk alım bonusu, en popüler, satın alma, canlı bakiye, yönetim satışları
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB, REPO, B, call, registerVerified } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const tag = Date.now();
const email = `wallet${tag}@test.com`;
const u = await registerVerified(email);
await call(u.t, 'PUT', '/me/profile', { displayName: 'Cüzdan', birthDate: '1995-01-01', gender: 'male', interestedIn: 'female' });
const photos = `${REPO}/server/uploads`;
const fd = new FormData();
fd.append('photo', new Blob([fs.readFileSync(`${photos}/${fs.readdirSync(photos).find((f) => f.endsWith('-0.png'))}`)], { type: 'image/png' }), 'p.png');
await fetch(`${B}/me/photos`, { method: 'POST', headers: { authorization: `Bearer ${u.t}` }, body: fd });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('page error:', e.message));
const shot = async (name, wait = 1200) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill(email);
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(3000);
await page.mouse.click(273, 812);
await shot('d1-wallet-bonus', 2500);

// Test modunda 1000'lik paketi al: 1000 + 500 bonus
await page.getByRole('button', { name: /^1000 jeton/ }).click();
await shot('d2-after-purchase', 2500);
const w1 = await call(u.t, 'GET', '/wallet');
console.log('balance after first purchase:', w1.balance, '(expected 1550)');

// Cüzdan açıkken mağaza webhook'u gelsin: bakiye canlı güncellenmeli
await fetch(`${B}/webhooks/revenuecat`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer test-webhook-secret' },
  body: JSON.stringify({ event: { type: 'NON_RENEWING_PURCHASE', app_user_id: u.id, product_id: 'coins_2500', transaction_id: `ui-${tag}`, store: 'APP_STORE', environment: 'PRODUCTION', price: 44.99, currency: 'TRY' } }),
});
await shot('d3-live-webhook', 2500);
const text = await page.locator('flt-semantics').allInnerTexts();
console.log('live balance shown:', text.join(' ').includes('4050') ? 'yes (4050)' : 'no');
await browser.close();

// Yönetim paneli: satışlar sekmesi
const b2 = await chromium.launch({ channel: 'msedge', headless: true });
const admin = await b2.newPage({ viewport: { width: 1280, height: 900 } });
await admin.goto(`${B}/admin`);
await admin.fill('#login-email', 'admin@meetpoint.dev');
await admin.fill('#login-password', 'password123');
await admin.click('#login-form button');
await admin.waitForSelector('.stat');
await admin.screenshot({ path: `${out}d4-admin-stats.png` });
await admin.click('[data-tab=purchases]');
await admin.waitForSelector('#purchases .item');
await admin.screenshot({ path: `${out}d5-admin-sales.png` });
console.log('shot d4/d5 admin');
await b2.close();
