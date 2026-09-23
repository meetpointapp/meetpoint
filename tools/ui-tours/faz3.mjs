// Faz 3 UI turu: kayıt + e-posta kodu, şifremi unuttum, mavi tik, hesap silme, yasaklanma
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB, B, REPO, call, latestCode } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const uploads = `${REPO}/server/uploads`;
const samplePhoto = `${uploads}/${fs.readdirSync(uploads).find((f) => f.endsWith('-0.png'))}`;
const tag = Date.now();
const email = `ui${tag}@test.com`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('page error:', e.message));
const shot = async (name, wait = 1200) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};
// Otomatik odaklı alanlar için: önce odağı al, sonra alana tıkla
const typeInto = async (name, text, blurAt = [195, 120]) => {
  await page.mouse.click(...blurAt);
  await page.waitForTimeout(300);
  await page.getByRole('textbox', { name }).click();
  await page.waitForTimeout(300);
  await page.keyboard.type(text, { delay: 20 });
  await page.waitForTimeout(400);
};
const boot = async () => {
  await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
  await page.locator('flt-semantics-placeholder').dispatchEvent('click');
  await page.waitForTimeout(3000);
};

await page.goto(WEB);
await boot();

// 1) Kayıt: koşul onayı olmadan kayıt olmamalı
await page.getByRole('button', { name: 'Hesabın yok mu? Kayıt ol' }).click();
await page.waitForTimeout(800);
await page.getByRole('textbox', { name: 'E-posta' }).fill(email);
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('button', { name: 'Kayıt ol' }).click();
await shot('a1-register-no-consent', 800);
await page.getByRole('checkbox').first().click();
await shot('a2-register-consent', 500);
await page.getByRole('button', { name: 'Kayıt ol' }).click();
await shot('a3-verify-email', 2500);

// 2) E-posta kodu
const code = await latestCode(email);
await typeInto('000000', code);
await shot('a4-after-verify', 2500);
const onboardingVisible = await page.getByText('Adın ne?').count();
console.log('onboarding after verify:', onboardingVisible > 0);

// Kaydı tamamla (kısa yol: API ile profil + foto, sonra yenile)
const login = await call(null, 'POST', '/auth/login', { email, password: 'password123' });
await call(login.token, 'PUT', '/me/profile', {
  displayName: 'Deniz', birthDate: '1996-04-04', gender: 'male', interestedIn: 'female',
  interests: ['coffee', 'music', 'travel'], lookingFor: 'relationship',
});
const fd = new FormData();
fd.append('photo', new Blob([fs.readFileSync(samplePhoto)], { type: 'image/png' }), 'p.png');
await fetch(`${B}/me/photos`, { method: 'POST', headers: { authorization: `Bearer ${login.token}` }, body: fd });
await page.reload();
await boot();

// 3) Keşfet: mavi tikli profiller
await shot('a5-discover-badge', 1500);

// 4) Profil sekmesi: mavi tik kartı + yasal + hesap silme
await page.mouse.click(351, 812);
await shot('a6-me', 2000);
await page.getByRole('button', { name: /Profilini doğrula/ }).click();
await shot('a7-verify-pose', 2500);
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 10000 }),
  page.getByRole('button', { name: 'Selfie çek' }).click(),
]);
await chooser.setFiles(samplePhoto);
await shot('a8-selfie-preview', 2000);
await page.getByRole('button', { name: 'Gönder' }).click();
await shot('a9-submitted', 2000);
await page.getByRole('button', { name: 'Tamam' }).click();
await shot('a10-me-pending', 2000);

// Yönetici onaylasın -> rozet
const admin = await call(null, 'POST', '/auth/login', { email: 'admin@meetpoint.dev', password: 'password123' });
const queue = await call(admin.token, 'GET', '/admin/api/verifications');
const mine = queue._arr.find((v) => v.user.email === email);
await call(admin.token, 'POST', `/admin/api/verifications/${mine.id}/approve`, {});
await page.reload();
await boot();
await page.mouse.click(351, 812);
await shot('a11-me-verified', 2000);

// 5) Hesap silme diyaloğu
await page.mouse.wheel(0, 600);
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Hesabı sil' }).click();
await shot('a12-delete-dialog', 1000);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// 6) Yasaklanma: yönetici yasaklar, uygulama bir sonraki istekte çıkış yapar ve uyarı gösterir
const me = await call(login.token, 'GET', '/me').catch(() => ({}));
const users = await call(admin.token, 'GET', `/admin/api/users?q=${encodeURIComponent(email)}`);
await call(admin.token, 'POST', `/admin/api/users/${users._arr[0].id}/ban`, { reason: 'test' });
await page.mouse.click(273, 812); // cüzdan sekmesi -> API çağrısı
await page.waitForTimeout(1500);
await page.mouse.click(39, 812);
await shot('a13-banned', 2500);
const bannedShown = await page.getByText(/askıya alındı/).count();
console.log('banned notice shown:', bannedShown > 0, me.id ? '' : '');

// 7) Şifremi unuttum (test hesabı)
await page.getByRole('button', { name: 'Şifremi unuttum' }).click();
await page.waitForTimeout(1000);
await typeInto('E-posta', 'test@meetpoint.dev');
await page.getByRole('button', { name: 'Kod gönder' }).click();
await shot('a14-reset-code', 2000);
const resetCode = await latestCode('test@meetpoint.dev');
await typeInto('000000', resetCode);
await page.getByRole('textbox', { name: 'Yeni şifre' }).click();
await page.keyboard.type('password123', { delay: 15 });
await page.getByRole('button', { name: 'Kaydet' }).click();
await shot('a15-after-reset', 3000);
console.log('logged in after reset:', (await page.getByRole('button', { name: 'Kod gönder' }).count()) === 0);
await browser.close();
