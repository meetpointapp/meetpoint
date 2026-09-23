// Faz 7 UI turu: para çekme (doğrulama şartı, form, bekleyen talep, ödendi), yönetim ödemeler + hatalar
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB, B, call, registerVerified, upload } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const tag = Date.now();
const admin = (await call(null, 'POST', '/auth/login', { email: 'admin@meetpoint.dev', password: 'password123' })).token;

async function makeUser(name, gender, interestedIn) {
  const email = `${name.toLowerCase()}${tag}@test.com`;
  const u = await registerVerified(email);
  await call(u.t, 'PUT', '/me/profile', { displayName: name, birthDate: '1995-02-02', gender, interestedIn });
  await upload(u.t, '/me/photos', 'photo');
  return { ...u, email };
}
const ece = await makeUser('Ece', 'female', 'male');
const emre = await makeUser('Emre', 'male', 'female');
await call(emre.t, 'POST', '/wallet/dev-topup', { packId: 'coins_6000' });
// Kazanç: arama + 10 elmas
const c = await call(emre.t, 'POST', '/calls', { toId: ece.id, kind: 'VIDEO' });
await call(ece.t, 'POST', `/calls/${c.id}/accept`);
for (let i = 0; i < 10; i++) await call(emre.t, 'POST', `/calls/${c.id}/gifts`, { giftId: 'diamond' });
await call(emre.t, 'POST', `/calls/${c.id}/hangup`);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('page error:', e.message));
const shot = async (p, name, wait = 1200) => {
  await p.waitForTimeout(wait);
  await p.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};
await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill(ece.email);
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(3500);

// Doğrulanmamış: mavi tik şartı
await page.goto(`${WEB}/#/wallet/cashout`);
await shot(page, 'f1-cashout-need-verify', 3000);

// Mavi tik onayı (yönetimden)
await call(ece.t, 'POST', '/me/verification/start');
await upload(ece.t, '/me/verification', 'selfie');
const q = await call(admin, 'GET', '/admin/api/verifications');
const v = q._arr.find((x) => x.user?.id === ece.id || x.userId === ece.id);
await call(admin, 'POST', `/admin/api/verifications/${v.id}/approve`, {});

await page.goto(`${WEB}/#/wallet`);
await shot(page, 'f2-wallet', 3000);
await page.getByRole('button', { name: 'Paraya çevir' }).click();
await shot(page, 'f3-cashout-form', 2500);
await page.getByRole('textbox', { name: 'Hesap sahibinin adı soyadı' }).fill('Ece Yılmaz');
await page.getByRole('textbox', { name: 'IBAN' }).fill('TR330006100519786457841326');
await shot(page, 'f4-cashout-filled', 800);
await page.mouse.click(195, 614); // odaklı metin alanı katmanı tıklamayı kesiyor
await shot(page, 'f5-cashout-pending', 2500);

// Uygulamadan bir hata raporu (yönetim Hatalar sekmesi için örnek)
await fetch(`${B}/client-errors`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    message: "Null check operator used on a null value",
    stack: '#0      _ChatScreenState._send (package:meetpoint/features/chat/chat_screen.dart:212:31)\n#1      _InkResponseState.handleTap',
    platform: 'android',
    appVersion: '1.0.0',
    context: '/chat/abc',
  }),
});

// Yönetim paneli
const b2 = await chromium.launch({ channel: 'msedge', headless: true });
const ap = await b2.newPage({ viewport: { width: 1280, height: 900 } });
await ap.goto(`${B}/admin`);
await ap.fill('#login-email', 'admin@meetpoint.dev');
await ap.fill('#login-password', 'password123');
await ap.click('#login-form button');
await ap.waitForSelector('.stat');
await ap.click('[data-tab=payouts]');
await ap.waitForSelector('#payouts .item');
await ap.screenshot({ path: `${out}f6-admin-payouts.png` });
await ap.click('[data-tab=errors]');
await ap.waitForSelector('#errors .item');
await ap.screenshot({ path: `${out}f7-admin-errors.png` });
console.log('shot f6/f7 admin');
// Ödendi işaretle (prompt → işlem no)
await ap.click('[data-tab=payouts]');
await ap.waitForSelector('#payouts .item');
ap.once('dialog', (d) => d.accept('EFT-2026-0042'));
await ap.click(`#payouts [data-pay]`);
await ap.waitForTimeout(1200);
await b2.close();

await page.waitForTimeout(1500);
await page.goto(`${WEB}/#/wallet/cashout`);
await shot(page, 'f8-cashout-paid', 3000);
await browser.close();
