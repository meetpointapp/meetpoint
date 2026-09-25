// Faz 16: kişisel profil vitrini (renk teması, kart zemini) ve "şu an aktif" rozeti.
import { describe, it } from 'vitest';
import { call, check, listen, makeUser, sleep } from '../helpers';

describe('Profil vitrini ve aktiflik rozeti (Faz 16)', () => {
  it('tema/zemin kaydedilir, doğrulanır ve başkasının profilinde görünür', async () => {
    const a = await makeUser('Show1a', 'male', 'female');
    const b = await makeUser('Show1b', 'female', 'male');

    const before = await call(a.t, 'GET', '/me');
    check('varsayılan: boş tema/zemin', before.profile.themeId === '' && before.profile.cardBackgroundId === '');

    const invalid = await call(a.t, 'PUT', '/me/profile', {
      displayName: 'Show1a', birthDate: '1996-03-10', gender: 'male', interestedIn: 'female', themeId: 'not-a-theme',
    });
    check('geçersiz tema reddedilir', invalid.http === 400);

    const saved = await call(a.t, 'PUT', '/me/profile', {
      displayName: 'Show1a', birthDate: '1996-03-10', gender: 'male', interestedIn: 'female',
      themeId: 'ocean', cardBackgroundId: 'sunset',
    });
    check('geçerli tema/zemin kaydedilir', saved.http === 200);

    const me = await call(a.t, 'GET', '/me');
    check('GET /me kendi vitrinini gösterir', me.profile.themeId === 'ocean' && me.profile.cardBackgroundId === 'sunset');

    const seenByOther = await call(b.t, 'GET', `/users/${a.id}`);
    check('başka kullanıcı da vitrini görür', seenByOther.themeId === 'ocean' && seenByOther.cardBackgroundId === 'sunset');
  });

  it('"şu an aktif" rozeti gerçek bağlantı durumunu yansıtır', async () => {
    const a = await makeUser('Show2a', 'male', 'female');
    const b = await makeUser('Show2b', 'female', 'male');

    const offlineView = await call(a.t, 'GET', `/users/${b.id}`);
    check('bağlanmadan önce çevrimdışı', offlineView.online === false);

    const bSock = await listen(b.t);
    await sleep(150);
    const onlineView = await call(a.t, 'GET', `/users/${b.id}`);
    check('bağlanınca aktif görünür', onlineView.online === true);

    // Kendi profilinde rozet hesaplanmaz (gereksiz sorgu, GET /me zaten kendi oturumu)
    const ownView = await call(b.t, 'GET', '/me');
    check('kendi profilinde online alanı yok', ownView.profile.online === undefined);

    bSock.s.disconnect();
    await sleep(200);
    const afterDisconnect = await call(a.t, 'GET', `/users/${b.id}`);
    check('bağlantı kopunca tekrar çevrimdışı', afterDisconnect.online === false);
  });

  it('keşfet destesinde de aktiflik rozeti gelir', async () => {
    const a = await makeUser('Show3a', 'male', 'female');
    const b = await makeUser('Show3b', 'female', 'male');
    const bSock = await listen(b.t);
    await sleep(150);

    const deck = await call(a.t, 'GET', '/discover');
    const row = deck._arr?.find((p: { id: string }) => p.id === b.id);
    check('destede bulunuyor', row !== undefined);
    check('destede aktiflik rozeti doğru', row?.online === true);

    bSock.s.disconnect();
  });
});
