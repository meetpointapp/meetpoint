// Faz 16: kendi oda (statik yerleşim) ve çizgi avatar. Ziyaret sadece bağlantın olan
// (bir konuşmanız olan) kişilerde çalışır.
import { describe, it } from 'vitest';
import { call, check, makeUser } from '../helpers';

describe('Kendi oda ve avatar (Faz 16)', () => {
  it('oda kaydedilir ve doğrulanır', async () => {
    const a = await makeUser('Room1a', 'male', 'female');

    const empty = await call(a.t, 'GET', '/me/room');
    check('varsayılan oda boş', empty.wallpaperId === '' && empty.floorId === '' && empty.items.length === 0);

    const invalidItem = await call(a.t, 'PUT', '/me/room', { wallpaperId: 'ocean', floorId: 'wood', items: [{ itemId: 'spaceship', x: 0, y: 0 }] });
    check('geçersiz eşya reddedilir', invalidItem.http === 400);

    const outOfBounds = await call(a.t, 'PUT', '/me/room', { wallpaperId: 'ocean', floorId: 'wood', items: [{ itemId: 'sofa', x: 99, y: 0 }] });
    check('ızgara dışı konum reddedilir', outOfBounds.http === 400);

    const duplicate = await call(a.t, 'PUT', '/me/room', {
      wallpaperId: 'ocean', floorId: 'wood',
      items: [{ itemId: 'sofa', x: 0, y: 0 }, { itemId: 'lamp', x: 0, y: 0 }],
    });
    check('aynı hücreye iki eşya reddedilir', duplicate.http === 400);

    const tooMany = await call(a.t, 'PUT', '/me/room', {
      wallpaperId: 'ocean', floorId: 'wood',
      items: Array.from({ length: 13 }, (_, i) => ({ itemId: 'lamp', x: i % 4, y: Math.floor(i / 4) })),
    });
    check('en fazla 12 eşya (fazlası reddedilir)', tooMany.http === 400);

    const saved = await call(a.t, 'PUT', '/me/room', {
      wallpaperId: 'ocean', floorId: 'wood',
      items: [{ itemId: 'sofa', x: 0, y: 0 }, { itemId: 'lamp', x: 1, y: 0 }],
    });
    check('geçerli oda kaydedilir', saved.http === 200);

    const after = await call(a.t, 'GET', '/me/room');
    check('oda geri okunur', after.wallpaperId === 'ocean' && after.floorId === 'wood' && after.items.length === 2);
  });

  it('avatar alanları profille birlikte kaydedilir', async () => {
    const a = await makeUser('Room2a', 'male', 'female');
    const b = await makeUser('Room2b', 'female', 'male');
    const saved = await call(a.t, 'PUT', '/me/profile', {
      displayName: 'Room2a', birthDate: '1996-03-10', gender: 'male', interestedIn: 'female',
      avatarSkinId: 'tan', avatarHairStyle: 'curly', avatarHairColorId: 'red', avatarOutfitId: 'forest', avatarAccessoryId: 'glasses',
    });
    check('avatar kaydedilir', saved.http === 200);
    const me = await call(a.t, 'GET', '/me');
    check(
      'GET /me avatarı yansıtır',
      me.profile.avatarSkinId === 'tan' && me.profile.avatarHairStyle === 'curly' && me.profile.avatarAccessoryId === 'glasses',
    );
    const seenByOther = await call(b.t, 'GET', `/users/${a.id}`);
    check('başkası da avatarı görür', seenByOther.avatarHairColorId === 'red' && seenByOther.avatarOutfitId === 'forest');
  });

  it('ziyaret: sadece bağlantın olan kişinin odasını görebilirsin', async () => {
    const a = await makeUser('Room3a', 'male', 'female');
    const b = await makeUser('Room3b', 'female', 'male');
    await call(b.t, 'PUT', '/me/room', { wallpaperId: 'sunset', floorId: 'tile', items: [{ itemId: 'bed', x: 2, y: 3 }] });

    const beforeConnected = await call(a.t, 'GET', `/users/${b.id}/room`);
    check('bağlantı yoksa 403 not_connected', beforeConnected.http === 403 && beforeConnected.error === 'not_connected');

    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    const match = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
    check('eşleşme oldu', match.match === true);

    const afterConnected = await call(a.t, 'GET', `/users/${b.id}/room`);
    check(
      'bağlantı kurulunca oda görünür',
      afterConnected.http === 200 && afterConnected.wallpaperId === 'sunset' && afterConnected.items.length === 1 && afterConnected.displayName === 'Room3b',
    );

    // Kendi odan her zaman görünür (bağlantı kontrolüne tabi değil)
    const own = await call(a.t, 'GET', `/users/${a.id}/room`);
    check('kendi odana her zaman erişebilirsin', own.http === 200);
  });
});
