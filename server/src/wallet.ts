import type { Prisma, WalletEntry } from '@prisma/client';
import { HttpError, prisma } from './db';
import { getFinance } from './finance/settings';

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
//
// Olgunlaşma (Faz 13): başkasından gelen kazanç, iade süresi boyunca (varsayılan 14 gün) bozdurulamaz.
// Bu sürede ödeyen taraf mağazadan iade alırsa, o satın almayla gelen kazanç alıcıdan geri alınır.

type Tx = Prisma.TransactionClient;

export type Buckets = { paid: number; promo: number; earned: number; earnedPromo: number };
export const BUCKETS = ['paid', 'promo', 'earned', 'earnedPromo'] as const;
const SPEND_ORDER = ['promo', 'earnedPromo', 'paid', 'earned'] as const;
const ZERO: Buckets = { paid: 0, promo: 0, earned: 0, earnedPromo: 0 };

export const total = (b: Buckets) => b.paid + b.promo + b.earned + b.earnedPromo;
// Bozdurulabilir: kazanç, ama bakiye borçluysa (ör. iade sonrası eksi) en fazla toplam bakiye kadar
export const cashableOf = (b: Buckets) => Math.max(0, Math.min(b.earned, total(b)));

type Meta = { requestId?: string; note?: string; counterpartyId?: string };

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
    data: { userId, amount: total(delta), type, ...delta, requestId: meta.requestId, note: meta.note ?? '', counterpartyId: meta.counterpartyId },
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
  const { taken } = await debit(tx, fromId, amount, types.debit, { ...meta, counterpartyId: toId });
  await credit(tx, toId, earningsFrom(taken), types.credit, { ...meta, counterpartyId: fromId });
  return taken;
}

// Harcanan jetonun karşı tarafa kazanç olarak dağılımı
export const earningsFrom = (taken: Buckets): Partial<Buckets> => ({
  earned: taken.paid + taken.earned,
  earnedPromo: taken.promo + taken.earnedPromo,
});

// Olgunlaşmamış kazanç: son N günde başkasından gelen (iadeyle geri alınmamış) bozdurulabilir kazanç
export async function immatureEarned(tx: Tx, userId: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await tx.$queryRaw<{ sum: bigint | null; oldest: Date | null }[]>`
    SELECT SUM("earned" - "reclaimedCoins") AS "sum", MIN("createdAt") AS "oldest" FROM "WalletEntry"
    WHERE "userId" = ${userId} AND "counterpartyId" IS NOT NULL AND "earned" > 0 AND "createdAt" > ${since}`;
  const oldest = rows[0]?.oldest ?? null;
  return { coins: Number(rows[0]?.sum ?? 0), nextMatureAt: oldest ? new Date(oldest.getTime() + days * 86_400_000) : null };
}

// Şu an bozdurulabilir: kazanç − olgunlaşmamış kısım (bakiye borçluysa en fazla toplam bakiye kadar)
export async function cashableNow(tx: Tx, userId: string, b?: Buckets) {
  const buckets = b ?? (await getBuckets(userId, tx));
  const { maturityDays } = await getFinance();
  const pending = await immatureEarned(tx, userId, maturityDays);
  const all = cashableOf(buckets);
  return { cashable: Math.max(0, all - pending.coins), pending: Math.min(all, pending.coins), nextMatureAt: pending.nextMatureAt };
}

// Bozdurma: sadece "earned" kovasının olgunlaşmış kısmından
export async function debitCashable(tx: Tx, userId: string, amount: number, type: string, meta: Meta = {}) {
  const b = await lockWallet(tx, userId);
  if ((await cashableNow(tx, userId, b)).cashable < amount) throw new HttpError(402, 'insufficient_cashable');
  return apply(tx, userId, { ...ZERO, earned: -amount }, type, meta);
}

