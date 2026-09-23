import { describe, expect, it } from 'vitest';
import { ageOf, birthdayForAge } from '../../src/age';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('ageOf', () => {
  it('doğum gününden bir gün önce yaş dolmamış sayılır', () => {
    expect(ageOf(d('2008-09-24'), d('2026-09-23'))).toBe(17);
  });

  it('doğum günü yaş dolar', () => {
    expect(ageOf(d('2008-09-24'), d('2026-09-24'))).toBe(18);
  });

  it('sunucunun saat diliminden bağımsız (UTC gece yarısına çok yakın an)', () => {
    // UTC'de hâlâ 23 Eylül: 18 yaş dolmamış olmalı
    expect(ageOf(d('2008-09-24'), new Date('2026-09-23T23:59:59.999Z'))).toBe(17);
  });

  it('29 Şubat doğumlu: artık olmayan yılda 1 Mart\'ta yaş dolar', () => {
    expect(ageOf(d('2008-02-29'), d('2026-02-28'))).toBe(17);
    expect(ageOf(d('2008-02-29'), d('2026-03-01'))).toBe(18);
  });
});

describe('birthdayForAge (keşfet yaş filtresi sınırları)', () => {
  const now = d('2026-09-23');

  it('en az 18: tam 18 olan dahil, bir gün eksik olan hariç', () => {
    const limit = birthdayForAge(18, now);
    expect(d('2008-09-23') <= limit).toBe(true);
    expect(d('2008-09-24') <= limit).toBe(false);
  });

  it('en fazla 30: 30 yaşındaki dahil, 31 olan hariç', () => {
    const lower = birthdayForAge(31, now);
    expect(d('1995-09-24') > lower).toBe(true); // 30 yaşında
    expect(d('1995-09-23') > lower).toBe(false); // bugün 31 oldu
  });

  it('ageOf ile tutarlı (29 Şubat dahil)', () => {
    for (const today of ['2026-02-28', '2026-03-01', '2028-02-29', '2026-12-31']) {
      const n = d(today);
      for (const birth of ['2008-02-29', '2008-03-01', '2007-12-31', '2008-01-01']) {
        const b = d(birth);
        expect(b <= birthdayForAge(18, n)).toBe(ageOf(b, n) >= 18);
      }
    }
  });
});
