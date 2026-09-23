import crypto from 'node:crypto';
import { prisma } from './db';

// Hata takibi (harici servis yok): hatalar parmak iziyle gruplanır, yönetim panelinde listelenir.
type ErrorReport = {
  source: 'app' | 'server';
  platform?: string;
  appVersion?: string;
  message: string;
  stack?: string;
  context?: string;
  userId?: string;
};

// Yığındaki değişken kısımları (satır/sütun, bellek adresleri, kimlikler) at: aynı hata aynı iz versin
function fingerprintOf(r: ErrorReport) {
  const firstFrames = (r.stack ?? '').split('\n').slice(0, 4).join('\n');
  const normalized = `${r.source}|${r.message}|${firstFrames}`
    .replace(/:\d+(:\d+)?/g, '')
    .replace(/0x[0-9a-f]+/gi, '')
    .replace(/\b[a-z0-9]{24,}\b/gi, '<id>');
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 40);
}

export async function recordError(r: ErrorReport) {
  const fingerprint = fingerprintOf(r);
  const data = {
    platform: (r.platform ?? '').slice(0, 20),
    appVersion: (r.appVersion ?? '').slice(0, 30),
    context: (r.context ?? '').slice(0, 200),
    lastUserId: r.userId ?? '',
    lastSeen: new Date(),
  };
  try {
    await prisma.errorLog.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        source: r.source,
        message: r.message.slice(0, 1000),
        stack: (r.stack ?? '').slice(0, 8000),
        ...data,
      },
      // Çözüldü işaretlenmiş hata tekrar olursa yeniden açılır
      update: { ...data, count: { increment: 1 }, resolvedAt: null },
    });
  } catch (e) {
    console.error('error log failed', e);
  }
}
