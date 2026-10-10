// Faz 17 madde 11: kişisel bağlantı linki ("Beni VibeUpMe'de bul"). Davet programıyla aynı kodu
// kullanır; tamamen herkese açık (oturum gerekmez), fotoğraf göstermez (gizlilik).
import { describe, it } from 'vitest';
import { B, call, check, makeUser } from '../helpers';

describe('Kişisel bağlantı linki (Faz 17)', () => {
  it('geçerli kod: görünen adı gösteren bir sayfa döner, oturum gerekmez', async () => {
    const a = await makeUser('Link1a', 'male', 'female');
    const me = await call(a.t, 'GET', '/me');

    const page = await fetch(`${B}/u/${me.referralCode}?lang=tr`);
    const html = await page.text();
    check('sayfa başarılı', page.status === 200);
    check('görünen ad görünür', html.includes('Link1a'));
    check('CSP başlığı var (herkese açık sayfa)', page.headers.get('content-security-policy') !== null);
  });

  it('geçersiz/bilinmeyen kod: hata değil, genel bir sayfa döner', async () => {
    const page = await fetch(`${B}/u/ZZZZZZZZ?lang=tr`);
    check('genel sayfa da 200 döner (kod sızdırmaz)', page.status === 200);
    const html = await page.text();
    check('VibeUpMe tanıtımı içerir', html.includes('VibeUpMe'));
  });

  it('İngilizce dil parametresi', async () => {
    const a = await makeUser('Link2a', 'male', 'female');
    const me = await call(a.t, 'GET', '/me');
    const page = await fetch(`${B}/u/${me.referralCode}?lang=en`);
    const html = await page.text();
    check('İngilizce metin', html.includes('waiting for you'));
  });

  it('kod küçük harfle de çalışır (büyük harfe normalize edilir)', async () => {
    const a = await makeUser('Link3a', 'male', 'female');
    const me = await call(a.t, 'GET', '/me');
    const page = await fetch(`${B}/u/${(me.referralCode as string).toLowerCase()}?lang=tr`);
    const html = await page.text();
    check('küçük harfle de bulunur', html.includes('Link3a'));
  });
});
