// Faz 23 UI turu: Doğruluk mu Cesaret mi — keşfet düğmesi, seçim, soru, bekleme, açılan cevaplar, oyun listesi.
// Önce API ile iki taraflı bir oyun hazırlanır (can7 başlatır, aye0 cevaplar); sonra can7 gözünden ekran görüntüleri.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB, call } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(out, { recursive: true });
const login = async (m) => (await call(null, 'POST', '/auth/login', { email: `${m}@meetpoint.dev`, password: 'password123' })).token;
const can = await login('can7');
const aye = await login('aye0');
const ayeId = (await call(aye, 'GET', '/me')).id;
const canId = (await call(can, 'GET', '/me')).id;

// Eski oyunu sıfırla: yeni oyun, 2 tur oynanmış, 3. turda can7 cevapladı ve aye0'ı bekliyor
const g = await call(can, 'POST', '/games/truth-dare', { toId: ayeId });
const play = async (n) => {
  for (let i = 0; i < n; i++) {
    await call(can, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: i % 2 ? 'dare' : 'truth' });
    await call(aye, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: i % 2 ? 'truth' : 'dare' });
    await call(can, 'POST', `/games/truth-dare/${g.id}/answer`, { answer: ['Ankara\'da, çocukluğumdan beri aynı sokakta.', 'Tabii ki! Kahve ve kitap benim için en iyi plan.'][i % 2] });
    await call(aye, 'POST', `/games/truth-dare/${g.id}/answer`, { answer: ['Ben hep kıyıya yakın bir yerde yaşamak isterim 🌊', 'Sana bir şiir: gözlerin kahve, gülüşün sabah.'][i % 2] });
  }
};
const status = await call(can, 'GET', `/games/truth-dare/${g.id}`);
if (status.round === 1) await play(2);
const cur = await call(can, 'GET', `/games/truth-dare/${g.id}`);
if (!cur.current.mine.choice) await call(aye, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: 'dare' });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 200)));
const shot = async (name, wait = 1300) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}game-${name}.png` });
  console.log('shot', name);
};
await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill('can7@meetpoint.dev');
await page.getByRole('textbox', { name: 'Şifre' }).click();
await page.keyboard.type('password123', { delay: 30 });
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(4500);
await page.getByRole('button', { name: 'Atla' }).click({ timeout: 3000 }).catch(() => {});

await page.goto(`${WEB}/#/discover`);
await shot('01-discover', 2500);
await page.goto(`${WEB}/#/game/${g.id}`);
await shot('02-choose');
// 3. tur: can7 doğruluk seçsin ve sorusunu görsün
await call(can, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: 'truth' });
await page.goto(`${WEB}/#/game/${g.id}`);
await shot('03-prompt', 1800);
await page.goto(`${WEB}/#/games`);
await shot('04-list');
await browser.close();
