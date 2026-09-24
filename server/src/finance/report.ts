import { prisma } from '../db';
import { verifyLedger } from '../wallet';
import { getFinance } from './settings';

// Aylık finans raporu (muhasebeye dışa aktarım): satış, iade, jeton akışı, dolaşımdaki jeton
// yükümlülüğü, ödemeler ve mutabakat. Tutarlar USD (mağaza raporlarıyla karşılaştırılır).

export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

const round = (n: number) => +n.toFixed(2);

export async function financeReport(month: string) {
  const { from, to } = monthRange(month);
  const s = await getFinance();
  const realSale = { sandbox: false, store: { not: 'dev' } };
  const inMonth = { gte: from, lt: to };

  const [sales, refunds, flows, balances, paid, pending, purchasedCoinsAll, purchaseEntriesAll, ledgerBad, deletedSales] = await Promise.all([
    prisma.purchase.aggregate({ where: { ...realSale, createdAt: inMonth }, _count: true, _sum: { priceUsd: true, coins: true, bonusCoins: true } }),
    prisma.purchase.aggregate({ where: { ...realSale, status: 'REFUNDED', refundedAt: inMonth }, _count: true, _sum: { priceUsd: true, coins: true } }),
    prisma.walletEntry.groupBy({ by: ['type'], where: { createdAt: inMonth }, _sum: { amount: true, earned: true } }),
    prisma.wallet.aggregate({ _sum: { paid: true, promo: true, earned: true, earnedPromo: true } }),
    prisma.payout.aggregate({ where: { status: 'PAID', processedAt: inMonth }, _count: true, _sum: { usd: true, withholdingUsd: true, netUsd: true, coins: true } }),
    prisma.payout.aggregate({ where: { status: 'PENDING' }, _count: true, _sum: { usd: true } }),
    // Silinen hesapların cüzdan hareketleri de silinir ama satış kaydı kalır: mutabakat mevcut hesaplarla yapılır
    prisma.purchase.aggregate({ where: { userId: { not: null } }, _sum: { coins: true, bonusCoins: true } }),
    prisma.walletEntry.aggregate({ where: { type: { in: ['PURCHASE', 'BONUS'] } }, _sum: { amount: true } }),
    verifyLedger(),
    prisma.purchase.aggregate({ where: { userId: null }, _count: true, _sum: { coins: true, bonusCoins: true } }),
  ]);

  const gross = sales._sum.priceUsd ?? 0;
  const flow = Object.fromEntries(flows.map((f) => [f.type, f._sum.amount ?? 0]));
  const b = balances._sum;
  const soldAll = (purchasedCoinsAll._sum.coins ?? 0) + (purchasedCoinsAll._sum.bonusCoins ?? 0);

  return {
    month,
    settings: { storeFeeRate: s.storeFeeRate, vatRate: s.vatRate, cashoutUsdPerCoin: s.cashoutUsdPerCoin, withholdingRate: s.withholdingRate },
    sales: {
      count: sales._count,
      grossUsd: round(gross),
      // Tahmini: mağazanın gerçek ödemesi mağaza raporundan alınır
      vatUsd: round(gross - gross / (1 + s.vatRate)),
      storeFeeUsd: round((gross / (1 + s.vatRate)) * s.storeFeeRate),
      netUsd: round((gross / (1 + s.vatRate)) * (1 - s.storeFeeRate)),
      coinsSold: sales._sum.coins ?? 0,
      bonusCoins: sales._sum.bonusCoins ?? 0,
    },
    refunds: { count: refunds._count, grossUsd: round(refunds._sum.priceUsd ?? 0), coins: refunds._sum.coins ?? 0 },
    coinFlows: flow,
    // Dolaşımdaki jeton: kullanıcılara borç. Bozdurulabilir kazanç nakit yükümlülüktür.
    liability: {
      paidCoins: b.paid ?? 0,
      promoCoins: (b.promo ?? 0) + (b.earnedPromo ?? 0),
      earnedCoins: b.earned ?? 0,
      maxCashUsd: round((b.earned ?? 0) * s.cashoutUsdPerCoin),
    },
    payouts: {
      paidCount: paid._count,
      paidCoins: paid._sum.coins ?? 0,
      grossUsd: round(paid._sum.usd ?? 0),
      withholdingUsd: round(paid._sum.withholdingUsd ?? 0),
      netUsd: round(paid._sum.netUsd ?? 0),
      pendingCount: pending._count,
      pendingUsd: round(pending._sum.usd ?? 0),
    },
    // Mutabakat: satış kayıtlarındaki jeton = cüzdana yüklenen jeton; her cüzdan defterle tutarlı
    reconciliation: {
      purchasedCoins: soldAll,
      creditedCoins: purchaseEntriesAll._sum.amount ?? 0,
      matches: soldAll === (purchaseEntriesAll._sum.amount ?? 0),
      inconsistentWallets: ledgerBad.length,
      // Bilgi: hesabı silinmiş kullanıcıların satışları (muhasebe kaydı olarak duruyor)
      deletedAccountSales: deletedSales._count,
      deletedAccountCoins: (deletedSales._sum.coins ?? 0) + (deletedSales._sum.bonusCoins ?? 0),
    },
  };
}

// Muhasebe için düz CSV (bölüm,kalem,değer)
export function reportCsv(r: Awaited<ReturnType<typeof financeReport>>) {
  const rows: [string, string, string | number][] = [['rapor', 'ay', r.month]];
  const add = (section: string, obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) rows.push([section, k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
  };
  add('ayarlar', r.settings);
  add('satis', r.sales);
  add('iade', r.refunds);
  add('jeton_akisi', r.coinFlows);
  add('yukumluluk', r.liability);
  add('odemeler', r.payouts);
  add('mutabakat', r.reconciliation);
  return ['bolum,kalem,deger', ...rows.map((row) => row.map((c) => (/[",]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(','))].join('\n');
}
