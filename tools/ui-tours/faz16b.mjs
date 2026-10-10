// Faz 16 UI turu (duman testi, "Kimlik, premium katman ve mağaza"): kişisel vitrin, oda +
// avatar + ziyaret, "Kendini Keşfet" vibe testi, günlük ruh hali, ilgi alanı bazlı keşif,
// kozmetik mağaza, VibeUpMe+ abonelik ve eşleşme kutlaması (cilalı mikro-etkileşimler).
// `faz16.mjs` adı, yol haritası fazları yeniden numaralandırılmadan önce alındığı için (eski
// Faz 16 = bugünkü Faz 18 içeriği) bu betik `faz16b` olarak adlandırıldı.
// Gerçek mağaza (RevenueCat) ve gerçek cihaz bu ortamda test edilemez; abonelik/satın alma
// dev-topup / dev-subscribe test uçlarıyla doğrulanır.
import fs from 'node:fs';
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
    displayName: name,
    birthDate: '1996-04-12',
    gender,
    interestedIn,
    city: 'İstanbul',
    interests: ['coffee'], // ortak ilgi alanı: "İlgi alanı bazlı keşif" grubunda birlikte görünsünler
  });
  const fd = new FormData();
  fd.append('photo', new Blob([png], { type: 'image/png' }), 'p.png');
  await fetch(`${B}/me/photos`, { method: 'POST', headers: { authorization: `Bearer ${u.t}` }, body: fd });
  return { ...u, email };
}

const a = await makeUser('Vitrin16', 'male', 'female');
const b = await makeUser('Kahve16', 'female', 'male');
// B önceden beğenir: A kaydırırken hemen eşleşme oluşsun (paylaşılan kutlama overlay'i, madde 8)
await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
await call(a.t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' });

let errors = 0;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
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

// --- Madde 8 (önce): eşleşme + kutlama (cilalı mikro-etkileşimler) — B zaten beğenmişti
await shot('16b-01-discover', 1500);
await page.getByRole('button', { name: 'Kabul et' }).click();
await shot('16b-02-match-celebration', 1200);
await page.getByText('Keşfetmeye devam').click();
await page.waitForTimeout(600);

// --- Madde 1: kişisel profil vitrini (tema/arkaplan) — picker'ı görüntüle, sonra API ile ayarla
await page.goto(`${WEB}/#/me/edit`);
await shot('16b-03-profile-edit', 1500);
await page.getByRole('button', { name: 'Düzenle', exact: true }).nth(3).click();
await shot('16b-04-showcase-picker', 1000);
// Not: Navigator.push ile açılan bu alt sayfa URL'i değiştirmez (go_router imperative push),
// bu yüzden goBack() yerine doğrudan /me/edit'e dönülür (API ile ayarlanan tema hemen görünür)
await call(a.t, 'PUT', '/me/profile', {
  displayName: 'Vitrin16',
  birthDate: '1996-04-12',
  gender: 'male',
  interestedIn: 'female',
  interests: ['coffee'],
  themeId: 'sunset',
  cardBackgroundId: 'ocean',
});
// Not: az önceki Düzenle ekranı Navigator.push (imperative) ile açıldığı için URL değişmedi;
// aynı hash'e goto() bunu fark etmez. Önce başka bir rotaya gidip öyle dönülür.
await page.goto(`${WEB}/#/discover`);
await page.waitForTimeout(400);
await page.goto(`${WEB}/#/me/edit`);
await shot('16b-05-showcase-applied', 1500);

// --- Madde 2: kendi oda (dekore et) + avatar
await page.goto(`${WEB}/#/room`);
await page.waitForTimeout(1500);
await page.getByRole('checkbox', { name: '🛋️ Koltuk' }).click();
await page.mouse.click(195, 300); // ızgarada boş bir hücre (yaklaşık orta)
await shot('16b-06-room-editor', 800);
const saveBtn = page.getByText('Kaydet');
if (await saveBtn.count()) await saveBtn.click();
await shot('16b-07-room-saved', 1200);
// Ziyaret: eşleştiği kişinin odasını salt görüntüleme ile görsün
await page.goto(`${WEB}/#/user/${b.id}/room`);
await shot('16b-08-room-visit', 1500);

// --- Madde 3: "Kendini Keşfet" vibe testi — ilk soruyu UI'dan cevapla (akış/animasyon kanıtı)
await page.goto(`${WEB}/#/vibe`);
await shot('16b-09-vibe-q1', 1200);
await page.getByText('Spontane bir yol gezisi').click();
await shot('16b-10-vibe-q2', 900);
// Kalan soruları API ile tamamla (10 soru, her birinin ilk seçeneği) — gerçek bir arketip üretir
// (testin geri kalanı UI'da 10 soruyu tek tek tıklamak yerine, sonuç ekranlarını doğrulamaya odaklanır)
const vibeAnswers = {
  ideal_date: 'road_trip',
  flirt_style: 'direct',
  weekend: 'explore_new_place',
  communication: 'frequent_texts',
  conflict: 'talk_now',
  dream_trip: 'backpacking',
  friday_night: 'new_experience',
  gift_style: 'surprise_adventure',
  social_battery: 'crowd_energizes',
  love_language: 'adventure_together',
};
const vibeResult = await call(a.t, 'PUT', '/me/vibe', vibeAnswers);
console.log('vibe archetype', vibeResult.archetypeId);
await page.goto(`${WEB}/#/me/edit`);
await shot('16b-11-vibe-card', 1500);

// --- Madde 4: günlük ruh hali
await page.goto(`${WEB}/#/discover`);
await page.waitForTimeout(1200);
await page.getByText('Bugün nasıl hissediyorsun?').click();
await shot('16b-12-mood-sheet', 1000);
await page.getByRole('checkbox', { name: '😊 Mutlu' }).click();
await shot('16b-13-mood-set', 1200);

// --- Madde 5: ilgi alanı bazlı keşif ("Kahve Tutkunları" grubu, B ile ortak)
await page.goto(`${WEB}/#/discover`);
await shot('16b-14-groups-strip', 1500);
await page.getByText('Kahve Tutkunları').click();
await shot('16b-15-interest-group', 1500);

// --- Madde 6: kozmetik mağaza — bir eşya satın al
await page.goto(`${WEB}/#/store`);
await shot('16b-16-store', 1500);
await page.getByText(/^\d+ jeton$/).first().click();
await shot('16b-17-store-purchased', 1200);

// --- Madde 7: VibeUpMe+ abonelik (mağaza bağlı değilken dev-subscribe yolu)
await page.goto(`${WEB}/#/premium`);
await shot('16b-18-premium', 1200);
await page.getByRole('button', { name: 'Abone ol' }).click();
await shot('16b-19-premium-active', 1500);

// --- Madde 8 (devam): cüzdan bakiyesi artık sayarak akıyor (AnimatedCoinAmount)
await page.goto(`${WEB}/#/wallet`);
await shot('16b-20-wallet-balance', 1500);

await browser.close();
console.log(errors === 0 ? 'NO PAGE ERRORS' : `${errors} PAGE ERRORS`);
