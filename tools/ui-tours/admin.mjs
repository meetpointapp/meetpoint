import { chromium } from 'playwright-core';
import { B, call, registerVerified, upload } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

// XSS denemesi: adı ve şikayet metni HTML/JS içeren kullanıcı
const tag = Date.now();
const evil = await registerVerified(`evil${tag}@test.com`);
await call(evil.t, 'PUT', '/me/profile', {
  displayName: '<img src=x onerror=alert(1)>',
  birthDate: '1995-01-01',
  gender: 'male',
  interestedIn: 'female',
  bio: '<script>alert(2)</script>',
});
await upload(evil.t, '/me/photos', 'photo');
const test = await call(null, 'POST', '/auth/login', { email: 'test@meetpoint.dev', password: 'password123' });
await call(test.token, 'POST', '/reports', { toId: evil.id, reason: 'scam', details: '<b onmouseover=alert(3)>hover</b>' });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let dialogs = 0;
page.on('dialog', async (d) => {
  if (d.type() === 'alert') dialogs++;
  await d.dismiss();
});
page.on('pageerror', (e) => console.log('page error:', e.message));

await page.goto(`${B}/admin`);
await page.fill('#login-email', 'admin@meetpoint.dev');
await page.fill('#login-password', 'password123');
await page.click('#login-form button');
await page.waitForSelector('.stat');
await page.screenshot({ path: `${out}90-admin-overview.png` });

await page.click('[data-tab=reports]');
await page.waitForSelector('#reports .item');
await page.hover('.detail').catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}91-admin-reports.png`, fullPage: true });

await page.click('[data-tab=verifications]');
await page.waitForSelector('#verifications .item');
await page.waitForTimeout(800);
const selfieLoaded = await page.$eval('img[data-selfie]', (img) => img.src.startsWith('blob:') && img.naturalWidth > 0);
await page.screenshot({ path: `${out}92-admin-verifications.png` });

// Mavi tik onayla (Zeynep)
await page.click('[data-approve]');
await page.waitForTimeout(800);
const emptyAfter = await page.textContent('#verifications');

await page.click('[data-tab=users]');
await page.waitForSelector('#users .item');
await page.fill('#user-search', 'test@');
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}93-admin-users.png` });

console.log('selfie loaded:', selfieLoaded);
console.log('queue empty after approve:', emptyAfter.includes('Bekleyen başvuru yok'));
console.log('XSS alerts fired:', dialogs);
await browser.close();
