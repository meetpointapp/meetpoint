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

  it('2500 ve 6000 paketleri jeton başına daha ucuz', () => {
    const perCoin = economy.coinPacks.map((p) => p.usd / p.coins);
    for (let i = 2; i < perCoin.length; i++) expect(perCoin[i]).toBeLessThan(perCoin[i - 1]);
  });

  // BİLİNEN SORUN (fiyat kararı bekliyor): "En popüler" 1000'lik paket ($19.99, jeton başı $0.01999)
  // 500'lük paketten ($9.99, $0.01998) jeton başına biraz daha pahalı.
  it.todo('büyük paket hiçbir zaman küçükten jeton başına pahalı değil (1000 ≤ 500)');

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

  // BİLİNEN RİSK (Faz 13'te karara bağlanacak): Bonus jetonlar başkasına harcandığında onun
  // bozdurulabilir kazancına dönüşüyor. %50 ilk alım bonusunda jeton başı net gelir kurun altına iniyor
  // (ör. 1000 paket: 19.99 / 1.2 × 0.85 / 1500 = $0.0094 < $0.01). %30 mağaza payında 6000'lik paket
  // bonussuz bile zararda. Çözüm seçenekleri yol haritasında.
  it.todo('ilk alım bonusu ve kayıt hediyesi dahil hiçbir senaryoda jeton başı net gelir kurun altına inmez');
  it.todo('%30 mağaza payında da tüm paketler kârlı kalır');
});
