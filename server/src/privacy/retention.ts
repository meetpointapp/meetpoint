import type { Prisma } from '@prisma/client';
import { retention } from '../config';
import { prisma } from '../db';
import { sendMail } from '../mailer';
import { purgeOldTraffic } from '../moderation/traffic';
import { privateStore } from '../storage';
import { hardDeleteUser } from './accounts';

// Saklama ve imha (KVKK md. 7, Kişisel Verilerin Silinmesi Yönetmeliği). Süresi dolan veriler periyodik
// olarak silinir; her imha DestructionLog'a yazılır (değiştirilemez kayıt). Süreler: config.ts → retention.

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

async function log(kind: string, count: number, details: Prisma.InputJsonObject = {}) {
  if (count > 0) await prisma.destructionLog.create({ data: { kind, count, details } });
  return count;
}

// Silme talebinin bekleme süresi doldu: kalıcı sil
async function deleteRequestedAccounts() {
  const due = await prisma.user.findMany({ where: { deleteAfter: { lte: new Date() } }, select: { id: true } });
  let n = 0;
  for (const u of due) if (await hardDeleteUser(u.id)) n++;
  return log('account_deleted', n, { reason: 'user_request', graceDays: retention.deletionGraceDays });
}

// Uzun süre girilmeyen hesaplar: önce e-posta uyarısı, süre içinde giriş yoksa silme.
// Yönetim ekibi ve bekleyen para çekme talebi olanlar atlanır.
async function handleInactiveAccounts() {
  const threshold = ago(retention.inactiveDays - retention.inactiveWarnDays);
  const toWarn = await prisma.user.findMany({
    where: { lastActiveAt: { lt: threshold }, inactivityWarnedAt: null, deletionRequestedAt: null, isAdmin: false },
    take: 200,
  });
  for (const u of toWarn) {
    const tr = u.locale === 'tr';
    await sendMail(
      u.email,
      tr ? 'MeetPoint: hesabın silinecek' : 'MeetPoint: your account will be deleted',
      tr
        ? `Merhaba,\n\nHesabına uzun süredir giriş yapılmadı. Kişisel verilerini gereğinden uzun saklamamak için hesabın ${retention.inactiveWarnDays} gün sonra silinecek.\n\nHesabını korumak istiyorsan uygulamaya giriş yapman yeterli.`
        : `Hi,\n\nYou haven't signed in for a long time. So we don't keep your personal data longer than needed, your account will be deleted in ${retention.inactiveWarnDays} days.\n\nTo keep your account, just sign in to the app.`,
    ).catch((e) => console.error('inactive mail', e));
    await prisma.user.update({ where: { id: u.id }, data: { inactivityWarnedAt: new Date() } });
  }
  await log('inactive_warning_sent', toWarn.length);

  const toDelete = await prisma.user.findMany({
    where: {
      inactivityWarnedAt: { lt: ago(retention.inactiveWarnDays) },
      lastActiveAt: { lt: ago(retention.inactiveDays - retention.inactiveWarnDays) },
      isAdmin: false,
      payouts: { none: { status: 'PENDING' } },
    },
    select: { id: true, lastActiveAt: true, inactivityWarnedAt: true },
    take: 200,
  });
  let n = 0;
  // Uyarıdan sonra giriş yapan (lastActiveAt uyarıdan yeni) silinmez: giriş zaten uyarıyı sıfırlar
  for (const u of toDelete) if (u.lastActiveAt < u.inactivityWarnedAt! && (await hardDeleteUser(u.id))) n++;
  return log('account_deleted', n, { reason: 'inactive', inactiveDays: retention.inactiveDays });
}

async function cleanupEmailCodes() {
  const cutoff = ago(retention.emailCodeDays);
  const { count } = await prisma.emailCode.deleteMany({ where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] } });
  return log('email_codes', count);
}

async function cleanupSessions() {
  const cutoff = ago(retention.closedSessionDays);
  const { count } = await prisma.session.deleteMany({ where: { OR: [{ revokedAt: { lt: cutoff } }, { expiresAt: { lt: cutoff } }] } });
  return log('sessions', count);
}

async function cleanupDataExports() {
  const expired = await prisma.dataExport.findMany({ where: { status: 'READY', expiresAt: { lt: new Date() } } });
  for (const x of expired) {
    if (x.path) await privateStore.remove(x.path).catch(() => {});
    await prisma.dataExport.update({ where: { id: x.id }, data: { status: 'EXPIRED', path: '' } });
  }
  return log('data_exports', expired.length);
}

// Açılmadan bekleyen tek seferlik fotoğraflar (açılanlar zaten ilk açılışta silinir)
async function cleanupViewOncePhotos() {
  const stale = await prisma.message.findMany({
    where: { kind: 'photo', viewedAt: null, photoPath: { not: null }, createdAt: { lt: ago(retention.unopenedViewOnceDays) } },
    select: { id: true, photoPath: true },
    take: 500,
  });
  for (const m of stale) {
    await privateStore.remove(m.photoPath!).catch(() => {});
    await prisma.message.update({ where: { id: m.id }, data: { photoPath: null } });
  }
  return log('view_once_photos', stale.length);
}

async function cleanupResolvedErrors() {
  const { count } = await prisma.errorLog.deleteMany({ where: { resolvedAt: { lt: ago(retention.resolvedErrorDays) } } });
  return log('error_logs', count);
}

export async function runRetention() {
  const summary: Record<string, number> = {};
  const jobs: [string, () => Promise<number>][] = [
    ['deletionRequests', deleteRequestedAccounts],
    ['inactiveAccounts', handleInactiveAccounts],
    ['emailCodes', cleanupEmailCodes],
    ['sessions', cleanupSessions],
    ['dataExports', cleanupDataExports],
    ['viewOncePhotos', cleanupViewOncePhotos],
    ['resolvedErrors', cleanupResolvedErrors],
    ['trafficLogs', async () => log('traffic_logs', await purgeOldTraffic(), { days: retention.trafficLogDays })],
  ];
  // Bir iş hata verirse diğerleri yine çalışır
  for (const [name, job] of jobs) {
    try {
      summary[name] = await job();
    } catch (e) {
      console.error(`[imha] ${name}`, e);
      summary[name] = -1;
    }
  }
  return summary;
}
