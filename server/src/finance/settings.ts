import type { CoinPack, FinanceSettings } from '@prisma/client';
import { prisma } from '../db';

// Ekonomi ayarları ve satış paketleri veritabanında (panelden değişir). Her sunucu birkaç saniyelik
// önbellekle okur: panelde yapılan değişiklik en geç TTL kadar sonra tüm sunuculara yansır.

const TTL_MS = Number(process.env.FINANCE_CACHE_MS ?? 5000);
let cache: { at: number; settings: FinanceSettings; packs: CoinPack[] } | null = null;

async function load() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const [settings, packs] = await Promise.all([
    prisma.financeSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.coinPack.findMany({ orderBy: [{ sortOrder: 'asc' }, { coins: 'asc' }] }),
  ]);
  cache = { at: Date.now(), settings, packs };
  return cache;
}

export const invalidateFinance = () => {
  cache = null;
};

export const getFinance = async () => (await load()).settings;
export const getPacks = async (includeInactive = false) => (await load()).packs.filter((p) => includeInactive || p.active);
export const packById = async (id: string) => (await getPacks()).find((p) => p.id === id);

// Paket kârlılığı: KDV dahil fiyattan KDV ve mağaza payı düşülünce jeton başı gelir, bozdurma kurundan
// yüksek mi? (Harcanan her ücretli jeton karşı tarafta bozdurulabilir kazanca dönüşebilir.)
export function packEconomics(pack: Pick<CoinPack, 'coins' | 'usd'>, s: Pick<FinanceSettings, 'storeFeeRate' | 'vatRate' | 'cashoutUsdPerCoin'>, storeFeeRate = s.storeFeeRate) {
  const netUsd = (pack.usd / (1 + s.vatRate)) * (1 - storeFeeRate);
  const netPerCoin = netUsd / pack.coins;
  const marginPerCoin = netPerCoin - s.cashoutUsdPerCoin;
  return {
    netUsd: +netUsd.toFixed(2),
    netPerCoin: +netPerCoin.toFixed(5),
    marginPct: +((marginPerCoin / netPerCoin) * 100).toFixed(1),
    profitable: marginPerCoin > 0,
  };
}

// Panel için: her paketin bugünkü ve %30 mağaza payındaki kârlılığı
export async function packReport() {
  const s = await getFinance();
  return (await getPacks(true)).map((p) => ({
    ...p,
    now: packEconomics(p, s),
    at30: packEconomics(p, s, 0.3),
  }));
}
