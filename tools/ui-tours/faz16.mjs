// Faz 16 UI turu (duman testi): ilk kullanım rehberi, cüzdan bilgi sayfası, çevrimdışı şeridi,
// gizlilik ekranındaki analitik anahtarı, uygulama içi geri bildirim girişi.
// Gerçek Android/iOS cihazı bu ortamda test edilemez (bkz. docs/yol-haritasi.md Faz 16);
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

const u = await makeUser('Faz16', 'male', 'female');

let errors = 0;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => {
  errors++;
  console.log('PAGE ERROR:', e.message);
});
// Gerçek WebSocket'i sonradan zorla kapatabilmek için referansını sakla (çevrimdışı şeridi testi)
await page.addInitScript(() => {
  window.__sockets = [];
  const RealWS = window.WebSocket;
  window.WebSocket = function (...args) {
    const ws = new RealWS(...args);
    window.__sockets.push(ws);
    return ws;
  };
  window.WebSocket.prototype = RealWS.prototype;
});
await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill(u.email);
await page.getByRole('textbox', { name: 'Şifre' }).fill(PASSWORD);
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(3500);
const shot = async (name, wait = 1000) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};

// --- İlk kullanım rehberi: girişten sonra otomatik açılır (4 sayfa), "İleri" ile ilerlenir
await shot('f16-01-intro', 1500);
const next = page.getByRole('button', { name: 'İleri' });
for (let i = 0; i < 3; i++) {
  await next.click();
  await page.waitForTimeout(400);
}
await page.getByRole('button', { name: 'Anladım' }).click();
await shot('f16-02-discover', 1500);

// --- Cüzdan: bilgi simgesinden "Jetonlar nasıl çalışır?" sayfası
await page.goto(`${WEB}/#/wallet`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Jetonlar nasıl çalışır?' }).click();
await shot('f16-03-coins-info', 1200);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// --- Çevrimdışı şeridi: gerçek WebSocket kapatılınca üstte görünmeli
await page.goto(`${WEB}/#/discover`);
await page.waitForTimeout(2000);
await page.evaluate(() => window.__sockets.forEach((s) => s.close()));
await shot('f16-04-offline-banner', 300);

// --- Gizlilik: "Nasıl çalışır?" tekrar açılabilir + kullanım analitiği anahtarı
await page.goto(`${WEB}/#/me/privacy`);
await page.waitForTimeout(2000);
const switches = page.getByRole('switch');
console.log('gizlilik ekranındaki anahtar sayısı:', await switches.count());
await switches.last().scrollIntoViewIfNeeded();
await shot('f16-05-privacy', 500);
await switches.last().click();
await shot('f16-06-analytics-on', 1000);

// --- Uygulama içi geri bildirim: Profil ekranından tek dokunuşla, "Öneri" seçili açılır
await page.goto(`${WEB}/#/me`);
await page.waitForTimeout(1500);
const fb = page.getByText('Öneri ve hata bildir');
if (await fb.count()) {
  await fb.click();
  await shot('f16-07-feedback', 1200);
} else {
  console.log('UYARI: "Öneri ve hata bildir" bulunamadı');
}

console.log(errors ? `\n${errors} SAYFA HATASI` : '\nSayfa hatası yok');
process.exitCode = errors ? 1 : 0;
await browser.close();
