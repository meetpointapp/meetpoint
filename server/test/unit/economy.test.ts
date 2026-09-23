import { describe, expect, it } from 'vitest';
import { economy } from '../../src/config';

// İş kuralı değişmezleri: fiyat veya kur değiştiğinde platformun zarar etmediğini garanti eder.
// Kötü senaryo varsayımı: satılan her jeton sonunda birinin kazancına dönüşüp paraya çevrilir.
const KDV = 0.2; // Türkiye'de dijital hizmet KDV'si (mağaza fiyatına dahil)
const STORE_FEE_SMALL = 0.15; // Apple/Google küçük işletme programı

// Mağaza ve KDV düşüldükten sonra jeton başına kalan net USD
const netPerCoin = (usd: number, coins: number, storeFee: number) => (usd / (1 + KDV)) * (1 - storeFee) / coins;

describe('jeton ekonomisi', () => {
  it('her paket, KDV ve %15 mağaza payından sonra bozdurma kurunun üstünde kalır', () => {
    for (const p of economy.coinPacks) {
      expect(netPerCoin(p.usd, p.coins, STORE_FEE_SMALL), p.id).toBeGreaterThan(economy.cashoutUsdPerCoin);
    }
  });

  it('büyük paket hiçbir zaman küçükten jeton başına pahalı değil', () => {
    const perCoin = economy.coinPacks.map((p) => p.usd / p.coins);
    for (let i = 1; i < perCoin.length; i++) expect(perCoin[i]).toBeLessThan(perCoin[i - 1]);
  });

  it('tam olarak bir "en popüler" paket', () => {
    expect(economy.coinPacks.filter((p) => p.popular)).toHaveLength(1);
  });

  it('en düşük para çekme tutarı en az 1 paket satışına denk (küçük ödemelerle masraf şişmesin)', () => {
    expect(economy.cashoutMinCoins * economy.cashoutUsdPerCoin).toBeGreaterThanOrEqual(10);
  });

  it('arama ücretleri ve hediyeler pozitif, hediyeler artan sırada', () => {
    expect(economy.callRates.VOICE).toBeGreaterThan(0);
    expect(economy.callRates.VIDEO).toBeGreaterThanOrEqual(economy.callRates.VOICE);
    const coins = economy.gifts.map((g) => g.coins);
    expect(coins).toEqual([...coins].sort((a, b) => a - b));
    expect(new Set(economy.gifts.map((g) => g.id)).size).toBe(economy.gifts.length);
  });

  // Bonus ve kayıt hediyesi "promo" kovasına girer; harcandığında karşı tarafta bozdurulamaz kazanç olur
  // (src/wallet.ts earningsFrom, test/unit/wallet.test.ts). Bu yüzden bozdurmaya dönüşebilecek her jeton
  // gerçek parayla satılmış jetondur ve yukarıdaki paket testi yeterlidir.
  it('promosyon jetonları kârlılık hesabına girmez: bonus hiçbir paketi zarara sokmaz', () => {
    expect(economy.firstPurchaseBonusPct).toBeGreaterThan(0); // teşvik duruyor
    for (const p of economy.coinPacks) {
      // Bozdurulabilecek en fazla jeton = satın alınan jeton (bonus hariç)
      expect(netPerCoin(p.usd, p.coins, STORE_FEE_SMALL), p.id).toBeGreaterThan(economy.cashoutUsdPerCoin);
    }
  });

  // Mağazaların küçük işletme programı (%15) yıllık 1 milyon $ gelire kadar geçerli; üstünde %30.
  // %30'da 6000'lik paket zarara geçiyor: fiyat/kur o eşiğe yaklaşınca yeniden ayarlanmalı (Faz 13).
  it.todo('%30 mağaza payında da tüm paketler kârlı kalır');
});
