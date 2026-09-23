// Faz 6: dakika başı sesli/görüntülü arama, hediyeler, puanlama, geçmiş.
// Test sunucusu kısa arama zamanlamalarıyla çalışır (test/env.ts).
import { describe, it } from 'vitest';
import { B, call, check, listen, registerVerified, upload } from '../helpers';

describe('Aramalar (Faz 6)', () => {
  it('senaryo', async () => {
    const tag = Date.now();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function makeUser(name, gender, interestedIn) {
      const u = await registerVerified(`${name.toLowerCase()}c${tag}@test.com`);
      await call(u.t, 'PUT', '/me/profile', { displayName: name, birthDate: '1996-03-10', gender, interestedIn, city: 'Istanbul' });
      await upload(u.t, '/me/photos', 'photo');
      return u;
    }

    const bal = async (u) => (await call(u.t, 'GET', '/wallet')).balance;

    const caller = await makeUser('Kaan', 'male', 'female');
    const callee = await makeUser('Lale', 'female', 'male');
    const other = await makeUser('Mert', 'male', 'female');
    const outsider = await makeUser('Nil', 'female', 'male');

    // --- Fiyatlar cüzdanda
    const w0 = await call(caller.t, 'GET', '/wallet');
    check('wallet exposes call rates', w0.callRates?.VOICE === 15 && w0.callRates?.VIDEO === 30);
    check('wallet exposes gifts', w0.gifts?.length === 4 && w0.gifts[0].id === 'rose');

    // --- Yetersiz bakiye: 50 hediyeyi mesaj isteğine harca, sonra ara
    await call(other.t, 'POST', '/requests', { toId: outsider.id, kind: 'MESSAGE', note: 'hi' });
    const poor = await call(other.t, 'POST', '/calls', { toId: callee.id, kind: 'VOICE' });
    check('call without balance -> 402', poor.http === 402, `status=${poor.http}`);
    const badKind = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'FAX' });
    check('invalid call kind -> 400', badKind.http === 400);
    const self = await call(caller.t, 'POST', '/calls', { toId: caller.id, kind: 'VOICE' });
    check('cannot call yourself', self.http === 400);

    // --- Normal arama akışı
    await call(caller.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' }); // 50 + 500 + 250 = 800
    check('caller starts with 800', (await bal(caller)) === 800);
    const calleeSock = await listen(callee.t);
    const callerSock = await listen(caller.t);

    const c1 = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VOICE' });
    check('call created ringing', c1.http === 201 && c1.status === 'RINGING' && c1.direction === 'out' && c1.ratePerMin === 15, JSON.stringify(c1).slice(0, 120));
    const callId = c1.id;
    await sleep(200);
    check('callee got call:incoming', calleeSock.events.some((e) => e.name === 'call:incoming' && e.payload.id === callId && e.payload.direction === 'in'));
    check('no charge while ringing', (await bal(caller)) === 800);

    const busy = await call(outsider.t, 'POST', '/calls', { toId: callee.id, kind: 'VOICE' });
    check('callee busy -> 409', busy.http === 409 && busy.error === 'busy');
    const twice = await call(caller.t, 'POST', '/calls', { toId: other.id, kind: 'VOICE' });
    check('caller already in call -> 409', twice.http === 409 && twice.error === 'already_in_call');

    const stranger = await call(outsider.t, 'POST', `/calls/${callId}/accept`);
    check('outsider cannot accept', stranger.http === 404);
    const selfAccept = await call(caller.t, 'POST', `/calls/${callId}/accept`);
    check('caller cannot accept own call', selfAccept.http === 404);
    const peek = await call(outsider.t, 'GET', `/calls/${callId}`);
    check('outsider cannot read call', peek.http === 404);

    const acc = await call(callee.t, 'POST', `/calls/${callId}/accept`);
    check('accepted -> active, first minute billed', acc.status === 'ACTIVE' && acc.billedMinutes === 1, JSON.stringify(acc).slice(0, 160));
    check('simulation mode: no media without Agora', acc.media === null);
    const acc2 = await call(callee.t, 'POST', `/calls/${callId}/accept`);
    check('double accept -> 409', acc2.http === 409);
    await sleep(200);
    check('caller got call:accepted', callerSock.has('call:accepted'));
    check('caller charged 15', (await bal(caller)) === 785);

    await sleep(3300); // bir "dakika" daha
    const mid = await call(caller.t, 'GET', `/calls/${callId}`);
    check('second minute billed', mid.billedMinutes === 2 && mid.totalCoins === 30, `min=${mid.billedMinutes}`);
    check('caller got call:charged events', callerSock.events.filter((e) => e.name === 'call:charged').length >= 2);

    // --- Hediyeler
    const g = await call(caller.t, 'POST', `/calls/${callId}/gifts`, { giftId: 'rose' });
    check('gift sent', g.http === 200 && g.balance === 800 - 30 - 20, `bal=${g.balance}`);
    const gBad = await call(caller.t, 'POST', `/calls/${callId}/gifts`, { giftId: 'yacht' });
    check('invalid gift -> 400', gBad.http === 400);
    const gOut = await call(outsider.t, 'POST', `/calls/${callId}/gifts`, { giftId: 'rose' });
    check('outsider cannot gift', gOut.http === 404);
    const gBig = await call(callee.t, 'POST', `/calls/${callId}/gifts`, { giftId: 'diamond' });
    check('gift beyond balance -> 402', gBig.http === 402);
    await sleep(200);
    check('callee got call:gift', calleeSock.events.some((e) => e.name === 'call:gift' && e.payload.emoji === '🌹'));

    const rateEarly = await call(caller.t, 'POST', `/calls/${callId}/rate`, { rating: 5 });
    check('cannot rate active call', rateEarly.http === 409);

    // --- Kapatma
    const end = await call(callee.t, 'POST', `/calls/${callId}/hangup`);
    check('hangup -> ended', end.status === 'ENDED' && end.endReason === 'hangup');
    await sleep(200);
    check('caller got call:ended', callerSock.has('call:ended'));
    await sleep(3300);
    const fin = await call(caller.t, 'GET', `/calls/${callId}`);
    check('no billing after end', fin.billedMinutes === 2 && fin.totalCoins === 30 && fin.giftCoins === 20);
    check('caller final balance 750', (await bal(caller)) === 750);
    const cw = await call(callee.t, 'GET', '/wallet');
    check('callee earned 50 cashable (30 min + 20 gift)', cw.cashable === 50 && cw.balance === 100, `bal=${cw.balance} cash=${cw.cashable}`);

    // --- Puanlama
    const r1 = await call(caller.t, 'POST', `/calls/${callId}/rate`, { rating: 5 });
    check('caller rated', r1.http === 200);
    const r1b = await call(caller.t, 'POST', `/calls/${callId}/rate`, { rating: 4 });
    check('rate twice -> 409', r1b.http === 409);
    const r2bad = await call(callee.t, 'POST', `/calls/${callId}/rate`, { rating: 6 });
    check('rating out of range -> 400', r2bad.http === 400);
    const r2 = await call(callee.t, 'POST', `/calls/${callId}/rate`, { rating: 1, reportReason: 'harassment' });
    check('callee rated with report', r2.http === 200);
    const adminLogin = await call(null, 'POST', '/auth/login', { email: 'admin@meetpoint.dev', password: 'password123' });
    const reports = await call(adminLogin.token, 'GET', '/admin/api/reports');
    check('call report reaches admin', reports._arr?.some((r) => r.to.id === caller.id && r.reason === 'harassment'));

    // --- Cevapsız / ret / iptal
    const c2 = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VIDEO' });
    await sleep(4600);
    const missed = await call(caller.t, 'GET', `/calls/${c2.id}`);
    check('unanswered -> MISSED', missed.status === 'MISSED');
    const lateAccept = await call(callee.t, 'POST', `/calls/${c2.id}/accept`);
    check('cannot accept missed call', lateAccept.http === 409);

    const c3 = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VIDEO' });
    const dec = await call(callee.t, 'POST', `/calls/${c3.id}/hangup`);
    check('callee hangup while ringing -> DECLINED', dec.status === 'DECLINED');
    const c4 = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VIDEO' });
    const can = await call(caller.t, 'POST', `/calls/${c4.id}/hangup`);
    check('caller hangup while ringing -> CANCELLED', can.status === 'CANCELLED');
    check('no charge for unanswered calls', (await bal(caller)) === 750);

    // --- Bakiye bitince arama biter: sadece 50 hediyesi olan kullanıcı, görüntülü 30/dk
    const poorCaller = await makeUser('Oya', 'female', 'male');
    const poorSock = await listen(poorCaller.t);
    const c5 = await call(poorCaller.t, 'POST', '/calls', { toId: other.id, kind: 'VIDEO' });
    await call(other.t, 'POST', `/calls/${c5.id}/accept`);
    await sleep(200);
    check('low balance warning sent', poorSock.has('call:low_balance'));
    await sleep(3300);
    const ranOut = await call(poorCaller.t, 'GET', `/calls/${c5.id}`);
    check('call ends when balance runs out', ranOut.status === 'ENDED' && ranOut.endReason === 'balance' && ranOut.billedMinutes === 1, `${ranOut.http}/${ranOut.endReason}`);
    check('poor caller left with 20', (await bal(poorCaller)) === 20);

    // --- Bağlantı kopması: arayan düşerse süre sonunda arama biter
    const c6 = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VOICE' });
    await call(callee.t, 'POST', `/calls/${c6.id}/accept`);
    callerSock.s.disconnect();
    await sleep(2600);
    const dropped = await call(callee.t, 'GET', `/calls/${c6.id}`);
    check('disconnect -> ended after grace', dropped.status === 'ENDED' && dropped.endReason === 'disconnect', `${dropped.http}/${dropped.endReason}`);

    // --- Engelleme
    await call(callee.t, 'POST', '/blocks', { toId: poorCaller.id });
    const blocked = await call(poorCaller.t, 'POST', '/calls', { toId: callee.id, kind: 'VOICE' });
    check('blocked user cannot call', blocked.http === 404);

    // --- Geçmiş
    const hist = await call(callee.t, 'GET', '/calls');
    check('history lists calls newest first', hist._arr?.length === 5 && hist._arr[0].id === c6.id, `n=${hist._arr?.length}`);
    const h1 = hist._arr?.find((h) => h.id === callId);
    check('history item shape', h1?.direction === 'in' && h1?.user?.displayName === 'Kaan' && h1?.myRating === 1 && h1?.giftCoins === 20);
    const outHist = await call(outsider.t, 'GET', '/calls');
    check('outsider history empty', outHist._arr?.length === 0);

    calleeSock.s.disconnect();
    poorSock.s.disconnect();
  });
});
