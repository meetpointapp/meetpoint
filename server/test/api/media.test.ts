// Fotoğraf güvenliği ve depolama: konum (EXIF/GPS) silinir, yön uygulanır, 3 boy üretilir,
// sahte görüntüler reddedilir, adresler imzalı ve süreli.
import sharp from 'sharp';
import { describe, it } from 'vitest';
import { B, call, check, makeUser } from '../helpers';

// GPS konumu ve "90° döndürülmüş" yön bilgisi içeren gerçek bir JPEG (telefon fotoğrafı gibi)
async function phonePhoto(width = 1600, height = 900) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 90 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'TestPhone', Model: 'X1' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '41/1 0/1 3600/100', GPSLongitudeRef: 'E', GPSLongitude: '28/1 58/1 0/1' },
    })
    .withMetadata({ orientation: 6 }) // "90° saat yönünde döndür" (telefon dik tutulmuş)
    .toBuffer();
}

async function uploadFile(token: string, p: string, field: string, data: Buffer, type: string, name = 'photo.jpg') {
  const fd = new FormData();
  fd.append(field, new Blob([new Uint8Array(data)], { type }), name);
  const res = await fetch(B + p, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
  return { ...(await res.json().catch(() => ({}))), http: res.status };
}

const get = (url: string) => fetch(B + url);

describe('Fotoğraf güvenliği ve depolama (Faz 9)', () => {
  it('senaryo', async () => {
    const u = await makeUser('Foto', 'female', 'male');
    const original = await phonePhoto();
    const om = await sharp(original).metadata();
    check('test photo really has GPS/EXIF and rotation', !!om.exif && om.orientation === 6);

    const up = await uploadFile(u.t, '/me/photos', 'photo', original, 'image/jpeg');
    check('photo uploaded', up.http === 201 && up.url && up.thumbUrl && up.fullUrl, JSON.stringify(up).slice(0, 120));

    // --- Konum ve cihaz bilgisi silindi, yön uygulandı
    const full = Buffer.from(await (await get(up.fullUrl)).arrayBuffer());
    const fm = await sharp(full).metadata();
    check('no EXIF/GPS in served photo', !fm.exif && !fm.xmp && !fm.iptc, `exif=${!!fm.exif}`);
    check('served as WebP', fm.format === 'webp');
    check('orientation applied (portrait now)', (fm.height ?? 0) > (fm.width ?? 0), `${fm.width}x${fm.height}`);

    // --- 3 boy
    const sm = await sharp(Buffer.from(await (await get(up.thumbUrl)).arrayBuffer())).metadata();
    const md = await sharp(Buffer.from(await (await get(up.url)).arrayBuffer())).metadata();
    check('thumbnail ≤ 240px', Math.max(sm.width ?? 0, sm.height ?? 0) <= 240);
    check('card size ≤ 720px', Math.max(md.width ?? 0, md.height ?? 0) <= 720);
    check('full size ≤ 1440px', Math.max(fm.width ?? 0, fm.height ?? 0) <= 1440);
    const r = await get(up.url);
    check('cacheable with expiry', (r.headers.get('cache-control') ?? '').includes('max-age='));

    // --- Profil yanıtında aynı adresler
    const me = await call(u.t, 'GET', `/users/${u.id}`);
    check('profile exposes sized urls', me.photos?.some((p) => p.id === up.id && p.thumbUrl && p.fullUrl));

    // --- Sahte/zararlı dosyalar
    const fake = await uploadFile(u.t, '/me/photos', 'photo', Buffer.from('<?php echo 1; ?>'), 'image/jpeg');
    check('non-image with image/jpeg type rejected', fake.http === 400 && fake.error === 'invalid_image');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    const svgUp = await uploadFile(u.t, '/me/photos', 'photo', svg, 'image/png', 'x.png');
    check('SVG disguised as PNG rejected', svgUp.http === 400 && svgUp.error === 'invalid_image');

    // --- İmzalı adres
    const path = up.url.split('?')[0];
    check('unsigned url rejected', (await get(path)).status === 403);
    const tampered = up.url.replace(/s=[^&]+/, 's=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    check('tampered signature rejected', (await get(tampered)).status === 403);
    const expired = up.url.replace(/e=\d+/, 'e=1000');
    check('expired/altered expiry rejected', [403, 410].includes((await get(expired)).status));
    check('path traversal rejected', (await get('/media/../.env?e=9999999999&s=x')).status !== 200);

    // --- Silinen fotoğrafın dosyaları gider
    await call(u.t, 'DELETE', `/me/photos/${up.id}`);
    check('deleted photo no longer served', (await get(up.url)).status === 404 && (await get(up.thumbUrl)).status === 404);

    // --- Tek seferlik sohbet fotoğrafında da konum silinir
    const v = await makeUser('Vardiya', 'male', 'female');
    await call(u.t, 'POST', '/swipes', { toId: v.id, direction: 'like' });
    const m = await call(v.t, 'POST', '/swipes', { toId: u.id, direction: 'like' });
    const sent = await uploadFile(u.t, `/conversations/${m.conversationId}/photos`, 'photo', original, 'image/jpeg');
    const opened = await fetch(`${B}/messages/${sent.id}/photo`, { headers: { authorization: `Bearer ${v.t}` } });
    const om2 = await sharp(Buffer.from(await opened.arrayBuffer())).metadata();
    check('chat photo stripped of GPS/EXIF', opened.status === 200 && !om2.exif, `status=${opened.status}`);
  });
});
