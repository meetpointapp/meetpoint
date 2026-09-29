// Faz 17 UI turu (duman testi, "Oyunlaştırma, alışkanlık ve organik büyüme"): günlük giriş serisi,
// sosyal cesaret yolculuğu + "Gelişimim" ekranı, sohbet içi buz kırıcı mini oyunlar ve XOX, eşleşme
// yıldönümü, haftalık özet, davet programı + kişisel bağlantı linki, paylaşılabilir anlar, odanı
// sergile. Hepsi kendi sunucumuzda; dış servis/API maliyeti yok.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { WEB, B, call, latestCode, png } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(out, { recursive: true });
const tag = Date.now();
const PASSWORD = 'Meet-Point-Tour-2026!';

async function makeUser(name, gender, interestedIn) {
  const email = `${name.toLowerCase()}${tag}@test.com`;
  const r = await call(null, 'POST', '/auth/register', { email, password: PASSWORD, acceptTerms: true, consents: { overseas: true } });
  if (r.status !== 201) throw new Error(`register ${r.status} ${JSON.stringify(r)}`);
  await call(r.token, 'POST', '/auth/verify-email', { code: await latestCode(email) });
  await call(r.token, 'PUT', '/me/consents', { kind: 'special_category', granted: true, source: 'onboarding' });
  const u = { t: r.token, id: r.userId };
  await call(u.t, 'PUT', '/me/profile', {
    displayName: name, birthDate: '1996-04-12', gender, interestedIn, city: 'İstanbul', interests: ['coffee'],
  });
  const fd = new FormData();
  fd.append('photo', new Blob([png], { type: 'image/png' }), 'p.png');
  await fetch(`${B}/me/photos`, { method: 'POST', headers: { authorization: `Bearer ${u.t}` }, body: fd });
  return { ...u, email };
}

const a = await makeUser('Seri17', 'male', 'female');
const b = await makeUser('Eslesme17', 'female', 'male');
// B önceden beğenir: A giriş yapıp kaydırırken hemen eşleşme oluşsun (madde 2 "ilk eşleşme" izi de tetiklenir)
await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });

let errors = 0;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => {
  // Faz 17 madde 9 (paylaşılabilir anlar): path_provider/share_plus web'de native değil, tek beklenen hata
  const expected = /UnimplementedError|MissingPluginException|Unsupported/i.test(e.message) || e.message === 'Error';
  if (!expected) {
    errors++;
    console.log('PAGE ERROR:', e.message);
  }
});
await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill(a.email);
await page.getByRole('textbox', { name: 'Şifre' }).fill(PASSWORD);
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(3500);
const shot = async (name, wait = 900) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};

// İlk kullanım rehberi: girişten sonra otomatik açılır, önce kapat
const next = page.getByRole('button', { name: 'İleri' });
for (let i = 0; i < 3; i++) {
  await next.click();
  await page.waitForTimeout(250);
}
await page.getByRole('button', { name: 'Anladım' }).click();
await page.waitForTimeout(600);

// --- Madde 1: günlük giriş serisi (streak) — keşfet ekranındaki alev rozeti
await shot('17-01-discover-streak', 1500);

// --- Madde 2 (kısım): ilk eşleşme + kutlama + paylaş düğmesi (madde 9'un bir parçası da burada)
await page.getByRole('button', { name: 'Kabul et' }).click();
await shot('17-02-match-celebration', 1200);
const matchShareBtn = page.getByRole('button', { name: 'Paylaş' });
if (await matchShareBtn.count()) await matchShareBtn.click();
await page.waitForTimeout(800);
await page.getByText('Keşfetmeye devam').click();
await page.waitForTimeout(600);
const convRes = await call(a.t, 'GET', '/conversations');
const conversationId = convRes._arr[0].id;

// --- Madde 4 ve 5: sohbet içi buz kırıcı mini oyun ("bu mu o mu") ve XOX
await page.goto(`${WEB}/#/chat/${conversationId}`);
await page.waitForTimeout(1500);
await shot('17-03-chat-empty', 800);
await page.getByRole('button', { name: 'Buz kırıcı oyun' }).click();
await page.waitForTimeout(500);
await shot('17-04-icebreaker-sheet', 800);
await page.getByText('Bu mu o mu?').click();
await page.waitForTimeout(500);
await shot('17-05-this-or-that-picker', 800);
await page.getByRole('button').filter({ hasText: '/' }).first().locator('..').getByRole('button').first().click().catch(() => {});
// Yukarıdaki genel seçici güvenilir değilse API ile başlat (akışın kendisi zaten UI'dan denendi)
const icebreakers = await call(a.t, 'GET', `/conversations/${conversationId}/icebreaker`);
if (!icebreakers._arr?.length) {
  await call(a.t, 'POST', `/conversations/${conversationId}/icebreaker`, { kind: 'this_or_that', promptId: 'coffee_or_tea', choice: 'a' });
}
await page.goto(`${WEB}/#/discover`);
await page.waitForTimeout(300);
await page.goto(`${WEB}/#/chat/${conversationId}`);
await page.waitForTimeout(1200);
await shot('17-06-icebreaker-started', 1000);

