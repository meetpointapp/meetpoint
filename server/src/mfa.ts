import crypto from 'node:crypto';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { HttpError, prisma } from './db';
import { decryptField, encryptField } from './fieldCrypto';

// Yönetim paneli için iki adımlı doğrulama (TOTP: Google Authenticator, Authy, 1Password vb.).
// Gizli anahtar veritabanında şifreli durur. Aynı kod iki kez kullanılamaz (mfaLastCounter).
// Telefon kaybına karşı 10 tek kullanımlık yedek kod verilir (sadece özetleri saklanır).

const ISSUER = 'MeetPoint Yönetim';
const totp = (secret: string, label: string) =>
  new OTPAuth.TOTP({ issuer: ISSUER, label, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });

const hashBackup = (code: string) => crypto.createHash('sha256').update(`mfa-backup:${code.replace(/\W/g, '').toLowerCase()}`).digest('hex');

export async function beginSetup(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.mfaEnabledAt) throw new HttpError(409, 'mfa_already_enabled');
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  await prisma.user.update({ where: { id: userId }, data: { mfaPendingSecret: encryptField(secret) } });
  const uri = totp(secret, user.email).toString();
  return { secret, uri, qrSvg: await QRCode.toString(uri, { type: 'svg', margin: 1, width: 220 }) };
}

// Kodun hangi zaman dilimine ait olduğunu bulur (±1 dilim saat kayması toleransı); geçersizse null
function matchCounter(secret: string, label: string, code: string) {
  const t = totp(secret, label);
  const delta = t.validate({ token: code, window: 1 });
  return delta === null ? null : t.counter() + delta;
}

export async function finishSetup(userId: string, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.mfaEnabledAt) throw new HttpError(409, 'mfa_already_enabled');
  if (!user.mfaPendingSecret) throw new HttpError(400, 'mfa_setup_not_started');
  const secret = decryptField(user.mfaPendingSecret);
  const counter = matchCounter(secret, user.email, code);
  if (counter === null) throw new HttpError(400, 'mfa_invalid');

  const backupCodes = Array.from({ length: 10 }, () => {
    const raw = crypto.randomBytes(5).toString('hex'); // 10 karakter
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encryptField(secret),
      mfaPendingSecret: '',
      mfaEnabledAt: new Date(),
      mfaLastCounter: counter,
      mfaBackupCodes: backupCodes.map(hashBackup),
    },
  });
  return backupCodes;
}

// Oturum için doğrulama: 6 haneli TOTP veya yedek kod
export async function verifyMfa(userId: string, code: string): Promise<'totp' | 'backup'> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaEnabledAt || !user.mfaSecret) throw new HttpError(403, 'mfa_setup_required');

  if (/^\d{6}$/.test(code)) {
    const counter = matchCounter(decryptField(user.mfaSecret), user.email, code);
    if (counter === null) throw new HttpError(400, 'mfa_invalid');
    // Tekrar kullanım engeli: sayaç sadece ileri gider (koşullu güncelleme, eşzamanlı iki istekte biri kazanır)
    const { count } = await prisma.user.updateMany({ where: { id: userId, mfaLastCounter: { lt: counter } }, data: { mfaLastCounter: counter } });
    if (count !== 1) throw new HttpError(400, 'mfa_code_used');
    return 'totp';
  }

  const hash = hashBackup(code);
  const codes = (user.mfaBackupCodes as string[]) ?? [];
  if (!codes.includes(hash)) throw new HttpError(400, 'mfa_invalid');
  // Yedek kod tek kullanımlık: listeden düşülür (liste değişmişse eşzamanlı kullanım, reddedilir)
  const rest = codes.filter((c) => c !== hash);
  const updated = await prisma.$executeRaw`
    UPDATE "User" SET "mfaBackupCodes" = ${JSON.stringify(rest)}::jsonb
    WHERE "id" = ${userId} AND "mfaBackupCodes" = ${JSON.stringify(codes)}::jsonb`;
  if (updated !== 1) throw new HttpError(400, 'mfa_code_used');
  return 'backup';
}

export async function mfaStatus(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { enabled: user.mfaEnabledAt !== null, backupCodesLeft: ((user.mfaBackupCodes as string[]) ?? []).length };
}

// Süper yönetici, telefonunu kaybeden bir ekip üyesinin 2FA'sını sıfırlayabilir (üye yeniden kurar)
export async function resetMfa(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: '', mfaPendingSecret: '', mfaEnabledAt: null, mfaLastCounter: 0, mfaBackupCodes: [] },
  });
  await prisma.session.updateMany({ where: { userId }, data: { mfa: false } });
}
