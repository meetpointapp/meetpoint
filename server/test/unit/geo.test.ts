import { describe, expect, it } from 'vitest';
import { distanceKm, roundCoord, roundedDistance } from '../../src/geo';

describe('konum ve mesafe', () => {
  it('konum ~1 km hassasiyete yuvarlanır (gizlilik)', () => {
    expect(roundCoord(41.008237)).toBe(41.01);
    expect(roundCoord(28.978359)).toBe(28.98);
    expect(roundCoord(-0.004)).toBe(-0);
  });

  it('İstanbul – İzmir kuş uçuşu ~330 km', () => {
    const km = distanceKm(41.01, 28.98, 38.42, 27.14);
    expect(km).toBeGreaterThan(320);
    expect(km).toBeLessThan(340);
  });

  it('aynı nokta 0 km, simetrik', () => {
    expect(distanceKm(41, 29, 41, 29)).toBe(0);
    expect(distanceKm(41, 29, 38, 27)).toBeCloseTo(distanceKm(38, 27, 41, 29), 9);
  });

  it('gösterilen mesafe en az 1 km, tam sayı', () => {
    expect(roundedDistance({ latitude: 41.01, longitude: 28.98 }, { latitude: 41.01, longitude: 28.98 })).toBe(1);
    expect(Number.isInteger(roundedDistance({ latitude: 41.01, longitude: 28.98 }, { latitude: 41.06, longitude: 29.01 }))).toBe(true);
  });

  it('konumu bilinmeyen tarafta mesafe gösterilmez', () => {
    expect(roundedDistance(null, { latitude: 41, longitude: 29 })).toBeNull();
    expect(roundedDistance({ latitude: 41, longitude: null }, { latitude: 41, longitude: 29 })).toBeNull();
    expect(roundedDistance({ latitude: 41, longitude: 29 }, undefined)).toBeNull();
  });
});