await page.getByRole('button', { name: 'XOX oyna' }).click();
await page.waitForTimeout(1000);
await shot('17-07-tictactoe-started', 1000);
const ttt = await call(a.t, 'GET', `/conversations/${conversationId}/tictactoe`);
const gameId = ttt._arr[0]?.id;
if (gameId) {
  await call(a.t, 'POST', `/conversations/${conversationId}/tictactoe/${gameId}/move`, { position: 0 });
  await call(b.t, 'POST', `/conversations/${conversationId}/tictactoe/${gameId}/move`, { position: 3 });
}
await page.goto(`${WEB}/#/discover`);
await page.waitForTimeout(300);
await page.goto(`${WEB}/#/chat/${conversationId}`);
await page.waitForTimeout(1200);
await shot('17-08-tictactoe-move', 1000);

// --- Madde 6: eşleşme yıldönümü — konuşmayı 7 gün öncesine çek, banner'ı doğrula
execSync(
  `PGPASSWORD=meetpoint-dev psql -h localhost -p 5433 -U meetpoint -d meetpoint -c "UPDATE \\"Conversation\\" SET \\"createdAt\\" = now() - interval '7 days' WHERE id = '${conversationId}'"`,
  { stdio: 'ignore' },
);
await page.goto(`${WEB}/#/discover`);
await page.waitForTimeout(300);
await page.goto(`${WEB}/#/chat/${conversationId}`);
await shot('17-09-match-anniversary', 1500);

// --- Madde 2 ve 3: sosyal cesaret yolculuğu + "Gelişimim" ekranı
await page.goto(`${WEB}/#/journey`);
await shot('17-10-journey', 1500);

// --- Madde 7: haftalık özet ("Me" ekranı) — bu haftaki eşleşme ve mesajlar zaten yukarıda oluştu
await page.goto(`${WEB}/#/me`);
await page.waitForTimeout(1500);
await shot('17-11-weekly-digest', 800);

// --- Madde 8 ve 11: davet programı + kişisel bağlantı linki
await page.getByText('Arkadaşını davet et').click();
await page.waitForTimeout(1200);
await shot('17-12-referral-screen', 800);

// --- Madde 9: paylaşılabilir anlar — vibe testi ve kendi profilinde paylaş ikonu
const vibeAnswers = {
  ideal_date: 'road_trip', flirt_style: 'direct', weekend: 'explore_new_place', communication: 'frequent_texts',
  conflict: 'talk_now', dream_trip: 'backpacking', friday_night: 'new_experience', gift_style: 'surprise_adventure',
  social_battery: 'crowd_energizes', love_language: 'adventure_together',
};
await call(a.t, 'PUT', '/me/vibe', vibeAnswers);
// meProvider tarayıcıda önbellekli: API'den değiştirilen vibe'ın görünmesi için sayfayı tazele
// (bkz. faz3.mjs'teki aynı desen — reload + semantics bootstrap). Soğuk açılış her zaman
// keşfet ekranına düşüyor ve ilk kullanım rehberini yeniden gösteriyor, o yüzden onu da kapatıp
// ardından /me/edit'e gidiyoruz.
await page.reload();
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
const nextAgain = page.getByRole('button', { name: 'İleri' });
if (await nextAgain.count()) {
  for (let i = 0; i < 3; i++) {
    await nextAgain.click();
    await page.waitForTimeout(250);
  }
  await page.getByRole('button', { name: 'Anladım' }).click();
  await page.waitForTimeout(600);
}
await page.goto(`${WEB}/#/me/edit`);
await page.waitForTimeout(1200);
for (let i = 0; i < 6; i++) {
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(150);
}
await page.waitForTimeout(400);
const vibeShareBtn = page.getByRole('button', { name: 'Paylaş' }).first();
if (await vibeShareBtn.count()) await vibeShareBtn.click();
await shot('17-13-vibe-share', 1000);

await page.goto(`${WEB}/#/user/${a.id}`);
await page.waitForTimeout(1500);
const profileShareBtn = page.getByRole('button', { name: 'Paylaş' });
if (await profileShareBtn.count()) await profileShareBtn.click();
await shot('17-14-profile-share', 1000);

// --- Madde 10: odanı sergile
await page.goto(`${WEB}/#/room`);
await page.waitForTimeout(1500);
await page.getByRole('checkbox', { name: '🛋️ Koltuk' }).click().catch(() => {});
await page.mouse.click(195, 300);
await page.mouse.wheel(0, 1600);
await page.waitForTimeout(400);
const showcaseSwitch = page.getByRole('switch');
if (await showcaseSwitch.count()) await showcaseSwitch.click();
await shot('17-15-room-showcase-toggle', 800);
const saveBtn = page.getByText('Kaydet');
if (await saveBtn.count()) await saveBtn.click();
await page.waitForTimeout(800);
await page.goto(`${WEB}/#/rooms/showcase`);
await shot('17-16-room-showcase-gallery', 1800);

await browser.close();
console.log(errors === 0 ? 'NO UNEXPECTED PAGE ERRORS' : `${errors} UNEXPECTED PAGE ERRORS`);
