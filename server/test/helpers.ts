import type { PrismaClient } from '@prisma/client';
import * as OTPAuth from 'otpauth';
import { expect, inject } from 'vitest';
import { call, registerVerified, uniqueTag } from './client';

// API testleri için ortak yardımcılar
export * from './client';

// Adım adım senaryo testlerinde: başarısız olsa bile senaryo devam eder, hepsi raporlanır
export function check(label: string, cond: unknown, extra = '') {
  expect.soft(Boolean(cond), extra ? `${label} (${extra})` : label).toBe(true);
}

// Test veritabanına doğrudan erişim (dosya başına tek bağlantı)
let db: PrismaClient | undefined;
export async function testDb() {
  if (!db) {
    process.env.DATABASE_URL = inject('databaseUrl');
    const { PrismaClient } = await import('@prisma/client');
    db = new PrismaClient();
  }
  return db;
}

export const totpCode = (secret: string, offset = 0) =>
  new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 }).generate({
    timestamp: Date.now() + offset * 30_000,
  });

export type TestAdmin = { t: string; id: string; email: string; refresh: string; secret: string; backupCodes: string[] };

// Yönetim ekibi üyesi: hesap açılır, rol verilir, 2FA kurulur (bu oturum doğrulanmış olur).
// Her test kendi yöneticisini açar: aynı 2FA kodunun iki kez kullanılamaması testleri etkilemez.
export async function makeAdmin(role: 'super' | 'moderator' | 'finance' = 'super'): Promise<TestAdmin> {
  const u = await registerVerified(`${role}${uniqueTag()}@staff.test`);
  await (await testDb()).user.update({ where: { id: u.id }, data: { isAdmin: true, adminRole: role } });
  const setup = await call(u.t, 'POST', '/admin/api/mfa/setup');
  if (setup.http !== 200) throw new Error(`mfa setup ${setup.http} ${setup.error}`);
  const enable = await call(u.t, 'POST', '/admin/api/mfa/enable', { code: totpCode(setup.secret) });
  if (enable.http !== 200) throw new Error(`mfa enable ${enable.http} ${enable.error}`);
  return { ...u, secret: setup.secret, backupCodes: enable.backupCodes };
}
