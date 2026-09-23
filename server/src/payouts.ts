import type { Payout } from '@prisma/client';
import { economy } from './config';
import { HttpError, prisma } from './db';
import { maskAccount, normalizeIban } from './iban';
import { notify } from './notify';
import { emitToUser } from './realtime';
import { addEntry, getCashable } from './wallet';

// Para çekme: kullanıcı talep eder, kazanılmış jetonları hemen düşülür (CASHOUT).
// Yönetim ödemeyi elle yapıp "ödendi" işaretler; reddedilen ya da kullanıcının iptal ettiği
// talepte jetonlar CASHOUT_REFUND ile geri gelir ve yine bozdurulabilir kalır.

export type PayoutMethod = 'iban' | 'paypal';

export const payoutDto = (p: Payout) => ({
  id: p.id,
  coins: p.coins,
  usd: p.usd,
  method: p.method,
  accountName: p.accountName,
  accountHint: maskAccount(p.method, p.accountValue),
  status: p.status,
  reference: p.reference,
  adminNote: p.adminNote,
  createdAt: p.createdAt,
  processedAt: p.processedAt,
});

export async function requestPayout(
  userId: string,
  input: { coins: number; method: PayoutMethod; accountName: string; accountValue: string },
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  // Dolandırıcılığa karşı: sadece mavi tikli (selfie ile doğrulanmış) hesaplar para çekebilir
  if (user.verificationStatus !== 'approved') throw new HttpError(403, 'verification_required');
  if (input.coins < economy.cashoutMinCoins) throw new HttpError(400, 'below_minimum');

  let accountValue = input.accountValue.trim();
  if (input.method === 'iban') {
    const iban = normalizeIban(accountValue);
    if (!iban) throw new HttpError(400, 'invalid_iban');
    if (input.accountName.trim().length < 3) throw new HttpError(400, 'account_name_required');
    accountValue = iban;
  } else {
    accountValue = accountValue.toLowerCase();
  }

  const payout = await prisma.$transaction(async (tx) => {
    if (await tx.payout.count({ where: { userId, status: 'PENDING' } })) throw new HttpError(409, 'payout_pending');
    if ((await getCashable(userId, tx)) < input.coins) throw new HttpError(402, 'insufficient_cashable');
    const p = await tx.payout.create({
      data: {
        userId,
        email: user.email,
        coins: input.coins,
        usd: +(input.coins * economy.cashoutUsdPerCoin).toFixed(2),
        method: input.method,
        accountName: input.accountName.trim(),
        accountValue,
      },
    });
    await addEntry(tx, { userId, amount: -input.coins, type: 'CASHOUT', note: `payout:${p.id}` });
    return p;
  });
  emitToUser(userId, 'wallet:updated', {});
  return payoutDto(payout);
}

// Bekleyen talebi kapat: iptal (kullanıcı) veya red (yönetim) → jetonlar geri
export async function closePayout(id: string, status: 'CANCELLED' | 'REJECTED', adminNote = '') {
  const payout = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payout.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, adminNote, processedAt: new Date() },
    });
    if (count !== 1) throw new HttpError(409, 'payout_not_pending');
    const p = await tx.payout.findUniqueOrThrow({ where: { id } });
    if (p.userId) await addEntry(tx, { userId: p.userId, amount: p.coins, type: 'CASHOUT_REFUND', note: `payout:${id}` });
    return p;
  });
  if (payout.userId) {
    emitToUser(payout.userId, 'wallet:updated', {});
    if (status === 'REJECTED') void notify(payout.userId, 'payout', payout.userId, 'REJECTED');
  }
  return payoutDto(payout);
}

// Yönetim ödemeyi yaptı: işlem numarasıyla "ödendi" işaretle
export async function markPayoutPaid(id: string, reference: string) {
  const { count } = await prisma.payout.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: 'PAID', reference, processedAt: new Date() },
  });
  if (count !== 1) throw new HttpError(409, 'payout_not_pending');
  const payout = await prisma.payout.findUniqueOrThrow({ where: { id } });
  if (payout.userId) {
    emitToUser(payout.userId, 'wallet:updated', {});
    void notify(payout.userId, 'payout', payout.userId, 'PAID');
  }
  return payoutDto(payout);
}
