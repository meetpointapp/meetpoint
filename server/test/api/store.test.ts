// Faz 16: kozmetik mağaza. Jetonla alınır (kullanıcıdan kullanıcıya geçmez); satın alınmadan
// premium bir öğe (çerçeve, rozet, tema, oda mobilyası, avatar kıyafeti, sohbet teması) profile
// uygulanamaz — sahiplik server/src/routes/store.ts assertOwned() ile zorlanır.
import { describe, it } from 'vitest';
import { call, check, makeUser } from '../helpers';

describe('Kozmetik mağaza (Faz 16)', () => {
  it('mağaza kataloğu listelenir, sahiplik olmadan hiçbir öğe seçilemez', async () => {
    const a = await makeUser('Store1a', 'male', 'female');
    const items = (await call(a.t, 'GET', '/store/items'))._arr;
    check('katalog dizi döner', Array.isArray(items) && items.length > 0);
    check('hiçbiri başlangıçta sahiplenilmemiş', items.every((i: { owned: boolean }) => i.owned === false));
    const frame = items.find((i: { category: string }) => i.category === 'frame');
    check('çerçeve kategorisi var', !!frame);

    const rejected = await call(a.t, 'PUT', '/me/profile', {
      displayName: 'Store1a', birthDate: '1996-03-10', gender: 'male', interestedIn: 'female',
      frameId: frame.id,
    });
    check('sahip olunmayan çerçeve reddedilir', rejected.http === 403 && rejected.error === 'item_not_owned');
  });

  it('yetersiz jetonla satın alma reddedilir; satın alınca seçilebilir ve iki kez ücretlendirilmez', async () => {
    const a = await makeUser('Store2a', 'male', 'female');
    const items = (await call(a.t, 'GET', '/store/items'))._arr;
    const badge = items.find((i: { category: string }) => i.category === 'badge');

    const poor = await call(a.t, 'POST', '/store/purchase', { itemId: badge.id });
    check('yetersiz bakiyede 402', poor.http === 402);

    await call(a.t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' });
    const before = await call(a.t, 'GET', '/wallet');

    const bought = await call(a.t, 'POST', '/store/purchase', { itemId: badge.id });
    check('satın alma başarılı', bought.http === 200);
    const after = await call(a.t, 'GET', '/wallet');
    check('bakiyeden fiyatı kadar düşer', after.balance === before.balance - badge.priceCoins);

    const again = await call(a.t, 'POST', '/store/purchase', { itemId: badge.id });
    check('ikinci kez satın alma reddedilir', again.http === 400 && again.error === 'already_owned');

    const itemsAfter = (await call(a.t, 'GET', '/store/items'))._arr;
    check('katalogda sahip görünür', itemsAfter.find((i: { id: string }) => i.id === badge.id)?.owned === true);

    const saved = await call(a.t, 'PUT', '/me/profile', {
      displayName: 'Store2a', birthDate: '1996-03-10', gender: 'male', interestedIn: 'female',
      badgeId: badge.id,
    });
    check('satın alınan rozet seçilebilir', saved.http === 200);
    const me = await call(a.t, 'GET', '/me');
    check('GET /me rozeti yansıtır', me.profile.badgeId === badge.id);
  });

  it('çerçeve/rozet herkese görünür; sohbet temaları sadece sahibine görünür', async () => {
    const a = await makeUser('Store3a', 'male', 'female');
    const b = await makeUser('Store3b', 'female', 'male');
    await call(a.t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' });
    const items = (await call(a.t, 'GET', '/store/items'))._arr;
    const frame = items.find((i: { category: string }) => i.category === 'frame');
    const bubble = items.find((i: { category: string }) => i.category === 'chatBubble');
    await call(a.t, 'POST', '/store/purchase', { itemId: frame.id });
    await call(a.t, 'POST', '/store/purchase', { itemId: bubble.id });
    await call(a.t, 'PUT', '/me/profile', {
      displayName: 'Store3a', birthDate: '1996-03-10', gender: 'male', interestedIn: 'female',
      frameId: frame.id, chatBubbleThemeId: bubble.id,
    });

    const seenByOther = await call(b.t, 'GET', `/users/${a.id}`);
    check('başkası çerçeveyi görür', seenByOther.frameId === frame.id);
    check('başkası sohbet temasını görmez', seenByOther.chatBubbleThemeId === undefined);

    const me = await call(a.t, 'GET', '/me');
    check('sahibi kendi sohbet temasını görür', me.profile.chatBubbleThemeId === bubble.id);
  });

  it('oda mobilyası: sahip olunmadan yerleştirilemez, satın alınca yerleştirilebilir', async () => {
    const a = await makeUser('Store4a', 'male', 'female');
    const items = (await call(a.t, 'GET', '/store/items'))._arr;
    const roomItem = items.find((i: { category: string }) => i.category === 'roomItem');

    const rejected = await call(a.t, 'PUT', '/me/room', {
      wallpaperId: '', floorId: '', items: [{ itemId: roomItem.id, x: 0, y: 0 }],
    });
    check('sahip olunmayan mobilya reddedilir', rejected.http === 403 && rejected.error === 'item_not_owned');

    await call(a.t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' });
    await call(a.t, 'POST', '/store/purchase', { itemId: roomItem.id });
    const saved = await call(a.t, 'PUT', '/me/room', {
      wallpaperId: '', floorId: '', items: [{ itemId: roomItem.id, x: 0, y: 0 }],
    });
    check('satın alınan mobilya yerleştirilebilir', saved.http === 200);
  });

  it('geçersiz öğe kimliği reddedilir', async () => {
    const a = await makeUser('Store5a', 'male', 'female');
    const invalid = await call(a.t, 'POST', '/store/purchase', { itemId: 'not_a_real_item' });
    check('geçersiz kimlik reddedilir', invalid.http === 400);
  });
});
