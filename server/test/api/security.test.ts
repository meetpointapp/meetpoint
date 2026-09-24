// Faz 3: güven ve güvenlik testleri
import { describe, it } from 'vitest';
import { B, call, check, makeAdmin, registerVerified, upload, latestCode, PRIVATE_DIR, TEST_PASSWORD } from '../helpers';

describe('Güvenlik ve güven (Faz 3)', () => {
  it('senaryo', async () => {
    const tag = Date.now();
    const profile = (name, gender, interestedIn) => ({ displayName: name, birthDate: '1995-03-03', gender, interestedIn });

    // --- 1. Kayıt: koşul onayı zorunlu, e-posta doğrulanmadan uygulama kullanılamaz
    const noTerms = await call(null, 'POST', '/auth/register', { email: `x${tag}@test.com`, password: TEST_PASSWORD });
    check('register without terms rejected', noTerms.http === 400);

    const email = `sec${tag}@test.com`;
    const reg = await call(null, 'POST', '/auth/register', { email, password: TEST_PASSWORD, acceptTerms: true });
    check('register ok', reg.http === 201);
    const meUnverified = await call(reg.token, 'GET', '/me');
    check('GET /me allowed before verification', meUnverified.http === 200 && meUnverified.emailVerified === false);
    const blocked = await call(reg.token, 'PUT', '/me/profile', profile('Sec', 'male', 'female'));
    check('app blocked before email verification', blocked.http === 403 && blocked.error === 'email_not_verified');

    const resendTooSoon = await call(reg.token, 'POST', '/auth/resend-code');
    check('resend cooldown enforced', resendTooSoon.http === 429 && resendTooSoon.error === 'code_cooldown');

    const code = await latestCode(email);
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
    const bad = await call(reg.token, 'POST', '/auth/verify-email', { code: wrong });
    check('wrong code rejected', bad.http === 400 && bad.error === 'code_invalid');
    const good = await call(reg.token, 'POST', '/auth/verify-email', { code });
    check('correct code verifies', good.http === 200);
    const reuse = await call(reg.token, 'POST', '/auth/verify-email', { code });
    check('code cannot be reused', reuse.http === 400);
    const noConsent = await call(reg.token, 'PUT', '/me/profile', profile('Sec', 'male', 'female'));
    check('profile needs orientation consent', noConsent.http === 403 && noConsent.error === 'consent_required' && noConsent.kind === 'special_category');
    await call(reg.token, 'PUT', '/me/consents', { kind: 'special_category', granted: true, source: 'onboarding' });
    const after = await call(reg.token, 'PUT', '/me/profile', profile('Sec', 'male', 'female'));
    check('app allowed after verification', after.http === 200);

    // Kod deneme sınırı: 5 yanlış denemeden sonra doğru kod da geçersiz
    const email2 = `brute${tag}@test.com`;
    const reg2 = await call(null, 'POST', '/auth/register', { email: email2, password: TEST_PASSWORD, acceptTerms: true });
    const code2 = await latestCode(email2);
    const wrong2 = String((Number(code2) + 7) % 1_000_000).padStart(6, '0');
    for (let i = 0; i < 5; i++) await call(reg2.token, 'POST', '/auth/verify-email', { code: wrong2 });
    const lockedOut = await call(reg2.token, 'POST', '/auth/verify-email', { code: code2 });
    check('code locked after 5 wrong attempts', lockedOut.http === 400 && lockedOut.error === 'code_expired');

    // --- 2. Şifre sıfırlama: eski oturumlar kapanır
    const unknown = await call(null, 'POST', '/auth/forgot-password', { email: `nobody${tag}@test.com` });
    check('forgot-password does not reveal accounts', unknown.http === 200);
    const forgot = await call(null, 'POST', '/auth/forgot-password', { email });
    check('forgot-password ok', forgot.http === 200);
    const resetCode = await latestCode(email);
    const reset = await call(null, 'POST', '/auth/reset-password', { email, code: resetCode, password: 'newpassword456' });
    check('password reset ok', reset.http === 200 && !!reset.token);
    const oldToken = await call(reg.token, 'GET', '/me');
    check('old session invalidated after reset', oldToken.http === 401);
    const oldPw = await call(null, 'POST', '/auth/login', { email, password: TEST_PASSWORD });
    check('old password rejected', oldPw.http === 401);
    const newPw = await call(null, 'POST', '/auth/login', { email, password: 'newpassword456' });
    check('new password works', newPw.http === 200);
    const secToken = newPw.token;

    // --- 3. Yönetim paneli yetkisi
    const notAdmin = await call(secToken, 'GET', '/admin/api/stats');
    check('non-admin blocked from admin api', notAdmin.http === 403);
    const admin = (await makeAdmin('moderator')).t;
    const stats = await call(admin, 'GET', '/admin/api/stats');
    check('admin sees stats', stats.http === 200 && typeof stats.users === 'number');

    // --- 4. Mavi tik: poz ata, selfie yükle, panelden onayla
    const noStart = await upload(secToken, '/me/verification', 'selfie');
    check('selfie without start rejected', noStart.http === 409);
    const noSelfieConsent = await call(secToken, 'POST', '/me/verification/start');
    check('verification needs selfie consent', noSelfieConsent.http === 403 && noSelfieConsent.kind === 'selfie');
    await call(secToken, 'PUT', '/me/consents', { kind: 'selfie', granted: true, source: 'verification' });
    const start = await call(secToken, 'POST', '/me/verification/start');
    check('verification start returns pose', start.http === 200 && !!start.pose, start.pose);
    const selfie = await upload(secToken, '/me/verification', 'selfie');
    check('selfie uploaded -> pending', selfie.http === 201);
    const secMe = await call(secToken, 'GET', '/me');
    check('status is pending', secMe.verificationStatus === 'pending');
    // Gerçek selfie dosyası herkese açık adreslerden erişilemez olmalı
    const fs = await import('node:fs');
    const selfieDir = `${PRIVATE_DIR}/selfie`;
    const newest = fs.readdirSync(selfieDir).map((f) => ({ f, t: fs.statSync(`${selfieDir}/${f}`).mtimeMs })).sort((x, y) => y.t - x.t)[0].f;
    const key = `selfie/${newest}`;
    const viaUploads = await fetch(`${B}/uploads/${key}`).then((r) => r.status);
    const viaPrivate = await fetch(`${B}/private-uploads/${key}`).then((r) => r.status);
    const viaMedia = await fetch(`${B}/media/${key}`).then((r) => r.status);
    check('selfie not served publicly', viaUploads !== 200 && viaPrivate !== 200 && viaMedia !== 200, `uploads=${viaUploads} private=${viaPrivate} media=${viaMedia}`);
    const queue = await call(admin, 'GET', '/admin/api/verifications');
    const mine = queue._arr?.find((v) => v.user.id === secMe.id);
    check('verification in admin queue', !!mine);
    const selfieFile = await fetch(`${B}/admin/api/verifications/${mine.id}/selfie`, {
      headers: { authorization: `Bearer ${admin}` },
    });
    check('admin can view selfie', selfieFile.status === 200);
    const selfieNoAuth = await fetch(`${B}/admin/api/verifications/${mine.id}/selfie`);
    check('selfie requires admin auth', selfieNoAuth.status === 401);
    await call(admin, 'POST', `/admin/api/verifications/${mine.id}/approve`, {});
    const verifiedMe = await call(secToken, 'GET', '/me');
    check('approved -> verified badge', verifiedMe.verificationStatus === 'approved' && verifiedMe.profile?.verified === true);

    // --- 5. Şikayet ve yasaklama
    const bad1 = await registerVerified(`troll${tag}@test.com`);
    await call(bad1.t, 'PUT', '/me/profile', profile('Troll', 'female', 'male'));
    await upload(bad1.t, '/me/photos', 'photo');
    await call(bad1.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    // Troll'ün Sec'e bekleyen isteği var: yasaklanınca iade edilmeli
    const trollReq = await call(bad1.t, 'POST', '/requests', { toId: secMe.id, kind: 'MESSAGE', note: 'hey' });
    check('troll sent request', trollReq.http === 201);
    const rep = await call(secToken, 'POST', '/reports', { toId: bad1.id, reason: 'harassment', details: 'test' });
    check('report created', rep.http === 201);
    const reports = await call(admin, 'GET', '/admin/api/reports');
    const myReport = reports._arr?.find((r) => r.to.id === bad1.id);
    check('report visible to admin', !!myReport);
    await call(admin, 'POST', `/admin/api/reports/${myReport.id}/resolve`, { action: 'ban', reason: 'harassment' });
    const bannedCall = await call(bad1.t, 'GET', '/me');
    check('banned user session rejected', bannedCall.http === 403 && bannedCall.error === 'banned');
    const bannedLogin = await call(null, 'POST', '/auth/login', { email: `troll${tag}@test.com`, password: TEST_PASSWORD });
    check('banned user cannot log in', bannedLogin.http === 403);
    const hidden = await call(secToken, 'GET', `/users/${bad1.id}`);
    check('banned profile hidden', hidden.http === 404);
    const trollReqAfter = await call(secToken, 'GET', '/requests?box=inbox');
    check('pending request from banned user closed', trollReqAfter._arr?.every((r) => r.id !== trollReq.id || r.status === 'CANCELLED'));
    const resolved = await call(admin, 'GET', '/admin/api/reports?status=RESOLVED');
    check('report resolved as banned', resolved._arr?.some((r) => r.id === myReport.id && r.resolution === 'banned'));

    // --- 6. Hesap silme: şifre gerekli, bekleyen istekler iade edilir
    const payer = await registerVerified(`payer${tag}@test.com`);
    await call(payer.t, 'PUT', '/me/profile', profile('Payer', 'male', 'female'));
    await call(payer.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    const victim = await registerVerified(`victim${tag}@test.com`);
    await call(victim.t, 'PUT', '/me/profile', profile('Victim', 'female', 'male'));
    const pr = await call(payer.t, 'POST', '/requests', { toId: victim.id, kind: 'MESSAGE', note: 'hi' });
    check('payer request created', pr.http === 201);
    const wrongPw = await call(victim.t, 'DELETE', '/me', { password: 'wrongpassword' });
    check('delete requires correct password', wrongPw.http === 401);
    const del = await call(victim.t, 'DELETE', '/me', { password: TEST_PASSWORD });
    check('account deleted', del.http === 200);
    const payerWallet = await call(payer.t, 'GET', '/wallet');
    // 50 hediye + 500 + 250 ilk alım bonusu; 50'lik istek iade edildi
    check('pending request refunded on delete', payerWallet.balance === 800, `balance=${payerWallet.balance}`);
    check('deleted account session closed', (await call(victim.t, 'GET', '/me')).http === 401);
    const hiddenVictim = await call(payer.t, 'GET', `/users/${victim.id}`);
    check('account hidden during grace period', hiddenVictim.http === 404);
    // Bekleme süresinde giriş: hesap geri gelir
    const restoredLogin = await call(null, 'POST', '/auth/login', { email: `victim${tag}@test.com`, password: TEST_PASSWORD });
    check('login during grace period restores account', restoredLogin.http === 200 && restoredLogin.restored === true);
    check('restored account visible again', (await call(payer.t, 'GET', `/users/${victim.id}`)).http === 200);

    // --- 7. Yasal sayfalar
    for (const doc of ['terms', 'privacy']) {
      for (const lang of ['tr', 'en']) {
        const r = await fetch(`${B}/legal/${doc}?lang=${lang}`);
        const html = await r.text();
        check(`legal ${doc}.${lang} served`, r.status === 200 && html.includes('<h2>'));
      }
    }

    // --- 8. Hız sınırlama: dakikada 30 mesaj
    const a = await registerVerified(`ra${tag}@test.com`);
    const b = await registerVerified(`rb${tag}@test.com`);
    await call(a.t, 'PUT', '/me/profile', profile('RA', 'male', 'female'));
    await call(b.t, 'PUT', '/me/profile', profile('RB', 'female', 'male'));
    await upload(a.t, '/me/photos', 'photo');
    await upload(b.t, '/me/photos', 'photo');
    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    const match = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
    let limited = false;
    for (let i = 0; i < 32; i++) {
      const r = await call(a.t, 'POST', `/conversations/${match.conversationId}/messages`, { body: `m${i}` });
      if (r.http === 429 && r.error === 'rate_limited') {
        limited = i >= 30;
        break;
      }
    }
    check('message spam rate-limited after 30/min', limited);
  });
});
