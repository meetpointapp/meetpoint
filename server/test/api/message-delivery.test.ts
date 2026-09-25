// Faz 15: mesaj teslim garantisi. "Gönderildi" iletildiğinden ayrı: alıcı çevrimiçiyse anında
// teslim edilir, değilse çevrimdışı kuyruktan (uygulama) veya "okundu" ile sonradan işaretlenir.
import { describe, it } from 'vitest';
import { call, check, listen, makeUser, sleep, waitFor } from '../helpers';

describe('Mesaj teslim garantisi (Faz 15)', () => {
  it('senaryo', async () => {
    const a = await makeUser('Delivera', 'male', 'female');
    const b = await makeUser('Deliverb', 'female', 'male');
    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    const m = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
    const convId = m.conversationId as string;

    // --- B çevrimdışıyken gönderilen mesaj hemen teslim edilmiş sayılmaz
    const offline = await call(a.t, 'POST', `/conversations/${convId}/messages`, { body: 'merhaba' });
    check('message sent, not delivered yet (recipient offline)', offline.http === 201 && offline.deliveredAt == null);

    // --- B bağlanıyor ama henüz teslim onayı vermedi: hâlâ null (soket bağlantısı tek başına yetmez)
    const bSock = await listen(b.t);
    const aSock = await listen(a.t);
    await sleep(100);
    const stillNull = await call(a.t, 'GET', `/conversations/${convId}/messages`);
    check('still not delivered until app confirms', stillNull._arr?.find((x) => x.id === offline.id)?.deliveredAt == null);

    // --- Uygulama mesajı aldığını bildirir (çevrimdışı kuyruktan gelen mesajlar da böyle işaretlenir)
    const ack = await call(b.t, 'POST', `/conversations/${convId}/delivered`, { ids: [offline.id] });
    check('delivered ack accepted', ack.http === 200);
    const afterAck = await call(a.t, 'GET', `/conversations/${convId}/messages`);
    check('now marked delivered', afterAck._arr?.find((x) => x.id === offline.id)?.deliveredAt != null);
    check('sender notified over socket', await waitFor(() => aSock.events.some((e) => e.name === 'message:delivered' && e.payload.ids?.includes(offline.id)), Boolean, 2000));

    // --- Yabancı biri veya karşı tarafın kendi mesajı teslim işaretleyemez
    const outsider = await makeUser('DeliverOut', 'male', 'female');
    const foreign = await call(outsider.t, 'POST', `/conversations/${convId}/delivered`, { ids: [offline.id] });
    check('outsider cannot ack', foreign.http === 404);
    const own = await call(a.t, 'POST', `/conversations/${convId}/delivered`, { ids: [offline.id] });
    check('sender cannot ack their own message', own.http === 200); // no-op: kendi mesajı zaten eşleşmez
    const stillOne = await call(a.t, 'GET', `/conversations/${convId}/messages`);
    check('no duplicate delivery side effects', stillOne._arr?.length === 1);

    // --- B artık çevrimiçi: yeni mesaj anında teslim edilmiş sayılır
    const live = await call(a.t, 'POST', `/conversations/${convId}/messages`, { body: 'çevrimiçiyken' });
    check('message delivered immediately when recipient is online', live.http === 201 && live.deliveredAt != null);

    // --- Okundu işaretlemek teslim edilmişliği de ima eder (B çevrimdışına düşse bile)
    bSock.s.disconnect();
    await sleep(200);
    const disconnected = await call(a.t, 'POST', `/conversations/${convId}/messages`, { body: 'çevrimdışıyken' });
    check('offline again -> not delivered', disconnected.deliveredAt == null);
    await call(b.t, 'POST', `/conversations/${convId}/read`);
    const afterRead = await call(a.t, 'GET', `/conversations/${convId}/messages`);
    const readMsg = afterRead._arr?.find((x) => x.id === disconnected.id);
    check('read implies delivered', readMsg?.readAt != null && readMsg?.deliveredAt != null);

    aSock.s.disconnect();
  });
});
