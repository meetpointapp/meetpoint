import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
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

export const publicStore: Store = new LocalStore(config.uploadDir);
export const privateStore: Store = new LocalStore(config.privateUploadDir);

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
