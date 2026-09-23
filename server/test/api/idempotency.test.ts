// Tekrar gönderilen istek koruması: aynı Idempotency-Key ile gelen istek bir kez işlenir.
import crypto from 'node:crypto';
import { describe, it } from 'vitest';
import { B, call, check, listen, makeUser, upload } from '../helpers';

const newKey = () => crypto.randomBytes(16).toString('hex');

// call() ile aynı, ama Idempotency-Key başlığıyla; yanıt başlığı da döner
async function keyed(token: string, method: string, p: string, key: string, body?: unknown) {
  const res = await fetch(B + p, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'idempotency-key': key },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ...json, http: res.status, replayed: res.headers.get('idempotent-replayed') === 'true' };
}

describe('Tekrar gönderilen istek koruması (Faz 9)', () => {
  it('senaryo', async () => {
    const a = await makeUser('Idem', 'male', 'female');
    const b = await makeUser('Potent', 'female', 'male');
    await call(a.t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' });
    const bal = async () => (await call(a.t, 'GET', '/wallet')).balance as number;

    // --- Hediye: ağ koptu, uygulama aynı anahtarla tekrar denedi → tek ücret
    const bs = await listen(b.t);
    const as = await listen(a.t);
    const c = await call(a.t, 'POST', '/calls', { toId: b.id, kind: 'VOICE' });
    await call(b.t, 'POST', `/calls/${c.id}/accept`);
    const start = await bal();
    const k1 = newKey();
    const g1 = await keyed(a.t, 'POST', `/calls/${c.id}/gifts`, k1, { giftId: 'heart' });
    const g2 = await keyed(a.t, 'POST', `/calls/${c.id}/gifts`, k1, { giftId: 'heart' });
    check('first gift processed', g1.http === 200 && !g1.replayed);
    check('retry with same key is replayed, not re-processed', g2.http === 200 && g2.replayed && g2.balance === g1.balance);
    check('charged once', (await bal()) === start - 50, `${start} → ${await bal()}`);

    // --- Aynı anahtar farklı istekle kullanılamaz
    const g3 = await keyed(a.t, 'POST', `/calls/${c.id}/gifts`, k1, { giftId: 'rose' });
    check('same key with different body → 422', g3.http === 422 && g3.error === 'idempotency_key_reused');

    // --- Eşzamanlı aynı anahtar: yalnızca biri işlenir
    const k2 = newKey();
    const before = await bal();
    const burst = await Promise.all(Array.from({ length: 5 }, () => keyed(a.t, 'POST', `/calls/${c.id}/gifts`, k2, { giftId: 'rose' })));
    const processed = burst.filter((r) => r.http === 200 && !r.replayed).length;
    check('concurrent duplicates: processed exactly once', processed === 1, `processed=${processed} codes=${burst.map((r) => r.http)}`);
    check('others replayed or told to retry', burst.every((r) => r.http === 200 || (r.http === 409 && r.error === 'request_in_progress')));
    check('concurrent duplicates charged once', (await bal()) === before - 20, `${before} → ${await bal()}`);
    await call(a.t, 'POST', `/calls/${c.id}/hangup`);

    // --- Mesaj: aynı anahtarla iki gönderim tek mesaj
    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    const m = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
    const k3 = newKey();
    await keyed(a.t, 'POST', `/conversations/${m.conversationId}/messages`, k3, { body: 'tek sefer' });
    const again = await keyed(a.t, 'POST', `/conversations/${m.conversationId}/messages`, k3, { body: 'tek sefer' });
    const msgs = await call(a.t, 'GET', `/conversations/${m.conversationId}/messages`);
    check('duplicate message not stored twice', again.replayed && msgs._arr?.filter((x) => x.body === 'tek sefer').length === 1);

    // --- Hata yanıtı da saklanır (aynı eylemin tekrarı aynı sonucu alır)
    const poor = await makeUser('Poor', 'male', 'female'); // 50 hediye jetonu
    const k4 = newKey();
    const r1 = await keyed(poor.t, 'POST', '/boost', k4);
    const r2 = await keyed(poor.t, 'POST', '/boost', k4);
    check('4xx result replayed too', r1.http === 402 && r2.http === 402 && r2.replayed);

    // --- Anahtarlar kullanıcıya özel
    const k5 = newKey();
    const own = await keyed(a.t, 'POST', '/blocks', k5, { toId: poor.id });
    const other = await keyed(b.t, 'POST', '/blocks', k5, { toId: poor.id });
    check('same key by another user is independent', own.http < 300 && other.http < 300 && !other.replayed);

    // --- Geçersiz anahtar biçimi
    const bad = await keyed(a.t, 'POST', '/blocks', 'short', { toId: poor.id });
    check('malformed key → 400', bad.http === 400 && bad.error === 'invalid_idempotency_key');

    // --- Anahtarsız istekler eskisi gibi
    const plain = await upload(a.t, '/me/photos', 'photo');
    check('requests without key still work', plain.http === 201);

    bs.s.disconnect();
    as.s.disconnect();
  });
});
