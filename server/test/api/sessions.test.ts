// Faz 10: oturumlar, şifre politikası, giriş kilidi, bot koruması
import crypto from 'node:crypto';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, inject, it } from 'vitest';
import { spawnServer } from '../globalSetup';
import { FAKE_SECURITY_PORT, testEnv } from '../env';
import {
  B,
  call,
  check,
  latestCode,
  listen,
  mailsFor,
  registerVerified,
  sleep,
  TEST_PASSWORD,
  testDb,
  uniqueTag,
  waitFor,
} from '../helpers';

// Sızıntıda geçen şifre (sahte HIBP bu şifrenin özetini "görülmüş" döndürür)
const BREACHED = 'Sizinti-Sifre-2026!';
const breachedSha = crypto.createHash('sha1').update(BREACHED).digest('hex').toUpperCase();

// Sahte güvenlik servisleri: HIBP k-anonimlik aralığı + Turnstile doğrulaması
const fake = http.createServer((req, res) => {
  if (req.url?.startsWith('/range/')) {
    const prefix = req.url.slice('/range/'.length);
    const lines = ['0018A45C4D1DEF81644B54AB7F969B88D65:3', '00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0'];
    if (prefix === breachedSha.slice(0, 5)) lines.push(`${breachedSha.slice(5)}:42`);
    res.end(lines.join('\r\n'));
    return;
  }
  if (req.url === '/siteverify') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const ok = new URLSearchParams(body).get('response') === 'insan-token';
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ success: ok }));
    });
    return;
  }
  res.statusCode = 404;
  res.end();
});

beforeAll(() => new Promise<void>((r) => fake.listen(FAKE_SECURITY_PORT, () => r())));
afterAll(() => new Promise<void>((r) => fake.close(() => r())));

const device = (id: string, name = 'Test Telefonu') => ({ 'x-device-id': id, 'x-device-name': name, 'x-platform': 'android' });

