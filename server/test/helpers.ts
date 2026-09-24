import type { PrismaClient } from '@prisma/client';
import * as OTPAuth from 'otpauth';
import { expect, inject } from 'vitest';
import { B, call, png, registerVerified, uniqueTag, type TestUser } from './client';

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

// Geçerli (algoritmaya uyan) rastgele TC kimlik numarası
export function validTc() {
  const d = [1 + Math.floor(Math.random() * 9), ...Array.from({ length: 8 }, () => Math.floor(Math.random() * 10))];
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  d.push((((odd * 7 - even) % 10) + 10) % 10);
  d.push(d.reduce((a, b) => a + b, 0) % 10);
  return d.join('');
}

// Kimlik doğrulama: başvuru (ad-soyad, TC, belge) + finans ekibinden onay
export async function verifyIdentity(u: TestUser, fullName: string, approver?: TestAdmin) {
  const fd = new FormData();
  fd.append('fullName', fullName);
  fd.append('tcNo', validTc());
  fd.append('document', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'kimlik.png');
  const res = await fetch(`${B}/me/kyc`, { method: 'POST', headers: { authorization: `Bearer ${u.t}` }, body: fd });
  const sub = await res.json();
  if (res.status !== 201) throw new Error(`kyc submit ${res.status} ${sub.error}`);
  const fin = approver ?? (await makeAdmin('finance'));
  const ok = await call(fin.t, 'POST', `/admin/api/finance/kyc/${sub.id}/decide`, { approve: true });
  if (ok.http !== 200) throw new Error(`kyc decide ${ok.http} ${ok.error}`);
  return sub.id as string;
}

// Kazancı olgunlaştır: başkasından gelen kazançları N gün öncesine taşı (14 günlük bekleme testte beklenmez)
export async function ageEarnings(userId: string, days = 15) {
  await (await testDb()).walletEntry.updateMany({
    where: { userId, counterpartyId: { not: null } },
    data: { createdAt: new Date(Date.now() - days * 86_400_000) },
  });
}
