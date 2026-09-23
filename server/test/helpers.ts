import { expect } from 'vitest';

// API testleri için ortak yardımcılar
export * from './client';

// Adım adım senaryo testlerinde: başarısız olsa bile senaryo devam eder, hepsi raporlanır
export function check(label: string, cond: unknown, extra = '') {
  expect.soft(Boolean(cond), extra ? `${label} (${extra})` : label).toBe(true);
}
