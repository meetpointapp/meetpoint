import { randomInt } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { economy } from './config';
import { HttpError, prisma } from './db';
import { credit, lockWallet } from './wallet';

// Faz 17 madde 8: davet programı. Her hesap kayıtta kendi davet kodunu alır; kod, I/O/0/1 gibi
// karışabilecek karakterler hariç tutularak elle yazılabilir kalır. Çakışma olasılığı 32^8'de bir,
// yine de kayıt sırasında benzersizlik denetimiyle (retry) güvence altına alınır.
const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) code += REFERRAL_ALPHABET[randomInt(REFERRAL_ALPHABET.length)];
  return code;
}

// Kayıt sırasında çağrılır (aynı prisma.$transaction içinde): benzersiz bir kod üretilene kadar dener.
export async function uniqueReferralCode(tx: Prisma.TransactionClient) {
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    const exists = await tx.user.findUnique({ where: { referralCode: code } });
    if (!exists) return code;
  }
  throw new Error('referral_code_collision');
}

// Doğrulanmadan önce bir davet kodu uygulanır (POST /auth/referral-code). Tek seferlik: zaten bir
// kod uygulanmışsa veya hesap zaten doğrulanmışsa reddedilir (doğrulama anında bonus zaten hesaplanır).
export async function redeemReferralCode(userId: string, code: string) {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true, referredById: true } });
  if (me.emailVerifiedAt) throw new HttpError(400, 'email_already_verified');
  if (me.referredById) throw new HttpError(400, 'already_redeemed');
  const referrer = await prisma.user.findUnique({ where: { referralCode: code.trim().toUpperCase() }, select: { id: true } });
  if (!referrer || referrer.id === userId) throw new HttpError(400, 'invalid_code');
  await prisma.user.update({ where: { id: userId }, data: { referredById: referrer.id } });
}

// E-posta doğrulanınca çağrılır (grantSignupBonus ile aynı yerde). Davet edilmemiş hesapta hiçbir
// şey yapmaz. İki cüzdan da aynı sırayla kilitlenir (kilitlenme olmasın, bkz. wallet.ts transfer()).
export async function grantReferralBonus(refereeId: string) {
  if (economy.referralBonus <= 0) return;
  const referee = await prisma.user.findUnique({ where: { id: refereeId }, select: { referredById: true } });
  const referrerId = referee?.referredById;
  if (!referrerId) return;
  await prisma.$transaction(async (tx) => {
    for (const id of [refereeId, referrerId].sort()) await lockWallet(tx, id);
    const given = await tx.walletEntry.findFirst({ where: { userId: refereeId, type: 'GRANT', note: 'referral_referee' } });
    if (given) return;
    await credit(tx, refereeId, { promo: economy.referralBonus }, 'GRANT', { note: 'referral_referee', counterpartyId: referrerId });
    await credit(tx, referrerId, { promo: economy.referralBonus }, 'GRANT', { note: 'referral_referrer', counterpartyId: refereeId });
  });
}

// "Davet et" ekranı: kendi kodu + kaç kişiyi davet ettiği + bu sayede kazandığı toplam jeton.
export async function referralStats(userId: string) {
  const totalReferred = await prisma.user.count({ where: { referredById: userId, emailVerifiedAt: { not: null } } });
  const earned = await prisma.walletEntry.aggregate({
    where: { userId, type: 'GRANT', note: 'referral_referrer' },
    _sum: { amount: true },
  });
  return { totalReferred, totalEarnedCoins: earned._sum.amount ?? 0 };
}