async function post(p: string, body: unknown, headers: Record<string, string> = {}, token?: string, base?: string) {
  const res = await fetch((base ?? B) + p, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { ...(await res.json().catch(() => ({}))), http: res.status };
}

describe('Oturumlar ve hesap güvenliği (Faz 10)', () => {
  it('şifre politikası: yaygın, e-postaya benzer ve sızıntıda geçen şifreler reddedilir', async () => {
    const tag = uniqueTag();
    const common = await call(null, 'POST', '/auth/register', { email: `pw${tag}@test.com`, password: 'password123', acceptTerms: true });
    check('common password rejected', common.http === 400 && common.error === 'password_too_common', common.error);
    const fener = await call(null, 'POST', '/auth/register', { email: `pw${tag}@test.com`, password: 'Fenerbahce1907', acceptTerms: true });
    check('common TR password rejected (case-insensitive)', fener.error === 'password_too_common');
    const likeEmail = await call(null, 'POST', '/auth/register', { email: `zeynep${tag}@test.com`, password: `zeynep${tag}!`, acceptTerms: true });
    check('password containing email name rejected', likeEmail.error === 'password_too_common');
    const breached = await call(null, 'POST', '/auth/register', { email: `pw${tag}@test.com`, password: BREACHED, acceptTerms: true });
    check('breached password rejected', breached.http === 400 && breached.error === 'password_breached', breached.error);
    const short = await call(null, 'POST', '/auth/register', { email: `pw${tag}@test.com`, password: 'Kisa-1', acceptTerms: true });
    check('short password rejected', short.http === 400);
    const ok = await call(null, 'POST', '/auth/register', { email: `pw${tag}@test.com`, password: TEST_PASSWORD, acceptTerms: true });
    check('strong password accepted, both tokens returned', ok.http === 201 && !!ok.token && !!ok.refreshToken);

    // Şifreler Argon2id ile saklanır
    const db = await testDb();
    const user = await db.user.findUniqueOrThrow({ where: { email: `pw${tag}@test.com` } });
    check('stored as argon2id', user.passwordHash.startsWith('$argon2id$'));
  });

  it('yenileme jetonu döner; eski jeton tekrar gelirse oturum kapanır', async () => {
    const u = await registerVerified(`rot${uniqueTag()}@test.com`);
    const r1 = await call(null, 'POST', '/auth/refresh', { refreshToken: u.refresh });
    check('refresh ok', r1.http === 200 && !!r1.token && r1.refreshToken !== u.refresh);
    const me = await call(r1.token, 'GET', '/me');
    check('new access token works', me.http === 200);
    const oldAccess = await call(u.t, 'GET', '/me');
    check('old access token still valid until expiry (same session)', oldAccess.http === 200);

    // Eşzamanlı yenileme yarışı: kısa süre içinde eski jeton → 409, oturum kapanmaz
    const race = await call(null, 'POST', '/auth/refresh', { refreshToken: u.refresh });
    check('reuse within grace -> refresh_race', race.http === 409 && race.error === 'refresh_race');
    const r2 = await call(null, 'POST', '/auth/refresh', { refreshToken: r1.refreshToken });
    check('session survives the race', r2.http === 200);

    // Süre geçtikten sonra eski jeton gelirse: çalınmış sayılır, oturum kapanır
    const db = await testDb();
    await db.session.updateMany({ where: { userId: u.id }, data: { rotatedAt: new Date(Date.now() - 60_000) } });
    const stolen = await call(null, 'POST', '/auth/refresh', { refreshToken: r1.refreshToken });
    check('reused refresh token rejected', stolen.http === 401 && stolen.error === 'invalid_refresh');
    const legit = await call(null, 'POST', '/auth/refresh', { refreshToken: r2.refreshToken });
    check('whole session revoked after reuse', legit.http === 401);
    const access = await call(r2.token, 'GET', '/me');
    check('access token of revoked session rejected immediately', access.http === 401 && access.error === 'invalid_token');
    const row = await db.session.findFirst({ where: { userId: u.id } });
    check('revoke reason recorded', row?.revokeReason === 'refresh_reused');
  });

  it('süresi dolan erişim jetonu "token_expired" verir (uygulama yeniler)', async () => {
    const u = await registerVerified(`exp${uniqueTag()}@test.com`);
    const { sid, v } = jwt.decode(u.t) as { sid: string; v: number };
    const expired = jwt.sign({ sub: u.id, v, sid, exp: Math.floor(Date.now() / 1000) - 10 }, testEnv.JWT_SECRET);
    const r = await call(expired, 'GET', '/me');
    check('expired -> token_expired', r.http === 401 && r.error === 'token_expired');
    const forged = jwt.sign({ sub: u.id, v, sid }, 'baska-bir-anahtar-en-az-32-karakter-uzunlukta');
    check('forged -> invalid_token', (await call(forged, 'GET', '/me')).error === 'invalid_token');
    const noSid = jwt.sign({ sub: u.id, v }, testEnv.JWT_SECRET);
    check('old-style token without session rejected', (await call(noSid, 'GET', '/me')).error === 'invalid_token');
    const exp = (jwt.decode(u.t) as { exp: number; iat: number });
    check('access token lives 15 minutes', exp.exp - exp.iat === 900);
  });

  it('çıkış, cihazlarım, diğer cihazlardan çıkış ve yeni cihaz uyarısı', async () => {
    const email = `dev${uniqueTag()}@test.com`;
    const u = await registerVerified(email);
    const mailsBefore = mailsFor(email).length;

    const phone = await post('/auth/login', { email, password: TEST_PASSWORD }, device('telefon-1', 'Pixel 9'));
    check('login from new device', phone.http === 200);
    const newDeviceMail = await waitFor(() => mailsFor(email), (m) => m.length > mailsBefore, 3000);
    check('new device mail sent', newDeviceMail.at(-1)?.includes('yeni bir cihazdan') && newDeviceMail.at(-1)?.includes('Pixel 9'));
    const again = await post('/auth/login', { email, password: TEST_PASSWORD }, device('telefon-1', 'Pixel 9'));
    await sleep(300);
    check('same device again: no second mail', mailsFor(email).length === newDeviceMail.length);

    const list = await call(phone.token, 'GET', '/me/sessions');
    check('sessions listed', list._arr?.length === 3, String(list._arr?.length));
    check('current device flagged', list._arr?.filter((s) => s.current).length === 1 && list._arr.find((s) => s.current)?.deviceName === 'Pixel 9');
    check('ip masked', list._arr?.every((s) => !s.ip || s.ip.endsWith('*') || s.ip.endsWith('…')), list._arr?.map((s) => s.ip).join(','));

    // Anlık bağlantı da oturumla birlikte kapanır
    const sock = await listen(u.t);
    const target = list._arr.find((s) => !s.current);
    const revoke = await call(phone.token, 'DELETE', `/me/sessions/${target.id}`);
    check('revoke other device', revoke.http === 200);
    const otherTokens = [u.t, again.token];
    const results = await Promise.all(otherTokens.map((t) => call(t, 'GET', '/me')));
    check('exactly one other session killed', results.filter((r) => r.http === 401).length === 1);
    const foreign = await call((await registerVerified(`x${uniqueTag()}@test.com`)).t, 'DELETE', `/me/sessions/${list._arr[0].id}`);
    check("cannot revoke someone else's session", foreign.http === 404);

    const others = await call(phone.token, 'POST', '/me/sessions/revoke-others');
    check('revoke others', others.http === 200);
    check('first device logged out', (await call(u.t, 'GET', '/me')).http === 401);
    check('second device logged out', (await call(again.token, 'GET', '/me')).http === 401);
    check('this device still in', (await call(phone.token, 'GET', '/me')).http === 200);
    const disconnected = await waitFor(() => sock.s.connected, (c) => !c, 3000);
    check('realtime connection closed with the session', !disconnected);
    sock.s.close();

    const out = await call(phone.token, 'POST', '/auth/logout');
    check('logout ok', out.http === 200);
    check('access token dead after logout', (await call(phone.token, 'GET', '/me')).http === 401);
    check('refresh token dead after logout', (await call(null, 'POST', '/auth/refresh', { refreshToken: phone.refreshToken })).http === 401);
  });

  it('şifre değiştirme diğer oturumları kapatır; şifre sıfırlama hepsini', async () => {
    const email = `chg${uniqueTag()}@test.com`;
    const u = await registerVerified(email);
    const second = await call(null, 'POST', '/auth/login', { email, password: TEST_PASSWORD });

    const wrong = await call(u.t, 'POST', '/auth/change-password', { currentPassword: 'yanlis-sifre', newPassword: 'Yeni-Sifre-2026?' });
    check('wrong current password', wrong.http === 401);
    const same = await call(u.t, 'POST', '/auth/change-password', { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });
    check('same password rejected', same.error === 'password_same');
    const weak = await call(u.t, 'POST', '/auth/change-password', { currentPassword: TEST_PASSWORD, newPassword: 'qwerty123' });
    check('weak new password rejected', weak.error === 'password_too_common');
    const ok = await call(u.t, 'POST', '/auth/change-password', { currentPassword: TEST_PASSWORD, newPassword: 'Yeni-Sifre-2026?' });
    check('password changed', ok.http === 200);
    check('this session kept', (await call(u.t, 'GET', '/me')).http === 200);
    check('other session closed', (await call(second.token, 'GET', '/me')).http === 401);
    check('new password works', (await call(null, 'POST', '/auth/login', { email, password: 'Yeni-Sifre-2026?' })).http === 200);

    await call(null, 'POST', '/auth/forgot-password', { email });
    const code = await latestCode(email);
    const reset = await call(null, 'POST', '/auth/reset-password', { email, code, password: 'Sifirlanan-2026#' });
    check('reset ok with fresh session', reset.http === 200 && !!reset.refreshToken);
    check('all old sessions closed by reset', (await call(u.t, 'GET', '/me')).http === 401);
    check('reset session works', (await call(reset.token, 'GET', '/me')).http === 200);
  });

  it('hesap kilidi: 15 dakikada 10 hatalı giriş → doğru şifre de beklemeli', async () => {
    const email = `lock${uniqueTag()}@test.com`;
    await registerVerified(email);
    for (let i = 0; i < 10; i++) {
      const r = await call(null, 'POST', '/auth/login', { email, password: `yanlis-${i}` });
      if (r.http !== 401) check(`attempt ${i} -> 401`, false, String(r.http));
    }
    const locked = await call(null, 'POST', '/auth/login', { email, password: TEST_PASSWORD });
    check('locked even with the right password', locked.http === 429 && locked.error === 'account_locked', locked.error);
    // Başka hesap etkilenmez; bilinmeyen e-posta da aynı şekilde sayılır (hesap var mı belli olmaz)
    const other = await registerVerified(`free${uniqueTag()}@test.com`);
    check('other accounts unaffected', (await call(null, 'POST', '/auth/login', { email: other.email, password: TEST_PASSWORD })).http === 200);
    // Şifre sıfırlama kilidi kaldırır
    await call(null, 'POST', '/auth/forgot-password', { email });
    const code = await latestCode(email);
    await call(null, 'POST', '/auth/reset-password', { email, code, password: 'Kilit-Acildi-2026' });
    check('reset clears lock', (await call(null, 'POST', '/auth/login', { email, password: 'Kilit-Acildi-2026' })).http === 200);
  });

  it('cihaz başına hesap sınırı ve bot doğrulaması', async () => {
    const dev = `cihaz-${uniqueTag()}`;
    const reg = (tag: string, extra: Record<string, unknown> = {}, base?: string) =>
      post('/auth/register', { email: `${tag}${uniqueTag()}@test.com`, password: TEST_PASSWORD, acceptTerms: true, ...extra }, device(dev), undefined, base);
    for (let i = 0; i < 3; i++) check(`account ${i + 1} from device`, (await reg('d')).http === 201);
    const fourth = await reg('d');
    check('4th account from same device blocked', fourth.http === 429 && fourth.error === 'too_many_accounts');

    // Turnstile açık bir sunucu örneği (gizli anahtar tanımlı)
    const port = 4031;
    // Zamanlayıcı kapalı: çok sunuculu testin liderlik devrine karışmasın
    const extra = spawnServer(port, 'turnstile.log', inject('databaseUrl'), {
      SCHEDULER: 'off',
      TURNSTILE_SECRET: 'test-turnstile-secret',
      TURNSTILE_VERIFY_URL: `http://localhost:${FAKE_SECURITY_PORT}/siteverify`,
    });
    const base = `http://localhost:${port}`;
    await waitFor(() => fetch(`${base}/health`).then((r) => r.ok).catch(() => false), (ok) => ok, 60_000, 250);
    const other = `bot-${uniqueTag()}`;
    const regAt = (extra: Record<string, unknown>) =>
      post('/auth/register', { email: `bot${uniqueTag()}@test.com`, password: TEST_PASSWORD, acceptTerms: true, ...extra }, device(other), undefined, base);
    check('captcha required', (await regAt({})).error === 'captcha_required');
    check('bad captcha rejected', (await regAt({ captchaToken: 'bot-token' })).error === 'captcha_failed');
    check('human passes', (await regAt({ captchaToken: 'insan-token' })).http === 201);
    extra.kill();
  }, 90_000);
});