// Mağaza iadesi: alıcının bu satın almadan sonra başkalarına geçirdiği ve henüz olgunlaşmamış kazançlar
// en yeniden başlayarak geri alınır (en fazla iade edilen jeton kadar). Olgunlaşıp bozdurulmuş kazanç
// geri alınamaz; olgunlaşma süresi bu riski sınırlamak için var. Geri alınan miktarı döndürür.
export async function reclaimEarnings(tx: Tx, buyerId: string, coins: number, since: Date, note: string) {
  const { maturityDays } = await getFinance();
  const after = new Date(Math.max(since.getTime(), Date.now() - maturityDays * 86_400_000));
  const entries = await tx.walletEntry.findMany({
    where: { counterpartyId: buyerId, earned: { gt: 0 }, createdAt: { gte: after } },
    orderBy: { createdAt: 'desc' },
  });
  // Kilitlenme olmasın: tüm cüzdanlar her zaman aynı sırayla kilitlenir
  for (const id of [...new Set([buyerId, ...entries.map((e) => e.userId)])].sort()) await lockWallet(tx, id);
  let left = coins;
  const touched = new Set<string>();
  for (const e of entries) {
    if (left <= 0) break;
    const w = await getBuckets(e.userId, tx);
    const take = Math.min(left, e.earned - e.reclaimedCoins, Math.max(0, w.earned));
    if (take <= 0) continue;
    await apply(tx, e.userId, { ...ZERO, earned: -take }, 'REFUND_CLAWBACK', { note, counterpartyId: buyerId });
    await tx.walletEntry.update({ where: { id: e.id }, data: { reclaimedCoins: { increment: take } } });
    touched.add(e.userId);
    left -= take;
  }
  return { reclaimed: coins - left, users: [...touched] };
}

// Arama ücretinin tamamını veya bir kısmını geri al (Faz 15: adil ücretlendirme). Her ücretlendirilen
// dakika, arayanın cüzdanından TAM O DAKİKANIN kova karışımıyla (paid/promo/earned/earnedPromo)
// düşülmüştü; iade de aynı karışımla tersine çevrilir — bonus jetonla ödenen bir dakikanın iadesi
// yanlışlıkla "gerçek" (cashable'a yakın) jetona dönüşmez. Alıcıdan da aynı oranda (mümkün olduğunca)
// geri alınır; en yeni ücretlendirilen dakikadan başlar. Karşı tarafın parası yoksa (zaten harcanmış)
// elde ne kalmışsa o kadar geri alınır, fark WalletEntry.reclaimedCoins'te iz olarak kalır.
export async function refundCallCharge(tx: Tx, callId: string, callerId: string, calleeId: string, refundCoins: number) {
  if (refundCoins <= 0) return;
  for (const id of [callerId, calleeId].sort()) await lockWallet(tx, id);
  const debits = await tx.walletEntry.findMany({ where: { userId: callerId, type: 'CALL', note: `call:${callId}` }, orderBy: { createdAt: 'desc' } });
  const credits = await tx.walletEntry.findMany({ where: { userId: calleeId, type: 'EARN', note: `call:${callId}` }, orderBy: { createdAt: 'desc' } });

  let left = refundCoins;
  for (let i = 0; i < debits.length && left > 0; i++) {
    const d = debits[i];
    const charged = -d.amount; // debit.amount negatiftir
    if (charged <= 0) continue;
    const take = Math.min(left, charged);
    const frac = take / charged;

    const refundBuckets: Buckets = {
      paid: Math.round(-d.paid * frac),
      promo: Math.round(-d.promo * frac),
      earned: Math.round(-d.earned * frac),
      earnedPromo: Math.round(-d.earnedPromo * frac),
    };
    // Bağımsız yuvarlamalar toplamı "take"ten sapabilir: farkı en büyük kovadan düzelt
    const diff = take - total(refundBuckets);
    if (diff !== 0) {
      const biggest = BUCKETS.reduce((a, b) => (refundBuckets[b] > refundBuckets[a] ? b : a));
      refundBuckets[biggest] += diff;
    }
    await credit(tx, callerId, refundBuckets, 'CALL_REFUND', { note: `call:${callId}`, counterpartyId: calleeId });

    const e = credits[i];
    if (e) {
      const w = await getBuckets(calleeId, tx);
      const takeEarned = Math.min(Math.round(e.earned * frac), e.earned - e.reclaimedCoins, Math.max(0, w.earned));
      const takeEarnedPromo = Math.min(Math.round(e.earnedPromo * frac), Math.max(0, w.earnedPromo));
      if (takeEarned > 0 || takeEarnedPromo > 0) {
        await apply(tx, calleeId, { ...ZERO, earned: -takeEarned, earnedPromo: -takeEarnedPromo }, 'CALL_REFUND_CLAWBACK', { note: `call:${callId}`, counterpartyId: callerId });
        if (takeEarned > 0) await tx.walletEntry.update({ where: { id: e.id }, data: { reclaimedCoins: { increment: takeEarned } } });
      }
    }
    left -= take;
  }
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
export const getCashable = async (userId: string, tx: Tx = prisma) => (await cashableNow(tx, userId)).cashable;

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
