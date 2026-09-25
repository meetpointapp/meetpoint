// Faz 15 UI turu (duman testi): arama + hemen kapatma (adil ücretlendirme), arama geçmişinden
// itiraz açma, sohbette mesaj gönderme (çevrimdışı kuyruk yolunun ön plan davranışı).
// Gerçek cihaz/CallKit/PushKit bu ortamda test edilemez (bkz. docs/yol-haritasi.md Faz 15);
// bu tur sadece web derlemesinin gerçek bir tarayıcıda çökmeden çalıştığını doğrular.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB, B, call, latestCode, png } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(out, { recursive: true });
const tag = Date.now();
// lib.mjs'nin varsayılan 'password123' şifresi güvenlik kurallarıyla artık reddediliyor (yaygın şifre)
const PASSWORD = 'Meet-Point-Tour-2026!';

async function makeUser(name, gender, interestedIn) {
  const email = `${name.toLowerCase()}${tag}@test.com`;
  const r = await call(null, 'POST', '/auth/register', { email, password: PASSWORD, acceptTerms: true, consents: { overseas: true } });
  if (r.status !== 201) throw new Error(`register ${r.status} ${r.error}`);
  await call(r.token, 'POST', '/auth/verify-email', { code: await latestCode(email) });
  await call(r.token, 'PUT', '/me/consents', { kind: 'special_category', granted: true, source: 'onboarding' });
  const u = { t: r.token, id: r.userId };
  await call(u.t, 'PUT', '/me/profile', { displayName: name, birthDate: '1996-04-12', gender, interestedIn, city: 'İstanbul' });
  const fd = new FormData();
  fd.append('photo', new Blob([png], { type: 'image/png' }), 'p.png');
  await fetch(`${B}/me/photos`, { method: 'POST', headers: { authorization: `Bearer ${u.t}` }, body: fd });
  return { ...u, email };
}

const arda = await makeUser('Arda15', 'male', 'female');
const deren = await makeUser('Deren15', 'female', 'male');
await call(arda.t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' });

let errors = 0;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
async function open(u) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    errors++;
    console.log('PAGE ERROR:', e.message);
  });
  await page.goto(WEB);
  await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
  await page.locator('flt-semantics-placeholder').dispatchEvent('click');
  await page.waitForTimeout(3000);
  await page.getByRole('textbox', { name: 'E-posta' }).fill(u.email);
  await page.getByRole('textbox', { name: 'Şifre' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForTimeout(3500);
  return page;
}
const shot = async (page, name, wait = 1200) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};
const btn = (page, name) => page.getByRole('button', { name, exact: true });

const A = await open(arda);
const Bp = await open(deren);

// --- Arama: başlat, kabul et, hemen kapat (kısmi dakika iadesi tetiklenir)
await A.goto(`${WEB}/#/user/${deren.id}`);
await A.getByRole('button', { name: /Sesli arama/ }).first().click();
await A.getByRole('button', { name: /^Ara · / }).click();
await shot(A, 'f15-01-outgoing', 1500);
await shot(Bp, 'f15-02-incoming', 1000);
await btn(Bp, 'Aç').click();
await shot(A, 'f15-03-active', 1500);
await btn(A, 'Bitir').click();
await shot(A, 'f15-04-summary', 1500);
const skip = A.getByRole('button', { name: 'Atla' });
if (await skip.count()) await skip.click();
await A.waitForTimeout(1000);

// --- Arama geçmişi: itiraz et
await A.goto(`${WEB}/#/calls`);
await shot(A, 'f15-05-history', 2500);
const disputeBtn = A.getByRole('button', { name: 'Ücrete itiraz et' }).first();
await disputeBtn.waitFor({ timeout: 5000 });
await disputeBtn.click();
await shot(A, 'f15-06-dispute-sheet', 1000);
await A.getByText('Yanlış tutar alındı').click();
await shot(A, 'f15-07-dispute-sent', 1500);

// --- Sohbet: mesaj gönder (çevrimdışı kuyruk yolu, ön planda anında denenir)
await A.goto(`${WEB}/#/chats`);
await shot(A, 'f15-08-conversations', 2000);
const convo = A.getByText('Deren15').first();
if (await convo.count()) {
  await convo.click();
  await A.waitForTimeout(1500);
  await A.getByPlaceholder('Mesaj yaz...').fill('Faz 15 duman testi mesajı');
  await A.getByRole('button', { name: 'Gönder' }).click();
  await shot(A, 'f15-09-chat-sent', 1500);
}

console.log(errors ? `\n${errors} SAYFA HATASI` : '\nSayfa hatası yok');
process.exitCode = errors ? 1 : 0;
await browser.close();
