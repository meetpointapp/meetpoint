// Faz 15: arama itirazı — geçmişten "yanlış ücret alındı" bildirimi, panelde inceleme, onaylanırsa
// arayana iade (alıcının olgunlaşmamış kazancı geri alınır).
import { describe, it } from 'vitest';
import { call, check, makeAdmin, makeUser, waitFor } from '../helpers';

describe('Arama itirazı (Faz 15)', () => {
  it('senaryo', async () => {
    const caller = await makeUser('Disputa', 'male', 'female');
    const callee = await makeUser('Disputb', 'female', 'male');

    const c = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VOICE' });
    const acc = await call(callee.t, 'POST', `/calls/${c.id}/accept`);
    check('accepted, first minute billed', acc.billedMinutes === 1 && acc.totalCoins === 15);

    // Çalarken/görüşme sürerken itiraz edilemez
    const early = await call(caller.t, 'POST', `/calls/${c.id}/dispute`, { reason: 'wrong_amount' });
    check('cannot dispute a live call', early.http === 409 && early.error === 'call_not_ended');

    const ended = await call(caller.t, 'POST', `/calls/${c.id}/hangup`);
    check('call ended', ended.status === 'ENDED');
    const finalInfo = await call(caller.t, 'GET', `/calls/${c.id}`);
    const chargedTotal = finalInfo.totalCoins as number; // kısmi dakika iadesi zaten uygulanmış olabilir

    // --- Yetkisiz denemeler
    const byCallee = await call(callee.t, 'POST', `/calls/${c.id}/dispute`, { reason: 'wrong_amount' });
    check('only the caller (charged party) can dispute', byCallee.http === 404);
    const badReason = await call(caller.t, 'POST', `/calls/${c.id}/dispute`, { reason: 'nope' });
    check('invalid reason -> 400', badReason.http === 400);

    // --- İtiraz açılır
    const filed = await call(caller.t, 'POST', `/calls/${c.id}/dispute`, { reason: 'wrong_amount', note: 'sadece 5 saniye konuştuk' });
    check('dispute filed', filed.http === 201 && filed.ok === true);
    const twice = await call(caller.t, 'POST', `/calls/${c.id}/dispute`, { reason: 'other' });
    check('cannot dispute the same call twice', twice.http === 409 && twice.error === 'already_disputed');
    const mine = await call(caller.t, 'GET', '/me/disputes');
    check('visible in my disputes', mine._arr?.length === 1 && mine._arr[0].status === 'PENDING' && mine._arr[0].callId === c.id);
    const afterFile = await call(caller.t, 'GET', `/calls/${c.id}`);
    check('call shows pending dispute', afterFile.disputeStatus === 'PENDING');

    // --- Panel: bekleyen kuyrukta görünür
    const fin = await makeAdmin('finance');
    const queue = await call(fin.t, 'GET', '/admin/api/finance/disputes?status=PENDING');
    const item = queue._arr?.find((d: { id: string }) => d.id === filed.id);
    check(
      'dispute queue lists it with call and filer details',
      item !== undefined && item.call?.id === c.id && item.filedBy?.id === caller.id,
      JSON.stringify(item)?.slice(0, 200),
    );

    const mod = await makeAdmin('moderator');
    const forbidden = await call(mod.t, 'GET', '/admin/api/finance/disputes');
    check('moderator role cannot view finance disputes', forbidden.http === 403);

    // --- Red: gerekçe kısa olamaz, iade olmaz
    const disputeId = filed.id as string;
    const shortReject = await call(fin.t, 'POST', `/admin/api/finance/disputes/${disputeId}/resolve`, { approve: false, note: 'no' });
    check('reject needs a real note', shortReject.http === 400);

    const callerBalanceBefore = (await call(caller.t, 'GET', '/wallet')).balance as number;
    const approved = await call(fin.t, 'POST', `/admin/api/finance/disputes/${disputeId}/resolve`, { approve: true, note: 'Kayıtlar incelendi, ücret hatalı' });
    check('approved, full remaining charge refunded', approved.http === 200 && approved.refund === chargedTotal, `refund=${approved.refund} expected=${chargedTotal}`);

    const callerBalanceAfter = await waitFor(async () => (await call(caller.t, 'GET', '/wallet')).balance, (b) => b === callerBalanceBefore + chargedTotal);
    check('caller refunded', callerBalanceAfter === callerBalanceBefore + chargedTotal);

    const resolved = await call(caller.t, 'GET', `/calls/${c.id}`);
    check('call shows approved dispute', resolved.disputeStatus === 'APPROVED');
    const totalsAfter = await call(caller.t, 'GET', `/calls/${c.id}`);
    check('call totalCoins reduced to 0 (fully refunded)', totalsAfter.totalCoins === 0, `total=${totalsAfter.totalCoins}`);

    // --- İkinci kez çözülemez
    const resolveTwice = await call(fin.t, 'POST', `/admin/api/finance/disputes/${disputeId}/resolve`, { approve: true, note: 'tekrar' });
    check('already resolved -> 404', resolveTwice.http === 404);

    // --- İkinci bir arama: reddedilen itirazda iade olmaz
    const c2 = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VOICE' });
    await call(callee.t, 'POST', `/calls/${c2.id}/accept`);
    await call(caller.t, 'POST', `/calls/${c2.id}/hangup`);
    const filed2 = await call(caller.t, 'POST', `/calls/${c2.id}/dispute`, { reason: 'no_connection' });
    const balBeforeReject = (await call(caller.t, 'GET', '/wallet')).balance as number;
    const rejected = await call(fin.t, 'POST', `/admin/api/finance/disputes/${filed2.id}/resolve`, { approve: false, note: 'Kayıtlar doğru, ücret geçerli' });
    check('rejected', rejected.http === 200 && rejected.refund === 0);
    const balAfterReject = (await call(caller.t, 'GET', '/wallet')).balance as number;
    check('no refund on rejection', balAfterReject === balBeforeReject, `before=${balBeforeReject} after=${balAfterReject}`);
    const c2Info = await call(caller.t, 'GET', `/calls/${c2.id}`);
    check('call shows rejected dispute', c2Info.disputeStatus === 'REJECTED');
  });
});
