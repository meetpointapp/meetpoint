import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { config, economy, revenueCat } from '../config';
import { HttpError, prisma } from '../db';
import { payoutDto } from '../payouts';
import { getFinance, getPacks, packById } from '../finance/settings';
import { creditPurchase, type Store } from '../purchases';
import { cashableNow, getBalance, getBuckets, total } from '../wallet';
import { acceptSalesTerms, requireSalesTerms, salesTermsState } from '../consumer/salesTerms';

export const walletRouter = Router();

walletRouter.get('/wallet', async (req, res) => {
  const userId = uid(req);
  const [buckets, entries, purchaseCount, pendingPayout, s, packs, user] = await Promise.all([
    getBuckets(userId),
    prisma.walletEntry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.purchase.count({ where: { userId } }),
    prisma.payout.findFirst({ where: { userId, status: 'PENDING' } }),
    getFinance(),
    getPacks(),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { kycStatus: true, salesTermsVersion: true } }),
  ]);
  const balance = total(buckets);
  const { cashable, pending, nextMatureAt } = await cashableNow(prisma, userId, buckets);
  res.json({
    balance,
    cashable,
    // Olgunlaşmayı bekleyen kazanç (iade süresi dolunca bozdurulabilir olur)
    maturingEarnings: pending,
    nextMatureAt,
    // Bonus/hediye jetonlarından gelen kazanç: harcanabilir ama paraya çevrilemez
    promoEarnings: buckets.earnedPromo,
    cashableUsd: +(cashable * s.cashoutUsdPerCoin).toFixed(2),
    cashout: {
      minCoins: s.cashoutMinCoins,
      usdPerCoin: s.cashoutUsdPerCoin,
      withholdingRate: s.withholdingRate,
      maturityDays: s.maturityDays,
      monthlyCapUsd: s.monthlyPayoutCapUsd,
      kycStatus: user.kycStatus,
      pending: pendingPayout ? payoutDto(pendingPayout) : null,
    },
    entries,
    // Satın alma öncesi onay (ön bilgilendirme + mesafeli satış + cayma istisnası)
    salesTerms: salesTermsState(user),
    packs: packs.map(({ id, coins, usd, tryPrice, popular }) => ({ id, coins, usd, tryPrice, popular })),
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

// Satın alma öncesi onay: uygulama ilk satın almadan (veya metin değişince) önce gösterir
walletRouter.post('/wallet/sales-terms', async (req, res) => {
  z.object({ accept: z.literal(true) }).parse(req.body);
  await acceptSalesTerms(uid(req), String(req.ip ?? ''));
  res.json({ ok: true });
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
  if (!(await packById(packId))) throw new HttpError(400, 'invalid_pack');
  const userId = uid(req);
  await requireSalesTerms(userId);
  const result = await creditPurchase({
    userId,
    productId: packId,
    transactionId: `dev-${crypto.randomUUID()}`,
    store: 'dev',
  });
  res.json({ balance: await getBalance(userId), coins: result.coins, bonus: result.bonus });
});
