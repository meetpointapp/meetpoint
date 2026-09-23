// Faz 7: para çekme talebi (IBAN/PayPal), manuel onay, red/iptal iadesi, yönetim paneli
// Test sunucusu kısa arama zamanlamalarıyla çalışır (test/env.ts).
import { describe, it } from 'vitest';
import { call, check, registerVerified, upload } from '../helpers';

describe('Para çekme (Faz 7)', () => {
  it('senaryo', async () => {
    const tag = Date.now();
    async function makeUser(name, gender, interestedIn) {
      const u = await registerVerified(`${name.toLowerCase()}p${tag}@test.com`);
      await call(u.t, 'PUT', '/me/profile', { displayName: name, birthDate: '1995-02-02', gender, interestedIn });
      await upload(u.t, '/me/photos', 'photo');
      return u;
    }
    const admin = (await call(null, 'POST', '/auth/login', { email: 'admin@meetpoint.dev', password: 'password123' })).token;
    const wallet = (u) => call(u.t, 'GET', '/wallet');
    const TR_IBAN = 'TR33 0006 1005 1978 6457 8413 26'; // geçerli örnek IBAN

    const earner = await makeUser('Ece', 'female', 'male');
    const payer = await makeUser('Emre', 'male', 'female');
    await call(payer.t, 'POST', '/wallet/dev-topup', { packId: 'coins_6000' });

    // Kazanç: görüntülü arama + 9 elmas hediye = 30 + 2250
    const c = await call(payer.t, 'POST', '/calls', { toId: earner.id, kind: 'VIDEO' });
    await call(earner.t, 'POST', `/calls/${c.id}/accept`);
    for (let i = 0; i < 9; i++) await call(payer.t, 'POST', `/calls/${c.id}/gifts`, { giftId: 'diamond' });
    await call(payer.t, 'POST', `/calls/${c.id}/hangup`);
    let w = await wallet(earner);
    check('earner cashable 2280', w.cashable === 2280, `cashable=${w.cashable} bal=${w.balance}`);
    check('wallet exposes cashout rules', w.cashout?.minCoins === 2000 && w.cashout?.usdPerCoin === 0.01 && w.cashout?.pending === null);

    const base = { coins: 2000, method: 'iban', accountName: 'Ece Yılmaz', accountValue: TR_IBAN };

    // Mavi tik şart
    const noVerify = await call(earner.t, 'POST', '/payouts', base);
    check('unverified cannot cash out', noVerify.http === 403 && noVerify.error === 'verification_required');
    await call(earner.t, 'POST', '/me/verification/start');
    await upload(earner.t, '/me/verification', 'selfie');
    const q = await call(admin, 'GET', '/admin/api/verifications');
    await call(admin, 'POST', `/admin/api/verifications/${q._arr.find((v) => v.user?.id === earner.id || v.userId === earner.id)?.id}/approve`, {});
    check('earner verified', (await call(earner.t, 'GET', '/me')).verificationStatus === 'approved');

    // Doğrulamalar
    const below = await call(earner.t, 'POST', '/payouts', { ...base, coins: 1999 });
    check('below minimum rejected', below.http === 400 && below.error === 'below_minimum');
    const tooMuch = await call(earner.t, 'POST', '/payouts', { ...base, coins: 2500 });
    check('more than cashable rejected', tooMuch.http === 402 && tooMuch.error === 'insufficient_cashable');
    const badIban = await call(earner.t, 'POST', '/payouts', { ...base, accountValue: 'TR33 0006 1005 1978 6457 8413 27' });
    check('bad IBAN checksum rejected', badIban.http === 400 && badIban.error === 'invalid_iban');
    const noName = await call(earner.t, 'POST', '/payouts', { ...base, accountName: '' });
    check('IBAN needs account holder', noName.http === 400 && noName.error === 'account_name_required');
    const badPaypal = await call(earner.t, 'POST', '/payouts', { ...base, method: 'paypal', accountValue: 'not-an-email' });
    check('PayPal needs email', badPaypal.http === 400);
    const payerTry = await call(payer.t, 'POST', '/payouts', base);
    check('purchased coins cannot be cashed out', payerTry.http === 403 || payerTry.http === 402);

    // Talep → iptal → jeton geri, yine bozdurulabilir
    const p1 = await call(earner.t, 'POST', '/payouts', base);
    check('payout requested', p1.http === 201 && p1.status === 'PENDING' && p1.usd === 20 && p1.accountHint === '•••• 1326', JSON.stringify(p1).slice(0, 140));
    w = await wallet(earner);
    check('coins deducted on request', w.cashable === 280 && w.cashout.pending?.id === p1.id, `cashable=${w.cashable}`);
    const dup = await call(earner.t, 'POST', '/payouts', { ...base, coins: 2000 });
    check('only one pending payout', dup.http === 409 || dup.http === 402);
    const del = await call(earner.t, 'DELETE', '/me', { password: 'password123' });
    check('cannot delete account with pending payout', del.http === 409 && del.error === 'payout_pending');
    const otherCancel = await call(payer.t, 'POST', `/payouts/${p1.id}/cancel`);
    check('others cannot cancel', otherCancel.http === 404);
    const cancel = await call(earner.t, 'POST', `/payouts/${p1.id}/cancel`);
    check('payout cancelled', cancel.http === 200 && cancel.status === 'CANCELLED');
    w = await wallet(earner);
    check('cancel restores cashable', w.cashable === 2280 && w.cashout.pending === null, `cashable=${w.cashable}`);
    const cancel2 = await call(earner.t, 'POST', `/payouts/${p1.id}/cancel`);
    check('double cancel -> 409', cancel2.http === 409);

    // Talep → yönetim reddeder → jeton geri
    const p2 = await call(earner.t, 'POST', '/payouts', { ...base, method: 'paypal', accountName: '', accountValue: 'Ece@Example.com' });
    check('paypal payout requested', p2.http === 201 && p2.accountHint === 'e•••@example.com', p2.accountHint);
    const pend = await call(admin, 'GET', '/admin/api/payouts');
    const adminRow = pend._arr?.find((p) => p.id === p2.id);
    check('admin sees full account + user info', adminRow?.accountValue === 'ece@example.com' && adminRow?.user?.verified === true && adminRow?.user?.cashableLeft === 280);
    const noAuth = await call(earner.t, 'GET', '/admin/api/payouts');
    check('payout admin API needs admin', noAuth.http === 403);
    const rejectNoNote = await call(admin, 'POST', `/admin/api/payouts/${p2.id}/reject`, { note: '' });
    check('reject needs a reason', rejectNoNote.http === 400);
    await call(admin, 'POST', `/admin/api/payouts/${p2.id}/reject`, { note: 'PayPal hesabı doğrulanamadı' });
    w = await wallet(earner);
    check('reject restores cashable', w.cashable === 2280);
    const mine = await call(earner.t, 'GET', '/payouts');
    check('user sees rejection reason', mine._arr?.find((p) => p.id === p2.id)?.adminNote === 'PayPal hesabı doğrulanamadı');

    // Talep → yönetim öder
    const p3 = await call(earner.t, 'POST', '/payouts', { ...base, coins: 2200 });
    const paid = await call(admin, 'POST', `/admin/api/payouts/${p3.id}/pay`, { reference: 'EFT-2026-0001' });
    check('admin marks paid', paid.http === 200 && paid.status === 'PAID' && paid.usd === 22);
    const payAgain = await call(admin, 'POST', `/admin/api/payouts/${p3.id}/pay`, { reference: 'EFT-2026-0002' });
    check('cannot pay twice', payAgain.http === 409);
    const rejectPaid = await call(admin, 'POST', `/admin/api/payouts/${p3.id}/reject`, { note: 'geç kalmış red' });
    check('cannot reject paid payout', rejectPaid.http === 409);
    w = await wallet(earner);
    check('paid coins stay deducted', w.cashable === 80 && w.entries.some((e) => e.type === 'CASHOUT' && e.amount === -2200), `cashable=${w.cashable}`);
    const stats = await call(admin, 'GET', '/admin/api/stats');
    check('stats include payouts', stats.payoutsPaidUsd >= 22 && typeof stats.payoutsPending === 'number');

    // Hesap silinse de ödenmiş kayıt yönetimde kalır
    const delOk = await call(earner.t, 'DELETE', '/me', { password: 'password123' });
    check('account deletable after payouts settle', delOk.http === 200);
    const paidList = await call(admin, 'GET', '/admin/api/payouts?status=PAID');
    const kept = paidList._arr?.find((p) => p.id === p3.id);
    check('paid record kept after deletion', kept && kept.user === null && kept.email.startsWith('ecep'));
  });
});
