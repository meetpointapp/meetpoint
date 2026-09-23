import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { config, economy, revenueCat } from '../config';
import { HttpError, prisma } from '../db';
import { payoutDto } from '../payouts';
import { creditPurchase, packById, type Store } from '../purchases';
import { cashableOf, getBalance, getBuckets, total } from '../wallet';

export const walletRouter = Router();

walletRouter.get('/wallet', async (req, res) => {
  const userId = uid(req);
  const [buckets, entries, purchaseCount, pendingPayout] = await Promise.all([
    getBuckets(userId),
    prisma.walletEntry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.purchase.count({ where: { userId } }),
    prisma.payout.findFirst({ where: { userId, status: 'PENDING' } }),
  ]);
  const balance = total(buckets);
  const cashable = cashableOf(buckets);
  res.json({
    balance,
    cashable,
    // Bonus/hediye jetonlarından gelen kazanç: harcanabilir ama paraya çevrilemez
    promoEarnings: buckets.earnedPromo,
    cashableUsd: +(cashable * economy.cashoutUsdPerCoin).toFixed(2),
    cashout: {
      minCoins: economy.cashoutMinCoins,
      usdPerCoin: economy.cashoutUsdPerCoin,
      pending: pendingPayout ? payoutDto(pendingPayout) : null,
    },
    entries,
    packs: economy.coinPacks,
    // İlk alım bonusu hâlâ geçerliyse yüzdesi, değilse 0
    firstPurchaseBonusPct: purchaseCount === 0 ? economy.firstPurchaseBonusPct : 0,
    requestPrices: economy.requestPrices,
    callRates: economy.callRates,
    gifts: economy.gifts,
    featurePrices: {
      superLike: economy.superLikePrice,
      boost: economy.boostPrice,
      boostMinutes: economy.boostMinutes,
      likesUnlock: economy.likesUnlockPrice,
      likesUnlockHours: economy.likesUnlockHours,
    },
  });
});

// Satın almadan sonra uygulama çağırır: RevenueCat'teki işlemleri çekip eksik olanları yükler.
// Webhook gecikse bile jeton hemen gelir; aynı işlem iki kez yüklenmez.
walletRouter.post('/wallet/sync', async (req, res) => {
  if (!revenueCat.secretKey) throw new HttpError(404, 'store_not_configured');
  const userId = uid(req);
  const r = await fetch(`${revenueCat.apiBase}/subscribers/${encodeURIComponent(userId)}`, {
    headers: { authorization: `Bearer ${revenueCat.secretKey}` },
  });
  if (!r.ok) throw new HttpError(502, 'store_unavailable');
  const body = (await r.json()) as {
    subscriber?: { non_subscriptions?: Record<string, { id: string; store?: string; is_sandbox?: boolean; store_transaction_id?: string }[]> };
  };

  let credited = 0;
  for (const [productId, txns] of Object.entries(body.subscriber?.non_subscriptions ?? {})) {
    for (const t of txns) {
      const store: Store = t.store === 'app_store' ? 'app_store' : 'play_store';
      const result = await creditPurchase({
        userId,
        productId,
        transactionId: t.store_transaction_id || t.id,
        store,
        sandbox: t.is_sandbox ?? false,
      });
      if (result.credited) credited += result.coins + result.bonus;
    }
  }
  res.json({ credited, balance: await getBalance(userId) });
});

// GEÇİCİ: Mağaza (IAP) bağlanana kadar test için satın alma. Gerçek akışla aynı yoldan geçer
// (ilk alım bonusu dahil). Yayında bu uç kapalıdır.
walletRouter.post('/wallet/dev-topup', async (req, res) => {
  if (config.isProduction) throw new HttpError(404, 'not_found');
  const { packId } = z.object({ packId: z.string() }).parse(req.body);
  if (!packById(packId)) throw new HttpError(400, 'invalid_pack');
  const userId = uid(req);
  const result = await creditPurchase({
    userId,
    productId: packId,
    transactionId: `dev-${crypto.randomUUID()}`,
    store: 'dev',
  });
  res.json({ balance: await getBalance(userId), coins: result.coins, bonus: result.bonus });
});
