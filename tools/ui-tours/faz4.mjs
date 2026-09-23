// Faz 4 UI turu: mesafe, süper beğeni, öne çıkarma, filtreler, seni beğenenler,
// okundu bilgisi, yazıyor, tek seferlik fotoğraf, uygulama içi bildirim
import { chromium } from 'playwright-core';
import { io } from 'socket.io-client';
import { WEB, B, call, upload } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  geolocation: { latitude: 41.0369, longitude: 28.9855 },
  permissions: ['geolocation'],
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('page error:', e.message));
const shot = async (name, wait = 1200) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};
const nav = async (x) => {
  await page.mouse.click(x, 812);
  await page.waitForTimeout(1500);
};

// Ayşe'nin oturumu (karşı taraf)
const ayse = await call(null, 'POST', '/auth/login', { email: 'aye0@meetpoint.dev', password: 'password123' });
if (!ayse.token) throw new Error('Ayşe login failed');

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill('test@meetpoint.dev');
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('button', { name: 'Giriş yap' }).click();
await shot('c1-discover-superliked', 4000);

// Filtreler
await page.getByRole('button', { name: 'Filtreler' }).click();
await shot('c2-filters', 1000);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// Süper beğeni (yıldız butonu) -> Deniz'e değil, sıradaki karta
await page.getByRole('button', { name: 'Süper beğeni' }).click();
await shot('c3-superlike-sent', 1500);
// Deniz seni zaten süper beğenmişti: süper beğeni eşleşme açar
await page.getByRole('button', { name: 'Keşfetmeye devam' }).click().catch(() => {});
await page.waitForTimeout(800);

// Öne çıkar
await page.getByRole('button', { name: 'Öne çıkar' }).click();
await shot('c4-boost-sheet', 1000);
await page.getByRole('button', { name: /Öne çıkar · / }).click();
await shot('c5-boost-active', 1800);

// Seni beğenenler
await nav(195);
await shot('c6-chats-likes-tile', 1500);
await page.getByText('Seni beğenenler').first().click();
await shot('c7-likes-locked', 1500);
await page.getByRole('button', { name: /Kimler olduğunu gör/ }).click();
await shot('c8-likes-unlocked', 2500);
// Ayşe'yi geri beğen -> eşleşme -> sohbet
const likeButtons = page.getByRole('button');
await page.mouse.click(0, 0);
const likes = await call(null, 'POST', '/auth/login', { email: 'test@meetpoint.dev', password: 'password123' });
const likeInfo = await call(likes.token, 'GET', '/likes');
console.log('likes listed:', likeInfo._arr ? 0 : likeInfo.users.length);
await page.goBack();
await page.waitForTimeout(800);

// Ayşe ile eşleş (API ile) ve sohbeti aç
const m = await call(likes.token, 'POST', '/swipes', { toId: likeInfo.users.find((u) => u.displayName === 'Ayşe').id, direction: 'like' });
await page.goto(`${WEB}/#/chat/${m.conversationId}`);
await page.waitForTimeout(3500);

// Ayşe yazıyor... + mesaj + fotoğraf
const sock = io(B, { auth: { token: ayse.token }, transports: ['websocket'] });
await new Promise((r) => setTimeout(r, 800));
sock.emit('typing', { conversationId: m.conversationId });
await shot('c9-typing', 500);
await call(ayse.token, 'POST', `/conversations/${m.conversationId}/messages`, { body: 'Selam! Profilindeki kahve sevgisi dikkatimi çekti ☕' });
await page.waitForTimeout(1200);
// Benim mesajım -> Ayşe okuyunca çift tik
await page.getByRole('textbox').last().click();
await page.keyboard.type('Selam Ayşe! Kadıköy’de en sevdiğin kahveci?', { delay: 10 });
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
await shot('c10-sent-single-tick', 300);
await call(ayse.token, 'POST', `/conversations/${m.conversationId}/read`);
await shot('c11-read-double-tick', 1500);
const photo = await upload(ayse.token, `/conversations/${m.conversationId}/photos`, 'photo');
console.log('photo sent:', photo.status);
await shot('c12-view-once-received', 1500);
await page.getByText('Görmek için dokun').click();
await shot('c13-view-once-open', 2000);
await page.keyboard.press('Escape');
await page.goBack().catch(() => {});
await page.waitForTimeout(1000);

// Uygulama içi bildirim: başka ekrandayken yeni mesaj
await page.goto(`${WEB}/#/discover`);
await page.waitForTimeout(3500);
await call(ayse.token, 'POST', `/conversations/${m.conversationId}/messages`, { body: 'Moda’daki küçük bir yer var 😊' });
await shot('c14-inapp-banner', 1500);
await nav(195);
await shot('c15-chats-unread', 1500);

sock.close();
await browser.close();
