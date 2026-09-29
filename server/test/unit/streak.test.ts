import { describe, expect, it } from 'vitest';
import { localDateStr } from '../../src/streak';

describe('localDateStr (Faz 17: günlük giriş serisi)', () => {
  it('UTC gece yarısını, pozitif fark (ör. Türkiye +180dk) yerel günü ileri taşır', () => {
    // 23:30 UTC + 180dk (UTC+3) = 02:30 yerel, ertesi gün
    const utc = new Date('2026-03-10T23:30:00.000Z');
    expect(localDateStr(utc, 180)).toBe('2026-03-11');
    expect(localDateStr(utc, 0)).toBe('2026-03-10');
  });

  it('negatif fark yerel günü geri taşıyabilir', () => {
    // 01:00 UTC - 300dk (UTC-5) = önceki gün 20:00
    const utc = new Date('2026-03-10T01:00:00.000Z');
    expect(localDateStr(utc, -300)).toBe('2026-03-09');
  });

  it('bir sonraki gün 24 saat sonra farklı bir değer döner', () => {
    const day1 = new Date('2026-06-01T10:00:00.000Z');
    const day2 = new Date(day1.getTime() + 86_400_000);
    expect(localDateStr(day1, 180)).not.toBe(localDateStr(day2, 180));
  });
});
