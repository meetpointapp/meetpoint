// Faz 6 UI turu: arama başlatma, gelen arama, bulanık görüntü, hediye, puanlama, geçmiş
// Sunucu CALL_BILLING_SECONDS=6 CALL_RING_SECONDS=40 ile çalışmalı.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB, REPO, B, call, registerVerified } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const tag = Date.now();
const photos = `${REPO}/server/uploads`;
const pngs = fs.readdirSync(photos).filter((f) => f.endsWith('.png'));

async function makeUser(name, gender, interestedIn, photoIndex) {
  const email = `${name.toLowerCase()}${tag}@test.com`;
  const u = await registerVerified(email);
  await call(u.t, 'PUT', '/me/profile', { displayName: name, birthDate: '1996-04-12', gender, interestedIn, city: 'İstanbul' });
  const fd = new FormData();
  fd.append('photo', new Blob([fs.readFileSync(`${photos}/${pngs[photoIndex % pngs.length]}`)], { type: 'image/png' }), 'p.png');
  await fetch(`${B}/me/photos`, { method: 'POST', headers: { authorization: `Bearer ${u.t}` }, body: fd });
  return { ...u, email };
}

const arda = await makeUser('Arda', 'male', 'female', 3);
const deren = await makeUser('Deren', 'female', 'male', 0);
await call(arda.t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' }); // 1550

const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function open(u) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('page error:', e.message));
  await page.goto(WEB);
  await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
  await page.locator('flt-semantics-placeholder').dispatchEvent('click');
  await page.waitForTimeout(3000);
  await page.getByRole('textbox', { name: 'E-posta' }).fill(u.email);
  await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
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

// Arayan: profildeki arama butonları
await A.goto(`${WEB}/#/user/${deren.id}`);
await shot(A, 'e1-profile-callbar', 3000);
const names = await A.getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.textContent));
console.log('buttons:', JSON.stringify(names));
await A.getByRole('button', { name: /Görüntülü arama/ }).first().click();
await shot(A, 'e2-call-confirm');
await A.getByRole('button', { name: /^Ara · 30\/dk/ }).click();
await shot(A, 'e3-outgoing-ringing', 1500);

// Aranan: gelen arama ekranı otomatik açılır
await shot(Bp, 'e4-incoming', 1500);
await btn(Bp, 'Aç').click();
await shot(Bp, 'e5-callee-blurred', 2000);
await btn(Bp, 'Görüntüyü aç').click();
await shot(Bp, 'e6-callee-revealed', 1200);
await shot(A, 'e7-caller-active', 800);

// Hediye
await btn(A, 'Hediye').click();
await shot(A, 'e8-gift-sheet', 1200);
await A.getByText('🌹').click();
await shot(Bp, 'e9-gift-received', 700);

// Bir "dakika" daha geçsin, sonra bitir
await A.waitForTimeout(6500);
await shot(A, 'e10-caller-2min', 200);
await btn(A, 'Bitir').click();
await shot(A, 'e11-caller-rating', 1500);
await btn(A, '4').click();
await shot(A, 'e12-caller-rated', 500);
await btn(A, 'Gönder').click();
await A.waitForTimeout(1500);

await shot(Bp, 'e13-callee-summary', 500);
await btn(Bp, 'Sorun mu vardı? Bildir').click();
await shot(Bp, 'e14-callee-report', 800);
await btn(Bp, 'Atla').click();
await Bp.waitForTimeout(1500);

// Sesli arama (aranan geri arıyor, hediye bakiyesi 50 + kazanç ile)
await Bp.goto(`${WEB}/#/calls`);
await shot(Bp, 'e15-history', 3000);
await btn(Bp, 'Geri ara').first().click();
await Bp.waitForTimeout(800);
// Onay diyaloğu: sesli aramayı başlat
const confirm = Bp.getByRole('button', { name: /^Ara · / });
if (await confirm.count()) await confirm.click();
await A.waitForTimeout(2500);
await btn(A, 'Aç').click();
await shot(A, 'e16-voice-active', 2500);
await btn(A, 'Bitir').click();
await A.waitForTimeout(1500);

// Cüzdan: arama ve hediye kalemleri
await A.goto(`${WEB}/#/wallet`);
await shot(A, 'e17-wallet', 3000);

const hist = await call(arda.t, 'GET', '/calls');
console.log('arda calls:', hist._arr?.length);
const w = await call(arda.t, 'GET', '/wallet');
console.log('arda balance:', w.balance);
await browser.close();
