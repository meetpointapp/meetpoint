// Faz 17 madde 8: davet programı. Kayıt hediyesiyle aynı mekanik (promosyon kovası, bozdurulamaz):
// davet edilen e-postasını doğrulayınca hem kendisi hem daveti gönderen bir kerelik bonus kazanır.
import { describe, it } from 'vitest';
import { call, check, latestCode, makeUser, testDb, uniqueTag } from '../helpers';

async function registerUnverified(name: string) {
  const email = `${name.toLowerCase()}${uniqueTag()}@test.com`;
  const r = await call(null, 'POST', '/auth/register', { email, password: 'Meet-Point-Test-2026!', acceptTerms: true });
  if (r.http !== 201) throw new Error(`register failed ${r.http} ${JSON.stringify(r)}`);
  return { t: r.token, id: r.userId, email };
}

describe('Davet programı (Faz 17)', () => {
  it('davet kodu ile katılan kullanıcı doğrulanınca her iki taraf da bonus kazanır', async () => {
    const referrer = await makeUser('Ref1a', 'male', 'female');
    const meReferrer = await call(referrer.t, 'GET', '/me');
    check('davet kodu var', typeof meReferrer.referralCode === 'string' && meReferrer.referralCode.length > 0);

    const referrerWalletBefore = await call(referrer.t, 'GET', '/wallet');

    const referee = await registerUnverified('Ref1b');
    const redeemed = await call(referee.t, 'POST', '/auth/referral-code', { code: meReferrer.referralCode });
    check('kod uygulandı', redeemed.http === 200);

    const verified = await call(referee.t, 'POST', '/auth/verify-email', { code: await latestCode(referee.email) });
    check('e-posta doğrulandı', verified.http === 200);

    const refereeWallet = await call(referee.t, 'GET', '/wallet');
    check('davet edilen bonus aldı (kayıt hediyesi + davet bonusu)', refereeWallet.balance === 100);

    const referrerWalletAfter = await call(referrer.t, 'GET', '/wallet');
    check('daveti gönderen de bonus aldı', referrerWalletAfter.balance - referrerWalletBefore.balance === 50);

    const stats = await call(referrer.t, 'GET', '/me/referral');
    check('davet edilen sayısı 1', stats.totalReferred === 1);
    check('toplam kazanç 50', stats.totalEarnedCoins === 50);
  });

  it('geçersiz kod reddedilir', async () => {
    const referee = await registerUnverified('Ref2a');
    const r = await call(referee.t, 'POST', '/auth/referral-code', { code: 'ZZZZZZZZ' });
    check('geçersiz kod reddedilir', r.http === 400 && r.error === 'invalid_code');
  });

  it('kendi kodunu kendine uygulayamaz', async () => {
    const referee = await registerUnverified('Ref3a');
    // GET /me doğrulama ister; henüz doğrulanmamış hesabın kendi kodunu doğrudan veritabanından okuyoruz
    const own = await (await testDb()).user.findUniqueOrThrow({ where: { id: referee.id }, select: { referralCode: true } });
    const r = await call(referee.t, 'POST', '/auth/referral-code', { code: own.referralCode });
    check('kendi kodu reddedilir', r.http === 400 && r.error === 'invalid_code');
  });

  it('bir kod uygulandıktan sonra ikincisi reddedilir', async () => {
    const a = await makeUser('Ref4a', 'male', 'female');
    const meA = await call(a.t, 'GET', '/me');
    const b = await makeUser('Ref4b', 'male', 'female');
    const meB = await call(b.t, 'GET', '/me');
    const referee = await registerUnverified('Ref4c');
    const first = await call(referee.t, 'POST', '/auth/referral-code', { code: meA.referralCode });
    check('ilk kod uygulandı', first.http === 200);
    const second = await call(referee.t, 'POST', '/auth/referral-code', { code: meB.referralCode });
    check('ikinci kod reddedilir', second.http === 400 && second.error === 'already_redeemed');
  });

  it('doğrulanmış hesap kod uygulayamaz', async () => {
    const referrer = await makeUser('Ref5a', 'male', 'female');
    const meReferrer = await call(referrer.t, 'GET', '/me');
    const already = await makeUser('Ref5b', 'male', 'female');
    const r = await call(already.t, 'POST', '/auth/referral-code', { code: meReferrer.referralCode });
    check('doğrulanmış hesapta reddedilir', r.http === 400 && r.error === 'email_already_verified');
  });
});
