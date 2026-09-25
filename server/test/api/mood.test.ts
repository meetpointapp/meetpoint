// Faz 16: günlük ruh hali. Serbest metin yok (moderasyon gerekmez); 24 saatte kendiliğinden
// kaybolur. Geçerlilik her okumada hesaplanır (src/routes/profile.ts activeMood()) — ayrı bir
// temizlik işi yok, bu yüzden süresi dolmuş durumu test etmek için doğrudan veritabanında
// moodSetAt'ı geriye alıyoruz (testDb()).
import { describe, it } from 'vitest';
import { call, check, makeUser, testDb } from '../helpers';

describe('Günlük ruh hali (Faz 16)', () => {
  it('ruh hali seçilir, GET /me yansıtır, başkası da görür (bitiş zamanı hariç)', async () => {
    const a = await makeUser('Mood1a', 'male', 'female');
    const b = await makeUser('Mood1b', 'female', 'male');

    const invalid = await call(a.t, 'PUT', '/me/mood', { moodId: 'not_a_mood' });
    check('geçersiz ruh hali reddedilir', invalid.http === 400);

    const saved = await call(a.t, 'PUT', '/me/mood', { moodId: 'happy' });
    check('ruh hali kaydedilir', saved.http === 200);

    const me = await call(a.t, 'GET', '/me');
    check('GET /me ruh halini yansıtır', me.profile.moodId === 'happy');
    check('sahibi bitiş zamanını görür', typeof me.profile.moodExpiresAt === 'string');

    const seenByOther = await call(b.t, 'GET', `/users/${a.id}`);
    check('başkası ruh halini görür', seenByOther.moodId === 'happy');
    check('başkası bitiş zamanını görmez', seenByOther.moodExpiresAt === undefined);
  });

  it('24 saat sonra ruh hali kendiliğinden kaybolur', async () => {
    const a = await makeUser('Mood2a', 'male', 'female');
    await call(a.t, 'PUT', '/me/mood', { moodId: 'excited' });

    const db = await testDb();
    await db.profile.update({
      where: { userId: a.id },
      data: { moodSetAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    const me = await call(a.t, 'GET', '/me');
    check('24 saatten eski ruh hali boş döner', me.profile.moodId === '');
    check('bitiş zamanı da null', me.profile.moodExpiresAt === null);
  });

  it('ruh hali elle temizlenebilir', async () => {
    const a = await makeUser('Mood3a', 'male', 'female');
    await call(a.t, 'PUT', '/me/mood', { moodId: 'tired' });
    const cleared = await call(a.t, 'DELETE', '/me/mood');
    check('silme başarılı', cleared.http === 200);
    const me = await call(a.t, 'GET', '/me');
    check('ruh hali boşaldı', me.profile.moodId === '');
  });
});
