import type { Prisma } from '@prisma/client';
import { prisma } from './db';

type Tx = Prisma.TransactionClient;

// Bakiye = tüm hareketlerin toplamı
export async function getBalance(userId: string, tx: Tx = prisma) {
  const agg = await tx.walletEntry.aggregate({ where: { userId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

// Bozdurulabilir jeton: sadece başkalarından kazanılan (EARN) jetonlar.
// Harcamalar önce satın alınan jetonlardan düşülür, bu yüzden
// bozdurulabilir = min(bakiye, kazanılan - bozdurulan).
export async function getCashable(userId: string, tx: Tx = prisma) {
  const [balance, earned, cashedOut] = await Promise.all([
    getBalance(userId, tx),
    tx.walletEntry.aggregate({ where: { userId, type: 'EARN' }, _sum: { amount: true } }),
    // Reddedilen/iptal edilen talepler CASHOUT_REFUND (pozitif) ile geri verilir
    tx.walletEntry.aggregate({ where: { userId, type: { in: ['CASHOUT', 'CASHOUT_REFUND'] } }, _sum: { amount: true } }),
  ]);
  const earnedNet = (earned._sum.amount ?? 0) + (cashedOut._sum.amount ?? 0); // CASHOUT negatif
  return Math.max(0, Math.min(balance, earnedNet));
}

export async function addEntry(
  tx: Tx,
  data: { userId: string; amount: number; type: string; requestId?: string; note?: string },
) {
  return tx.walletEntry.create({ data });
}
