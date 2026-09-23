import { describe, expect, it } from 'vitest';
import { type Buckets, cashableOf, earningsFrom, heldBuckets, total } from '../../src/wallet';

const b = (x: Partial<Buckets>): Buckets => ({ paid: 0, promo: 0, earned: 0, earnedPromo: 0, ...x });

describe('cüzdan kuralları', () => {
  it('bakiye tüm kovaların toplamı', () => {
    expect(total(b({ paid: 100, promo: 50, earned: 30, earnedPromo: 20 }))).toBe(200);
  });

  it('sadece gerçek parayla ödenmiş jetondan gelen kazanç bozdurulabilir', () => {
    expect(cashableOf(b({ paid: 1000, promo: 500, earned: 300, earnedPromo: 200 }))).toBe(300);
    expect(cashableOf(b({ paid: 1000, promo: 500 }))).toBe(0);
    expect(cashableOf(b({ earnedPromo: 5000 }))).toBe(0);
  });

  it('iade sonrası borçlu cüzdanda bozdurulabilir tutar bakiyeyle sınırlı', () => {
    // 500'lük alım iade edildi (paid -500), 300 kazanç var: toplam -200 → bozdurulabilir 0
    expect(cashableOf(b({ paid: -500, earned: 300 }))).toBe(0);
    // toplam 100: en fazla 100 bozdurulabilir
    expect(cashableOf(b({ paid: -200, earned: 300 }))).toBe(100);
  });

  it('bonus/hediye jetonu karşı tarafta asla bozdurulabilir kazanca dönüşmez', () => {
    expect(earningsFrom(b({ promo: 30 }))).toEqual({ earned: 0, earnedPromo: 30 });
    expect(earningsFrom(b({ earnedPromo: 30 }))).toEqual({ earned: 0, earnedPromo: 30 });
  });

  it('satın alınmış jeton ve gerçek kazanç karşı tarafa bozdurulabilir kazanç olarak geçer', () => {
    expect(earningsFrom(b({ paid: 20, earned: 10 }))).toEqual({ earned: 30, earnedPromo: 0 });
    expect(earningsFrom(b({ promo: 5, paid: 25 }))).toEqual({ earned: 25, earnedPromo: 5 });
  });

  it('bloke kaydı: kova dağılımı aynen geri alınır; eski (kovasız) kayıtlar "paid" sayılır', () => {
    expect(heldBuckets({ amount: -50, paid: -20, promo: -30, earned: 0, earnedPromo: 0 })).toEqual(b({ paid: 20, promo: 30 }));
    expect(heldBuckets({ amount: -50, paid: 0, promo: 0, earned: 0, earnedPromo: 0 })).toEqual(b({ paid: 50 }));
  });
});
