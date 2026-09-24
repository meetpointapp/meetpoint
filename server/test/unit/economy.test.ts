import { describe, expect, it } from 'vitest';
import { economy } from '../../src/config';
import { packEconomics } from '../../src/finance/settings';

// İş kuralı değişmezleri: fiyat veya kur değiştiğinde platformun zarar etmediğini garanti eder.
// Kötü senaryo varsayımı: satılan her jeton sonunda birinin kazancına dönüşüp paraya çevrilir.
// Paketler ve kurlar veritabanında (panelden değişir); burada ilk kurulum değerleri denetlenir
// (prisma/migrations/*_finance). Panel aynı packEconomics hesabıyla zarar eden paketi kırmızı gösterir.
const DEFAULT_PACKS = [
  { id: 'coins_500', coins: 500, usd: 9.99, popular: false },
  { id: 'coins_1000', coins: 1000, usd: 18.99, popular: true },
  { id: 'coins_2500', coins: 2500, usd: 44.99, popular: false },
  { id: 'coins_6000', coins: 6000, usd: 99.99, popular: false },
];
const DEFAULTS = { storeFeeRate: 0.15, vatRate: 0.2, cashoutUsdPerCoin: 0.01, cashoutMinCoins: 2000 };

describe('jeton ekonomisi', () => {
  it('her paket, KDV ve %15 mağaza payından sonra bozdurma kurunun üstünde kalır', () => {
    for (const p of DEFAULT_PACKS) expect(packEconomics(p, DEFAULTS).profitable, p.id).toBe(true);
  });

  it('büyük paket hiçbir zaman küçükten jeton başına pahalı değil', () => {
    const perCoin = DEFAULT_PACKS.map((p) => p.usd / p.coins);
    for (let i = 1; i < perCoin.length; i++) expect(perCoin[i]).toBeLessThan(perCoin[i - 1]);
  });

  it('tam olarak bir "en popüler" paket', () => {
    expect(DEFAULT_PACKS.filter((p) => p.popular)).toHaveLength(1);
  });

  it('en düşük para çekme tutarı en az 1 paket satışına denk (küçük ödemelerle masraf şişmesin)', () => {
    expect(DEFAULTS.cashoutMinCoins * DEFAULTS.cashoutUsdPerCoin).toBeGreaterThanOrEqual(10);
  });

  it('arama ücretleri ve hediyeler pozitif, hediyeler artan sırada', () => {
    expect(economy.callRates.VOICE).toBeGreaterThan(0);
    expect(economy.callRates.VIDEO).toBeGreaterThanOrEqual(economy.callRates.VOICE);
    const coins = economy.gifts.map((g) => g.coins);
    expect(coins).toEqual([...coins].sort((a, b) => a - b));
    expect(new Set(economy.gifts.map((g) => g.id)).size).toBe(economy.gifts.length);
  });

  // Mağazaların küçük işletme programı (%15) yıllık 1 milyon $ gelire kadar geçerli; üstünde %30.
  // Karar (Faz 13): paketler panelden ayarlanır, %30'da zarara geçen paket panelde uyarıyla gösterilir.
  it('%30 mağaza payında 6000\'lik paket zarar olarak işaretlenir, diğerleri kârlı', () => {
    const at30 = DEFAULT_PACKS.map((p) => [p.id, packEconomics(p, DEFAULTS, 0.3).profitable]);
    expect(Object.fromEntries(at30)).toEqual({ coins_500: true, coins_1000: true, coins_2500: true, coins_6000: false });
  });

  it('kâr hesabı: KDV dahil fiyattan KDV ve mağaza payı düşülür', () => {
    const e = packEconomics({ coins: 1000, usd: 12 }, { storeFeeRate: 0.15, vatRate: 0.2, cashoutUsdPerCoin: 0.005 });
    expect(e.netUsd).toBe(8.5); // 12 / 1.2 × 0.85
    expect(e.netPerCoin).toBe(0.0085);
    expect(e.marginPct).toBeCloseTo(41.2, 1);
  });
});
