import type { Prisma, User } from '@prisma/client';
import { config, privacy } from '../config';
import { HttpError, prisma } from '../db';

// KVKK açık rızaları. Her verme/geri alma Consent tablosuna kanıt olarak yazılır (sürüm, zaman, IP);
// güncel durum hızlı sorgu için User üzerinde tutulur.
//
// special_category  Cinsel yönelim (kimi gördüğün / kimle eşleştiğin). Eşleştirme için zorunlu:
//                   rıza yoksa profil keşfette görünmez, keşfet kullanılamaz. Sohbetler sürer.
// overseas_transfer Yurt dışındaki hizmetlere aktarım (Agora arama, Firebase bildirim).
//                   Rıza yoksa arama yapılamaz/alınamaz, bildirim gitmez; gerisi çalışır.
// selfie            Mavi tik için selfie. Geri alınınca saklanan selfie'ler silinir.
// marketing         Kampanya ve duyuru e-postaları.

export const CONSENT_KINDS = ['special_category', 'overseas_transfer', 'selfie', 'marketing'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

const FIELD: Record<ConsentKind, keyof Pick<User, 'consentSpecialAt' | 'consentOverseasAt' | 'consentSelfieAt' | 'consentMarketingAt'>> = {
  special_category: 'consentSpecialAt',
  overseas_transfer: 'consentOverseasAt',
  selfie: 'consentSelfieAt',
  marketing: 'consentMarketingAt',
};

type Tx = Prisma.TransactionClient;

export async function recordConsent(
  tx: Tx,
  userId: string,
  kind: ConsentKind | 'terms' | 'privacy',
  granted: boolean,
  source: string,
  ip = '',
) {
  const version =
    kind === 'terms' ? config.termsVersion : kind === 'privacy' ? config.privacyVersion : privacy.consentVersions[kind];
  await tx.consent.create({ data: { userId, kind, version, granted, source, ip: ip.slice(0, 64) } });
  if (kind !== 'terms' && kind !== 'privacy') {
    await tx.user.update({ where: { id: userId }, data: { [FIELD[kind]]: granted ? new Date() : null } });
  }
}

// Kullanım koşulları + aydınlatma metninin güncel sürümünün okunduğu/kabul edildiği kaydı
export async function acceptLegal(tx: Tx, userId: string, source: string, ip = '') {
  await recordConsent(tx, userId, 'terms', true, source, ip);
  await recordConsent(tx, userId, 'privacy', true, source, ip);
  await tx.user.update({
    where: { id: userId },
    data: { termsAcceptedAt: new Date(), termsVersion: config.termsVersion, privacyVersion: config.privacyVersion },
  });
}

export const hasConsent = (user: Pick<User, 'consentSpecialAt' | 'consentOverseasAt' | 'consentSelfieAt' | 'consentMarketingAt'>, kind: ConsentKind) =>
  kind === 'overseas_transfer' && !privacy.overseasConsentRequired ? true : user[FIELD[kind]] !== null;

// Yeniden onay gereken belgeler (metin sürümü değiştiyse)
export function legalUpdatesNeeded(user: Pick<User, 'termsVersion' | 'privacyVersion'>) {
  const docs: ('terms' | 'privacy')[] = [];
  if (user.termsVersion !== config.termsVersion) docs.push('terms');
  if (user.privacyVersion !== config.privacyVersion) docs.push('privacy');
  return docs;
}

export async function requireConsent(userId: string, kind: ConsentKind) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!hasConsent(user, kind)) throw new HttpError(403, 'consent_required', { kind });
}

// Uygulamanın gösterdiği güncel durum
export function consentState(user: User) {
  return {
    special_category: user.consentSpecialAt !== null,
    overseas_transfer: hasConsent(user, 'overseas_transfer'),
    selfie: user.consentSelfieAt !== null,
    marketing: user.consentMarketingAt !== null,
    overseasConsentRequired: privacy.overseasConsentRequired,
  };
}
