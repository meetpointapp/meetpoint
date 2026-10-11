// Premium tema taraması: her koyu temayı (galaksi/ateş/kraliyet) uygulayıp başlıca ekranların
// ekran görüntüsünü alır; sabit açık yüzey/okunmayan metin aramak için. Çıktı: shots/theme-<tema>-<ekran>.png
// Kullanım: THEMES=theme_galaxy,theme_royal node theme-scan.mjs   (TOUR_EMAIL ile hesap seçilir)
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB, call } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(out, { recursive: true });
const email = process.env.TOUR_EMAIL ?? 'mert6@meetpoint.dev';
const password = process.env.TOUR_PASSWORD ?? 'password123';
const themes = (process.env.THEMES ?? 'theme_galaxy,theme_fire,theme_royal').split(',');
const peerId = process.env.PEER_ID; // sohbet/profil ekranları için karşı kullanıcı

const token = (await call(null, 'POST', '/auth/login', { email, password })).token;
const setTheme = async (themeId) => {
  await call(token, 'POST', '/store/purchase', { itemId: themeId }); // zaten alınmışsa hata yutulur
  const me = (await call(token, 'GET', '/me')).profile;
  const r = await call(token, 'PUT', '/me/profile', { ...me, birthDate: me.birthDate.slice(0, 10), themeId });
  console.log('tema', themeId, r.status);
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
let screens = [
  ['discover', '/discover'], ['matches', '/matches'], ['chats', '/chats'], ['wallet', '/wallet'], ['store', '/store'],
  ['me', '/me'], ['daily', '/daily'], ['premium', '/premium'], ['edit', '/me/edit'], ['notif', '/me/notifications'],
  ['likes', '/likes'], ['journey', '/journey'], ['help', '/help'], ['requests', '/requests'], ['calls', '/calls'],
];
if (peerId) screens.push(['user', `/user/${peerId}`]);
if (process.env.CONV_ID) screens.push(['chat', `/chat/${process.env.CONV_ID}`]);
if (process.env.EXTRA === '1') {
  screens.length = 0;
  screens.push(['support', '/support'], ['privacy', '/me/privacy'], ['devices', '/me/devices'], ['password', '/me/password'],
    ['referral', '/referral'], ['leaderboard', '/leaderboard'], ['verify', '/verify-profile'], ['vibe', '/vibe'], ['cashout', '/wallet/cashout']);
  if (process.env.CONV_ID) screens.push(['chat', `/chat/${process.env.CONV_ID}`]);
}

for (const themeId of themes) {
  await setTheme(themeId);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 160)));
  await page.goto(WEB);
  await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
  await page.locator('flt-semantics-placeholder').dispatchEvent('click');
  await page.waitForTimeout(3000);
  await page.getByRole('textbox', { name: 'E-posta' }).fill(email);
  await page.getByRole('textbox', { name: 'Şifre' }).click();
  await page.keyboard.type(password, { delay: 30 });
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForTimeout(4500);
  await page.getByRole('button', { name: 'Atla' }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1200);
  for (const [name, route] of screens) {
    await page.goto(`${WEB}/#${route}`);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${out}theme-${themeId.replace('theme_', '')}-${name}.png` });
  }
  await ctx.close();
  console.log('bitti', themeId);
}
await browser.close();
