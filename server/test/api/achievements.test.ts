// Faz 17: "Sosyal cesaret yolculuğu". Her kademe gerçek bir eyleme bağlı (src/achievements.ts
// tetikleyicileri) ve bir kez, kalıcı olarak açılır; açılınca Faz 16 kozmetik mağazasından
// ücretsiz bir ödül verir (jeton harcanmadan StorePurchase satırı).
import { describe, it } from 'vitest';
import { call, check, makeUser, testDb, upload } from '../helpers';
import { MILESTONE_REWARD } from '../../src/achievements';

describe('Sosyal cesaret yolculuğu (Faz 17)', () => {
  it('ilk mesaj: İletişim izinin bronz kademesini açar ve ücretsiz ödül verir', async () => {
    const a = await makeUser('Ach1a', 'male', 'female');
    const b = await makeUser('Ach1b', 'female', 'male');
    // Karşılıklı beğeni: sohbet açılsın
    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    const matchRes = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
    check('eşleşme oluştu', matchRes.match === true);
    const conversationId = matchRes.conversationId;

    const beforeMe = await call(a.t, 'GET', '/me');
    check('mesaj öncesi İletişim izi 0', beforeMe.achievements.iletisim.tier === 0);

    await call(a.t, 'POST', `/conversations/${conversationId}/messages`, { body: 'Merhaba!' });

    const me = await call(a.t, 'GET', '/me');
    check('ilk mesajdan sonra İletişim izi bronz (1)', me.achievements.iletisim.tier === 1);
    check('first_message kademesi işaretli', me.achievements.iletisim.milestones[0].id === 'first_message' && me.achievements.iletisim.milestones[0].done);

    const db = await testDb();
    const owned = await db.storePurchase.findUnique({ where: { userId_itemId: { userId: a.id, itemId: MILESTONE_REWARD.first_message } } });
    check('ücretsiz ödül sahipliği verildi', owned !== null);
  });

  it('eşleşme: Bağlantı izinin bronz kademesini her iki tarafta da açar', async () => {
    const a = await makeUser('Ach2a', 'male', 'female');
    const b = await makeUser('Ach2b', 'female', 'male');
    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });

    const [meA, meB] = await Promise.all([call(a.t, 'GET', '/me'), call(b.t, 'GET', '/me')]);
    check('A: Bağlantı izi bronz', meA.achievements.baglanti.tier === 1);
    check('B: Bağlantı izi bronz', meB.achievements.baglanti.tier === 1);
  });

  it('vibe testi: Kimlik izinde bir kademe açar', async () => {
    const a = await makeUser('Ach3', 'male', 'female');
    const before = await call(a.t, 'GET', '/me');
    check('vibe öncesi kimlik izi 0', before.achievements.kimlik.tier === 0);

    const answers = {
      ideal_date: 'road_trip', flirt_style: 'direct', weekend: 'explore_new_place', communication: 'frequent_texts',
      conflict: 'talk_now', dream_trip: 'backpacking', friday_night: 'new_experience', gift_style: 'surprise_adventure',
      social_battery: 'crowd_energizes', love_language: 'adventure_together',
    };
    await call(a.t, 'PUT', '/me/vibe', answers);

    const me = await call(a.t, 'GET', '/me');
    check('vibe sonrası kimlik izi en az 1', me.achievements.kimlik.tier >= 1);
    const vibeDone = me.achievements.kimlik.milestones.find((m: { id: string }) => m.id === 'vibe_done');
    check('vibe_done açık', vibeDone?.done === true);
  });

  it('profil tamamlama: yeterince alan doldurulunca Kimlik izinde kademe açar', async () => {
    // makeUser 1 fotoğraf yükler (profil kaydından SONRA) — checkProfileComplete sadece
    // PUT /me/profile sırasında çalıştığı için 2 fotoğraf daha ekleyip profili yeniden
    // kaydediyoruz ki o an fotoğraf sayısı da (3) doğru sayılsın.
    const a = await makeUser('Ach4', 'male', 'female', {
      interests: ['coffee', 'travel', 'music'],
      lookingFor: 'relationship',
      bio: 'Merhaba, ben bir test kullanıcısıyım.',
      heightCm: 180,
      job: 'Mühendis',
    });
    await upload(a.t, '/me/photos', 'photo');
    await upload(a.t, '/me/photos', 'photo');
    const saved = await call(a.t, 'PUT', '/me/profile', {
      displayName: 'Ach4',
      birthDate: '1996-03-10',
      gender: 'male',
      interestedIn: 'female',
      interests: ['coffee', 'travel', 'music'],
      lookingFor: 'relationship',
      bio: 'Merhaba, ben bir test kullanıcısıyım.',
      heightCm: 180,
      job: 'Mühendis',
      prompts: [
        { id: 'perfect_sunday', answer: 'Kahvaltı ve kitap' },
        { id: 'laugh', answer: 'İyi bir espri' },
        { id: 'travel_dream', answer: 'Japonya' },
      ],
    });
    check('profil kaydedildi', saved.http === 200);

    const me = await call(a.t, 'GET', '/me');
    const done = me.achievements.kimlik.milestones.find((m: { id: string }) => m.id === 'profile_complete');
    check('profile_complete açık (fotoğraf + ilgi alanı + prompt + iş/bio yeterli)', done?.done === true);
  });

  it('oda ziyareti: bağlantın olan birinin odasına bakınca Bağlantı izinde kademe açar', async () => {
    const a = await makeUser('Ach5a', 'male', 'female');
    const b = await makeUser('Ach5b', 'female', 'male');
    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });

    // Eşleşme zaten first_match'i açtı; oda ziyaretinin AYRI bir kademe olduğunu doğrulamak için
    // Bağlantı izinin bu ziyaretten önce sadece 1 (first_match) olduğunu kontrol ediyoruz.
    const before = await call(a.t, 'GET', '/me');
    check('ziyaret öncesi Bağlantı izi 1 (sadece eşleşme)', before.achievements.baglanti.tier === 1);

    const visit = await call(a.t, 'GET', `/users/${b.id}/room`);
    check('oda görüntülendi', visit.http === 200);

    const after = await call(a.t, 'GET', '/me');
    check('ziyaret sonrası Bağlantı izi 2', after.achievements.baglanti.tier === 2);
  });

  it('kademe iki kez tetiklenince tekrar açılmaz (idempotent)', async () => {
    const a = await makeUser('Ach6a', 'male', 'female');
    const b = await makeUser('Ach6b', 'female', 'male');
    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    const r = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });

    await call(a.t, 'POST', `/conversations/${r.conversationId}/messages`, { body: 'Bir' });
    await call(a.t, 'POST', `/conversations/${r.conversationId}/messages`, { body: 'İki' });
    await call(a.t, 'POST', `/conversations/${r.conversationId}/messages`, { body: 'Üç' });

    const me = await call(a.t, 'GET', '/me');
    check('birden fazla mesajdan sonra İletişim izi hâlâ bronz (1), tekrar açılmadı', me.achievements.iletisim.tier === 1);
  });
});
