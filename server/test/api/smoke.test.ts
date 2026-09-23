// Faz 1 akışları: eşleşme, sohbet, jeton cüzdanı, ücretli istekler, engelleme
import { describe, it } from 'vitest';
import { call, check, registerVerified, upload } from '../helpers';

describe('Temel akışlar (Faz 1)', () => {
  it('senaryo', async () => {
    const tag = Date.now();

    async function makeUser(name, gender, interestedIn) {
      const u = await registerVerified(`${name.toLowerCase()}${tag}@test.com`);
      await call(u.t, 'PUT', '/me/profile', { displayName: name, birthDate: '1998-05-10', gender, interestedIn, city: 'Istanbul' });
      const up = await upload(u.t, '/me/photos', 'photo');
      check(`${name} photo upload`, up.http === 201);
      return u;
    }

    const kidUser = await registerVerified(`kid${tag}@test.com`);
    const kid = await call(kidUser.t, 'PUT', '/me/profile', { displayName: 'Kid', birthDate: '2015-01-01', gender: 'male', interestedIn: 'female' });
    check('underage rejected', kid.http === 403);

    const ali = await makeUser('Ali', 'male', 'female');
    const ayse = await makeUser('Ayse', 'female', 'male');
    const zeynep = await makeUser('Zeynep', 'female', 'male');
    const elif = await makeUser('Elif', 'female', 'male');

    const disc = await call(ali.t, 'GET', '/discover');
    check('discover shows women', disc._arr?.some((p) => p.id === ayse.id));

    await call(ali.t, 'POST', '/swipes', { toId: ayse.id, direction: 'like' });
    const m = await call(ayse.t, 'POST', '/swipes', { toId: ali.id, direction: 'like' });
    check('mutual like -> match', m.match === true);
    const msg = await call(ali.t, 'POST', `/conversations/${m.conversationId}/messages`, { body: 'Selam!' });
    check('free message after match', msg.http === 201);

    // Sesli/görüntülü artık istek değil, dakika başı arama (/calls)
    const legacy = await call(ali.t, 'POST', '/requests', { toId: zeynep.id, kind: 'VIDEO' });
    check('legacy video request kind rejected', legacy.http === 400);

    await call(ali.t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' });
    const r1 = await call(ali.t, 'POST', '/requests', { toId: zeynep.id, kind: 'MESSAGE', note: 'Merhaba Zeynep' });
    check('message request created', r1.http === 201);
    const r2 = await call(ali.t, 'POST', '/requests', { toId: elif.id, kind: 'MESSAGE', note: 'Selam Elif' });
    let w = await call(ali.t, 'GET', '/wallet');
    // 50 hediye + 1000 + %50 ilk alım bonusu = 1550
    check('sender balance held', w.balance === 1550 - 50 - 50, `balance=${w.balance}`);

    await call(zeynep.t, 'POST', `/requests/${r1.id}/accept`);
    const again = await call(zeynep.t, 'POST', `/requests/${r1.id}/accept`);
    check('double accept rejected', again.http === 409);
    await call(elif.t, 'POST', `/requests/${r2.id}/reject`);

    w = await call(ali.t, 'GET', '/wallet');
    check('sender refunded rejected request', w.balance === 1500, `balance=${w.balance}`);
    const zw = await call(zeynep.t, 'GET', '/wallet');
    check('receiver earned 50 (+50 gift), cashable 50', zw.balance === 100 && zw.cashable === 50, `bal=${zw.balance} cash=${zw.cashable}`);
    check('ali purchased coins not cashable', w.cashable === 0);

    const convs = await call(zeynep.t, 'GET', '/conversations');
    check('conversation opened from request', convs._arr?.length === 1 && convs._arr[0].lastMessage?.body === 'Merhaba Zeynep');

    await call(zeynep.t, 'POST', '/blocks', { toId: ali.id });
    const blockedMsg = await call(ali.t, 'POST', `/conversations/${convs._arr[0].id}/messages`, { body: 'hey' });
    check('blocked user cannot message', blockedMsg.http !== 201);
  });
});
