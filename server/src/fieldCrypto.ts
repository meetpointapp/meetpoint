import crypto from 'node:crypto';
import { config } from './config';

// Hassas alanların veritabanında şifrelenmesi (AES-256-GCM): IBAN, PayPal adresi, hesap sahibi adı,
// yönetim 2FA gizli anahtarları. Veritabanı yedeği ya da dökümü sızsa bile bu bilgiler okunamaz.
// Anahtar veritabanı dışında durur (FIELD_ENCRYPTION_KEY, 32 bayt, base64). Biçim: "v1:iv:etiket:veri".
// "v1" anahtar sürümüdür: anahtar değiştirilirken eski kayıtlar okunmaya devam eder.

const PREFIX = 'v1:';
let cachedKey: Buffer | null = null;

function key() {
  if (cachedKey) return cachedKey;
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, 'base64');
    if (k.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY 32 baytlık base64 olmalı');
    cachedKey = k;
  } else {
    // Geliştirme: JWT anahtarından türetilir (yayında FIELD_ENCRYPTION_KEY zorunlu, bkz. assertProductionConfig)
    cachedKey = crypto.createHash('sha256').update(`field-encryption:${config.jwtSecret}`).digest();
  }
  return cachedKey;
}

export function encryptField(plain: string) {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${data.toString('base64url')}`;
}

export const isEncrypted = (value: string) => value.startsWith(PREFIX);

// Şifresiz eski değerler (şifreleme öncesi kayıtlar) olduğu gibi döner
export function decryptField(value: string) {
  if (!value || !isEncrypted(value)) return value;
  const [, iv, tag, data] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
