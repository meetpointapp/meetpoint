// Faz 20: beğeni hakkı (sayaç + jetonla sıfırlama), mesaj isteği emaneti ve sohbet teması.
import { describe, it } from 'vitest';
import { call, check, makeUser, testDb } from '../helpers';

describe('Beğeni hakkı (Faz 20)', () => {
  it('sayaç beğeniyle azalır, jetonla sıfırlanır; hak yoksa sıfırlama jeton almaz', async () => {
    const me = await makeUser('Lim0a', 'male', 'female');
    const t1 = await makeUser('Lim1a', 'female', 'male');
    const t2 = await makeUser('Lim2a', 'female', 'male');

    const fresh = await call(me.t, 'GET', '/discover/like-status');
    check('başlangıçta 25 hak', fresh.limit === 25 && fresh.used === 0 && fresh.remaining === 25);

    // Hiç kullanılmamış hakta sıfırlama jeton almaz
    const noop = await call(me.t, 'POST', '/discover/like-reset');
    check('kullanılmamış hakta sıfırlama ücretsiz', noop.http === 200 && noop.used === 0);

    const l1 = await call(me.t, 'POST', '/swipes', { toId: t1.id, direction: 'like' });
    check('beğeni yanıtı kalan hakkı taşır', l1.likes?.used === 1 && l1.likes?.remaining === 24);
    await call(me.t, 'POST', '/swipes', { toId: t2.id, direction: 'pass' });
    const afterPass = await call(me.t, 'GET', '/discover/like-status');
    check('geçmek hak harcamaz', afterPass.used === 1);

    // Jetonla sıfırla
    await call(me.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    const before = await call(me.t, 'GET', '/wallet');
    const reset = await call(me.t, 'POST', '/discover/like-reset');
    check('sıfırlama sayacı başa alır', reset.http === 200 && reset.used === 0 && reset.remaining === 25);
    const after = await call(me.t, 'GET', '/wallet');
    check('sıfırlama 50 jeton alır', before.balance - after.balance === reset.resetPrice && reset.resetPrice === 50, `${before.balance}→${after.balance}`);
  });

  it('hak biterse beğeni 403 like_limit_reached döner, süper beğeni ve geçme etkilenmez', async () => {
    const me = await makeUser('Lim0b', 'male', 'female');
    const t = await makeUser('Lim1b', 'female', 'male');
    const t2 = await makeUser('Lim2b', 'female', 'male');
    // 25 beğeniyi doğrudan veritabanına yaz (25 gerçek hesap açmadan): hedef kimlikleri sadece sayım için
    const db = await testDb();
    const fillers = await Promise.all(Array.from({ length: 25 }, (_, i) => makeUser(`Lim${i}f`, 'female', 'male')));
    await db.swipe.createMany({ data: fillers.map((f) => ({ fromId: me.id, toId: f.id, direction: 'like' })) });

    const status = await call(me.t, 'GET', '/discover/like-status');
    check('25 hak doldu', status.used === 25 && status.remaining === 0);
    const blocked = await call(me.t, 'POST', '/swipes', { toId: t.id, direction: 'like' });
    check('limit dolunca beğeni reddedilir', blocked.http === 403 && blocked.error === 'like_limit_reached');
    const pass = await call(me.t, 'POST', '/swipes', { toId: t2.id, direction: 'pass' });
    check('geçmek serbest', pass.http === 200);
  });
});

describe('Mesaj isteği emaneti (Faz 20)', () => {
  it('kabulde jeton alıcıya geçmez; 3 anlamlı cevaptan sonra geçer', async () => {
    const payer = await makeUser('Esc1a', 'male', 'female');
    const earner = await makeUser('Esc1b', 'female', 'male');
    await call(payer.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    const req = await call(payer.t, 'POST', '/requests', { toId: earner.id, kind: 'MESSAGE', note: 'Merhaba nasılsın' });
    check('istek oluştu', req.http === 201);
    const before = await call(earner.t, 'GET', '/wallet');
    await call(earner.t, 'POST', `/requests/${req.id}/accept`);
    const afterAccept = await call(earner.t, 'GET', '/wallet');
    check('kabulde alıcının bakiyesi değişmez', afterAccept.balance === before.balance, `${before.balance}→${afterAccept.balance}`);

    const convs = await call(earner.t, 'GET', '/conversations');
    const cid = convs._arr[0].id;
    check('sohbette emanet bilgisi var', convs._arr[0].escrow?.role === 'earner' && convs._arr[0].escrow?.needed === 3);

    // Kısa ve 5 kelimeden az mesajlar sayılmaz
    await call(earner.t, 'POST', `/conversations/${cid}/messages`, { body: 'tamam' });
    await call(earner.t, 'POST', `/conversations/${cid}/messages`, { body: 'evet sana da selam' });
    await new Promise((r) => setTimeout(r, 400));
    const still = await call(earner.t, 'GET', '/wallet');
    check('kısa cevaplar jeton kazandırmaz', still.balance === before.balance);

    for (let i = 0; i < 3; i++) {
      await call(earner.t, 'POST', `/conversations/${cid}/messages`, { body: `Merhaba ben iyiyim sen nasılsın ${i}` });
    }
    await new Promise((r) => setTimeout(r, 800));
    const paid = await call(earner.t, 'GET', '/wallet');
    check('3 anlamlı cevaptan sonra 50 jeton geçer', paid.balance === before.balance + 50, `${before.balance}→${paid.balance}`);
  });

  it('süre dolarsa emanet gönderene iade edilir', async () => {
    const payer = await makeUser('Esc2a', 'male', 'female');
    const earner = await makeUser('Esc2b', 'female', 'male');
    await call(payer.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    const before = await call(payer.t, 'GET', '/wallet');
    const req = await call(payer.t, 'POST', '/requests', { toId: earner.id, kind: 'MESSAGE', note: 'Selam' });
    await call(earner.t, 'POST', `/requests/${req.id}/accept`);
    const held = await call(payer.t, 'GET', '/wallet');
    check('gönderenin jetonu emanette', held.balance === before.balance - 50);

    // Emanet süresini geçmişe çek; zamanlayıcı iade eder
    const db = await testDb();
    await db.contactRequest.update({ where: { id: req.id }, data: { escrowUntil: new Date(Date.now() - 1000) } });
    let refunded = false;
    for (let i = 0; i < 40 && !refunded; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const w = await call(payer.t, 'GET', '/wallet');
      refunded = w.balance === before.balance;
    }
    check('süre dolunca jeton gönderene iade edildi', refunded);
  });
});

describe('Sohbet teması: ilk mesajı yazanın teması (Faz 20)', () => {
  it('sohbet listesi ilk mesajı yazanın balon ve arka plan kimliğini taşır', async () => {
    const a = await makeUser('Thm1a', 'male', 'female');
    const b = await makeUser('Thm1b', 'female', 'male');
    const db = await testDb();
    await db.profile.update({ where: { userId: a.id }, data: { chatBubbleThemeId: 'bubble_ocean', chatBackgroundThemeId: 'chatbg_hearts' } });
    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    const m = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
    const none = await call(b.t, 'GET', '/conversations');
    check('ilk mesaj yokken tema yok', none._arr[0].theme === null);

    await call(a.t, 'POST', `/conversations/${m.conversationId}/messages`, { body: 'selam' });
    const asB = await call(b.t, 'GET', '/conversations');
    check('karşı taraf başlatanın temasını görür', asB._arr[0].theme?.chatBubbleThemeId === 'bubble_ocean' && asB._arr[0].theme?.chatBackgroundThemeId === 'chatbg_hearts');
  });
});
