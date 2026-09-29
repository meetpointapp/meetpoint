// Faz 17 madde 10: "Odanı sergile" — haftalık "en güzel odalar" galerisi. Varsayılan kapalı
// (oda normalde sadece bağlantılı kişilere açık); açan kullanıcının odası bağlantısı olmayanlara
// da görünür ve eşya sayısına göre sıralanan galeride yer alabilir.
import { describe, it } from 'vitest';
import { call, check, makeUser } from '../helpers';

describe('Odanı sergile (Faz 17)', () => {
  it('sergilemeyi açmayan biri galeride görünmez, açan görünür', async () => {
    const a = await makeUser('Show1a', 'male', 'female');
    const b = await makeUser('Show1b', 'female', 'male');

    // A sergilemeyi açmadan kaydeder
    await call(a.t, 'PUT', '/me/room', { wallpaperId: 'ocean', floorId: 'wood', items: [{ itemId: 'sofa', x: 0, y: 0 }], showcaseOptIn: false });
    // B sergilemeyi açarak kaydeder
    const savedB = await call(b.t, 'PUT', '/me/room', {
      wallpaperId: 'sunset', floorId: 'tile',
      items: [{ itemId: 'bed', x: 0, y: 0 }, { itemId: 'lamp', x: 1, y: 0 }, { itemId: 'sofa', x: 2, y: 0 }],
      showcaseOptIn: true,
    });
    check('B kaydı başarılı', savedB.http === 200);

    const meB = await call(b.t, 'GET', '/me/room');
    check('B nin showcaseOptIn alanı doğru okunur', meB.showcaseOptIn === true);

    const showcase = await call(a.t, 'GET', '/rooms/showcase');
    check('galeri bir dizi döner', Array.isArray(showcase._arr));
    check('A galeride yok (sergilemeyi açmadı)', !showcase._arr.some((r: { userId: string }) => r.userId === a.id));
    check('B galeride var (sergilemeyi açtı)', showcase._arr.some((r: { userId: string }) => r.userId === b.id));
  });

  it('sergileyen birinin odası bağlantı olmadan da görülebilir', async () => {
    const a = await makeUser('Show2a', 'male', 'female');
    const b = await makeUser('Show2b', 'female', 'male');
    await call(b.t, 'PUT', '/me/room', { wallpaperId: 'sunset', floorId: 'tile', items: [{ itemId: 'bed', x: 2, y: 3 }], showcaseOptIn: true });

    // Aralarında hiçbir bağlantı (eşleşme/mesaj) yok
    const visit = await call(a.t, 'GET', `/users/${b.id}/room`);
    check('bağlantı olmadan da sergilenen oda görülür', visit.http === 200 && visit.wallpaperId === 'sunset');
  });

  it('boş oda (eşyasız) sergilemeyi açsa da galeride yer almaz', async () => {
    const a = await makeUser('Show3a', 'male', 'female');
    await call(a.t, 'PUT', '/me/room', { wallpaperId: 'ocean', floorId: 'wood', items: [], showcaseOptIn: true });
    const showcase = await call(a.t, 'GET', '/rooms/showcase');
    check('eşyasız oda galeride yok', !showcase._arr.some((r: { userId: string }) => r.userId === a.id));
  });

  it('en çok eşyalı oda galeride önde sıralanır', async () => {
    const a = await makeUser('Show4a', 'male', 'female');
    const b = await makeUser('Show4b', 'female', 'male');
    await call(a.t, 'PUT', '/me/room', { wallpaperId: 'ocean', floorId: 'wood', items: [{ itemId: 'sofa', x: 0, y: 0 }], showcaseOptIn: true });
    await call(b.t, 'PUT', '/me/room', {
      wallpaperId: 'sunset', floorId: 'tile',
      items: [{ itemId: 'bed', x: 0, y: 0 }, { itemId: 'lamp', x: 1, y: 0 }, { itemId: 'sofa', x: 2, y: 0 }],
      showcaseOptIn: true,
    });
    const showcase = await call(a.t, 'GET', '/rooms/showcase');
    const idxA = showcase._arr.findIndex((r: { userId: string }) => r.userId === a.id);
    const idxB = showcase._arr.findIndex((r: { userId: string }) => r.userId === b.id);
    check('daha çok eşyalı oda (B) daha önde', idxB !== -1 && idxA !== -1 && idxB < idxA);
  });

  it('engellenen kişinin odası galeride görünmez', async () => {
    const a = await makeUser('Show5a', 'male', 'female');
    const b = await makeUser('Show5b', 'female', 'male');
    await call(b.t, 'PUT', '/me/room', { wallpaperId: 'sunset', floorId: 'tile', items: [{ itemId: 'bed', x: 0, y: 0 }], showcaseOptIn: true });
    await call(a.t, 'POST', '/blocks', { toId: b.id });
    const showcase = await call(a.t, 'GET', '/rooms/showcase');
    check('engellenen kişi galeride yok', !showcase._arr.some((r: { userId: string }) => r.userId === b.id));
  });
});
