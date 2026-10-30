import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from './config';

// Dosya depolama katmanı. Şimdilik yerel disk; yayında S3 uyumlu nesne depolama aynı arayüzle takılır
// (put/read/remove + imzalı adres). Uygulama kodu dosya yollarını hiç bilmez, sadece "anahtar" kullanır.
//
//   publicStore:  profil fotoğrafları (imzalı, süreli adresle herkese sunulur)
//   privateStore: tek seferlik sohbet fotoğrafları, doğrulama selfie'leri (sadece yetkili uçlardan)

export interface Store {
  put(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

// Anahtar biçimi: klasör/ad.uzantı; yol dışına çıkış (..) ve mutlak yol imkânsız
const KEY = /^[a-z0-9_-]+(\/[a-zA-Z0-9_-]+)*(\.[a-z0-9]+)?$/;
export const isValidKey = (key: string) => KEY.test(key) && !key.includes('..');

class LocalStore implements Store {
  constructor(private dir: string) {}
  private file(key: string) {
    if (!isValidKey(key)) throw new Error(`geçersiz dosya anahtarı: ${key}`);
    return path.join(this.dir, ...key.split('/'));
  }
  async put(key: string, data: Buffer) {
    const f = this.file(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, data);
  }
  async read(key: string) {
    return fs.readFile(this.file(key)).catch(() => null);
  }
  async remove(key: string) {
    await fs.rm(this.file(key), { force: true });
  }
}

// S3 uyumlu nesne depolama (Cloudflare R2, AWS S3, MinIO, Backblaze B2...). Çoklu sunucuda ortak depolama
// gerektiğinde açılır: S3_PUBLIC_BUCKET / S3_PRIVATE_BUCKET tanımlıysa o depo yerel disk yerine kullanılır.
// Genel (profil fotoğrafları) ve özel (doğrulama, sohbet fotoğrafı, veri dışa aktarma) depolar ayrı kovalardır.
const CONTENT_TYPES: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', zip: 'application/zip' };

export class S3Store implements Store {
  constructor(
    private client: S3Client,
    private bucket: string,
  ) {}
  private check(key: string) {
    if (!isValidKey(key)) throw new Error(`geçersiz dosya anahtarı: ${key}`);
    return key;
  }
  async put(key: string, data: Buffer) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.check(key),
        Body: data,
        ContentType: CONTENT_TYPES[key.split('.').pop() ?? ''] ?? 'application/octet-stream',
      }),
    );
  }
  async read(key: string) {
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.check(key) }));
      return r.Body ? Buffer.from(await r.Body.transformToByteArray()) : null;
    } catch (e) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }
  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.check(key) }));
  }
}

let s3: S3Client | null = null;
const s3Client = () =>
  (s3 ??= new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: process.env.S3_ACCESS_KEY_ID
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '' }
      : undefined,
  }));

export const publicStore: Store = process.env.S3_PUBLIC_BUCKET ? new S3Store(s3Client(), process.env.S3_PUBLIC_BUCKET) : new LocalStore(config.uploadDir);
export const privateStore: Store = process.env.S3_PRIVATE_BUCKET ? new S3Store(s3Client(), process.env.S3_PRIVATE_BUCKET) : new LocalStore(config.privateUploadDir);

// --- İmzalı, süreli medya adresleri ---
// Adres haftalık pencerelere yuvarlanır: aynı fotoğrafın adresi bir hafta boyunca değişmez
// (uygulama önbelleği işe yarar), sonra kendiliğinden geçersiz olur. Silinen fotoğrafın adresi
// en geç pencere sonunda ölür; tahmin edilemez anahtarlarla birlikte toplu indirmeyi engeller.
const WINDOW_S = 7 * 24 * 3600;
const secret = () => process.env.MEDIA_URL_SECRET || `media:${config.jwtSecret}`;
const sign = (key: string, exp: number) => crypto.createHmac('sha256', secret()).update(`${key}:${exp}`).digest('base64url').slice(0, 32);

export function mediaUrl(key: string, now = Date.now()) {
  // Pencere sonu + bir pencere: en az 7, en fazla 14 gün geçerli
  const exp = (Math.floor(now / 1000 / WINDOW_S) + 2) * WINDOW_S;
  return `/media/${key}?e=${exp}&s=${sign(key, exp)}`;
}

export function verifyMediaUrl(key: string, e: unknown, s: unknown, now = Date.now()): 'ok' | 'expired' | 'invalid' {
  const exp = Number(e);
  if (!isValidKey(key) || !Number.isInteger(exp) || typeof s !== 'string') return 'invalid';
  const expected = sign(key, exp);
  if (s.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return 'invalid';
  return exp * 1000 < now ? 'expired' : 'ok';
}

export const randomKey = (prefix: string, ext: string) => `${prefix}/${Date.now().toString(36)}${crypto.randomBytes(9).toString('hex')}.${ext}`;
