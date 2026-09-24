import { Prisma } from '@prisma/client';
import { economy } from './config';
import { prisma } from './db';
import { emitToUser } from './realtime';
import { packById } from './finance/settings';
import { credit, lockWallet, reclaimEarnings } from './wallet';

export type Store = 'app_store' | 'play_store' | 'dev';

export interface PurchaseInput {
  userId: string;
  productId: string;
  transactionId: string;
  store: Store;
  priceUsd?: number | null;
  currency?: string;
  sandbox?: boolean;
}

// İlk alım bonusu: kullanıcının daha önce hiç satın alımı yoksa (iade edilmiş olsa bile)
export async function firstPurchaseBonusFor(userId: string, coins: number, tx: Prisma.TransactionClient = prisma) {
  const previous = await tx.purchase.count({ where: { userId } });
  return previous === 0 ? Math.round((coins * economy.firstPurchaseBonusPct) / 100) : 0;
}

// Satın almayı jetona çevirir. Tüm kaynaklar (webhook, senkronizasyon, test) buradan geçer.
// Aynı mağaza işlemi (transactionId) ikinci kez gelirse hiçbir şey yapmaz.
export async function creditPurchase(input: PurchaseInput): Promise<{ credited: boolean; coins: number; bonus: number }> {
  const pack = await packById(input.productId);
  if (!pack) return { credited: false, coins: 0, bonus: 0 };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchase.findUnique({ where: { transactionId: input.transactionId } });
      if (existing) return { credited: false, coins: 0, bonus: 0 };
      const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, email: true } });
      if (!user) return { credited: false, coins: 0, bonus: 0 };

      const bonus = await firstPurchaseBonusFor(input.userId, pack.coins, tx);
      const purchase = await tx.purchase.create({
        data: {
          userId: input.userId,
          email: user.email,
          store: input.store,
          productId: pack.id,
          transactionId: input.transactionId,
          coins: pack.coins,
          bonusCoins: bonus,
          priceUsd: input.priceUsd ?? null,
          currency: input.currency ?? '',
          sandbox: input.sandbox ?? false,
        },
      });
      await credit(tx, input.userId, { paid: pack.coins }, 'PURCHASE', { note: `${input.store}:${pack.id}:${purchase.id}` });
      // Bonus promosyon kovasına: harcanabilir ama karşı tarafta bozdurulamaz kazanca dönüşür
      if (bonus > 0) await credit(tx, input.userId, { promo: bonus }, 'BONUS', { note: `first_purchase:${purchase.id}` });
      return { credited: true, coins: pack.coins, bonus };
    });
    if (result.credited) emitToUser(input.userId, 'wallet:updated', { coins: result.coins, bonus: result.bonus });
    return result;
  } catch (e) {
    // Aynı işlem eşzamanlı iki kez geldiyse benzersizlik kısıtı yakalar
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { credited: false, coins: 0, bonus: 0 };
    throw e;
  }
}

// Mağaza iadesi: verilen jetonlar (bonus dahil) geri alınır. Bakiye eksiye düşebilir;
// eksi bakiyede harcama yapılamaz, sonraki alım önce borcu kapatır.
export async function refundPurchase(transactionId: string): Promise<boolean> {
  const refunded = await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.findUnique({ where: { transactionId } });
    if (!p || p.status !== 'COMPLETED') return null;
    const { count } = await tx.purchase.updateMany({
      where: { id: p.id, status: 'COMPLETED' },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    });
    if (count !== 1) return null;
    // Hesap silinmişse geri alınacak bakiye yok: sadece kayıt iade olarak işaretlenir
    if (!p.userId) return null;
    // Önce bu jetonlarla karşı tarafa geçen, henüz olgunlaşmamış kazançlar geri alınır; kalanı alıcıdan
    const back = await reclaimEarnings(tx, p.userId, p.coins, p.createdAt, `refund:${p.id}`);
    await credit(tx, p.userId, { paid: -(p.coins - back.reclaimed), promo: -p.bonusCoins }, 'CLAWBACK', { note: `refund:${p.id}` });
    return [p.userId, ...back.users];
  });
  for (const id of refunded ?? []) emitToUser(id, 'wallet:updated', {});
  return refunded !== null;
}

// E-posta doğrulanınca bir kez hediye jeton (promosyon kovası). Kilit: eşzamanlı iki doğrulama çift hediye veremez.
export async function grantSignupBonus(userId: string) {
  if (economy.signupBonus <= 0) return;
  await prisma.$transaction(async (tx) => {
    await lockWallet(tx, userId);
    const given = await tx.walletEntry.findFirst({ where: { userId, type: 'GRANT', note: 'signup_bonus' } });
    if (!given) await credit(tx, userId, { promo: economy.signupBonus }, 'GRANT', { note: 'signup_bonus' });
  });
}
