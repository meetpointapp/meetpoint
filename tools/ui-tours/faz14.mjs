// Faz 14 UI turu: satın alma öncesi onay, bildirim ayarları, yardım merkezi, destek talebi (+ panelden yanıt),
// yönetim paneli Destek sekmesi (talep, SSS, künye)
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import { B, REPO, WEB, call, latestCode, upload } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const tag = Date.now();
const PASSWORD = 'Meet-Point-Tour-2026!';

// Sunucunun paketleri: 2FA kodu ve yönetici rolü vermek için
const req = createRequire(`${REPO}/server/package.json`);
const OTPAuth = req('otpauth');
process.env.DATABASE_URL ??= 'postgresql://meetpoint:meetpoint-dev@localhost:5433/meetpoint';
const { PrismaClient } = req('@prisma/client');
const db = new PrismaClient();

async function registerVerified(email) {
  const r = await call(null, 'POST', '/auth/register', { email, password: PASSWORD, acceptTerms: true, consents: { overseas: true } });
  if (r.status !== 201) throw new Error(`register ${r.status} ${r.error}`);
  await call(r.token, 'POST', '/auth/verify-email', { code: await latestCode(email) });
  await call(r.token, 'PUT', '/me/consents', { kind: 'special_category', granted: true, source: 'onboarding' });
  return { t: r.token, id: r.userId, email };
}

const deniz = await registerVerified(`deniz${tag}@test.com`);
await call(deniz.t, 'PUT', '/me/profile', { displayName: 'Deniz', birthDate: '1996-04-12', gender: 'female', interestedIn: 'male', city: 'İstanbul' });
await upload(deniz.t, '/me/photos', 'photo');

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('page error:', e.message));
const shot = async (p, name, wait = 1200) => {
  await p.waitForTimeout(wait);
  await p.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};
const nav = async (x) => {
  await page.mouse.click(x, 812);
  await page.waitForTimeout(1500);
};

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill(deniz.email);
await page.getByRole('textbox', { name: 'Şifre' }).fill(PASSWORD);
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(4000);

// 1. Cüzdan: pakete dokun → satın alma öncesi onay
await nav(273);
await shot(page, '140-wallet', 1500);
await page.getByRole('button', { name: /1\.000 jeton|1000 jeton/ }).first().click();
await shot(page, '141-sales-terms', 1500);
await page.getByRole('checkbox').first().click();
await shot(page, '142-sales-terms-checked', 600);
await page.getByRole('button', { name: 'Onayla ve devam et' }).click();
await shot(page, '143-purchased', 2500);
await page.mouse.wheel(0, 500);
await shot(page, '144-wallet-terms-line', 1000);

// 2. Profil › Bildirimler
await nav(351);
await page.getByRole('button', { name: 'Bildirimler' }).click();
await shot(page, '145-notifications', 2000);
await page.getByRole('switch', { name: /Sessiz saatleri aç/ }).click();
await shot(page, '146-quiet-hours', 1500);
await page.goBack();
await page.waitForTimeout(1200);

// 3. Yardım ve destek
await page.getByRole('button', { name: /Yardım ve destek/ }).click();
await shot(page, '147-help', 2500);
await page.getByRole('textbox').first().fill('iade');
await shot(page, '148-help-search', 2500);

// 4. Yeni talep
await page.getByRole('button', { name: 'Bize yaz' }).click();
await page.waitForTimeout(1200);
await page.getByRole('checkbox', { name: 'Jeton ve ödeme' }).click().catch(() => page.getByText('Jeton ve ödeme').click());
await page.getByRole('textbox', { name: 'Başlık' }).fill('Bonus jetonlarım görünmüyor');
await page.getByRole('textbox', { name: /Ne oldu/ }).fill('İlk alımda %50 bonus yazıyordu ama bakiyemde göremedim, kontrol eder misiniz?');
await shot(page, '149-new-ticket', 800);
await page.getByRole('button', { name: 'Gönder' }).click();
await shot(page, '150-ticket-sent', 2500);

// Panelden yanıt (API) → kullanıcı yazışmayı görür
const ticket = (await call(deniz.t, 'GET', '/support/tickets')).tickets[0];
const staffEmail = `destek${tag}@staff.test`;
const staff = await registerVerified(staffEmail);
await db.user.update({ where: { id: staff.id }, data: { isAdmin: true, adminRole: 'super' } });
const setup = await call(staff.t, 'POST', '/admin/api/mfa/setup');
const totp = (s, offset = 0) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(s), digits: 6, period: 30 }).generate({ timestamp: Date.now() + offset * 30_000 });
await call(staff.t, 'POST', '/admin/api/mfa/enable', { code: totp(setup.secret) });
await call(staff.t, 'POST', `/admin/api/support/tickets/${ticket.id}/reply`, {
  body: 'Merhaba Deniz, kontrol ettik: 500 bonus jeton bakiyene eklenmiş, Cüzdan ekranını aşağı çekip yenilersen görünür. İyi eğlenceler! 💛',
});
// Uygulamanın geri düğmesiyle yardım merkezine dön (talep ekranı yeni talep ekranının yerine açıldı)
await page.getByRole('button', { name: /Geri|Back/ }).first().click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Destek taleplerim/ }).click();
await shot(page, '151-my-tickets', 2000);
await page.getByRole('button', { name: /Bonus jetonlarım/ }).click();
await shot(page, '152-ticket-thread', 2500);

// 5. Yönetim paneli: Destek sekmesi
const admin = await ctx.newPage();
await admin.setViewportSize({ width: 1280, height: 900 });
await admin.goto(`${B}/admin/`);
await admin.waitForTimeout(1200);
await admin.fill('#login-email', staffEmail);
await admin.fill('#login-password', PASSWORD);
await admin.click('#login-form button[type=submit]');
await admin.waitForTimeout(1500);
// Aynı 30 sn'lik kod tekrar kullanılamaz: bir sonraki pencerenin kodu (±1 pencere kabul edilir)
await admin.fill('#mfa-code', totp(setup.secret, 1));
await admin.click('#mfa-verify button[type=submit]');
await admin.waitForTimeout(2000);
await admin.click('.tab[data-tab="support"]');
await admin.waitForTimeout(1200);
// Yanıtlanan talep "Kullanıcıda" listesinde
await admin.click('[data-tstatus="ANSWERED"]');
await admin.waitForTimeout(1000);
await admin.click('[data-ticket-open]');
await shot(admin, '153-admin-tickets', 1500);
await admin.click('[data-sup="help"]');
await shot(admin, '154-admin-help', 1500);
await admin.click('[data-sup="company"]');
await shot(admin, '155-admin-company', 1500);

await browser.close();
await db.$disconnect();
