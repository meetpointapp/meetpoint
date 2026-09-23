import crypto from 'node:crypto';
import sharp, { type Sharp } from 'sharp';
import { HttpError } from './db';
import { mediaUrl, publicStore } from './storage';

// Yüklenen her fotoğraf sunucuda yeniden kodlanır:
//  - Gerçekten desteklenen bir görüntü mü? (uzantı/MIME'a güvenilmez; SVG gibi içerik taşıyabilen
//    biçimler reddedilir, aşırı büyük görüntü "bombaları" sınırlanır)
//  - EXIF yönü uygulanır, sonra TÜM üst veri (GPS konumu, cihaz, tarih) silinir
//  - Profil fotoğrafları için 3 boy (WebP): liste/küçük resim, kart, tam ekran
//
// Telefonla çekilen fotoğrafların çoğu GPS konumu içerir; silinmezse kullanıcının evinin konumu
// fotoğrafı indiren herkese açık olurdu.

const ALLOWED = new Set(['jpeg', 'png', 'webp', 'heif']);
const MAX_PIXELS = 40_000_000; // ~8000x5000
export const PHOTO_SIZES = { sm: 240, md: 720, lg: 1440 } as const;
export type PhotoSize = keyof typeof PHOTO_SIZES;

async function decode(input: Buffer) {
  try {
    const meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
    if (!meta.format || !ALLOWED.has(meta.format)) throw new Error(`desteklenmeyen biçim: ${meta.format}`);
    return sharp(input, { limitInputPixels: MAX_PIXELS }).rotate(); // yön uygulanır; üst veri eklenmez
  } catch {
    throw new HttpError(400, 'invalid_image');
  }
}

const toWebp = (img: Sharp, max: number, quality = 80) =>
  img.clone().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();

// Profil fotoğrafı: 3 boy üretilip depolamaya yazılır. Dönen "base" anahtar Photo.path'e kaydedilir.
export async function storeProfilePhoto(input: Buffer) {
  const img = await decode(input);
  const base = `p/${Date.now().toString(36)}${crypto.randomBytes(9).toString('hex')}`;
  const variants = await Promise.all(
    (Object.keys(PHOTO_SIZES) as PhotoSize[]).map(async (size) => [size, await toWebp(img, PHOTO_SIZES[size])] as const),
  );
  for (const [size, data] of variants) await publicStore.put(`${base}-${size}.webp`, data);
  return base;
}

// Özel fotoğraflar (sohbet, selfie): tek boy, üst verisi temizlenmiş
export async function sanitizePrivatePhoto(input: Buffer, max = 1600) {
  return toWebp(await decode(input), max, 85);
}

// Eski sürümde yüklenmiş tek dosyalı fotoğraflar (uzantılı yol): hepsi aynı dosya
const isLegacy = (base: string) => /\.[a-z0-9]+$/i.test(base);

export const photoKey = (base: string, size: PhotoSize) => (isLegacy(base) ? base : `${base}-${size}.webp`);

export const photoUrls = (base: string) => ({
  url: mediaUrl(photoKey(base, 'md')),
  thumbUrl: mediaUrl(photoKey(base, 'sm')),
  fullUrl: mediaUrl(photoKey(base, 'lg')),
});

export async function removeProfilePhoto(base: string) {
  const keys = isLegacy(base) ? [base] : (Object.keys(PHOTO_SIZES) as PhotoSize[]).map((s) => photoKey(base, s));
  await Promise.all(keys.map((k) => publicStore.remove(k)));
}
