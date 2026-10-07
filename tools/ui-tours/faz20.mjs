// Faz 20 UI turu: eşleştirme modları (astroloji/müzik/ilgi/vibe), mağaza sekmesi, kompakt profil,
// görsel yenileme. Seed'li demo hesapla (mert6@meetpoint.dev) giriş yapar, ekran görüntüsü alır.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB, call } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(out, { recursive: true });
const email = process.env.TOUR_EMAIL ?? 'mert6@meetpoint.dev';
const password = process.env.TOUR_PASSWORD ?? 'password123';

// Hazırlık: mert ile deniz arasında sohbet aç (demo hesaplar, yoksa eşleştir) ve birkaç mesaj yaz
const login = async (mail) => (await call(null, 'POST', '/auth/login', { email: mail, password })).token;
const mert = await login(email);
const deniz = await login('deniz5@meetpoint.dev');
const mertId = (await call(mert, 'GET', '/me')).id;
const denizId = (await call(deniz, 'GET', '/me')).id;
await call(deniz, 'POST', '/swipes', { toId: mertId, direction: 'like' });
await call(mert, 'POST', '/swipes', { toId: denizId, direction: 'like' });
const convs = (await call(mert, 'GET', '/conversations'))._arr ?? [];
const conv = convs.find((c) => c.user?.id === denizId);
if (conv) {
  await call(deniz, 'POST', `/conversations/${conv.id}/messages`, { body: 'Selam! Müzik zevkimiz uyuşuyor galiba 🎸' });
  await call(mert, 'POST', `/conversations/${conv.id}/messages`, { body: 'Aynen, hangi grupları dinliyorsun?' });
}

let errors = 0;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => {
  errors++;
  console.log('PAGE ERROR:', e.message.slice(0, 200));
});
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 160));
});

const shot = async (name, wait = 1200) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}faz20-${name}.png` });
  console.log('shot', name);
};
const tap = async (name, opts = {}) => {
  // Alt menü öğeleri Flutter web'de 'tab' rolüyle, diğerleri 'button' olarak gelir
  const el = page.getByRole('button', { name, exact: opts.exact ?? false }).or(page.getByRole('tab', { name, exact: opts.exact ?? false })).first();
  await el.click({ timeout: 8000 });
};

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill(email);
await page.getByRole('textbox', { name: 'Şifre' }).click();
await page.keyboard.type(password, { delay: 30 });
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(4500);
// İlk açılış tanıtımını atla
await page.getByRole('button', { name: 'Atla' }).click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(1500);

await shot('01-discover');
for (const [mode, tag] of [['Astroloji', '02-astro'], ['Müzik', '03-music'], ['İlgi', '04-interests'], ['Vibe', '05-vibe']]) {
  await tap(mode, { exact: true });
  await shot(tag, 1800);
}
await tap('Tümü', { exact: true });

// Mağaza sekmesi: bir balon satın al, uygula
await tap('Mağaza', { exact: true });
await shot('06-store', 1800);
await page.getByRole('button', { name: /100/ }).first().click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1800);
await shot('06b-store-bought', 600);
await page.getByRole('button', { name: 'Kullan', exact: true }).first().click();
await page.waitForTimeout(1500);
await shot('06c-store-equipped', 600);
await tap('Sohbet arka planı');
await shot('07-store-backdrops', 1000);
// (Tekrar çalıştırmalarda ürün zaten alınmış olabilir: hatalar yutulur)
await page.getByRole('button', { name: /150/ }).nth(5).click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Kullan', exact: true }).first().click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1500);
await tap('Çerçeve');
await shot('08-store-frames', 800);

// Sohbet: satın alınan balon + arka plan uygulanmış mı
await tap('Sohbetler');
await shot('10-chats', 1500);
await page.getByText('Deniz', { exact: false }).first().click();
await shot('11-chat-themed', 2000);

// Emoji paneli: aç, birkaç emoji seç, gönder (tek emoji büyük gösterilir)
await tap('Emoji', { exact: true });
await shot('11b-emoji-panel', 800);
// Emoji ızgarası semantik ağaçta ayrı düğüm vermiyor: koordinatla seç (😍 ve 😀)
await page.mouse.click(312, 698);
await page.waitForTimeout(300);
await page.mouse.click(31, 651);
await shot('11c-emoji-picked', 500);
await page.mouse.click(367, 552);
await shot('11d-emoji-sent', 1500);
await page.goBack().catch(() => {});

// Diğer sekmeler
await tap('İstekler');
await shot('12-requests', 1200);
await tap('Cüzdan');
await shot('13-wallet', 1500);

// Başkasının profili (kompakt başlık + fotoğraf şeridi)
await tap('Tümü', { exact: true }).catch(() => {});
await page.goto(WEB + '/#/user/' + denizId);
await page.waitForTimeout(3500);
await shot('14-user-profile', 1500);
await page.getByRole('button', { name: /Geri|Back/ }).first().click().catch(() => {});

// Profil sekmesi
await page.goto(WEB);
await page.waitForTimeout(3500);
await tap('Profil', { exact: true });
await shot('09-me', 1500);

console.log(errors ? `${errors} sayfa hatası` : 'hata yok');
await browser.close();
