import type { Prisma, WalletEntry } from '@prisma/client';
import { HttpError, prisma } from './db';

// Cüzdan: her kullanıcının bakiyesi 4 kovada tutulur. Her para hareketi cüzdan satırını kilitler
// (SELECT … FOR UPDATE): aynı kullanıcıya eşzamanlı gelen harcamalar sırayla işlenir, çift harcama
// ve eksi bakiye imkânsızdır. Her hareket WalletEntry'ye kova kova yazılır (denetim izi).
//
//   paid         satın alınan jeton                    → harcanabilir, bozdurulamaz
//   promo        hediye / bonus jeton                  → harcanabilir, bozdurulamaz
//   earned       gerçek parayla ödenmiş jetondan kazanç → bozdurulabilir
//   earnedPromo  promosyon jetondan kazanç             → harcanabilir, bozdurulamaz
//
// Harcama sırası: promo → earnedPromo → paid → earned (bozdurulabilir kazanç en son harcanır).
// Transferde (arama, hediye, istek) karşı tarafa: gönderenin paid+earned kısmı "earned",
// promo+earnedPromo kısmı "earnedPromo" olarak geçer. Böylece bonus jetonlar asla nakde dönüşmez.

type Tx = Prisma.TransactionClient;

export type Buckets = { paid: number; promo: number; earned: number; earnedPromo: number };
export const BUCKETS = ['paid', 'promo', 'earned', 'earnedPromo'] as const;
const SPEND_ORDER = ['promo', 'earnedPromo', 'paid', 'earned'] as const;
const ZERO: Buckets = { paid: 0, promo: 0, earned: 0, earnedPromo: 0 };

export const total = (b: Buckets) => b.paid + b.promo + b.earned + b.earnedPromo;
// Bozdurulabilir: kazanç, ama bakiye borçluysa (ör. iade sonrası eksi) en fazla toplam bakiye kadar
export const cashableOf = (b: Buckets) => Math.max(0, Math.min(b.earned, total(b)));

type Meta = { requestId?: string; note?: string };

// Cüzdan satırını kilitle (yoksa oluştur). Sadece bir işlem (transaction) içinde çağrılır.
export async function lockWallet(tx: Tx, userId: string): Promise<Buckets> {
  await tx.$executeRaw`INSERT INTO "Wallet" ("userId", "updatedAt") VALUES (${userId}, NOW()) ON CONFLICT ("userId") DO NOTHING`;
  const rows = await tx.$queryRaw<Buckets[]>`
    SELECT "paid", "promo", "earned", "earnedPromo" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
  return rows[0];
}

async function apply(tx: Tx, userId: string, delta: Buckets, type: string, meta: Meta) {
  await tx.wallet.update({
    where: { userId },
    data: {
      paid: { increment: delta.paid },
      promo: { increment: delta.promo },
      earned: { increment: delta.earned },
      earnedPromo: { increment: delta.earnedPromo },
    },
  });
  return tx.walletEntry.create({
    data: { userId, amount: total(delta), type, ...delta, requestId: meta.requestId, note: meta.note ?? '' },
  });
}

// Harcama: kovalardan sırayla düşer. Yetmezse 402. Düşülen dağılımı döndürür.
export async function debit(tx: Tx, userId: string, amount: number, type: string, meta: Meta = {}) {
  const b = await lockWallet(tx, userId);
  if (amount <= 0 || total(b) < amount) throw new HttpError(402, 'insufficient_balance');
  const taken = { ...ZERO };
  let left = amount;
  for (const k of SPEND_ORDER) {
    const t = Math.min(Math.max(b[k], 0), left);
    taken[k] = t;
    left -= t;
  }
  const entry = await apply(tx, userId, negate(taken), type, meta);
  return { taken, entry };
}

// Yükleme: belirtilen kovalara ekler (eksi değer = geri alma, ör. iade)
export async function credit(tx: Tx, userId: string, delta: Partial<Buckets>, type: string, meta: Meta = {}) {
  await lockWallet(tx, userId);
  return apply(tx, userId, { ...ZERO, ...delta }, type, meta);
}

// Gönderenden alıcıya: iki cüzdan her zaman aynı sırayla kilitlenir (kilitlenme/deadlock olmasın)
export async function transfer(
  tx: Tx,
  fromId: string,
  toId: string,
  amount: number,
  types: { debit: string; credit: string },
  meta: Meta = {},
) {
  for (const id of [fromId, toId].sort()) await lockWallet(tx, id);
  const { taken } = await debit(tx, fromId, amount, types.debit, meta);
  await credit(tx, toId, earningsFrom(taken), types.credit, meta);
  return taken;
}

// Harcanan jetonun karşı tarafa kazanç olarak dağılımı
export const earningsFrom = (taken: Buckets): Partial<Buckets> => ({
  earned: taken.paid + taken.earned,
  earnedPromo: taken.promo + taken.earnedPromo,
});

// Bozdurma: sadece "earned" kovasından
export async function debitCashable(tx: Tx, userId: string, amount: number, type: string, meta: Meta = {}) {
  const b = await lockWallet(tx, userId);
  if (cashableOf(b) < amount) throw new HttpError(402, 'insufficient_cashable');
  return apply(tx, userId, { ...ZERO, earned: -amount }, type, meta);
}

// Bloke edilen (HOLD) kaydın kova dağılımı. Kova sütunlarından önceki eski kayıtlar tamamen "paid" sayılır.
export function heldBuckets(hold: Pick<WalletEntry, 'amount' | 'paid' | 'promo' | 'earned' | 'earnedPromo'>): Buckets {
  const b = negate(hold);
  return total(b) === 0 && hold.amount !== 0 ? { ...ZERO, paid: -hold.amount } : b;
}

// 0 - x: sıfırı "-0" yapmaz
const negate = (b: Buckets): Buckets => ({ paid: 0 - b.paid, promo: 0 - b.promo, earned: 0 - b.earned, earnedPromo: 0 - b.earnedPromo });

// Okuma (kilitsiz)
export async function getBuckets(userId: string, tx: Tx = prisma): Promise<Buckets> {
  const w = await tx.wallet.findUnique({ where: { userId } });
  return w ? { paid: w.paid, promo: w.promo, earned: w.earned, earnedPromo: w.earnedPromo } : { ...ZERO };
}

export const getBalance = async (userId: string, tx: Tx = prisma) => total(await getBuckets(userId, tx));
export const getCashable = async (userId: string, tx: Tx = prisma) => cashableOf(await getBuckets(userId, tx));

// Tutarlılık denetimi: her cüzdanın kovaları, hareketlerin kova toplamına eşit olmalı
export async function verifyLedger() {
  const rows = await prisma.$queryRaw<{ userId: string }[]>`
    SELECT w."userId"
    FROM "Wallet" w
    LEFT JOIN (
      SELECT "userId", SUM("paid") p, SUM("promo") pr, SUM("earned") e, SUM("earnedPromo") ep, SUM("amount") a
      FROM "WalletEntry" GROUP BY "userId"
    ) s ON s."userId" = w."userId"
    WHERE w."paid" <> COALESCE(s.p, 0) OR w."promo" <> COALESCE(s.pr, 0)
       OR w."earned" <> COALESCE(s.e, 0) OR w."earnedPromo" <> COALESCE(s.ep, 0)
       OR (w."paid" + w."promo" + w."earned" + w."earnedPromo") <> COALESCE(s.a, 0)`;
  return rows.map((r) => r.userId);
}
