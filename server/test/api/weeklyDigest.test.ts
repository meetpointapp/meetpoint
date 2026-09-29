// Faz 17 madde 7: haftalık özet. Yapay zekâ yok — son 7 günün yeni eşleşme sayısı ve en çok
// mesajlaşılan (iki yönlü toplam) sohbet.
import { describe, it } from 'vitest';
import { call, check, makeUser } from '../helpers';

describe('Haftalık özet (Faz 17)', () => {
  it('yeni eşleşmesi ve mesajı olmayan kullanıcıda boş özet döner', async () => {
    const a = await makeUser('Wk1a', 'male', 'female');
    const digest = await call(a.t, 'GET', '/me/weekly-digest');
    check('istek başarılı', digest.http === 200);
    check('yeni eşleşme yok', digest.newMatches === 0);
    check('en uzun sohbet yok', digest.longestChat === null);
  });

  it('eşleşme sayılır, en çok mesajlaşılan sohbet doğru bulunur', async () => {
    const a = await makeUser('Wk2a', 'male', 'female');
    const b = await makeUser('Wk2b', 'female', 'male');
    const c = await makeUser('Wk2c', 'female', 'male');

    // A, hem B hem C ile eşleşir
    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    const rb = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
    await call(a.t, 'POST', '/swipes', { toId: c.id, direction: 'like' });
    const rc = await call(c.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
    const convB = rb.conversationId as string;
    const convC = rc.conversationId as string;

    // B ile 3 mesaj (iki yönlü), C ile 1 mesaj — B'nin sohbeti daha uzun olmalı
    await call(a.t, 'POST', `/conversations/${convB}/messages`, { body: 'Selam B' });
    await call(b.t, 'POST', `/conversations/${convB}/messages`, { body: 'Selam A' });
    await call(a.t, 'POST', `/conversations/${convB}/messages`, { body: 'Nasılsın?' });
    await call(a.t, 'POST', `/conversations/${convC}/messages`, { body: 'Selam C' });

    const digest = await call(a.t, 'GET', '/me/weekly-digest');
    check('2 yeni eşleşme', digest.newMatches === 2);
    check('en uzun sohbet B ile', digest.longestChat?.otherUserId === b.id);
    check('mesaj sayısı doğru', digest.longestChat?.messageCount === 3);

    // B tarafından bakınca da aynı sohbet en uzun olmalı
    const digestB = await call(b.t, 'GET', '/me/weekly-digest');
    check('B için de aynı sohbet en uzun', digestB.longestChat?.otherUserId === a.id);
    check('B için 1 yeni eşleşme', digestB.newMatches === 1);
  });
});
